import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler } from '../../src/index';

// Mock the services
jest.mock('../../src/services/bedrock');
jest.mock('../../src/services/auth');
jest.mock('../../src/services/provider');

describe('API Integration Tests', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test',
    logStreamName: 'test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS requests', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'OPTIONS',
        path: '/v1/chat/completions',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext, jest.fn()) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      });
    });
  });

  describe('Health check endpoint', () => {
    it('should return health status', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext, jest.fn()) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(200);
      expect(result.headers).toBeDefined();
      expect(result.headers!['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(result.body);
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown paths', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/unknown/path',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext, jest.fn()) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(404);
      
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('not found');
      expect(body.error.type).toBe('invalid_request_error');
    });
  });

  describe('Error handling', () => {
    it('should handle unhandled errors gracefully', async () => {
      // Mock a service to throw an error
      const mockError = new Error('Test error');
      jest.doMock('../../src/handlers/chat', () => ({
        ChatHandler: jest.fn().mockImplementation(() => ({
          handleChatCompletion: jest.fn().mockRejectedValue(mockError)
        }))
      }));

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/v1/chat/completions',
        headers: { 'Content-Type': 'application/json' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        }),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext, jest.fn()) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Internal server error');
      expect(body.error.type).toBe('api_error');
    });
  });
});