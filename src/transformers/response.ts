import { ClaudeResponse, OpenAIChatCompletionResponse, OpenAIErrorResponse } from '../types';

/**
 * Transforms Claude response to OpenAI format
 * Based on the original claudeToChatgptResponseStream function from sample.ts
 */
export function transformClaudeToOpenAI(claudeResponse: ClaudeResponse, requestModel?: string): OpenAIChatCompletionResponse {
  // Extract text content from Claude response
  const textContent = extractTextContent(claudeResponse.content);

  // Determine finish reason based on Claude's stop reason
  const finishReason = mapClaudeStopReason(claudeResponse.stop_reason);

  const openaiResponse: OpenAIChatCompletionResponse = {
    id: claudeResponse.id || generateChatCompletionId(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: requestModel || claudeResponse.model || 'claude-3-sonnet',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: textContent
        },
        finish_reason: finishReason,
        logprobs: null
      }
    ],
    usage: {
      prompt_tokens: claudeResponse.usage?.input_tokens || 0,
      completion_tokens: claudeResponse.usage?.output_tokens || 0,
      total_tokens: (claudeResponse.usage?.input_tokens || 0) + (claudeResponse.usage?.output_tokens || 0)
    }
  };

  return openaiResponse;
}

/**
 * Extracts text content from Claude's content array
 */
function extractTextContent(content: any[]): string {
  if (!Array.isArray(content) || content.length === 0) {
    return '';
  }

  // Combine all text content blocks
  return content
    .filter(item => item.type === 'text' && item.text)
    .map(item => item.text)
    .join('');
}

/**
 * Maps Claude's stop reason to OpenAI's finish reason
 */
function mapClaudeStopReason(stopReason?: string): 'stop' | 'length' | 'content_filter' | null {
  switch (stopReason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'content_filter':
      return 'content_filter';
    default:
      return 'stop'; // Default to 'stop' for unknown reasons
  }
}

/**
 * Transforms Claude streaming response chunk to OpenAI format
 */
export function transformClaudeStreamChunk(
  chunk: any,
  requestModel?: string,
  messageId?: string
): string {
  const chunkId = messageId || generateChatCompletionId();

  // Handle different types of streaming chunks
  if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
    const streamChunk = {
      id: chunkId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: requestModel || 'claude-3-sonnet',
      choices: [
        {
          index: 0,
          delta: {
            content: chunk.delta.text
          },
          finish_reason: null
        }
      ]
    };

    return `data: ${JSON.stringify(streamChunk)}\n\n`;
  }

  // Handle stream end
  if (chunk.type === 'message_stop') {
    const endChunk = {
      id: chunkId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: requestModel || 'claude-3-sonnet',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }
      ]
    };

    return `data: ${JSON.stringify(endChunk)}\n\ndata: [DONE]\n\n`;
  }

  return ''; // Skip other chunk types
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
 * Transforms AWS Bedrock errors to OpenAI format
 */
export function transformBedrockErrorToOpenAI(error: any): OpenAIErrorResponse {
  const errorName = error.name || error.__type || 'UnknownError';
  const errorMessage = error.message || 'An unknown error occurred';

  switch (errorName) {
    case 'ValidationException':
      return createOpenAIErrorResponse(
        `Invalid request: ${errorMessage}`,
        'invalid_request_error',
        undefined,
        'validation_error'
      );

    case 'AccessDeniedException':
      return createOpenAIErrorResponse(
        'Invalid authentication credentials',
        'authentication_error',
        undefined,
        'invalid_api_key'
      );

    case 'ThrottlingException':
      return createOpenAIErrorResponse(
        'Rate limit exceeded. Please try again later.',
        'rate_limit_exceeded',
        undefined,
        'rate_limit_exceeded'
      );

    case 'ServiceQuotaExceededException':
      return createOpenAIErrorResponse(
        'Service quota exceeded. Please try again later.',
        'rate_limit_exceeded',
        undefined,
        'quota_exceeded'
      );

    case 'InternalServerException':
    case 'InternalFailureException':
      return createOpenAIErrorResponse(
        'Internal server error. Please try again later.',
        'api_error',
        undefined,
        'internal_error'
      );

    case 'ModelNotAvailableException':
    case 'ResourceNotFoundException':
      return createOpenAIErrorResponse(
        `The requested model is not available: ${errorMessage}`,
        'invalid_request_error',
        'model',
        'model_not_found'
      );

    default:
      return createOpenAIErrorResponse(
        `Unexpected error: ${errorMessage}`,
        'api_error',
        undefined,
        'unknown_error'
      );
  }
}

/**
 * Generates a unique chat completion ID
 */
export function generateChatCompletionId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `chatcmpl-${timestamp}${randomStr}`;
}
