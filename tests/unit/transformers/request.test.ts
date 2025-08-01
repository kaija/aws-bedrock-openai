import { transformOpenAIToClaude, extractSystemMessage, validateOpenAIRequest } from '../../../src/transformers/request';
import { OpenAIMessage } from '../../../src/types';

describe('Request Transformer', () => {
  describe('transformOpenAIToClaude', () => {
    it('should transform simple text messages', () => {
      const openaiMessages: OpenAIMessage[] = [
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you!' }
      ];

      const result = transformOpenAIToClaude(openaiMessages);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        role: 'user',
        content: [{ type: 'text', text: 'Hello, how are you?' }]
      });
      expect(result[1]).toEqual({
        role: 'assistant',
        content: [{ type: 'text', text: 'I am doing well, thank you!' }]
      });
    });

    it('should filter out system messages', () => {
      const openaiMessages: OpenAIMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' }
      ];

      const result = transformOpenAIToClaude(openaiMessages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
    });

    it('should handle complex content with images', () => {
      const openaiMessages: OpenAIMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What do you see?' },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
              }
            }
          ]
        }
      ];

      const result = transformOpenAIToClaude(openaiMessages);

      expect(result).toHaveLength(1);
      expect(result[0].content).toHaveLength(2);
      expect(result[0].content[0]).toEqual({
        type: 'text',
        text: 'What do you see?'
      });
      expect(result[0].content[1]).toEqual({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
        }
      });
    });
  });

  describe('extractSystemMessage', () => {
    it('should extract system message from messages array', () => {
      const messages: OpenAIMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' }
      ];

      const result = extractSystemMessage(messages);

      expect(result).toBe('You are a helpful assistant.');
    });

    it('should return undefined if no system message', () => {
      const messages: OpenAIMessage[] = [
        { role: 'user', content: 'Hello!' }
      ];

      const result = extractSystemMessage(messages);

      expect(result).toBeUndefined();
    });

    it('should handle complex system message content', () => {
      const messages: OpenAIMessage[] = [
        { 
          role: 'system', 
          content: [{ type: 'text', text: 'You are a helpful assistant.' }] as any
        },
        { role: 'user', content: 'Hello!' }
      ];

      const result = extractSystemMessage(messages);

      expect(result).toBeUndefined(); // Should only handle string content
    });
  });

  describe('validateOpenAIRequest', () => {
    it('should validate a correct request', () => {
      const request = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello!' }
        ]
      };

      const result = validateOpenAIRequest(request);

      expect(result.isValid).toBe(true);
    });

    it('should reject request without model', () => {
      const request = {
        messages: [
          { role: 'user', content: 'Hello!' }
        ]
      };

      const result = validateOpenAIRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('model');
    });

    it('should reject request without messages', () => {
      const request = {
        model: 'gpt-3.5-turbo'
      };

      const result = validateOpenAIRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('messages');
    });

    it('should reject request with empty messages array', () => {
      const request = {
        model: 'gpt-3.5-turbo',
        messages: []
      };

      const result = validateOpenAIRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty messages');
    });

    it('should reject request with invalid temperature', () => {
      const request = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello!' }],
        temperature: 3.0
      };

      const result = validateOpenAIRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Temperature');
    });

    it('should reject request with invalid max_tokens', () => {
      const request = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: -1
      };

      const result = validateOpenAIRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('max_tokens');
    });

    it('should validate vision model with images', () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What do you see?' },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
                }
              }
            ]
          }
        ]
      };

      const result = validateOpenAIRequest(request);

      expect(result.isValid).toBe(true);
    });

    it('should reject non-vision model with images', () => {
      const request = {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What do you see?' },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
                }
              }
            ]
          }
        ]
      };

      const result = validateOpenAIRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('does not support vision');
    });
  });
});