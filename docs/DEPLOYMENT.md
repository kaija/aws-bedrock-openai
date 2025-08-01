# Deployment Guide

This guide provides detailed instructions for deploying the Bedrock OpenAI Proxy in different environments and configurations.

## Prerequisites

### Required Tools

1. **AWS CLI** (v2.0+)
   ```bash
   aws --version
   aws configure
   ```

2. **AWS SAM CLI** (v1.50+)
   ```bash
   sam --version
   ```

3. **Node.js** (v22+) and npm
   ```bash
   node --version
   npm --version
   ```

4. **Git**
   ```bash
   git --version
   ```

### AWS Permissions

Your AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "apigateway:*",
        "iam:*",
        "s3:*",
        "ssm:*",
        "logs:*",
        "acm:*",
        "cloudwatch:*"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    }
  ]
}
```

### Bedrock Model Access

Ensure you have access to the required Bedrock models in your target region:

```bash
# Check available models
aws bedrock list-foundation-models --region ap-northeast-1

# Request model access if needed (via AWS Console)
# Go to AWS Bedrock Console > Model access > Request access
```

## Basic Deployment

### 1. Clone and Setup

```bash
git clone <repository-url>
cd aws-bedrock-openai
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Deploy to Development

```bash
./scripts/deploy.sh
```

This will:
- Create an S3 bucket for deployment artifacts
- Deploy the SAM stack to the `dev` environment
- Set up API Gateway, Lambda, and Parameter Store
- Output the API endpoint URL

### 4. Test the Deployment

```bash
# Get the API URL from the deployment output
export API_URL="https://abc123.execute-api.ap-northeast-1.amazonaws.com/dev"
export AWS_ACCESS_KEY="your-aws-access-key"

# Test the API
curl -X GET $API_URL/v1/models \
  -H "Authorization: Bearer $AWS_ACCESS_KEY"
```

## Production Deployment

### 1. Custom Domain Setup

First, create an ACM certificate:

```bash
# Request a certificate (must be done in us-east-1 for CloudFront/Edge)
aws acm request-certificate \
  --domain-name "openai.yourdomain.com" \
  --validation-method DNS \
  --region us-east-1

# Note the certificate ARN from the output
```

Validate the certificate by adding the DNS records provided by ACM.

### 2. Deploy with Custom Domain

```bash
./scripts/deploy.sh \
  --environment prod \
  --domain openai.yourdomain.com \
  --certificate arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
```

### 3. DNS Configuration

After deployment, configure your DNS to point to the API Gateway:

```bash
# Get the CloudFront distribution domain from the output
# Add a CNAME record in your DNS:
# openai.yourdomain.com -> d123456789.cloudfront.net
```

## Multi-Environment Deployment

### Environment Configuration

Create separate configurations for each environment:

```bash
# Development
./scripts/deploy.sh --environment dev --region ap-northeast-1

# Staging
./scripts/deploy.sh --environment staging --region ap-northeast-1

# Production
./scripts/deploy.sh --environment prod --region ap-northeast-1
```

### Environment-Specific Parameters

Each environment has its own Parameter Store configuration:

```bash
# Update model mappings for staging
aws ssm put-parameter \
  --name "/bedrock-openai-proxy/staging/model-mappings" \
  --value '{"gpt-4":"anthropic.claude-3-sonnet-20240229-v1:0"}' \
  --type String \
  --overwrite

# Update allowed models for production
aws ssm put-parameter \
  --name "/bedrock-openai-proxy/prod/allowed-models" \
  --value "anthropic.claude-3-sonnet-20240229-v1:0,anthropic.claude-3-5-sonnet-20240620-v1:0" \
  --type StringList \
  --overwrite
```

## Multi-Region Deployment

### Deploy to Multiple Regions

```bash
# US East (N. Virginia)
./scripts/deploy.sh --region us-east-1 --environment prod-us

# Europe (Ireland)
./scripts/deploy.sh --region eu-west-1 --environment prod-eu

# Asia Pacific (Tokyo)
./scripts/deploy.sh --region ap-northeast-1 --environment prod-ap
```

### Region-Specific Considerations

1. **Model Availability**: Different regions have different Bedrock models
2. **Latency**: Deploy closer to your users
3. **Compliance**: Some regions have specific compliance requirements

Check available models per region:

```bash
./scripts/check-models.sh --region us-east-1
./scripts/check-models.sh --region eu-west-1
./scripts/check-models.sh --region ap-northeast-1
```

## Advanced Configuration

### Custom S3 Bucket

Use your own S3 bucket for deployment artifacts:

```bash
# Create bucket
aws s3 mb s3://my-bedrock-proxy-artifacts --region ap-northeast-1

# Deploy with custom bucket
sam deploy \
  --stack-name bedrock-openai-proxy-prod \
  --s3-bucket my-bedrock-proxy-artifacts \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides Environment=prod
```

### VPC Deployment

For enhanced security, deploy Lambda in a VPC:

1. Update `template.yaml`:

```yaml
BedrockOpenAIProxyFunction:
  Type: AWS::Serverless::Function
  Properties:
    # ... other properties
    VpcConfig:
      SecurityGroupIds:
        - !Ref LambdaSecurityGroup
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
```

2. Add VPC resources to the template
3. Ensure NAT Gateway for internet access

### Custom Lambda Configuration

Adjust Lambda settings for your workload:

```yaml
Globals:
  Function:
    Timeout: 120          # Increase for long-running requests
    MemorySize: 2048      # Increase for better performance
    ReservedConcurrency: 50  # Limit concurrent executions
```

### Environment Variables

Set additional environment variables:

```yaml
Environment:
  Variables:
    ENVIRONMENT: !Ref Environment
    LOG_LEVEL: !If [IsProduction, 'INFO', 'DEBUG']
    CUSTOM_SETTING: 'value'
```

## Monitoring Setup

### CloudWatch Dashboard

Create a custom dashboard:

```bash
aws cloudwatch put-dashboard \
  --dashboard-name "BedrockOpenAIProxy" \
  --dashboard-body file://dashboard.json
```

### Custom Alarms

Add application-specific alarms:

```bash
# High token usage alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "bedrock-proxy-high-token-usage" \
  --alarm-description "High token usage detected" \
  --metric-name "TokensUsed" \
  --namespace "BedrockProxy" \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 100000 \
  --comparison-operator GreaterThanThreshold
```

### Log Insights Queries

Useful CloudWatch Logs Insights queries:

```sql
-- Error analysis
fields @timestamp, level, message, error
| filter level = "ERROR"
| sort @timestamp desc
| limit 100

-- Performance analysis
fields @timestamp, duration, model, statusCode
| filter type = "request_end"
| stats avg(duration), max(duration), count() by model
| sort avg(duration) desc

-- Authentication failures
fields @timestamp, message, success, reason
| filter type = "authentication" and success = false
| sort @timestamp desc
```

## Troubleshooting Deployment

### Common Issues

1. **SAM Build Fails**
   ```bash
   # Clear cache and rebuild
   rm -rf .aws-sam/
   npm run clean
   npm install
   npm run build
   sam build
   ```

2. **Permission Denied**
   ```bash
   # Check AWS credentials
   aws sts get-caller-identity
   
   # Verify permissions
   aws iam simulate-principal-policy \
     --policy-source-arn $(aws sts get-caller-identity --query Arn --output text) \
     --action-names lambda:CreateFunction \
     --resource-arns "*"
   ```

3. **Stack Update Fails**
   ```bash
   # Check stack events
   aws cloudformation describe-stack-events \
     --stack-name bedrock-openai-proxy-dev
   
   # Rollback if needed
   aws cloudformation cancel-update-stack \
     --stack-name bedrock-openai-proxy-dev
   ```

4. **Custom Domain Issues**
   ```bash
   # Check certificate status
   aws acm describe-certificate \
     --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
   
   # Verify DNS configuration
   dig openai.yourdomain.com
   ```

### Validation Steps

After deployment, validate:

1. **API Endpoints**
   ```bash
   curl -X GET $API_URL/v1/models
   curl -X POST $API_URL/v1/chat/completions -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}'
   ```

2. **CloudWatch Logs**
   ```bash
   aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/bedrock-openai-proxy"
   ```

3. **Parameter Store**
   ```bash
   aws ssm get-parameters-by-path --path "/bedrock-openai-proxy/dev"
   ```

4. **Alarms**
   ```bash
   aws cloudwatch describe-alarms --alarm-name-prefix "bedrock-openai-proxy"
   ```

## Cleanup

### Delete Stack

```bash
# Delete the CloudFormation stack
aws cloudformation delete-stack --stack-name bedrock-openai-proxy-dev

# Delete S3 bucket (if not needed)
aws s3 rb s3://bedrock-openai-proxy-sam-artifacts-dev --force

# Delete custom domain (if created)
aws apigateway delete-domain-name --domain-name openai.yourdomain.com
```

### Cleanup Script

```bash
#!/bin/bash
ENVIRONMENT=${1:-dev}
STACK_NAME="bedrock-openai-proxy-$ENVIRONMENT"

echo "Deleting stack: $STACK_NAME"
aws cloudformation delete-stack --stack-name $STACK_NAME

echo "Waiting for stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME

echo "Cleanup completed for environment: $ENVIRONMENT"
```

## Best Practices

### Security

1. Use least-privilege IAM policies
2. Enable CloudTrail for API calls
3. Use VPC endpoints for private communication
4. Rotate access keys regularly
5. Enable AWS Config for compliance

### Performance

1. Use provisioned concurrency for production
2. Monitor and adjust Lambda memory allocation
3. Implement client-side caching
4. Use CloudFront for global distribution
5. Monitor Bedrock quotas and limits

### Cost Optimization

1. Use ARM64 architecture for Lambda
2. Optimize Lambda memory and timeout
3. Implement request caching
4. Monitor usage with Cost Explorer
5. Use Reserved Capacity for predictable workloads

### Operational Excellence

1. Implement comprehensive monitoring
2. Set up automated deployments
3. Use Infrastructure as Code
4. Implement proper logging
5. Create runbooks for common issues