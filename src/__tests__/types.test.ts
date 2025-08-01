import {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  ClaudeRequest,
  BedrockConverseRequest,
  ProviderConfig,
  ModelMapping,
  ValidationResult
} from '../types';

describe('Type Definitions', () => {
  test('OpenAI types should be properly structured', () => {
    const request: OpenAIChatCompletionRequest = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Hello' }
      ],
      temperature: 0.7,
      max_tokens: 100
    };

    expect(request.model).toBe('gpt-3.5-turbo');
    expect(request.messages).toHaveLength(1);
    expect(request.temperature).toBe(0.7);
  });

  test('OpenAI response should include all required fields', () => {
    const response: OpenAIChatCompletionResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'gpt-3.5-turbo',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello there!'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 9,
        completion_tokens: 12,
        total_tokens: 21
      }
    };

    expect(response.id).toBe('chatcmpl-123');
    expect(response.choices[0].message.content).toBe('Hello there!');
    expect(response.usage.total_tokens).toBe(21);
  });

  test('Claude types should support vision content', () => {
    const request: ClaudeRequest = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [{
          type: 'text',
          text: 'What is in this image?'
        }, {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: 'base64data...'
          }
        }]
      }]
    };

    expect(request.messages[0].content).toHaveLength(2);
    expect(request.messages[0].content[1].type).toBe('image');
  });

  test('Provider config should define capabilities', () => {
    const config: ProviderConfig = {
      name: 'bedrock',
      region: 'us-east-1',
      models: ['claude-3-sonnet', 'claude-3-haiku'],
      capabilities: {
        streaming: true,
        vision: true,
        tools: false,
        systemMessages: true
      }
    };

    expect(config.capabilities.vision).toBe(true);
    expect(config.models).toContain('claude-3-sonnet');
  });

  test('Model mapping should map OpenAI to provider models', () => {
    const mapping: ModelMapping = {
      'gpt-3.5-turbo': 'anthropic.claude-3-haiku-20240307-v1:0',
      'gpt-4': 'anthropic.claude-3-sonnet-20240229-v1:0'
    };

    expect(mapping['gpt-3.5-turbo']).toBe('anthropic.claude-3-haiku-20240307-v1:0');
  });

  test('Validation result should include error details', () => {
    const result: ValidationResult = {
      isValid: false,
      error: 'Invalid parameter',
      details: {
        parameter: 'temperature',
        value: 3.0,
        expected: 'between 0 and 2'
      }
    };

    expect(result.isValid).toBe(false);
    expect(result.details?.parameter).toBe('temperature');
  });

  test('Bedrock Converse types should support tools', () => {
    const request: BedrockConverseRequest = {
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      messages: [{
        role: 'user',
        content: [{ text: 'What is the weather?' }]
      }],
      toolConfig: {
        tools: [{
          toolSpec: {
            name: 'get_weather',
            description: 'Get current weather',
            inputSchema: {
              json: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                }
              }
            }
          }
        }]
      }
    };

    expect(request.toolConfig?.tools).toHaveLength(1);
    expect(request.toolConfig?.tools[0].toolSpec.name).toBe('get_weather');
  });
});
