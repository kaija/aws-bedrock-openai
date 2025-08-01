// Configuration and system types

export interface ModelMapping {
  [openaiModel: string]: string; // Maps OpenAI model names to provider model IDs
}

export interface ProxyConfig {
  domain: string;
  modelMappings: ModelMapping;
  allowedModels: string[];
  defaultProvider: string;
  providers: {
    [providerName: string]: import('./providers').ProviderConfig;
  };
  cors?: {
    allowOrigin: string;
    allowHeaders: string;
    allowMethods: string;
    maxAge: number;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    maskSensitiveData: boolean;
  };
  rateLimit?: {
    enabled: boolean;
    requestsPerMinute: number;
    burstLimit: number;
  };
}

export interface ParameterStoreConfig {
  domain: string;
  modelMappings: string; // JSON string
  allowedModels: string; // Comma-separated string
  providerConfig: string; // JSON string
  defaultProvider: string;
}

export interface RuntimeConfig {
  environment: string;
  region: string;
  parameterPrefix: string;
  cacheTimeout: number;
}

// Authentication Types
export interface AuthContext {
  accessKey?: string;
  secretKey?: string;
  sessionToken?: string;
  region?: string;
  provider: string;
  userId?: string;
}

export interface AuthResult {
  isValid: boolean;
  context?: AuthContext;
  error?: string;
  statusCode?: number;
}

// Validation Types
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: Record<string, any>;
}

export interface RequestValidation {
  model: ValidationResult;
  messages: ValidationResult;
  parameters: ValidationResult;
  authentication: ValidationResult;
}

// Middleware Types
export interface MiddlewareContext {
  request: import('./openai').OpenAIChatCompletionRequest;
  provider: string;
  modelId: string;
  authContext: AuthContext;
  startTime: number;
  requestId: string;
  userAgent?: string;
  clientIp?: string;
}

export interface MiddlewareResult {
  success: boolean;
  context?: MiddlewareContext;
  error?: string;
  statusCode?: number;
  headers?: Record<string, string>;
}

// Logging Types
export interface LogContext {
  requestId: string;
  provider: string;
  model: string;
  userId?: string;
  duration?: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  error?: string;
}

export interface MetricsData {
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  tokenUsage: {
    total: number;
    byModel: Record<string, number>;
  };
  providerUsage: Record<string, number>;
}
