import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { createOpenAIErrorResponse } from '../transformers/response';
import { authenticateRequest } from '../services/auth';

/**
 * OpenAI Model object format
 */
interface OpenAIModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  permission?: any[];
  root?: string;
  parent?: string;
}

/**
 * OpenAI Models list response format
 */
interface OpenAIModelsResponse {
  object: 'list';
  data: OpenAIModel[];
}

export class ModelsHandler {
  private ssmClient: SSMClient;
  private modelCache: { data: OpenAIModel[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(region?: string) {
    this.ssmClient = new SSMClient({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Handles GET /v1/models requests
   */
  async handleModelsRequest(event: APIGatewayProxyEvent, logger?: any): Promise<APIGatewayProxyResult> {
    try {
      // Authenticate request
      const authResult = await authenticateRequest(event, logger);
      if (!authResult.isValid) {
        return this.createErrorResponse(401, authResult.error || 'Authentication failed');
      }

      const models = await this.getAvailableModels();

      const response: OpenAIModelsResponse = {
        object: 'list',
        data: models
      };

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        body: JSON.stringify(response, null, 2)
      };

    } catch (error) {
      console.error('Error in models request:', error);
      return this.createErrorResponse(500, 'Failed to retrieve models');
    }
  }

  /**
   * Gets available models from configuration
   */
  private async getAvailableModels(): Promise<OpenAIModel[]> {
    // Check cache first
    if (this.modelCache && (Date.now() - this.modelCache.timestamp) < this.CACHE_TTL) {
      return this.modelCache.data;
    }

    try {
      // Load model mappings from Parameter Store
      const modelMappings = await this.loadModelMappings();
      const allowedModels = await this.loadAllowedModels();

      // Create OpenAI model objects
      const models: OpenAIModel[] = [];
      const currentTime = Math.floor(Date.now() / 1000);

      // Add models from mappings (these are the OpenAI-compatible names)
      for (const [openaiModel, bedrockModel] of Object.entries(modelMappings)) {
        if (allowedModels.includes(bedrockModel)) {
          models.push({
            id: openaiModel,
            object: 'model',
            created: currentTime,
            owned_by: this.getModelOwner(bedrockModel),
            root: openaiModel,
            parent: undefined
          });
        }
      }

      // Add direct Bedrock models that are allowed
      for (const bedrockModel of allowedModels) {
        // Only add if not already included via mapping
        const alreadyMapped = Object.values(modelMappings).includes(bedrockModel);
        if (!alreadyMapped) {
          models.push({
            id: bedrockModel,
            object: 'model',
            created: currentTime,
            owned_by: this.getModelOwner(bedrockModel),
            root: bedrockModel,
            parent: undefined
          });
        }
      }

      // Sort models by ID for consistent ordering
      models.sort((a, b) => a.id.localeCompare(b.id));

      // Update cache
      this.modelCache = {
        data: models,
        timestamp: Date.now()
      };

      return models;

    } catch (error) {
      console.error('Failed to load model configuration:', error);

      // Return fallback models if configuration loading fails
      return this.getFallbackModels();
    }
  }

  /**
   * Loads model mappings from Parameter Store
   */
  private async loadModelMappings(): Promise<Record<string, string>> {
    try {
      const environment = process.env.ENVIRONMENT || 'dev';
      const parameterName = `/bedrock-openai-proxy/${environment}/model-mappings`;

      const command = new GetParameterCommand({
        Name: parameterName
      });

      const response = await this.ssmClient.send(command);

      if (response.Parameter?.Value) {
        return JSON.parse(response.Parameter.Value);
      }

      return {};
    } catch (error) {
      console.warn('Failed to load model mappings from Parameter Store:', error);
      return this.getDefaultModelMappings();
    }
  }

  /**
   * Loads allowed models from Parameter Store
   */
  private async loadAllowedModels(): Promise<string[]> {
    try {
      const environment = process.env.ENVIRONMENT || 'dev';
      const parameterName = `/bedrock-openai-proxy/${environment}/allowed-models`;

      const command = new GetParameterCommand({
        Name: parameterName
      });

      const response = await this.ssmClient.send(command);

      if (response.Parameter?.Value) {
        return response.Parameter.Value.split(',').map(model => model.trim());
      }

      return [];
    } catch (error) {
      console.warn('Failed to load allowed models from Parameter Store:', error);
      return this.getDefaultAllowedModels();
    }
  }

  /**
   * Gets the owner/provider for a model
   */
  private getModelOwner(modelId: string): string {
    if (modelId.startsWith('anthropic.')) {
      return 'anthropic';
    } else if (modelId.startsWith('amazon.')) {
      return 'amazon';
    } else if (modelId.startsWith('cohere.')) {
      return 'cohere';
    } else if (modelId.startsWith('meta.')) {
      return 'meta';
    } else {
      return 'bedrock';
    }
  }

  /**
   * Default model mappings (fallback)
   */
  private getDefaultModelMappings(): Record<string, string> {
    return {
      'gpt-3.5-turbo': 'anthropic.claude-3-haiku-20240307-v1:0',
      'gpt-4': 'anthropic.claude-3-sonnet-20240229-v1:0',
      'gpt-4-turbo': 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0',
      'claude-3-sonnet': 'anthropic.claude-3-sonnet-20240229-v1:0',
      'claude-3-5-sonnet': 'anthropic.claude-3-5-sonnet-20240620-v1:0'
    };
  }

  /**
   * Default allowed models (fallback)
   */
  private getDefaultAllowedModels(): string[] {
    return [
      'anthropic.claude-3-haiku-20240307-v1:0',
      'anthropic.claude-3-sonnet-20240229-v1:0',
      'anthropic.claude-3-5-sonnet-20240620-v1:0'
    ];
  }

  /**
   * Fallback models when configuration fails
   */
  private getFallbackModels(): OpenAIModel[] {
    const currentTime = Math.floor(Date.now() / 1000);

    return [
      {
        id: 'gpt-3.5-turbo',
        object: 'model',
        created: currentTime,
        owned_by: 'anthropic',
        root: 'gpt-3.5-turbo',
        parent: undefined
      },
      {
        id: 'gpt-4',
        object: 'model',
        created: currentTime,
        owned_by: 'anthropic',
        root: 'gpt-4',
        parent: undefined
      },
      {
        id: 'claude-3-sonnet',
        object: 'model',
        created: currentTime,
        owned_by: 'anthropic',
        root: 'claude-3-sonnet',
        parent: undefined
      }
    ];
  }

  /**
   * Creates an error response
   */
  private createErrorResponse(statusCode: number, message: string): APIGatewayProxyResult {
    const errorResponse = createOpenAIErrorResponse(message);

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      },
      body: JSON.stringify(errorResponse)
    };
  }
}
