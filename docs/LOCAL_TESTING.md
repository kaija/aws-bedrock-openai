# Local Testing Guide

This guide explains how to test the Bedrock OpenAI Proxy Lambda function locally on your desktop without deploying to AWS.

## Overview

There are two main approaches for local testing:

1. **Direct Lambda Handler Testing** - Directly invoke the Lambda handler function in your local Node.js environment
2. **SAM Local API** - Use AWS SAM CLI to simulate API Gateway and Lambda locally

## Method 1: Direct Lambda Handler Testing (Recommended)

This method directly invokes the Lambda handler function locally, which is faster and simpler for testing Bedrock API connectivity.

### Prerequisites

- Node.js 18+ installed
- Your Bedrock API token
- Project built (`npm run build`)

### Quick Start

```bash
# Build the project
npm run build

# Test with your Bedrock token
npm run test:lambda "bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......"

# Or set environment variable
export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-..."
npm run test:lambda
```

### What It Tests

The local Lambda tester runs the following tests:

1. **Health Check** - Tests basic Lambda function execution
2. **List Models** - Tests authentication and model listing
3. **Chat Completion** - Tests full Bedrock API integration
4. **Invalid Authentication** - Tests error handling for bad tokens
5. **Missing Authentication** - Tests error handling for missing tokens

### Example Output

```
🚀 Bedrock OpenAI Proxy - Local Lambda Testing
===============================================
🔑 Using Bedrock token: bedrock-api-key-YmVk...
🌍 AWS Region: ap-northeast-1

🧪 Running test: Health Check
📝 Method: GET /health
⏱️  Duration: 45ms
📊 Status Code: 200
✅ Test passed: Health Check
📄 Response preview: { status: 'healthy', timestamp: '2024-01-15T10:30:00.000Z' }

🧪 Running test: List Models
📝 Method: GET /v1/models
⏱️  Duration: 120ms
📊 Status Code: 200
✅ Test passed: List Models
📄 Response preview: { object: 'list', models: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-haiku', 'claude-3-sonnet', 'nova-pro'], total: 10 }

🧪 Running test: Chat Completion
📝 Method: POST /v1/chat/completions
⏱️  Duration: 2340ms
📊 Status Code: 200
✅ Test passed: Chat Completion
📄 Response preview: { model: 'anthropic.claude-3-haiku-20240307-v1:0', content: 'AWS Bedrock is a fully managed service that provides access to foundation models from leading AI companies...', usage: { input_tokens: 25, output_tokens: 45, total_tokens: 70 } }

📊 Test Summary
================
✅ Passed: 5
❌ Failed: 0
💥 Errors: 0
📈 Total: 5
⏱️  Average duration: 645ms
```

### Manual Testing

You can also run the test script directly with Node.js:

```bash
# Build first
npm run build

# Run tests directly
node scripts/test-lambda-local.js "bedrock-api-key-..."

# Or with environment variable
export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-..."
node scripts/test-lambda-local.js
```

### Custom Test Events

You can modify the test script to create custom test events:

```javascript
const { handler } = require('../dist/index.js');

// Create custom event
const customEvent = {
    httpMethod: 'POST',
    path: '/v1/chat/completions',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-bedrock-token'
    },
    body: JSON.stringify({
        model: 'claude-3-sonnet',
        messages: [
            { role: 'user', content: 'Your custom test message' }
        ],
        temperature: 0.5,
        max_tokens: 200
    })
};

// Mock context
const context = {
    awsRequestId: 'test-request-id',
    getRemainingTimeInMillis: () => 30000
};

// Invoke handler
handler(customEvent, context)
    .then(result => {
        console.log('Result:', result);
    })
    .catch(error => {
        console.error('Error:', error);
    });
```

## Method 2: SAM Local API

This method uses AWS SAM CLI to simulate the complete API Gateway + Lambda environment locally.

### Prerequisites

- AWS SAM CLI installed
- AWS CLI configured
- Docker installed (for SAM local)

### Quick Start

```bash
# Start local API server
npm run test:local --token "bedrock-api-key-..."

# Or with custom port
./scripts/test-local.sh --port 8080 --token "bedrock-api-key-..."
```

### Testing the Local API

Once the local API is running, you can test it with curl or any HTTP client:

```bash
# Health check
curl http://localhost:3000/health

# List models
curl -H "Authorization: Bearer bedrock-api-key-..." \
     http://localhost:3000/v1/models

# Chat completion
curl -X POST http://localhost:3000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer bedrock-api-key-..." \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {"role": "user", "content": "Hello!"}
       ]
     }'
```

### Using with OpenAI SDK

You can test with the OpenAI Python SDK:

```python
from openai import OpenAI

client = OpenAI(
    api_key="bedrock-api-key-...",
    base_url="http://localhost:3000/v1"
)

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "Hello from local testing!"}
    ]
)

print(response.choices[0].message.content)
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

```
❌ Test failed: Chat Completion
   Expected status: 200, got: 401
📄 Error response: { error: { message: 'Invalid Bedrock API token format', type: 'authentication_error' } }
```

**Solution**: Ensure your token starts with `bedrock-api-key-` and is valid.

#### 2. Bedrock API Errors

```
❌ Test failed: Chat Completion
   Expected status: 200, got: 403
📄 Error response: { error: { message: 'Access denied. Please check your AWS credentials and permissions.', type: 'authentication_error' } }
```

**Solution**: Verify your Bedrock API token has the required permissions:
- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`

#### 3. Build Errors

```
❌ Build failed. Please fix the build errors.
```

**Solution**: Run `npm run build` manually to see detailed TypeScript errors.

#### 4. Module Not Found

```
Error: Cannot find module '../dist/index.js'
```

**Solution**: Make sure you've built the project first with `npm run build`.

### Debug Mode

Enable debug logging by setting environment variables:

```bash
export LOG_LEVEL=DEBUG
export NODE_ENV=development
npm run test:lambda "bedrock-api-key-..."
```

### Network Issues

If you're having network connectivity issues with Bedrock:

1. Check your internet connection
2. Verify the AWS region is correct (`ap-northeast-1`)
3. Try with a different model ID
4. Check if your firewall is blocking AWS API calls

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_BEARER_TOKEN_BEDROCK` | Your Bedrock API token | Required |
| `AWS_REGION` | AWS region for Bedrock | `ap-northeast-1` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `NODE_ENV` | Node environment | `development` |
| `ENVIRONMENT` | App environment | `local-test` |

## Integration with CI/CD

You can integrate local testing into your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Test Lambda Function Locally
  run: |
    npm run build
    npm run test:lambda "${{ secrets.BEDROCK_API_TOKEN }}"
  env:
    AWS_REGION: ap-northeast-1
```

## Performance Testing

The local tester measures response times for each test. Typical performance:

- **Health Check**: 10-50ms
- **List Models**: 50-200ms  
- **Chat Completion**: 1000-5000ms (depends on model and response length)

## Next Steps

After successful local testing:

1. Run unit tests: `npm test`
2. Deploy to dev environment: `npm run deploy:dev`
3. Run end-to-end tests against deployed API
4. Deploy to production: `npm run deploy:prod`