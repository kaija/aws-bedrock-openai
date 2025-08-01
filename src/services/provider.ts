import { ConfigService, AppConfig } from './config';
import { Logger } from './logger';

/**
 * Supported providers
 */
export enum Provider {
  BEDROCK = 'bedrock',
  OPENAI = 'openai',
  GEMINI = 'gemini'
}

/**
 * Provider detection result
 */
export interface ProviderResult {
  provider: Provider;
  modelId: string;
  originalModel: string;
  confidence: number; // 0-1 confidence score
}

/**
 * Provider detection and routing service
 */
export class ProviderService {
  private configService: ConfigService;
  private logger: Logger;
  private config: AppConfig | null = null;

  constructor(region?: string, logger?: Logger) {
    this.configService = new ConfigService(region);
    this.logger = logger || new Logger();
  }

  /**
   * Detects the appropriate provider for a given model
   */
  async detectProvider(modelName: string): Promise<ProviderResult> {
    try {
      // Load configuration if not cached
      if (!this.config) {
        this.config = await this.configService.getConfig();
      }

      // Check explicit model mappings first
      const mappedModel = this.config.modelMappings[modelName];
      if (mappedModel) {
        const provider = this.getProviderFromModelId(mappedModel);

        this.logger.debug('Provider detected from model mapping', {
          originalModel: modelName,
          mappedModel,
          provider,
          confidence: 1.0
        });

        return {
          provider,
          modelId: mappedModel,
          originalModel: modelName,
          confidence: 1.0
        };
      }

      // Check if the model name is already a provider-specific model ID
      if (this.isBedrockModelId(modelName)) {
        this.logger.debug('Direct Bedrock model ID detected', {
          originalModel: modelName,
          provider: Provider.BEDROCK,
          confidence: 1.0
        });

        return {
          provider: Provider.BEDROCK,
          modelId: modelName,
          originalModel: modelName,
          confidence: 1.0
        };
      }

      // Pattern-based detection for unknown models
      const patternResult = this.detectByPattern(modelName);
      if (patternResult) {
        this.logger.debug('Provider detected by pattern', {
          originalModel: modelName,
          provider: patternResult.provider,
          modelId: patternResult.modelId,
          confidence: patternResult.confidence
        });

        return patternResult;
      }

      // Fallback to default provider
      const defaultProvider = this.config.defaultProvider as Provider || Provider.BEDROCK;
      const fallbackModel = this.getFallbackModel(defaultProvider, modelName);

      this.logger.warn('Using fallback provider', {
        originalModel: modelName,
        provider: defaultProvider,
        fallbackModel,
        confidence: 0.3
      });

      return {
        provider: defaultProvider,
        modelId: fallbackModel,
        originalModel: modelName,
        confidence: 0.3
      };

    } catch (error) {
      this.logger.error('Provider detection failed', error, { modelName });

      // Emergency fallback
      return {
        provider: Provider.BEDROCK,
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        originalModel: modelName,
        confidence: 0.1
      };
    }
  }

  /**
   * Gets the provider from a model ID
   */
  private getProviderFromModelId(modelId: string): Provider {
    if (modelId.startsWith('anthropic.') || modelId.startsWith('amazon.') ||
        modelId.startsWith('cohere.') || modelId.startsWith('meta.')) {
      return Provider.BEDROCK;
    }

    if (modelId.startsWith('gpt-') || modelId.startsWith('text-') ||
        modelId.startsWith('davinci') || modelId.startsWith('curie')) {
      return Provider.OPENAI;
    }

    if (modelId.startsWith('gemini-') || modelId.startsWith('palm-')) {
      return Provider.GEMINI;
    }

    return Provider.BEDROCK; // Default fallback
  }

  /**
   * Checks if a model name is a Bedrock model ID
   */
  private isBedrockModelId(modelName: string): boolean {
    const bedrockPrefixes = [
      'anthropic.',
      'amazon.',
      'cohere.',
      'meta.',
      'mistral.',
      'stability.'
    ];

    return bedrockPrefixes.some(prefix => modelName.startsWith(prefix));
  }

  /**
   * Detects provider by model name patterns
   */
  private detectByPattern(modelName: string): ProviderResult | null {
    // OpenAI patterns
    const openaiPatterns = [
      /^gpt-[0-9]/,
      /^text-/,
      /^davinci/,
      /^curie/,
      /^babbage/,
      /^ada/,
      /^whisper/,
      /^dall-e/
    ];

    for (const pattern of openaiPatterns) {
      if (pattern.test(modelName)) {
        return {
          provider: Provider.OPENAI,
          modelId: modelName,
          originalModel: modelName,
          confidence: 0.8
        };
      }
    }

    // Claude patterns (map to Bedrock)
    const claudePatterns = [
      /^claude-/,
      /^anthropic/
    ];

    for (const pattern of claudePatterns) {
      if (pattern.test(modelName)) {
        const bedrockModel = this.mapClaudeModelToBedrock(modelName);
        return {
          provider: Provider.BEDROCK,
          modelId: bedrockModel,
          originalModel: modelName,
          confidence: 0.9
        };
      }
    }

    // Gemini patterns
    const geminiPatterns = [
      /^gemini-/,
      /^palm-/,
      /^bison/
    ];

    for (const pattern of geminiPatterns) {
      if (pattern.test(modelName)) {
        return {
          provider: Provider.GEMINI,
          modelId: modelName,
          originalModel: modelName,
          confidence: 0.8
        };
      }
    }

    return null;
  }

  /**
   * Maps Claude model names to Bedrock model IDs
   */
  private mapClaudeModelToBedrock(modelName: string): string {
    const claudeMappings: Record<string, string> = {
      'claude-instant': 'anthropic.claude-instant-v1',
      'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0',
      'claude-3-sonnet': 'anthropic.claude-3-sonnet-20240229-v1:0',
      'claude-3-opus': 'anthropic.claude-3-opus-20240229-v1:0',
      'claude-3-5-sonnet': 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      'claude-3-5-sonnet-v2': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'claude-3-7-sonnet': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
      'claude-4-sonnet': 'anthropic.claude-sonnet-4-20250514-v1:0'
    };

    return claudeMappings[modelName] || 'anthropic.claude-3-sonnet-20240229-v1:0';
  }

  /**
   * Gets a fallback model for the given provider
   */
  private getFallbackModel(provider: Provider, _originalModel: string): string {
    switch (provider) {
      case Provider.BEDROCK:
        return 'anthropic.claude-3-haiku-20240307-v1:0';
      case Provider.OPENAI:
        return 'gpt-3.5-turbo';
      case Provider.GEMINI:
        return 'gemini-pro';
      default:
        return 'anthropic.claude-3-haiku-20240307-v1:0';
    }
  }

  /**
   * Checks if a provider is enabled
   */
  async isProviderEnabled(provider: Provider): Promise<boolean> {
    if (!this.config) {
      this.config = await this.configService.getConfig();
    }

    switch (provider) {
      case Provider.BEDROCK:
        return this.config.providerConfig.bedrock?.enabled ?? true;
      case Provider.OPENAI:
        return this.config.providerConfig.openai?.enabled ?? false;
      case Provider.GEMINI:
        return this.config.providerConfig.gemini?.enabled ?? false;
      default:
        return false;
    }
  }

  /**
   * Gets available providers
   */
  async getAvailableProviders(): Promise<Provider[]> {
    const providers: Provider[] = [];

    for (const provider of Object.values(Provider)) {
      if (await this.isProviderEnabled(provider)) {
        providers.push(provider);
      }
    }

    return providers;
  }

  /**
   * Middleware function for provider detection
   */
  static async middleware(
    modelName: string,
    region?: string,
    logger?: Logger
  ): Promise<ProviderResult> {
    const providerService = new ProviderService(region, logger);
    return await providerService.detectProvider(modelName);
  }
}

/**
 * Provider detection middleware for easy integration
 */
export async function detectProvider(
  modelName: string,
  region?: string,
  logger?: Logger
): Promise<ProviderResult> {
  return await ProviderService.middleware(modelName, region, logger);
}
