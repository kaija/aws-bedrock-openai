import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ChatHandler } from './handlers/chat';

const chatHandler = new ChatHandler();

/**
 * Main Lambda handler - refactored from sample.ts
 * Maintains backward compatibility while providing modular architecture
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent, _context): Promise<APIGatewayProxyResult> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const path = event.path;
  const method = event.httpMethod;

  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      },
      body: ''
    };
  }

  // Route requests based on path
  try {
    if (path === '/v1/chat/completions' && method === 'POST') {
      return await chatHandler.handleChatCompletion(event);
    } else if (path === '/v1/messages' && method === 'POST') {
      // Claude native format for backward compatibility
      return await chatHandler.handleClaudeNative(event);
    } else if (path === '/v1/models' && method === 'GET') {
      // TODO: Implement models endpoint in next task
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          object: 'list',
          data: [
            {
              id: 'anthropic.claude-3-sonnet-20240229-v1:0',
              object: 'model',
              created: Math.floor(Date.now() / 1000),
              owned_by: 'anthropic'
            }
          ]
        })
      };
    } else {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: {
            message: `Path ${path} not found`,
            type: 'invalid_request_error'
          }
        })
      };
    }
  } catch (error) {
    console.error('Unhandled error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: {
          message: 'Internal server error',
          type: 'api_error'
        }
      })
    };
  }
};