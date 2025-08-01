import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
  ConverseCommand,
  ConverseCommandInput,
  ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { ClaudeRequest, ClaudeResponse } from '../types';

/**
 * Custom error class for Bedrock-specific errors
 */
export class BedrockError extends Error {
  public readonly statusCode: number;
  public readonly errorType: string;
  public readonly originalError: any;

  constructor(message: string, statusCode: number, errorType: string, originalError?: any) {
    super(message);
    this.name = 'BedrockError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.originalError = originalError;
  }
}

export class BedrockService {
  private client: BedrockRuntimeClient;

  constructor(region?: string, bedrockApiToken?: string) {
    const clientConfig: any = {
      region: region || process.env.AWS_REGION || 'us-east-1',
    };

    // Set the Bedrock API token as environment variable if provided
    if (bedrockApiToken) {
      process.env.AWS_BEARER_TOKEN_BEDROCK = bedrockApiToken;
    }

    // The Bedrock client will automatically use the AWS_BEARER_TOKEN_BEDROCK environment variable
    this.client = new BedrockRuntimeClient(clientConfig);
  }

  /**
   * Invokes a Bedrock model using the Converse API (preferred) or legacy InvokeModel
   */
  async invokeModel(
    modelId: string,
    request: ClaudeRequest
  ): Promise<ClaudeResponse> {
    // Try Converse API first for better standardization
    if (this.supportsConverseAPI(modelId)) {
      return await this.invokeWithConverse(modelId, request);
    }

    // Fallback to legacy InvokeModel API
    return await this.invokeWithLegacyAPI(modelId, request);
  }

  /**
   * Invokes a Bedrock model using the Converse API
   */
  private async invokeWithConverse(
    modelId: string,
    request: ClaudeRequest
  ): Promise<ClaudeResponse> {
    try {
      const converseInput: ConverseCommandInput = {
        modelId,
        messages: this.convertToConverseMessages(request.messages),
        inferenceConfig: {
          temperature: request.temperature,
          maxTokens: request.max_tokens,
          topP: request.top_p,
        }
      };

      // Add system message if present
      if (request.system) {
        converseInput.system = [{ text: request.system }];
      }

      const command = new ConverseCommand(converseInput);
      const response = await this.client.send(command);

      return this.convertFromConverseResponse(response, modelId);

    } catch (error: any) {
      console.error('Converse API invocation error:', error);

      // Handle specific AWS Bedrock errors
      if (error.name === 'ValidationException') {
        // Check if it's the inference profile error
        if (error.message?.includes("on-demand throughput isn't supported")) {
          const alternativeModelId = this.getInferenceProfileId(modelId);
          console.log(`Retrying with alternative model: ${alternativeModelId}`);

          // Retry with alternative model
          try {
            const retryInput: ConverseCommandInput = {
              modelId: alternativeModelId,
              messages: this.convertToConverseMessages(request.messages),
              inferenceConfig: {
                temperature: request.temperature,
                maxTokens: request.max_tokens,
                topP: request.top_p,
              }
            };

            // Add system message if present
            if (request.system) {
              retryInput.system = [{ text: request.system }];
            }

            const retryResponse = await this.client.send(new ConverseCommand(retryInput));
            return this.convertFromConverseResponse(retryResponse, alternativeModelId);

          } catch (retryError: any) {
            console.error('Retry with alternative model failed:', retryError);
            throw new BedrockError(
              `Model ${modelId} is not available. Please try a different model.`,
              400,
              'invalid_request_error',
              retryError
            );
          }
        } else {
          throw new BedrockError(
            `Invalid request: ${error.message}`,
            400,
            'invalid_request_error',
            error
          );
        }
      } else if (error.name === 'AccessDeniedException') {
        throw new BedrockError(
          'Access denied. Please check your AWS credentials and permissions.',
          401,
          'authentication_error',
          error
        );
      } else if (error.name === 'ThrottlingException') {
        throw new BedrockError(
          'Rate limit exceeded. Please try again later.',
          429,
          'rate_limit_exceeded',
          error
        );
      } else if (error.name === 'ServiceQuotaExceededException') {
        throw new BedrockError(
          'Service quota exceeded. Please try again later.',
          429,
          'rate_limit_exceeded',
          error
        );
      } else if (error.name === 'InternalServerException') {
        throw new BedrockError(
          'Internal server error. Please try again later.',
          500,
          'api_error',
          error
        );
      } else {
        // Re-throw BedrockError as-is
        if (error instanceof BedrockError) {
          throw error;
        }

        // Handle unknown errors
        throw new BedrockError(
          `Unexpected error: ${error.message || 'Unknown error'}`,
          500,
          'api_error',
          error
        );
      }
    }
  }

  /**
   * Invokes a Bedrock model using the legacy InvokeModel API
   */
  private async invokeWithLegacyAPI(
    modelId: string,
    request: ClaudeRequest
  ): Promise<ClaudeResponse> {
    const contentType = 'application/json';

    try {
      const inputCommand: InvokeModelCommandInput = {
        modelId,
        contentType,
        accept: contentType,
        body: JSON.stringify(request),
      };

      const command = new InvokeModelCommand(inputCommand);
      const response = await this.client.send(command);

      if (!response.body) {
        throw new BedrockError('Empty response from Bedrock', 500, 'api_error');
      }

      const responseBody = new TextDecoder().decode(response.body);
      return JSON.parse(responseBody) as ClaudeResponse;

    } catch (error: any) {
      console.error('Bedrock invocation error:', error);

      // Handle specific AWS Bedrock errors
      if (error.name === 'ValidationException') {
        // Check if it's the inference profile error
        if (error.message?.includes("on-demand throughput isn't supported")) {
          const inferenceProfileId = this.getInferenceProfileId(modelId);
          console.log(`Retrying with inference profile: ${inferenceProfileId}`);

          // Retry with inference profile
          try {
            const retryCommand: InvokeModelCommandInput = {
              modelId: inferenceProfileId,
              contentType,
              accept: contentType,
              body: JSON.stringify(request),
            };

            const retryResponse = await this.client.send(new InvokeModelCommand(retryCommand));

            if (!retryResponse.body) {
              throw new BedrockError('Empty response from Bedrock on retry', 500, 'api_error');
            }

            const responseBody = new TextDecoder().decode(retryResponse.body);
            return JSON.parse(responseBody) as ClaudeResponse;

          } catch (retryError: any) {
            console.error('Retry with inference profile failed:', retryError);
            throw new BedrockError(
              `Model ${modelId} is not available. Please try a different model.`,
              400,
              'invalid_request_error',
              retryError
            );
          }
        } else {
          throw new BedrockError(
            `Invalid request: ${error.message}`,
            400,
            'invalid_request_error',
            error
          );
        }
      } else if (error.name === 'AccessDeniedException') {
        throw new BedrockError(
          'Access denied. Please check your AWS credentials and permissions.',
          401,
          'authentication_error',
          error
        );
      } else if (error.name === 'ThrottlingException') {
        throw new BedrockError(
          'Rate limit exceeded. Please try again later.',
          429,
          'rate_limit_exceeded',
          error
        );
      } else if (error.name === 'ServiceQuotaExceededException') {
        throw new BedrockError(
          'Service quota exceeded. Please try again later.',
          429,
          'rate_limit_exceeded',
          error
        );
      } else if (error.name === 'InternalServerException') {
        throw new BedrockError(
          'Internal server error. Please try again later.',
          500,
          'api_error',
          error
        );
      } else {
        // Re-throw BedrockError as-is
        if (error instanceof BedrockError) {
          throw error;
        }

        // Handle unknown errors
        throw new BedrockError(
          `Unexpected error: ${error.message || 'Unknown error'}`,
          500,
          'api_error',
          error
        );
      }
    }
  }

  /**
   * Maps OpenAI model names to Bedrock model IDs available in ap-northeast-1
   */
  mapModelId(openaiModel: string): string {
    const modelMappings: Record<string, string> = {
      // OpenAI model mappings to available Bedrock models in ap-northeast-1
      'gpt-3.5-turbo': 'anthropic.claude-3-haiku-20240307-v1:0',
      'gpt-4': 'anthropic.claude-3-sonnet-20240229-v1:0',
      'gpt-4-turbo': 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      'gpt-4o': 'anthropic.claude-3-5-sonnet-20241022-v2:0',

      // Claude model mappings
      'claude-instant': 'anthropic.claude-instant-v1',
      'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0',
      'claude-3-sonnet': 'anthropic.claude-3-sonnet-20240229-v1:0',
      'claude-3-5-sonnet': 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      'claude-3-5-sonnet-v2': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'claude-3-7-sonnet': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
      'claude-4-sonnet': 'anthropic.claude-sonnet-4-20250514-v1:0',

      // Amazon Nova models
      'nova-pro': 'amazon.nova-pro-v1:0',
      'nova-lite': 'amazon.nova-lite-v1:0',
      'nova-micro': 'amazon.nova-micro-v1:0',
    };

    // If it's already a Bedrock model ID, return as-is
    if (openaiModel.startsWith('anthropic.') || openaiModel.startsWith('amazon.')) {
      return openaiModel;
    }

    // Use mapping or default to Claude 3 Sonnet
    return modelMappings[openaiModel] || 'anthropic.claude-3-sonnet-20240229-v1:0';
  }

  /**
   * Checks if a model supports the Converse API
   */
  private supportsConverseAPI(modelId: string): boolean {
    // Converse API is supported by most modern Bedrock models
    const supportedPrefixes = [
      'anthropic.claude-3',
      'anthropic.claude-instant',
      'amazon.nova',
      'cohere.command',
      'meta.llama'
    ];

    return supportedPrefixes.some(prefix => modelId.startsWith(prefix));
  }

  /**
   * Converts Claude messages to Converse API format
   */
  private convertToConverseMessages(messages: any[]): any[] {
    return messages.map(message => ({
      role: message.role,
      content: message.content.map((item: any) => {
        if (item.type === 'text') {
          return { text: item.text };
        } else if (item.type === 'image') {
          return {
            image: {
              format: this.getImageFormat(item.source.media_type),
              source: {
                bytes: Buffer.from(item.source.data, 'base64')
              }
            }
          };
        }
        return item;
      })
    }));
  }

  /**
   * Converts Converse API response to Claude format
   */
  private convertFromConverseResponse(response: ConverseCommandOutput, modelId: string): ClaudeResponse {
    const content = response.output?.message?.content || [];
    const usage = response.usage || {};

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'message',
      role: 'assistant',
      model: modelId,
      content: content.map((item: any) => ({
        type: 'text',
        text: item.text || ''
      })),
      stop_reason: this.mapConverseStopReason(response.stopReason),
      usage: {
        input_tokens: (usage as any)?.inputTokens || 0,
        output_tokens: (usage as any)?.outputTokens || 0
      }
    };
  }

  /**
   * Maps Converse API stop reason to Claude format
   */
  private mapConverseStopReason(stopReason?: string): 'end_turn' | 'max_tokens' | 'stop_sequence' {
    switch (stopReason) {
      case 'end_turn':
        return 'end_turn';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      case 'content_filtered':
        return 'stop_sequence'; // Map content filter to stop_sequence
      default:
        return 'end_turn';
    }
  }

  /**
   * Gets image format from media type
   */
  private getImageFormat(mediaType: string): string {
    switch (mediaType) {
      case 'image/jpeg':
        return 'jpeg';
      case 'image/png':
        return 'png';
      case 'image/gif':
        return 'gif';
      case 'image/webp':
        return 'webp';
      default:
        return 'jpeg';
    }
  }

  /**
   * Gets alternative model ID for retry (since inference profiles aren't available in ap-northeast-1)
   */
  private getInferenceProfileId(modelId: string): string {
    // In ap-northeast-1, we don't have inference profiles, so try alternative models
    const alternativeModels: Record<string, string> = {
      'anthropic.claude-3-haiku-20240307-v1:0': 'anthropic.claude-instant-v1',
      'anthropic.claude-3-sonnet-20240229-v1:0': 'anthropic.claude-3-haiku-20240307-v1:0',
      'anthropic.claude-3-5-sonnet-20240620-v1:0': 'anthropic.claude-3-sonnet-20240229-v1:0',
      'anthropic.claude-3-5-sonnet-20241022-v2:0': 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      'anthropic.claude-3-7-sonnet-20250219-v1:0': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'anthropic.claude-sonnet-4-20250514-v1:0': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
    };

    return alternativeModels[modelId] || 'anthropic.claude-instant-v1';
  }

  /**
   * Builds Claude request from parameters
   */
  buildClaudeRequest(
    messages: any[],
    system?: string,
    temperature: number = 0.5,
    maxTokens: number = 1000,
    topP: number = 1,
    topK: number = 250
  ): ClaudeRequest {
    const request: ClaudeRequest = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      temperature,
      top_k: topK,
      top_p: topP,
      messages
    };

    if (system) {
      request.system = system;
    }

    return request;
  }
}
