#!/bin/bash

# Bedrock OpenAI Proxy - Local Testing Script
# This script sets up and runs local Lambda testing with SAM CLI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
PORT=3000
DEBUG=false
BEDROCK_TOKEN=""

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

Test the Bedrock OpenAI Proxy Lambda function locally using SAM CLI.

OPTIONS:
    -e, --environment ENV    Environment (dev, staging, prod) [default: dev]
    -p, --port PORT         Local API port [default: 3000]
    -t, --token TOKEN       Bedrock API token for testing
    -d, --debug             Enable debug mode
    -h, --help              Show this help message

EXAMPLES:
    # Basic local testing
    $0 --token "bedrock-api-key-..."

    # Test with custom port and debug
    $0 --port 8080 --debug --token "bedrock-api-key-..."

    # Test specific environment
    $0 --environment staging --token "bedrock-api-key-..."

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -t|--token)
            BEDROCK_TOKEN="$2"
            shift 2
            ;;
        -d|--debug)
            DEBUG=true
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

print_status "Starting local Lambda testing setup"
print_status "Environment: $ENVIRONMENT"
print_status "Port: $PORT"
print_status "Debug: $DEBUG"

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    print_error "SAM CLI is not installed. Please install it first."
    print_error "Visit: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
print_status "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid."
    print_error "Please run 'aws configure' or set AWS environment variables."
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_success "AWS credentials verified (Account: $AWS_ACCOUNT_ID)"

# Validate Bedrock token
if [[ -z "$BEDROCK_TOKEN" ]]; then
    print_warning "No Bedrock token provided. You can set it later or pass it in requests."
    print_warning "Use --token flag or set AWS_BEARER_TOKEN_BEDROCK environment variable."
else
    export AWS_BEARER_TOKEN_BEDROCK="$BEDROCK_TOKEN"
    print_success "Bedrock token configured"
fi

# Build the application
print_status "Building the application..."
npm run build

if [[ $? -ne 0 ]]; then
    print_error "Build failed. Please fix the build errors."
    exit 1
fi

print_success "Build completed successfully"

# Create local environment file
print_status "Creating local environment configuration..."
cat > .env.local << EOF
ENVIRONMENT=$ENVIRONMENT
AWS_REGION=ap-northeast-1
LOG_LEVEL=${DEBUG:+DEBUG}${DEBUG:-INFO}
NODE_ENV=development
AWS_BEARER_TOKEN_BEDROCK=$BEDROCK_TOKEN
EOF

print_success "Environment configuration created"

# Start SAM local API
print_status "Starting SAM local API on port $PORT..."
print_status "Press Ctrl+C to stop the server"
print_status ""
print_status "API will be available at: http://localhost:$PORT"
print_status "Health check: http://localhost:$PORT/health"
print_status "Chat completions: http://localhost:$PORT/v1/chat/completions"
print_status "Models: http://localhost:$PORT/v1/models"
print_status ""

# Set debug flags if enabled
DEBUG_FLAGS=""
if [[ "$DEBUG" == true ]]; then
    DEBUG_FLAGS="--debug"
fi

# Start the local API
sam local start-api \
    --port $PORT \
    --env-vars .env.local \
    --warm-containers EAGER \
    $DEBUG_FLAGS

# Cleanup on exit
cleanup() {
    print_status "Cleaning up..."
    if [[ -f ".env.local" ]]; then
        rm .env.local
        print_success "Removed local environment file"
    fi
}

trap cleanup EXIT