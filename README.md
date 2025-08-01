# Bedrock OpenAI Proxy

An OpenAI-compatible API proxy for AWS Bedrock that allows you to use existing OpenAI client libraries (like langchain or openai-python) with AWS Bedrock foundation models.

## Features

- 🔄 **OpenAI-Compatible API**: Drop-in replacement for OpenAI API endpoints
- 🤖 **Multiple Models**: Support for Claude, Nova, and other Bedrock models
- 🖼️ **Vision Support**: Handle image inputs with vision-capable models
- 🔐 **AWS Authentication**: Use AWS access keys for authentication
- 📊 **Structured Logging**: CloudWatch integration with structured logs
- 🚀 **Serverless**: Built with AWS SAM for easy deployment
- 🌐 **Custom Domains**: Support for custom domain names with ACM certificates
- 📈 **Monitoring**: Built-in CloudWatch alarms and metrics

## Quick Start

### Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js 22+ and npm
- AWS SAM CLI
- An AWS account with Bedrock access in ap-northeast-1

### 1. Clone and Setup

```bash
git clone <repository-url>
cd aws-bedrock-openai
npm install
```

### 2. Check Available Models

```bash
# Check what models are available in your region
./scripts/check-models.sh --region ap-northeast-1
```

### 3. Deploy

```bash
# Build and deploy to dev environment
npm run build
./scripts/deploy.sh

# Deploy to production with custom domain
./scripts/deploy.sh --environment prod --domain openai.yourdomain.com --certificate arn:aws:acm:region:account:certificate/cert-id
```

### 4. Destroy (when needed)

```bash
# Destroy dev environment
./scripts/destroy.sh

# Destroy production environment (requires confirmation)
./scripts/destroy.sh --environment prod

# Force destroy without prompts
./scripts/destroy.sh --environment staging --force
```

### 4. Test the API

```bash
# Get your API endpoint from the deployment output
export API_URL="https://your-api-id.execute-api.ap-northeast-1.amazonaws.com/dev"
export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-...."

# Test chat completion
curl -X POST $API_URL/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AWS_BEARER_TOKEN_BEDROCK" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hello! Tell me about AWS Bedrock."}
    ]
  }'

# List available models
curl -X GET $API_URL/v1/models \
  -H "Authorization: Bearer $AWS_BEARER_TOKEN_BEDROCK"
```

## Usage

### With OpenAI Python Library

```python
from openai import OpenAI

# Bedrock API Token format
aws_bearer_token = "bedrock-api-key-...."

client = OpenAI(
    api_key=aws_bearer_token,
    base_url="https://your-api-domain.com/dev/v1"
)

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### With LangChain

```python
from langchain.chat_models import ChatOpenAI

# Bedrock API Token format
aws_bearer_token = "bedrock-api-key-...."

llm = ChatOpenAI(
    openai_api_key=aws_bearer_token,
    openai_api_base="https://your-api-domain.com/dev/v1",
    model_name="gpt-3.5-turbo"
)

response = llm.predict("What is AWS Bedrock?")
print(response)
```

### Vision Models

```python
response = client.chat.completions.create(
    model="claude-3-sonnet",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What do you see in this image?"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "data:image/jpeg;base64,/9j/4AAQ..."
                    }
                }
            ]
        }
    ]
)
```

## Authentication

The API uses Bedrock API Tokens passed directly in the Authorization header. The token format is:

```
bedrock-api-key-<base64-encoded-data>
```

### Examples

**Bedrock API Token:**
```bash
export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-...."
```

### Usage with boto3

The token can be used directly with boto3 by setting it as an environment variable:

```python
import boto3
import os

# Set the API key as an environment variable
os.environ['AWS_BEARER_TOKEN_BEDROCK'] = "bedrock-api-key-...."

# Create the Bedrock client
client = boto3.client(
    service_name="bedrock-runtime",
    region_name="us-east-1"
)

# Define the model and message
model_id = "us.anthropic.claude-3-5-haiku-20241022-v1:0"
messages = [{"role": "user", "content": [{"text": "Hello! Can you tell me about Amazon Bedrock?"}]}]

# Make the API call
response = client.converse(
    modelId=model_id,
    messages=messages,
)

# Print the response
print(response['output']['message']['content'][0]['text'])
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Deployment environment | `dev` |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARN, ERROR) | `INFO` |
| `NODE_ENV` | Node.js environment | `development` |

### Parameter Store Configuration

The application uses AWS Systems Manager Parameter Store for configuration:

- `/bedrock-openai-proxy/{env}/domain` - Custom domain name
- `/bedrock-openai-proxy/{env}/model-mappings` - Model name mappings
- `/bedrock-openai-proxy/{env}/allowed-models` - List of allowed models
- `/bedrock-openai-proxy/{env}/provider-config` - Provider configurations
- `/bedrock-openai-proxy/{env}/default-provider` - Default provider

### Model Mappings

| OpenAI Model | Bedrock Model (ap-northeast-1) |
|--------------|--------------------------------|
| `gpt-3.5-turbo` | `anthropic.claude-3-haiku-20240307-v1:0` |
| `gpt-4` | `anthropic.claude-3-sonnet-20240229-v1:0` |
| `gpt-4-turbo` | `anthropic.claude-3-5-sonnet-20240620-v1:0` |
| `gpt-4o` | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| `claude-3-haiku` | `anthropic.claude-3-haiku-20240307-v1:0` |
| `claude-3-sonnet` | `anthropic.claude-3-sonnet-20240229-v1:0` |
| `claude-3-5-sonnet` | `anthropic.claude-3-5-sonnet-20240620-v1:0` |
| `claude-4-sonnet` | `anthropic.claude-sonnet-4-20250514-v1:0` |
| `nova-pro` | `amazon.nova-pro-v1:0` |
| `nova-lite` | `amazon.nova-lite-v1:0` |

## Deployment Options

### Basic Deployment

```bash
./scripts/deploy.sh
```

### Production Deployment with Custom Domain

```bash
./scripts/deploy.sh \
  --environment prod \
  --domain openai.yourdomain.com \
  --certificate arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
```

### Multi-Region Deployment

```bash
# Deploy to different regions
./scripts/deploy.sh --region us-east-1 --environment prod-us
./scripts/deploy.sh --region eu-west-1 --environment prod-eu
```

## Monitoring and Logging

### CloudWatch Logs

Structured JSON logs are sent to CloudWatch with the following format:

```json
{
  "timestamp": "2025-01-31T10:30:00.000Z",
  "level": "INFO",
  "message": "API request completed",
  "requestId": "abc123",
  "method": "POST",
  "path": "/v1/chat/completions",
  "statusCode": 200,
  "duration": 1250,
  "model": "gpt-3.5-turbo",
  "provider": "bedrock"
}
```

### CloudWatch Alarms

The deployment includes several CloudWatch alarms:

- **Error Rate**: Triggers when Lambda errors exceed threshold
- **Duration**: Triggers when response time is too high
- **Throttles**: Triggers when Lambda is throttled
- **4XX Errors**: Triggers on client errors
- **5XX Errors**: Triggers on server errors

### Metrics Dashboard

Create a CloudWatch dashboard to monitor:

- Request count and latency
- Error rates by endpoint
- Model usage statistics
- Token consumption

## Security

### Authentication

The proxy uses AWS access keys for authentication:

1. **Long-term Access Keys**: Standard AWS access keys
2. **Short-term Access Keys**: Temporary credentials from STS
3. **IAM Roles**: For service-to-service communication

### Permissions Required

Your AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
```

### Network Security

- HTTPS-only communication
- CORS support for web applications
- Custom domain with ACM certificates
- VPC deployment support (optional)

## Troubleshooting

### Common Issues

1. **ValidationException: on-demand throughput isn't supported**
   - The proxy automatically retries with alternative models
   - Check available models with `./scripts/check-models.sh`

2. **Authentication Errors**
   - Verify AWS credentials have Bedrock permissions
   - Check if the model is available in your region

3. **Rate Limiting**
   - Bedrock has service quotas and rate limits
   - Consider implementing client-side retry logic

4. **High Latency**
   - Check CloudWatch metrics for bottlenecks
   - Consider increasing Lambda memory allocation
   - Use provisioned concurrency for production

### Debug Mode

Enable debug logging:

```bash
# Update Parameter Store
aws ssm put-parameter \
  --name "/bedrock-openai-proxy/dev/log-level" \
  --value "DEBUG" \
  --overwrite

# Or set environment variable
export LOG_LEVEL=DEBUG
```

### Health Checks

```bash
# Check API health
curl -X GET $API_URL/v1/models

# Check specific model
curl -X POST $API_URL/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AWS_ACCESS_KEY" \
  -d '{"model":"claude-3-haiku","messages":[{"role":"user","content":"test"}]}'
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
├── src/
│   ├── handlers/          # Request handlers
│   ├── services/          # Business logic services
│   ├── transformers/      # Request/response transformers
│   ├── types/            # TypeScript type definitions
│   └── index.ts          # Main Lambda handler
├── scripts/              # Deployment and utility scripts
├── examples/             # Usage examples
├── template.yaml         # SAM template
└── README.md
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review CloudWatch logs
3. Open an issue on GitHub
4. Check AWS Bedrock documentation

## Changelog

### v1.0.0
- Initial release
- OpenAI-compatible API endpoints
- AWS Bedrock integration
- Vision model support
- Structured logging
- CloudWatch monitoring
- Custom domain support
