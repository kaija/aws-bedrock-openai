#!/usr/bin/env node

/**
 * Bedrock OpenAI Proxy - Node.js Direct AWS SDK Example
 * 
 * This example demonstrates how to use the AWS SDK directly to call Bedrock
 * using the same credential flow as the proxy service.
 */

const { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

/**
 * Direct Bedrock client using the same credential pattern as the proxy
 */
class DirectBedrockClient {
    constructor(region = 'ap-northeast-1', bedrockApiToken = null) {
        // Set the Bedrock API token as environment variable (same as proxy)
        if (bedrockApiToken) {
            process.env.AWS_BEARER_TOKEN_BEDROCK = bedrockApiToken;
            console.log('✅ Set AWS_BEARER_TOKEN_BEDROCK environment variable');
        }

        // Create Bedrock client (AWS SDK will automatically use the environment variable)
        this.client = new BedrockRuntimeClient({
            region: region
        });

        this.region = region;
        console.log(`🚀 Initialized Bedrock client for region: ${region}`);
    }

    /**
     * Call Bedrock using the modern Converse API (recommended)
     */
    async callConverseAPI(modelId, messages, options = {}) {
        const {
            maxTokens = 1000,
            topP = 1.0,
            systemMessage = null
        } = options;

        console.log(`📞 Calling Converse API with model: ${modelId}`);

        try {
            const input = {
                modelId: modelId,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: [{ text: msg.content }]
                })),
                inferenceConfig: {
                    temperature: temperature,
                    maxTokens: maxTokens,
                    topP: topP
                }
            };

            // Add system message if provided
            if (systemMessage) {
                input.system = [{ text: systemMessage }];
            }

            const command = new ConverseCommand(input);
            const response = await this.client.send(command);

            console.log('✅ Converse API call successful');
            return this.formatConverseResponse(response, modelId);

        } catch (error) {
            console.error('❌ Converse API call failed:', error.message);
            throw this.handleBedrockError(error);
        }
    }

    /**
     * Call Bedrock using the legacy InvokeModel API
     */
    async callLegacyAPI(modelId, claudeRequest) {
        console.log(`📞 Calling Legacy API with model: ${modelId}`);

        try {
            const input = {
                modelId: modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify(claudeRequest)
            };

            const command = new InvokeModelCommand(input);
            const response = await this.client.send(command);

            if (!response.body) {
                throw new Error('Empty response from Bedrock');
            }

            const responseBody = new TextDecoder().decode(response.body);
            const parsedResponse = JSON.parse(responseBody);

            console.log('✅ Legacy API call successful');
            return parsedResponse;

        } catch (error) {
            console.error('❌ Legacy API call failed:', error.message);
            throw this.handleBedrockError(error);
        }
    }

    /**
     * Smart model invocation - automatically chooses best API
     */
    async invokeModel(modelId, messages, options = {}) {
        // Check if model supports Converse API
        if (this.supportsConverseAPI(modelId)) {
            return await this.callConverseAPI(modelId, messages, options);
        } else {
            // Convert to Claude format for legacy API
            const claudeRequest = this.convertToClaudeFormat(messages, options);
            return await this.callLegacyAPI(modelId, claudeRequest);
        }
    }

    /**
     * Check if model supports Converse API
     */
    supportsConverseAPI(modelId) {
        const supportedPrefixes = [
            'anthropic.claude-3',
            'anthropic.claude-instant',
            'amazon.nova',
            'cohere.command',
            'meta.llama'
        ];
        return supportedPrefixes.some(prefix => modelId.startsWith(prefix));
    }

    /**
     * Convert messages to Claude format for legacy API
     */
    convertToClaudeFormat(messages, options) {
        const {
            temperature = 0.7,
            maxTokens = 1000,
            topP = 1.0,
            topK = 250,
            systemMessage = null
        } = options;

        const claudeRequest = {
            anthropic_version: 'bedrock-2023-05-31',
            temperature: temperature,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        };

        if (systemMessage) {
            claudeRequest.system = systemMessage;
        }

        return claudeRequest;
    }

    /**
     * Format Converse API response to consistent format
     */
    formatConverseResponse(response, modelId) {
        const content = response.output?.message?.content || [];
        const usage = response.usage || {};

        return {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'message',
            role: 'assistant',
            model: modelId,
            content: content.map(item => ({
                type: 'text',
                text: item.text || ''
            })),
            stop_reason: this.mapStopReason(response.stopReason),
            usage: {
                input_tokens: usage.inputTokens || 0,
                output_tokens: usage.outputTokens || 0,
                total_tokens: (usage.inputTokens || 0) + (usage.outputTokens || 0)
            }
        };
    }

    /**
     * Map stop reasons to consistent format
     */
    mapStopReason(stopReason) {
        const mapping = {
            'end_turn': 'end_turn',
            'max_tokens': 'max_tokens',
            'stop_sequence': 'stop_sequence',
            'content_filtered': 'stop_sequence'
        };
        return mapping[stopReason] || 'end_turn';
    }

    /**
     * Handle Bedrock errors with proper error mapping
     */
    handleBedrockError(error) {
        const errorMappings = {
            'ValidationException': {
                message: `Invalid request: ${error.message}`,
                statusCode: 400,
                type: 'invalid_request_error'
            },
            'AccessDeniedException': {
                message: 'Access denied. Please check your AWS credentials and permissions.',
                statusCode: 401,
                type: 'authentication_error'
            },
            'ThrottlingException': {
                message: 'Rate limit exceeded. Please try again later.',
                statusCode: 429,
                type: 'rate_limit_exceeded'
            },
            'ServiceQuotaExceededException': {
                message: 'Service quota exceeded. Please try again later.',
                statusCode: 429,
                type: 'rate_limit_exceeded'
            },
            'InternalServerException': {
                message: 'Internal server error. Please try again later.',
                statusCode: 500,
                type: 'api_error'
            }
        };

        const errorInfo = errorMappings[error.name] || {
            message: `Unexpected error: ${error.message}`,
            statusCode: 500,
            type: 'api_error'
        };

        const customError = new Error(errorInfo.message);
        customError.statusCode = errorInfo.statusCode;
        customError.type = errorInfo.type;
        customError.originalError = error;

        return customError;
    }

    /**
     * List available models (requires additional permissions)
     */
    async listModels() {
        console.log('📋 Listing available models...');
        
        // Note: This would require bedrock:ListFoundationModels permission
        // For this example, we'll return the commonly available models
        const availableModels = [
            'anthropic.claude-instant-v1',
            'anthropic.claude-3-haiku-20240307-v1:0',
            'anthropic.claude-3-sonnet-20240229-v1:0',
            'anthropic.claude-3-5-sonnet-20240620-v1:0',
            'anthropic.claude-3-5-sonnet-20241022-v2:0',
            'amazon.nova-pro-v1:0',
            'amazon.nova-lite-v1:0',
            'amazon.nova-micro-v1:0'
        ];

        return availableModels.map(modelId => ({
            id: modelId,
            object: 'model',
            created: Date.now(),
            owned_by: 'aws-bedrock'
        }));
    }
}

/**
 * Example usage and demonstrations
 */
async function runExamples() {
    console.log('🚀 Bedrock Direct AWS SDK Examples\n');

    // Configuration - replace with your actual values
    const BEDROCK_API_TOKEN = process.env.AWS_BEARER_TOKEN_BEDROCK || 'bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......';
    const REGION = process.env.AWS_REGION || 'ap-northeast-1';

    if (BEDROCK_API_TOKEN === 'bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......') {
        console.log('⚠️  Please set your Bedrock API token in the AWS_BEARER_TOKEN_BEDROCK environment variable');
        console.log('   export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-..."');
        return;
    }

    // Initialize client
    const client = new DirectBedrockClient(REGION, BEDROCK_API_TOKEN);

    try {
        // Example 1: List available models
        console.log('📋 Example 1: List Available Models');
        const models = await client.listModels();
        console.log(`Found ${models.length} models:`);
        models.forEach(model => console.log(`  - ${model.id}`));
        console.log('');

        // Example 2: Simple chat with Converse API
        console.log('💬 Example 2: Simple Chat (Converse API)');
        const messages = [
            { role: 'user', content: 'Hello! Can you tell me about AWS Bedrock in 2 sentences?' }
        ];

        const response1 = await client.invokeModel(
            'apac.amazon.nova-pro-v1:0',
            messages,
            { temperature: 0.7, maxTokens: 200 }
        );

        console.log('Response:', response1.content[0].text);
        console.log('Usage:', response1.usage);
        console.log('');

        // Example 3: Chat with system message
        console.log('🎭 Example 3: Chat with System Message');
        const systemMessage = 'You are a helpful AWS expert assistant. Be concise and technical.';
        const messages2 = [
            { role: 'user', content: 'What are the benefits of using AWS Bedrock over direct model APIs?' }
        ];

        const response2 = await client.invokeModel(
            'apac.amazon.nova-pro-v1:0',
            messages2,
            { 
                temperature: 0.5, 
                maxTokens: 300,
                systemMessage: systemMessage
            }
        );

        console.log('Response:', response2.content[0].text);
        console.log('Usage:', response2.usage);
        console.log('');

    } catch (error) {
        console.error('❌ Example failed:', error.message);
        if (error.name === 'AccessDeniedException') {
            console.error('💡 Make sure your Bedrock API token has the required permissions:');
            console.error('   - bedrock:InvokeModel');
            console.error('   - bedrock:InvokeModelWithResponseStream');
        }
    }
}

/**
 * Utility function to demonstrate credential setup
 */
function demonstrateCredentialSetup() {
    console.log('🔐 Credential Setup Demonstration\n');
    
    console.log('1. Set your Bedrock API token as environment variable:');
    console.log('   export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......"');
    console.log('');
    
    console.log('2. The AWS SDK will automatically use this environment variable');
    console.log('   when making Bedrock API calls');
    console.log('');
    
    console.log('3. Current environment status:');
    console.log(`   AWS_BEARER_TOKEN_BEDROCK: ${process.env.AWS_BEARER_TOKEN_BEDROCK ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'Not set (will use ap-northeast-1)'}`);
    console.log('');
}

// Main execution
if (require.main === module) {
    demonstrateCredentialSetup();
    runExamples().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { DirectBedrockClient };
