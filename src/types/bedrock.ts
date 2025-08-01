// AWS Bedrock Types

// Claude Legacy API (InvokeModel)
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: ClaudeMessageContent[];
}

export interface ClaudeMessageContent {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export interface ClaudeRequest {
  anthropic_version: string;
  max_tokens: number;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  stop_sequences?: string[];
  system?: string;
  messages: ClaudeMessage[];
  stream?: boolean;
}

export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: ClaudeContentBlock[];
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence?: string;
  usage: ClaudeUsage;
}

export interface ClaudeContentBlock {
  type: 'text';
  text: string;
}

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
}

// Bedrock Converse API (Recommended)
export interface BedrockConverseRequest {
  modelId: string;
  messages: BedrockMessage[];
  system?: BedrockSystemMessage[];
  inferenceConfig?: BedrockInferenceConfig;
  toolConfig?: BedrockToolConfig;
  guardrailConfig?: BedrockGuardrailConfig;
}

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: BedrockContentBlock[];
}

export interface BedrockContentBlock {
  text?: string;
  image?: {
    format: 'png' | 'jpeg' | 'gif' | 'webp';
    source: {
      bytes: Uint8Array;
    };
  };
  toolUse?: {
    toolUseId: string;
    name: string;
    input: Record<string, any>;
  };
  toolResult?: {
    toolUseId: string;
    content: BedrockContentBlock[];
    status?: 'success' | 'error';
  };
}

export interface BedrockSystemMessage {
  text: string;
}

export interface BedrockInferenceConfig {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface BedrockToolConfig {
  tools: BedrockTool[];
  toolChoice?: BedrockToolChoice;
}

export interface BedrockTool {
  toolSpec: {
    name: string;
    description: string;
    inputSchema: {
      json: Record<string, any>;
    };
  };
}

export interface BedrockToolChoice {
  auto?: {};
  any?: {};
  tool?: {
    name: string;
  };
}

export interface BedrockGuardrailConfig {
  guardrailIdentifier: string;
  guardrailVersion: string;
  trace?: 'enabled' | 'disabled';
}

export interface BedrockConverseResponse {
  output: {
    message: BedrockMessage;
  };
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'guardrail_intervened';
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  metrics: {
    latencyMs: number;
  };
}

// Bedrock Error Types
export interface BedrockError {
  __type: string;
  message: string;
}

// Model Information
export interface BedrockModelInfo {
  modelId: string;
  modelName: string;
  providerName: string;
  inputModalities: ('TEXT' | 'IMAGE')[];
  outputModalities: ('TEXT' | 'IMAGE')[];
  responseStreamingSupported: boolean;
  customizationsSupported: string[];
  inferenceTypesSupported: ('ON_DEMAND' | 'PROVISIONED')[];
}
