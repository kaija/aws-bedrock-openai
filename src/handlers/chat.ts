import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { OpenAIChatCompletionRequest } from '../types';
import { transformOpenAIToClaude, extractSystemMessage, validateOpenAIRequest } from '../transformers/request';
import { transformClaudeToOpenAI, createOpenAIErrorResponse } from '../transformers/response';
import { BedrockService, BedrockError } from '../services/bedrock';
import { authenticateRequest } from '../services/auth';
import { detectProvider, Provider } from '../services/provider';

export class ChatHandler {
  private bedrockService: BedrockService;

  constructor() {
    this.bedrockService = new BedrockService();
  }

  /**
   * Handles chat completion requests
   */
  async handleChatCompletion(event: APIGatewayProxyEvent, logger?: any): Promise<APIGatewayProxyResult> {
    try {
      // Authenticate request
      const authResult = await authenticateRequest(event, logger);
      if (!authResult.isValid) {
        return this.createErrorResponse(401, authResult.error || 'Authentication failed', 'authentication_error');
      }

      // Parse request body
      if (!event.body) {
        return this.createErrorResponse(400, 'Missing request body');
      }

      const body: OpenAIChatCompletionRequest = JSON.parse(event.body);

      // Validate request
      const validation = validateOpenAIRequest(body);
      if (!validation.isValid) {
        return this.createErrorResponse(400, validation.error!);
      }

      // Extract system message and transform messages
      const systemMessage = body.system || extractSystemMessage(body.messages);
      const claudeMessages = transformOpenAIToClaude(body.messages);

      if (claudeMessages.length === 0) {
        return this.createErrorResponse(400, 'No valid messages after transformation');
      }

      // Build Claude request
      const claudeRequest = this.bedrockService.buildClaudeRequest(
        claudeMessages,
        systemMessage,
        body.temperature || 0.5,
        body.max_tokens || 1000,
        body.top_p || 1,
        body.top_k || 250
      );

      // Detect provider and get model mapping
      const providerResult = await detectProvider(body.model, undefined, logger);

      // Currently only support Bedrock provider
      if (providerResult.provider !== Provider.BEDROCK) {
        return this.createErrorResponse(
          400,
          `Provider ${providerResult.provider} is not yet supported. Currently only AWS Bedrock is supported.`,
          'invalid_request_error'
        );
      }

      // Create Bedrock service with authenticated API token
      const bedrockService = new BedrockService(undefined, authResult.bedrockApiToken);

      // Log model invocation
      if (logger) {
        logger.info('Model invocation started', {
          originalModel: body.model,
          mappedModel: providerResult.modelId,
          provider: providerResult.provider,
          confidence: providerResult.confidence
        });
      }

      // Invoke Bedrock
      const claudeResponse = await bedrockService.invokeModel(providerResult.modelId, claudeRequest);

      // Transform response
      const openaiResponse = transformClaudeToOpenAI(claudeResponse, body.model);

      // Log successful completion
      if (logger) {
        logger.logModelInvocation(
          providerResult.modelId,
          providerResult.provider,
          openaiResponse.usage.prompt_tokens,
          openaiResponse.usage.completion_tokens
        );
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        body: JSON.stringify(openaiResponse, null, 2)
      };

    } catch (error) {
      console.error('Error in chat completion:', error);

      // Handle BedrockError specifically
      if (error instanceof BedrockError) {
        return this.createErrorResponse(error.statusCode, error.message, error.errorType);
      }

      // Handle other errors
      return this.createErrorResponse(500, 'Internal server error');
    }
  }

  /**
   * Handles Claude-native requests (for backward compatibility)
   */
  async handleClaudeNative(event: APIGatewayProxyEvent, logger?: any): Promise<APIGatewayProxyResult> {
    try {
      // Authenticate request
      const authResult = await authenticateRequest(event, logger);
      if (!authResult.isValid) {
        return this.createErrorResponse(401, authResult.error || 'Authentication failed', 'authentication_error');
      }

      if (!event.body) {
        return this.createErrorResponse(400, 'Missing request body');
      }

      const body = JSON.parse(event.body);
      const validation = validateOpenAIRequest(body);
      if (!validation.isValid) {
        return this.createErrorResponse(400, validation.error!);
      }

      // For Claude native, pass messages as-is
      const systemMessage = body.system || extractSystemMessage(body.messages);
      const claudeMessages = body.messages.filter((msg: any) => msg.role !== 'system');

      const claudeRequest = this.bedrockService.buildClaudeRequest(
        claudeMessages,
        systemMessage,
        body.temperature || 0.5,
        body.max_tokens || 1000,
        body.top_p || 1,
        body.top_k || 250
      );

      // Detect provider and get model mapping
      const providerResult = await detectProvider(body.model, undefined, logger);

      // Currently only support Bedrock provider
      if (providerResult.provider !== Provider.BEDROCK) {
        return this.createErrorResponse(
          400,
          `Provider ${providerResult.provider} is not yet supported. Currently only AWS Bedrock is supported.`,
          'invalid_request_error'
        );
      }

      // Create Bedrock service with authenticated API token
      const bedrockService = new BedrockService(undefined, authResult.bedrockApiToken);
      const claudeResponse = await bedrockService.invokeModel(providerResult.modelId, claudeRequest);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        body: JSON.stringify(claudeResponse)
      };

    } catch (error) {
      console.error('Error in Claude native request:', error);

      // Handle BedrockError specifically
      if (error instanceof BedrockError) {
        return this.createErrorResponse(error.statusCode, error.message, error.errorType);
      }

      // Handle other errors
      return this.createErrorResponse(500, 'Internal server error');
    }
  }

  /**
   * Creates an error response
   */
  private createErrorResponse(
    statusCode: number,
    message: string,
    errorType: string = 'api_error'
  ): APIGatewayProxyResult {
    const errorResponse = createOpenAIErrorResponse(message, errorType as any);

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      },
      body: JSON.stringify(errorResponse)
    };
  }
}
