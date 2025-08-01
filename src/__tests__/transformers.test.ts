import { transformOpenAIToClaude, extractSystemMessage, validateOpenAIRequest } from '../transformers/request';
import { transformClaudeToOpenAI, createOpenAIErrorResponse } from '../transformers/response';
import { OpenAIMessage, ClaudeResponse } from '../types';

describe('Request Transformers', () => {
  test('transformOpenAIToClaude should handle simple text messages', () => {
    const openaiMessages: OpenAIMessage[] = [
      { role: 'user', content: 'Hello, how are you?' },
      { role: 'assistant', content: 'I am doing well, thank you!' }
    ];

    const result = transformOpenAIToClaude(openaiMessages);

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('user');
    expect(result[0].content[0].type).toBe('text');
    expect(result[0].content[0].text).toBe('Hello, how are you?');
  });

  test('transformOpenAIToClaude should filter out system messages', () => {
    const openaiMessages: OpenAIMessage[] = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' }
    ];

    const result = transformOpenAIToClaude(openaiMessages);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
  });

  test('extractSystemMessage should find system message', () => {
    const openaiMessages: OpenAIMessage[] = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' }
    ];

    const result = extractSystemMessage(openaiMessages);

    expect(result).toBe('You are a helpful assistant');
  });

  test('validateOpenAIRequest should validate required fields', () => {
    const validRequest = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const invalidRequest = {
      model: 'gpt-3.5-turbo'
      // missing messages
    };

    const invalidRoleRequest = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'invalid', content: 'Hello' }]
    };

    const invalidTemperatureRequest = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 3.0 // Invalid: > 2
    };

    expect(validateOpenAIRequest(validRequest).isValid).toBe(true);
    expect(validateOpenAIRequest(invalidRequest).isValid).toBe(false);
    expect(validateOpenAIRequest(invalidRoleRequest).isValid).toBe(false);
    expect(validateOpenAIRequest(invalidTemperatureRequest).isValid).toBe(false);

    // Check error details
    const roleValidation = validateOpenAIRequest(invalidRoleRequest);
    expect(roleValidation.details?.messageIndex).toBe(0);
    expect(roleValidation.details?.role).toBe('invalid');
  });
});

describe('Response Transformers', () => {
  test('transformClaudeToOpenAI should convert Claude response format', () => {
    const claudeResponse: ClaudeResponse = {
      id: 'msg_123',
      type: 'message',
      model: 'claude-3-sonnet',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello there!' }],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 5
      }
    };

    const result = transformClaudeToOpenAI(claudeResponse);

    expect(result.id).toBe('msg_123');
    expect(result.object).toBe('chat.completion');
    expect(result.choices[0].message.content).toBe('Hello there!');
    expect(result.usage.prompt_tokens).toBe(10);
    expect(result.usage.completion_tokens).toBe(5);
    expect(result.usage.total_tokens).toBe(15);
  });

  test('createOpenAIErrorResponse should format errors correctly', () => {
    const result = createOpenAIErrorResponse('Test error', 'invalid_request_error');

    expect(result.error.message).toBe('Test error');
    expect(result.error.type).toBe('invalid_request_error');
  });
});
