#!/usr/bin/env node

/**
 * Local Lambda Function Tester
 * 
 * This script directly invokes the Lambda handler function locally
 * to test Bedrock API connectivity without deploying to AWS.
 */

const { handler } = require('../dist/index.js');

// Mock AWS Lambda context
const createMockContext = () => ({
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'bedrock-openai-proxy-local-test',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:local:123456789012:function:bedrock-openai-proxy-local-test',
    memoryLimitInMB: '1024',
    awsRequestId: `local-test-${Date.now()}`,
    logGroupName: '/aws/lambda/bedrock-openai-proxy-local-test',
    logStreamName: `local-test-stream-${Date.now()}`,
    getRemainingTimeInMillis: () => 30000,
    done: (error, result) => {
        if (error) {
            console.error('Lambda done with error:', error);
        } else {
            console.log('Lambda done with result:', result);
        }
    },
    fail: (error) => {
        console.error('Lambda failed:', error);
    },
    succeed: (result) => {
        console.log('Lambda succeeded:', result);
    }
});

// Create mock API Gateway events
const createChatCompletionEvent = (bedrockToken) => ({
    httpMethod: 'POST',
    path: '/v1/chat/completions',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bedrockToken}`,
        'User-Agent': 'local-test-client/1.0'
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
        requestId: `local-test-${Date.now()}`,
        stage: 'local',
        httpMethod: 'POST',
        path: '/v1/chat/completions',
        protocol: 'HTTP/1.1',
        requestTime: new Date().toISOString(),
        requestTimeEpoch: Date.now(),
        identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'local-test-client/1.0'
        }
    },
    resource: '/v1/chat/completions',
    body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
            {
                role: 'user',
                content: 'Hello! This is a local test. Can you tell me about AWS Bedrock in one sentence?'
            }
        ],
        temperature: 0.7,
        max_tokens: 100
    }),
    isBase64Encoded: false
});

const createModelsEvent = (bedrockToken) => ({
    httpMethod: 'GET',
    path: '/v1/models',
    headers: {
        'Authorization': `Bearer ${bedrockToken}`,
        'User-Agent': 'local-test-client/1.0'
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
        requestId: `local-test-${Date.now()}`,
        stage: 'local',
        httpMethod: 'GET',
        path: '/v1/models',
        protocol: 'HTTP/1.1',
        requestTime: new Date().toISOString(),
        requestTimeEpoch: Date.now(),
        identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'local-test-client/1.0'
        }
    },
    resource: '/v1/models',
    body: null,
    isBase64Encoded: false
});

const createHealthEvent = () => ({
    httpMethod: 'GET',
    path: '/health',
    headers: {
        'User-Agent': 'local-test-client/1.0'
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
        requestId: `local-test-${Date.now()}`,
        stage: 'local',
        httpMethod: 'GET',
        path: '/health',
        protocol: 'HTTP/1.1',
        requestTime: new Date().toISOString(),
        requestTimeEpoch: Date.now(),
        identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'local-test-client/1.0'
        }
    },
    resource: '/health',
    body: null,
    isBase64Encoded: false
});

// Test runner class
class LocalLambdaTester {
    constructor(bedrockToken) {
        this.bedrockToken = bedrockToken;
        this.testResults = [];
    }

    async runTest(testName, event, expectedStatusCode = 200) {
        console.log(`\n🧪 Running test: ${testName}`);
        console.log(`📝 Method: ${event.httpMethod} ${event.path}`);
        
        const startTime = Date.now();
        
        try {
            const context = createMockContext();
            const result = await handler(event, context);
            
            const duration = Date.now() - startTime;
            
            console.log(`⏱️  Duration: ${duration}ms`);
            console.log(`📊 Status Code: ${result.statusCode}`);
            
            if (result.statusCode === expectedStatusCode) {
                console.log(`✅ Test passed: ${testName}`);
                this.testResults.push({ name: testName, status: 'PASSED', duration });
                
                // Parse and display response body
                if (result.body) {
                    try {
                        const responseBody = JSON.parse(result.body);
                        console.log(`📄 Response preview:`, this.formatResponse(responseBody));
                    } catch (e) {
                        console.log(`📄 Response body: ${result.body.substring(0, 200)}...`);
                    }
                }
                
                return result;
            } else {
                console.log(`❌ Test failed: ${testName}`);
                console.log(`   Expected status: ${expectedStatusCode}, got: ${result.statusCode}`);
                this.testResults.push({ name: testName, status: 'FAILED', duration, error: `Status code mismatch` });
                
                if (result.body) {
                    try {
                        const errorBody = JSON.parse(result.body);
                        console.log(`📄 Error response:`, errorBody);
                    } catch (e) {
                        console.log(`📄 Error body: ${result.body}`);
                    }
                }
                
                return result;
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`❌ Test failed with exception: ${testName}`);
            console.log(`   Error: ${error.message}`);
            this.testResults.push({ name: testName, status: 'ERROR', duration, error: error.message });
            throw error;
        }
    }

    formatResponse(response) {
        if (response.choices && response.choices[0]) {
            return {
                model: response.model,
                content: response.choices[0].message?.content?.substring(0, 100) + '...',
                usage: response.usage
            };
        } else if (response.data && Array.isArray(response.data)) {
            return {
                object: response.object,
                models: response.data.map(m => m.id).slice(0, 5),
                total: response.data.length
            };
        } else if (response.status) {
            return {
                status: response.status,
                timestamp: response.timestamp
            };
        }
        return response;
    }

    printSummary() {
        console.log('\n📊 Test Summary');
        console.log('================');
        
        const passed = this.testResults.filter(r => r.status === 'PASSED').length;
        const failed = this.testResults.filter(r => r.status === 'FAILED').length;
        const errors = this.testResults.filter(r => r.status === 'ERROR').length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`💥 Errors: ${errors}`);
        console.log(`📈 Total: ${this.testResults.length}`);
        
        if (failed > 0 || errors > 0) {
            console.log('\n❌ Failed/Error Tests:');
            this.testResults
                .filter(r => r.status !== 'PASSED')
                .forEach(r => {
                    console.log(`   - ${r.name}: ${r.status} (${r.error || 'Unknown error'})`);
                });
        }
        
        const avgDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0) / this.testResults.length;
        console.log(`⏱️  Average duration: ${Math.round(avgDuration)}ms`);
    }
}

// Main test execution
async function runLocalTests() {
    console.log('🚀 Bedrock OpenAI Proxy - Local Lambda Testing');
    console.log('===============================================');
    
    // Check for Bedrock token
    const bedrockToken = process.env.AWS_BEARER_TOKEN_BEDROCK || process.argv[2];
    
    if (!bedrockToken) {
        console.log('❌ No Bedrock API token provided!');
        console.log('');
        console.log('Usage:');
        console.log('  1. Set environment variable: export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-..."');
        console.log('  2. Or pass as argument: node scripts/test-lambda-local.js "bedrock-api-key-..."');
        console.log('');
        process.exit(1);
    }
    
    if (!bedrockToken.startsWith('bedrock-api-key-')) {
        console.log('⚠️  Warning: Token does not start with "bedrock-api-key-"');
        console.log('   This might cause authentication issues.');
    }
    
    console.log(`🔑 Using Bedrock token: ${bedrockToken.substring(0, 20)}...`);
    console.log(`🌍 AWS Region: ${process.env.AWS_REGION || 'ap-northeast-1'}`);
    console.log('');
    
    // Set environment variables for the Lambda function
    process.env.ENVIRONMENT = 'local-test';
    process.env.AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';
    process.env.LOG_LEVEL = 'DEBUG';
    process.env.NODE_ENV = 'development';
    
    const tester = new LocalLambdaTester(bedrockToken);
    
    try {
        // Test 1: Health check (no authentication required)
        await tester.runTest(
            'Health Check',
            createHealthEvent(),
            200
        );
        
        // Test 2: List models (requires authentication)
        await tester.runTest(
            'List Models',
            createModelsEvent(bedrockToken),
            200
        );
        
        // Test 3: Chat completion (requires authentication and Bedrock API call)
        await tester.runTest(
            'Chat Completion',
            createChatCompletionEvent(bedrockToken),
            200
        );
        
        // Test 4: Invalid authentication
        await tester.runTest(
            'Invalid Authentication',
            createChatCompletionEvent('invalid-token'),
            401
        );
        
        // Test 5: Missing authentication
        const eventWithoutAuth = createChatCompletionEvent('');
        delete eventWithoutAuth.headers.Authorization;
        await tester.runTest(
            'Missing Authentication',
            eventWithoutAuth,
            401
        );
        
    } catch (error) {
        console.log(`\n💥 Critical error during testing: ${error.message}`);
        console.log('Stack trace:', error.stack);
    }
    
    tester.printSummary();
    
    // Exit with appropriate code
    const hasFailures = tester.testResults.some(r => r.status !== 'PASSED');
    process.exit(hasFailures ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

// Run the tests
if (require.main === module) {
    runLocalTests();
}

module.exports = { LocalLambdaTester, createChatCompletionEvent, createModelsEvent, createHealthEvent };