import { ClaudeResponse, OpenAIChatCompletionResponse, OpenAIErrorResponse } from '../types';

/**
 * Transforms Claude response to OpenAI format
 * Based on the original claudeToChatgptResponseStream function from sample.ts
 */
export function transformClaudeToOpenAI(claudeResponse: ClaudeResponse): OpenAIChatCompletionResponse {
  const openaiResponse: OpenAIChatCompletionResponse = {
    id: claudeResponse.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000), // Current timestamp in seconds
    model: claudeResponse.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: claudeResponse.content[0]?.text || ''
        },
        finish_reason: 'stop',
        logprobs: null
      }
    ],
    usage: {
      prompt_tokens: claudeResponse.usage.input_tokens,
      completion_tokens: claudeResponse.usage.output_tokens,
      total_tokens: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens
    }
  };

  return openaiResponse;
}

/**
 * Creates an error response in OpenAI format
 */
export function createOpenAIErrorResponse(
  message: string,
  type: OpenAIErrorResponse['error']['type'] = 'invalid_request_error',
  param?: string,
  code?: string
): OpenAIErrorResponse {
  return {
    error: {
      message,
      type,
      param,
      code
    }
  };
}

/**
 * Generates a unique chat completion ID
 */
export function generateChatCompletionId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `chatcmpl-${timestamp}${randomStr}`;
}