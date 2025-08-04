import { APIGatewayProxyEvent } from 'aws-lambda';
import { Logger } from './logger';

/**
 * Authentication result interface
 */
export interface AuthResult {
  isValid: boolean;
  userId?: string;
  error?: string;
  bedrockApiToken?: string;
}

/**
 * Authentication service for Bedrock API Token from Authorization header
 */
export class AuthService {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Authenticates the request by extracting Bedrock API Token from Authorization header
   */
  async authenticate(event: APIGatewayProxyEvent): Promise<AuthResult> {
    try {
      // Extract Bedrock API Token from Authorization header
      const tokenResult = this.extractBedrockApiToken(event);
      if (!tokenResult.isValid) {
        this.logger.logAuth(false, tokenResult.error);
        return tokenResult;
      }

      // Validate Bedrock API token format
      if (!this.validateBedrockTokenFormat(tokenResult.bedrockApiToken!)) {
        this.logger.logAuth(false, 'Invalid Bedrock API token format');
        return {
          isValid: false,
          error: 'Invalid Bedrock API token format'
        };
      }

      this.logger.logAuth(true, 'Bedrock API token successfully validated');

      // Debug: Print the validated token for troubleshooting
      console.log('[DEBUG] AuthService.authenticate - Token validated:', tokenResult.bedrockApiToken!.substring(0, 20) + '...');

      return {
        isValid: true,
        userId: this.extractUserIdFromToken(tokenResult.bedrockApiToken!),
        bedrockApiToken: tokenResult.bedrockApiToken
      };

    } catch (error) {
      this.logger.error('Authentication error', error);
      return {
        isValid: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Extracts Bedrock API Token from the Authorization header
   */
  private extractBedrockApiToken(event: APIGatewayProxyEvent): { isValid: boolean; bedrockApiToken?: string; error?: string } {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader) {
      return {
        isValid: false,
        error: 'Missing Authorization header'
      };
    }

    // Support Bearer token format: "Bearer bedrock-api-key-..."
    if (authHeader.startsWith('Bearer ')) {
      const bedrockApiToken = authHeader.substring(7); // Remove "Bearer " prefix

      // Basic validation - token should not be empty
      if (bedrockApiToken.length > 0) {
        // Debug: Print extracted token for troubleshooting
        console.log('[DEBUG] AuthService.extractBedrockApiToken - Extracted token:', bedrockApiToken.substring(0, 20) + '...');

        return {
          isValid: true,
          bedrockApiToken: bedrockApiToken
        };
      }

      return {
        isValid: false,
        error: 'Empty Bedrock API token'
      };
    }

    return {
      isValid: false,
      error: 'Invalid Authorization header format. Expected Bearer token with Bedrock API key'
    };
  }

  /**
   * Validates Bedrock API token format
   */
  private validateBedrockTokenFormat(token: string): boolean {
    // Basic validation - check if it looks like a Bedrock API token
    // Bedrock API tokens typically start with "bedrock-api-key-" followed by base64-encoded data
    if (token.startsWith('bedrock-api-key-') && token.length > 20) {
      return true;
    }

    // Also accept other formats that might be valid Bedrock tokens
    // This is flexible to accommodate different token formats
    if (token.length >= 10) {
      return true;
    }

    return false;
  }

  /**
   * Extracts a user ID from the Bedrock API token for logging purposes
   */
  private extractUserIdFromToken(token: string): string {
    // For logging purposes, use a hash of the token or a portion of it
    // This avoids logging the full token while providing a unique identifier
    if (token.startsWith('bedrock-api-key-')) {
      return `bedrock-user-${token.substring(16, 26)}...`;
    }
    return `bedrock-user-${token.substring(0, 10)}...`;
  }

  /**
   * Sets the Bedrock API token as an environment variable for the Bedrock client
   */
  setBedrockEnvironment(authResult: AuthResult): void {
    if (authResult.isValid && authResult.bedrockApiToken) {
      // Set the API token as an environment variable for the Bedrock client
      process.env.AWS_BEARER_TOKEN_BEDROCK = authResult.bedrockApiToken;
      this.logger.debug('Bedrock API token set in environment');

      // Debug: Print the token for troubleshooting
      console.log('[DEBUG] AWS_BEARER_TOKEN_BEDROCK set:', authResult.bedrockApiToken.substring(0, 20) + '...');
    }
  }

  /**
   * Gets the Bedrock API token from authentication result
   */
  getBedrockApiToken(authResult: AuthResult): string | undefined {
    return authResult.isValid ? authResult.bedrockApiToken : undefined;
  }

  /**
   * Middleware function for authentication
   */
  static async middleware(
    event: APIGatewayProxyEvent,
    logger?: Logger
  ): Promise<AuthResult> {
    const authService = new AuthService(logger);
    return await authService.authenticate(event);
  }
}

/**
 * Authentication middleware for easy integration
 */
export async function authenticateRequest(
  event: APIGatewayProxyEvent,
  logger?: Logger
): Promise<AuthResult> {
  return await AuthService.middleware(event, logger);
}
