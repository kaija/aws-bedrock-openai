import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
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

  constructor(region?: string) {
    this.client = new BedrockRuntimeClient({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Invokes a Bedrock model with the given request
   */
  async invokeModel(
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