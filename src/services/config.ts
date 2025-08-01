import { SSMClient, GetParameterCommand, GetParametersCommand } from '@aws-sdk/client-ssm';

/**
 * Configuration interface
 */
export interface AppConfig {
  domain?: string;
  modelMappings: Record<string, string>;
  allowedModels: string[];
  providerConfig: ProviderConfig;
  defaultProvider: string;
}

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  bedrock: {
    region: string;
    enabled: boolean;
  };
  openai?: {
    apiKey?: string;
    baseUrl?: string;
    enabled: boolean;
  };
  gemini?: {
    apiKey?: string;
    enabled: boolean;
  };
}

/**
 * Configuration service for loading and caching Parameter Store values
 */
export class ConfigService {
  private ssmClient: SSMClient;
  private configCache: { config: AppConfig; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly environment: string;

  constructor(region?: string) {
    this.ssmClient = new SSMClient({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });
    this.environment = process.env.ENVIRONMENT || 'dev';
  }

  /**
   * Gets the complete application configuration
   */
  async getConfig(): Promise<AppConfig> {
    // Check cache first
    if (this.configCache && (Date.now() - this.configCache.timestamp) < this.CACHE_TTL) {
      return this.configCache.config;
    }

    try {
      // Load all configuration parameters
      const [domain, modelMappings, allowedModels, providerConfig, defaultProvider] = await Promise.all([
        this.getDomain(),
        this.getModelMappings(),
        this.getAllowedModels(),
        this.getProviderConfig(),
        this.getDefaultProvider()
      ]);

      const config: AppConfig = {
        domain,
        modelMappings,
        allowedModels,
        providerConfig,
        defaultProvider
      };

      // Update cache
      this.configCache = {
        config,
        timestamp: Date.now()
      };

      return config;

    } catch (error) {
      console.error('Failed to load configuration:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Gets domain configuration
   */
  async getDomain(): Promise<string | undefined> {
    try {
      const parameterName = `/bedrock-openai-proxy/${this.environment}/domain`;
      const command = new GetParameterCommand({ Name: parameterName });
      const response = await this.ssmClient.send(command);
      return response.Parameter?.Value;
    } catch (error) {
      console.warn('Failed to load domain from Parameter Store:', error);
      return undefined;
    }
  }

  /**
   * Gets model mappings configuration
   */
  async getModelMappings(): Promise<Record<string, string>> {
    try {
      const parameterName = `/bedrock-openai-proxy/${this.environment}/model-mappings`;
      const command = new GetParameterCommand({ Name: parameterName });
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
   * Gets allowed models configuration
   */
  async getAllowedModels(): Promise<string[]> {
    try {
      const parameterName = `/bedrock-openai-proxy/${this.environment}/allowed-models`;
      const command = new GetParameterCommand({ Name: parameterName });
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
   * Gets provider configuration
   */
  async getProviderConfig(): Promise<ProviderConfig> {
    try {
      const parameterName = `/bedrock-openai-proxy/${this.environment}/provider-config`;
      const command = new GetParameterCommand({ Name: parameterName });
      const response = await this.ssmClient.send(command);

      if (response.Parameter?.Value) {
        return JSON.parse(response.Parameter.Value);
      }

      return this.getDefaultProviderConfig();
    } catch (error) {
      console.warn('Failed to load provider config from Parameter Store:', error);
      return this.getDefaultProviderConfig();
    }
  }

  /**
   * Gets default provider configuration
   */
  async getDefaultProvider(): Promise<string> {
    try {
      const parameterName = `/bedrock-openai-proxy/${this.environment}/default-provider`;
      const command = new GetParameterCommand({ Name: parameterName });
      const response = await this.ssmClient.send(command);

      return response.Parameter?.Value || 'bedrock';
    } catch (error) {
      console.warn('Failed to load default provider from Parameter Store:', error);
      return 'bedrock';
    }
  }



  /**
   * Loads multiple parameters at once for efficiency
   */
  async loadParametersBatch(parameterNames: string[]): Promise<Record<string, string>> {
    try {
      const command = new GetParametersCommand({
        Names: parameterNames
      });

      const response = await this.ssmClient.send(command);
      const result: Record<string, string> = {};

      if (response.Parameters) {
        for (const param of response.Parameters) {
          if (param.Name && param.Value) {
            result[param.Name] = param.Value;
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to load parameters batch:', error);
      return {};
    }
  }

  /**
   * Invalidates the configuration cache
   */
  invalidateCache(): void {
    this.configCache = null;
  }

  /**
   * Gets default configuration (fallback)
   */
  private getDefaultConfig(): AppConfig {
    return {
      modelMappings: this.getDefaultModelMappings(),
      allowedModels: this.getDefaultAllowedModels(),
      providerConfig: this.getDefaultProviderConfig(),
      defaultProvider: 'bedrock'
    };
  }

  /**
   * Default model mappings
   */
  private getDefaultModelMappings(): Record<string, string> {
    return {
      'gpt-3.5-turbo': 'anthropic.claude-3-haiku-20240307-v1:0',
      'gpt-4': 'anthropic.claude-3-sonnet-20240229-v1:0',
      'gpt-4-turbo': 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      'gpt-4o': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'claude-instant': 'anthropic.claude-instant-v1',
      'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0',
      'claude-3-sonnet': 'anthropic.claude-3-sonnet-20240229-v1:0',
      'claude-3-5-sonnet': 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      'claude-3-5-sonnet-v2': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'claude-3-7-sonnet': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
      'claude-4-sonnet': 'anthropic.claude-sonnet-4-20250514-v1:0',
      'nova-pro': 'amazon.nova-pro-v1:0',
      'nova-lite': 'amazon.nova-lite-v1:0',
      'nova-micro': 'amazon.nova-micro-v1:0'
    };
  }

  /**
   * Default allowed models
   */
  private getDefaultAllowedModels(): string[] {
    return [
      'anthropic.claude-instant-v1',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'anthropic.claude-3-sonnet-20240229-v1:0',
      'anthropic.claude-3-5-sonnet-20240620-v1:0',
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'anthropic.claude-3-7-sonnet-20250219-v1:0',
      'anthropic.claude-sonnet-4-20250514-v1:0',
      'amazon.nova-pro-v1:0',
      'amazon.nova-lite-v1:0',
      'amazon.nova-micro-v1:0'
    ];
  }

  /**
   * Default provider configuration
   */
  private getDefaultProviderConfig(): ProviderConfig {
    return {
      bedrock: {
        region: process.env.AWS_REGION || 'us-east-1',
        enabled: true
      },
      openai: {
        enabled: false
      },
      gemini: {
        enabled: false
      }
    };
  }
}
