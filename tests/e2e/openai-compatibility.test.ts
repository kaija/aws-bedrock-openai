/**
 * End-to-end tests for OpenAI compatibility
 * These tests require a deployed API endpoint and valid AWS credentials
 */

import axios from 'axios';

// Skip these tests unless E2E_TEST_URL is provided
const API_URL = process.env.E2E_TEST_URL;
const API_KEY = process.env.E2E_API_KEY;

const describeE2E = API_URL && API_KEY ? describe : describe.skip;

describeE2E('OpenAI Compatibility E2E Tests', () => {
  const client = axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  describe('Chat Completions API', () => {
    it('should handle basic chat completion', async () => {
      const response = await client.post('/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Say "Hello, World!" and nothing else.' }
        ],
        max_tokens: 10
      });

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: expect.any(String),
        object: 'chat.completion',
        created: expect.any(Number),
        model: expect.any(String),
        choices: expect.arrayContaining([
          expect.objectContaining({
            index: 0,
            message: expect.objectContaining({
              role: 'assistant',
              content: expect.any(String)
            }),
            finish_reason: expect.any(String)
          })
        ]),
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number)
        })
      });
    });

    it('should handle system messages', async () => {
      const response = await client.post('/v1/chat/completions', {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that responds in JSON format.' },
          { role: 'user', content: 'What is 2+2?' }
        ],
        max_tokens: 50
      });

      expect(response.status).toBe(200);
      expect(response.data.choices[0].message.content).toBeTruthy();
    });

    it('should handle temperature parameter', async () => {
      const response = await client.post('/v1/chat/completions', {
        model: 'claude-3-haiku',
        messages: [
          { role: 'user', content: 'Generate a random number between 1 and 10.' }
        ],
        temperature: 0.1,
        max_tokens: 20
      });

      expect(response.status).toBe(200);
      expect(response.data.choices[0].message.content).toBeTruthy();
    });

    it('should handle vision models with images', async () => {
      // Simple 1x1 red pixel PNG in base64
      const redPixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      
      const response = await client.post('/v1/chat/completions', {
        model: 'claude-3-sonnet',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What color is this pixel?' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${redPixelPng}`
                }
              }
            ]
          }
        ],
        max_tokens: 50
      });

      expect(response.status).toBe(200);
      expect(response.data.choices[0].message.content).toBeTruthy();
    });
  });

  describe('Models API', () => {
    it('should list available models', async () => {
      const response = await client.get('/v1/models');

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        object: 'list',
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            object: 'model',
            created: expect.any(Number),
            owned_by: expect.any(String)
          })
        ])
      });

      // Should include common OpenAI model names
      const modelIds = response.data.data.map((model: any) => model.id);
      expect(modelIds).toContain('gpt-3.5-turbo');
      expect(modelIds).toContain('gpt-4');
    });
  });

  describe('Error Handling', () => {
    it('should return 401 for missing authentication', async () => {
      const unauthenticatedClient = axios.create({
        baseURL: API_URL,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      try {
        await unauthenticatedClient.post('/v1/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.error.type).toBe('authentication_error');
      }
    });

    it('should return 400 for invalid request', async () => {
      try {
        await client.post('/v1/chat/completions', {
          model: 'gpt-3.5-turbo',
          // Missing required messages field
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error.type).toBe('invalid_request_error');
      }
    });

    it('should return 404 for unknown endpoints', async () => {
      try {
        await client.get('/v1/unknown-endpoint');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await client.get('/health');

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        environment: expect.any(String)
      });
    });
  });
});