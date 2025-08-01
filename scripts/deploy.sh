#!/bin/bash

# Bedrock OpenAI Proxy Deployment Script

set -e

# Default values
ENVIRONMENT="dev"
REGION="ap-northeast-1"
STACK_NAME=""
DOMAIN_NAME="openai.ez2.click"
CERTIFICATE_ARN="arn:aws:acm:us-east-1:313906465919:certificate/48fcecba-27bf-4346-8ffa-853ada12682a"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -r|--region)
      REGION="$2"
      shift 2
      ;;
    -s|--stack-name)
      STACK_NAME="$2"
      shift 2
      ;;
    -d|--domain)
      DOMAIN_NAME="$2"
      shift 2
      ;;
    -c|--certificate)
      CERTIFICATE_ARN="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment    Environment (dev, staging, prod) [default: dev]"
      echo "  -r, --region         AWS Region [default: us-east-1]"
      echo "  -s, --stack-name     CloudFormation stack name [default: bedrock-openai-proxy-{env}]"
      echo "  -d, --domain         Custom domain name (optional)"
      echo "  -c, --certificate    ACM Certificate ARN (required if domain specified)"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Set default stack name if not provided
if [ -z "$STACK_NAME" ]; then
  STACK_NAME="bedrock-openai-proxy-$ENVIRONMENT"
fi

# Validate domain and certificate
if [ -n "$DOMAIN_NAME" ] && [ -z "$CERTIFICATE_ARN" ]; then
  echo "Error: Certificate ARN is required when domain name is specified"
  exit 1
fi

echo "🚀 Deploying Bedrock OpenAI Proxy"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Stack Name: $STACK_NAME"
if [ -n "$DOMAIN_NAME" ]; then
  echo "Domain: $DOMAIN_NAME"
  echo "Certificate: $CERTIFICATE_ARN"
fi
echo ""

# Build the project
echo "📦 Building TypeScript project..."
npm run build

# Validate SAM template
echo "✅ Validating SAM template..."
sam validate --region $REGION

# Create S3 bucket if it doesn't exist
S3_BUCKET="bedrock-openai-proxy-sam-artifacts-$ENVIRONMENT"
echo "📦 Ensuring S3 bucket exists: $S3_BUCKET"
aws s3 mb s3://$S3_BUCKET --region $REGION 2>/dev/null || echo "Bucket already exists or creation failed"

# Build SAM application
echo "🔨 Building SAM application..."
sam build --region $REGION

# Deploy with SAM
echo "🚀 Deploying to AWS..."

DEPLOY_PARAMS="--stack-name $STACK_NAME --region $REGION --capabilities CAPABILITY_IAM --s3-bucket $S3_BUCKET --parameter-overrides Environment=$ENVIRONMENT"

if [ -n "$DOMAIN_NAME" ]; then
  DEPLOY_PARAMS="$DEPLOY_PARAMS DomainName=$DOMAIN_NAME CertificateArn=$CERTIFICATE_ARN"
fi

# Clean any cached configuration and deploy
echo "Cleaning SAM cache..."
rm -rf .aws-sam/

sam deploy $DEPLOY_PARAMS --no-confirm-changeset

# Get outputs
echo ""
echo "✅ Deployment completed!"
echo ""
echo "📋 Stack Outputs:"
aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs' --output table

# Get API URL
API_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)

echo ""
echo "🌐 API Endpoint: $API_URL"
echo ""
echo "📝 Usage Examples:"
echo "OpenAI Compatible:"
echo "  curl -X POST $API_URL/v1/chat/completions \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'Authorization: Bearer YOUR_AWS_ACCESS_KEY' \\"
echo "    -d '{\"model\":\"gpt-3.5-turbo\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello!\"}]}'"
echo ""
echo "Claude Native:"
echo "  curl -X POST $API_URL/v1/messages \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"model\":\"claude-3-sonnet\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello!\"}]}'"
