# Deployment Guide

This guide explains how to deploy the Bedrock OpenAI Proxy using AWS SAM.

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **SAM CLI** installed ([Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html))
3. **Node.js 22** or later
4. **npm** package manager

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Project
```bash
npm run build:full
```

### 3. Deploy to Development Environment
```bash
npm run deploy:dev
```

## Custom Deployment Options

### Deploy with Custom Domain

First, create an ACM certificate in your AWS account:

```bash
# Request a certificate (replace with your domain)
aws acm request-certificate \
  --domain-name openai.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

Then deploy with domain configuration:

```bash
./scripts/deploy.sh \
  --environment prod \
  --domain openai.yourdomain.com \
  --certificate arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
```

### Deploy to Different Regions

```bash
./scripts/deploy.sh --environment prod --region eu-west-1
```

### Deploy with Custom Stack Name

```bash
./scripts/deploy.sh --stack-name my-custom-bedrock-proxy
```

## Environment-Specific Deployments

### Development
```bash
npm run deploy:dev
# or
./scripts/deploy.sh --environment dev
```

### Staging
```bash
npm run deploy:staging
# or
./scripts/deploy.sh --environment staging
```

### Production
```bash
npm run deploy:prod
# or
./scripts/deploy.sh --environment prod
```

## Configuration

The deployment creates several Parameter Store entries:

- `/bedrock-openai-proxy/{env}/domain` - API domain name
- `/bedrock-openai-proxy/{env}/model-mappings` - OpenAI to Bedrock model mappings
- `/bedrock-openai-proxy/{env}/allowed-models` - List of allowed Bedrock models

### Model Mappings

Default model mappings:
```json
{
  "gpt-3.5-turbo": "anthropic.claude-3-haiku-20240307-v1:0",
  "gpt-4": "anthropic.claude-3-sonnet-20240229-v1:0",
  "gpt-4-turbo": "anthropic.claude-3-opus-20240229-v1:0",
  "claude-3-haiku": "anthropic.claude-3-haiku-20240307-v1:0",
  "claude-3-sonnet": "anthropic.claude-3-sonnet-20240229-v1:0",
  "claude-3-opus": "anthropic.claude-3-opus-20240229-v1:0"
}
```

You can update these mappings after deployment:

```bash
aws ssm put-parameter \
  --name "/bedrock-openai-proxy/prod/model-mappings" \
  --value '{"gpt-4":"anthropic.claude-3-opus-20240229-v1:0"}' \
  --type String \
  --overwrite
```

## IAM Permissions

The Lambda function is granted the following permissions:

- `bedrock:InvokeModel` - To call Bedrock models
- `bedrock:InvokeModelWithResponseStream` - For streaming responses
- `ssm:GetParameter*` - To read configuration from Parameter Store
- `logs:*` - For CloudWatch logging

## Monitoring

### CloudWatch Logs
Logs are available in CloudWatch under:
```
/aws/lambda/bedrock-openai-proxy-{environment}
```

### Metrics
Monitor the following CloudWatch metrics:
- Lambda Duration
- Lambda Errors
- Lambda Invocations
- API Gateway 4XXError
- API Gateway 5XXError

## Testing the Deployment

After deployment, test the API:

### OpenAI Compatible Endpoint
```bash
curl -X POST https://your-api-url/dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AWS_ACCESS_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Models Endpoint
```bash
curl https://your-api-url/dev/v1/models
```

### Claude Native Endpoint
```bash
curl -X POST https://your-api-url/dev/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-sonnet",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Ensure Node.js 22 is installed
   - Run `npm ci` to install exact dependency versions

2. **Deployment Failures**
   - Check AWS credentials: `aws sts get-caller-identity`
   - Verify SAM CLI installation: `sam --version`
   - Ensure sufficient IAM permissions

3. **Runtime Errors**
   - Check CloudWatch logs for detailed error messages
   - Verify Bedrock model access in your AWS region
   - Ensure Parameter Store values are correctly set

### Cleanup

To delete the stack:

```bash
aws cloudformation delete-stack --stack-name bedrock-openai-proxy-dev
```

## Security Considerations

1. **API Keys**: Use proper AWS access keys with minimal required permissions
2. **CORS**: Configure CORS settings based on your client requirements
3. **Rate Limiting**: Consider adding API Gateway throttling
4. **VPC**: For enhanced security, deploy Lambda in a VPC
5. **WAF**: Consider adding AWS WAF for additional protection