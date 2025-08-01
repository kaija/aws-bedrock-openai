#!/bin/bash

# Bedrock OpenAI Proxy - Service Destroy Script
# This script destroys the deployed AWS resources for the Bedrock OpenAI Proxy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
REGION="ap-northeast-1"
STACK_NAME=""
FORCE=false
CONFIRM=true

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Destroy the Bedrock OpenAI Proxy AWS resources.

OPTIONS:
    -e, --environment ENV    Environment to destroy (dev, staging, prod) [default: dev]
    -r, --region REGION      AWS region [default: ap-northeast-1]
    -s, --stack-name NAME    Custom stack name (overrides default naming)
    -f, --force             Skip confirmation prompts
    -y, --yes               Assume yes to all prompts
    -h, --help              Show this help message

EXAMPLES:
    # Destroy dev environment
    $0

    # Destroy production environment with confirmation
    $0 --environment prod

    # Force destroy without prompts
    $0 --environment staging --force

    # Destroy with custom stack name
    $0 --stack-name my-custom-stack --force

EOF
}

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
        -f|--force)
            FORCE=true
            CONFIRM=false
            shift
            ;;
        -y|--yes)
            CONFIRM=false
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod."
    exit 1
fi

# Set stack name if not provided
if [[ -z "$STACK_NAME" ]]; then
    STACK_NAME="bedrock-openai-proxy-$ENVIRONMENT"
fi

print_status "Starting destruction of Bedrock OpenAI Proxy"
print_status "Environment: $ENVIRONMENT"
print_status "Region: $REGION"
print_status "Stack Name: $STACK_NAME"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    print_error "SAM CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
print_status "Checking AWS credentials..."
if ! aws sts get-caller-identity --region "$REGION" &> /dev/null; then
    print_error "AWS credentials not configured or invalid."
    print_error "Please run 'aws configure' or set AWS environment variables."
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
print_success "AWS credentials verified (Account: $AWS_ACCOUNT_ID)"

# Check if stack exists
print_status "Checking if stack exists..."
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
    print_warning "Stack '$STACK_NAME' does not exist in region '$REGION'"
    print_status "Nothing to destroy."
    exit 0
fi

# Get stack information
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].StackStatus' --output text)
print_status "Stack Status: $STACK_STATUS"

# Get stack outputs for information
print_status "Getting stack information..."
STACK_OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].Outputs' --output table 2>/dev/null || echo "No outputs available")

if [[ "$STACK_OUTPUTS" != "No outputs available" ]]; then
    echo ""
    print_status "Current stack outputs:"
    echo "$STACK_OUTPUTS"
    echo ""
fi

# Confirmation prompt
if [[ "$CONFIRM" == true ]]; then
    echo ""
    print_warning "⚠️  WARNING: This will permanently delete the following resources:"
    print_warning "   • Lambda function: bedrock-openai-proxy-$ENVIRONMENT"
    print_warning "   • API Gateway: bedrock-openai-proxy-api-$ENVIRONMENT"
    print_warning "   • CloudWatch Log Groups"
    print_warning "   • CloudWatch Alarms"
    print_warning "   • SSM Parameters"
    print_warning "   • Custom Domain (if configured)"
    print_warning "   • All associated resources"
    echo ""
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        print_error "🚨 PRODUCTION ENVIRONMENT DESTRUCTION 🚨"
        print_error "You are about to destroy the PRODUCTION environment!"
        echo ""
        read -p "Type 'DELETE PRODUCTION' to confirm: " confirmation
        if [[ "$confirmation" != "DELETE PRODUCTION" ]]; then
            print_status "Destruction cancelled."
            exit 0
        fi
    else
        read -p "Are you sure you want to destroy the $ENVIRONMENT environment? (y/N): " confirmation
        if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
            print_status "Destruction cancelled."
            exit 0
        fi
    fi
fi

# Start destruction process
print_status "Starting stack destruction..."

# Delete the CloudFormation stack
print_status "Deleting CloudFormation stack: $STACK_NAME"
aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION"

# Wait for stack deletion to complete
print_status "Waiting for stack deletion to complete..."
print_status "This may take several minutes..."

# Monitor deletion progress
DELETION_START_TIME=$(date +%s)
TIMEOUT=1800  # 30 minutes timeout

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED_TIME=$((CURRENT_TIME - DELETION_START_TIME))
    
    if [[ $ELAPSED_TIME -gt $TIMEOUT ]]; then
        print_error "Stack deletion timed out after 30 minutes"
        print_error "Please check the AWS Console for the current status"
        exit 1
    fi
    
    if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
        print_success "Stack successfully deleted!"
        break
    fi
    
    STACK_STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETE_COMPLETE")
    
    if [[ "$STACK_STATUS" == "DELETE_COMPLETE" ]]; then
        print_success "Stack successfully deleted!"
        break
    elif [[ "$STACK_STATUS" == "DELETE_FAILED" ]]; then
        print_error "Stack deletion failed!"
        print_error "Please check the AWS Console for details and manually clean up resources"
        exit 1
    fi
    
    print_status "Stack status: $STACK_STATUS (elapsed: ${ELAPSED_TIME}s)"
    sleep 30
done

# Clean up SAM build artifacts
print_status "Cleaning up local build artifacts..."
if [[ -d ".aws-sam" ]]; then
    rm -rf .aws-sam
    print_success "Removed .aws-sam directory"
fi

if [[ -d "dist" ]]; then
    rm -rf dist
    print_success "Removed dist directory"
fi

# Optional: Clean up S3 deployment bucket (be careful with this)
if [[ "$FORCE" == true ]]; then
    print_status "Checking for SAM deployment bucket..."
    SAM_BUCKET="aws-sam-cli-managed-default-samclisourcebucket-*"
    
    # List buckets that match the pattern
    MATCHING_BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'samclisourcebucket')].Name" --output text --region "$REGION" 2>/dev/null || echo "")
    
    if [[ -n "$MATCHING_BUCKETS" ]]; then
        print_warning "Found SAM deployment buckets. These contain deployment artifacts."
        print_warning "Buckets: $MATCHING_BUCKETS"
        print_warning "Note: These buckets may be shared with other SAM applications."
        print_warning "Manual cleanup may be required if you want to remove them."
    fi
fi

# Final status
echo ""
print_success "🎉 Bedrock OpenAI Proxy destruction completed successfully!"
print_status "Environment: $ENVIRONMENT"
print_status "Region: $REGION"
print_status "Stack: $STACK_NAME"

if [[ "$ENVIRONMENT" == "prod" ]]; then
    print_warning "Production environment has been destroyed."
    print_warning "All data and configurations have been permanently deleted."
fi

echo ""
print_status "If you need to redeploy, run: ./scripts/deploy.sh --environment $ENVIRONMENT"