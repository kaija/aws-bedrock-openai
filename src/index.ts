import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ChatHandler } from './handlers/chat';
import { ModelsHandler } from './handlers/models';
import { Logger, createTimer } from './services/logger';

const chatHandler = new ChatHandler();
const modelsHandler = new ModelsHandler();

/**
 * Main Lambda handler - refactored from sample.ts
 * Maintains backward compatibility while providing modular architecture
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent, context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  const logger = Logger.withContext(requestId);
  const timer = createTimer(logger);

  const path = event.path;
  const method = event.httpMethod;

  // Extract model from request body for logging
  let requestModel: string | undefined;
  try {
    if (event.body) {
      const body = JSON.parse(event.body);
      requestModel = body.model;
    }
  } catch {
    // Ignore parsing errors for logging
  }

  logger.logRequestStart(method, path, requestModel);

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
    let result: APIGatewayProxyResult;

    if (path === '/v1/chat/completions' && method === 'POST') {
      result = await chatHandler.handleChatCompletion(event, logger);
    } else if (path === '/v1/messages' && method === 'POST') {
      // Claude native format for backward compatibility
      result = await chatHandler.handleClaudeNative(event, logger);
    } else if (path === '/v1/models' && method === 'GET') {
      result = await modelsHandler.handleModelsRequest(event, logger);
    } else if (path === '/health' && method === 'GET') {
      // Health check endpoint
      result = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.ENVIRONMENT || 'dev'
        })
      };
    } else {
      result = {
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

    // Log request completion
    const duration = timer.end('API request');
    logger.logRequestEnd(method, path, result.statusCode, duration, requestModel);

    return result;

  } catch (error) {
    logger.error('Unhandled error in request handler', error);

    const errorResult = {
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

    const duration = timer.end('API request (error)');
    logger.logRequestEnd(method, path, errorResult.statusCode, duration, requestModel);

    return errorResult;
  }
};
