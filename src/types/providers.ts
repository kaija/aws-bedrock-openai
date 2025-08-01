// Provider-agnostic types for future extensibility

export interface ProviderMessage {
  role: string;
  content: any;
  name?: string;
}

export interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: any; // Allow provider-specific parameters
}

export interface ProviderResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  [key: string]: any; // Allow provider-specific fields
}

export interface ProviderConfig {
  name: string;
  endpoint?: string;
  apiKey?: string;
  region?: string;
  models: string[];
  capabilities: {
    streaming: boolean;
    vision: boolean;
    tools: boolean;
    systemMessages: boolean;
  };
  defaultModel?: string;
  maxTokens?: number;
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface ProviderFactory {
  createProvider(config: ProviderConfig): Provider;
  getSupportedProviders(): string[];
}

export interface Provider {
  name: string;
  config: ProviderConfig;

  // Core methods
  chatCompletion(request: ProviderRequest): Promise<ProviderResponse>;
  listModels(): Promise<string[]>;
  validateModel(modelId: string): boolean;

  // Optional methods
  streamChatCompletion?(request: ProviderRequest): AsyncIterable<any>;
  getModelInfo?(modelId: string): Promise<any>;
}

// Provider-specific implementations
export interface BedrockProvider extends Provider {
  name: 'bedrock';
  invokeModel(modelId: string, request: any): Promise<any>;
  mapOpenAIToBedrock(request: ProviderRequest): any;
  mapBedrockToOpenAI(response: any): ProviderResponse;
}

export interface OpenAIProvider extends Provider {
  name: 'openai';
  apiKey: string;
  baseURL?: string;
}

export interface GeminiProvider extends Provider {
  name: 'gemini';
  apiKey: string;
  projectId?: string;
}
