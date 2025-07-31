#!/bin/bash

# Check Available Bedrock Models Script

set -e

# Default region
REGION="ap-northeast-1"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -r|--region)
      REGION="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -r, --region         AWS Region [default: ap-northeast-1]"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo "🔍 Checking available Bedrock models in region: $REGION"
echo ""

# Check Anthropic models
echo "📋 Anthropic Models:"
aws bedrock list-foundation-models --region $REGION \
  --query 'modelSummaries[?providerName==`Anthropic`].{ModelId:modelId,ModelName:modelName,InputModalities:inputModalities,OutputModalities:outputModalities}' \
  --output table

echo ""

# Check Amazon models
echo "📋 Amazon Models:"
aws bedrock list-foundation-models --region $REGION \
  --query 'modelSummaries[?providerName==`Amazon`].{ModelId:modelId,ModelName:modelName,InputModalities:inputModalities,OutputModalities:outputModalities}' \
  --output table

echo ""

# Check other providers
echo "📋 Other Provider Models:"
aws bedrock list-foundation-models --region $REGION \
  --query 'modelSummaries[?providerName!=`Anthropic` && providerName!=`Amazon`].{ModelId:modelId,ModelName:modelName,ProviderName:providerName}' \
  --output table

echo ""
echo "✅ Model check completed for region: $REGION"
echo ""
echo "💡 To update your model mappings:"
echo "   1. Edit template.yaml ModelMappingsParameter"
echo "   2. Update src/services/bedrock.ts mapModelId() method"
echo "   3. Redeploy with: ./scripts/deploy.sh"