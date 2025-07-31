import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { ClaudeRequest, ClaudeResponse } from '../types';

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
    
    const inputCommand: InvokeModelCommandInput = {
      modelId,
      contentType,
      accept: contentType,
      body: JSON.stringify(request),
    };

    const command = new InvokeModelCommand(inputCommand);
    const response = await this.client.send(command);
    
    if (!response.body) {
      throw new Error('Empty response from Bedrock');
    }

    const responseBody = new TextDecoder().decode(response.body);
    return JSON.parse(responseBody) as ClaudeResponse;
  }

  /**
   * Maps OpenAI model names to Bedrock model IDs
   */
  mapModelId(openaiModel: string): string {
    // Default mapping - can be enhanced with configuration
    if (openaiModel.startsWith('anthropic')) {
      return openaiModel;
    }
    
    // Default to Claude 3 Sonnet
    return 'anthropic.claude-3-sonnet-20240229-v1:0';
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