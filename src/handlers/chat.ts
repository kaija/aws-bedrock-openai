import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { OpenAIChatCompletionRequest } from '../types';
import { transformOpenAIToClaude, extractSystemMessage, validateOpenAIRequest } from '../transformers/request';
import { transformClaudeToOpenAI, createOpenAIErrorResponse } from '../transformers/response';
import { BedrockService } from '../services/bedrock';

export class ChatHandler {
  private bedrockService: BedrockService;

  constructor() {
    this.bedrockService = new BedrockService();
  }

  /**
   * Handles chat completion requests
   */
  async handleChatCompletion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
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

      // Map model ID
      const modelId = this.bedrockService.mapModelId(body.model);

      // Invoke Bedrock
      const claudeResponse = await this.bedrockService.invokeModel(modelId, claudeRequest);

      // Transform response
      const openaiResponse = transformClaudeToOpenAI(claudeResponse);

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
      return this.createErrorResponse(500, 'Internal server error');
    }
  }

  /**
   * Handles Claude-native requests (for backward compatibility)
   */
  async handleClaudeNative(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
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

      const modelId = this.bedrockService.mapModelId(body.model);
      const claudeResponse = await this.bedrockService.invokeModel(modelId, claudeRequest);

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
      return this.createErrorResponse(500, 'Internal server error');
    }
  }

  /**
   * Creates an error response
   */
  private createErrorResponse(statusCode: number, message: string): APIGatewayProxyResult {
    const errorResponse = createOpenAIErrorResponse(message);
    
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