import { transformClaudeToOpenAI, createOpenAIErrorResponse, transformBedrockErrorToOpenAI } from '../../../src/transformers/response';
import { ClaudeResponse } from '../../../src/types';

describe('Response Transformer', () => {
  describe('transformClaudeToOpenAI', () => {
    it('should transform Claude response to OpenAI format', () => {
      const claudeResponse: ClaudeResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'anthropic.claude-3-sonnet-20240229-v1:0',
        content: [
          { type: 'text', text: 'Hello! How can I help you today?' }
        ],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 15
        }
      };

      const result = transformClaudeToOpenAI(claudeResponse, 'gpt-3.5-turbo');

      expect(result).toEqual({
        id: 'msg_123',
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finish_reason: 'stop',
            logprobs: null
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      });
    });

    it('should handle empty content', () => {
      const claudeResponse: ClaudeResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'anthropic.claude-3-sonnet-20240229-v1:0',
        content: [],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 0
        }
      };

      const result = transformClaudeToOpenAI(claudeResponse);

      expect(result.choices[0].message.content).toBe('');
      expect(result.usage.completion_tokens).toBe(0);
    });

    it('should handle multiple content blocks', () => {
      const claudeResponse: ClaudeResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'anthropic.claude-3-sonnet-20240229-v1:0',
        content: [
          { type: 'text', text: 'Hello! ' },
          { type: 'text', text: 'How can I help you?' }
        ],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 15
        }
      };

      const result = transformClaudeToOpenAI(claudeResponse);

      expect(result.choices[0].message.content).toBe('Hello! How can I help you?');
    });

    it('should map stop reasons correctly', () => {
      const testCases = [
        { claudeReason: 'end_turn', openaiReason: 'stop' },
        { claudeReason: 'max_tokens', openaiReason: 'length' },
        { claudeReason: 'content_filter', openaiReason: 'content_filter' },
        { claudeReason: 'unknown', openaiReason: 'stop' }
      ];

      testCases.forEach(({ claudeReason, openaiReason }) => {
        const claudeResponse: ClaudeResponse = {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          model: 'anthropic.claude-3-sonnet-20240229-v1:0',
          content: [{ type: 'text', text: 'Test' }],
          stop_reason: claudeReason as 'end_turn' | 'max_tokens' | 'stop_sequence',
          usage: { input_tokens: 5, output_tokens: 5 }
        };

        const result = transformClaudeToOpenAI(claudeResponse);
        expect(result.choices[0].finish_reason).toBe(openaiReason);
      });
    });
  });

  describe('createOpenAIErrorResponse', () => {
    it('should create basic error response', () => {
      const result = createOpenAIErrorResponse('Test error message');

      expect(result).toEqual({
        error: {
          message: 'Test error message',
          type: 'invalid_request_error',
          param: undefined,
          code: undefined
        }
      });
    });

    it('should create error response with all parameters', () => {
      const result = createOpenAIErrorResponse(
        'Test error message',
        'authentication_error',
        'api_key',
        'invalid_key'
      );

      expect(result).toEqual({
        error: {
          message: 'Test error message',
          type: 'authentication_error',
          param: 'api_key',
          code: 'invalid_key'
        }
      });
    });
  });

  describe('transformBedrockErrorToOpenAI', () => {
    it('should transform ValidationException', () => {
      const error = {
        name: 'ValidationException',
        message: 'Invalid model parameter'
      };

      const result = transformBedrockErrorToOpenAI(error);

      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.message).toContain('Invalid request');
      expect(result.error.code).toBe('validation_error');
    });

    it('should transform AccessDeniedException', () => {
      const error = {
        name: 'AccessDeniedException',
        message: 'Access denied'
      };

      const result = transformBedrockErrorToOpenAI(error);

      expect(result.error.type).toBe('authentication_error');
      expect(result.error.code).toBe('invalid_api_key');
    });

    it('should transform ThrottlingException', () => {
      const error = {
        name: 'ThrottlingException',
        message: 'Rate limit exceeded'
      };

      const result = transformBedrockErrorToOpenAI(error);

      expect(result.error.type).toBe('rate_limit_exceeded');
      expect(result.error.code).toBe('rate_limit_exceeded');
    });

    it('should handle unknown errors', () => {
      const error = {
        name: 'UnknownError',
        message: 'Something went wrong'
      };

      const result = transformBedrockErrorToOpenAI(error);

      expect(result.error.type).toBe('api_error');
      expect(result.error.code).toBe('unknown_error');
      expect(result.error.message).toContain('Unexpected error');
    });
  });
});