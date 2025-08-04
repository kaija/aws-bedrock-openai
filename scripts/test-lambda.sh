#!/bin/bash

# Bedrock OpenAI Proxy - Local Lambda Function Tester
# This script builds and tests the Lambda function locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
Usage: $0 [BEDROCK_TOKEN]

Test the Lambda function locally by directly invoking the handler.

ARGUMENTS:
    BEDROCK_TOKEN    Your Bedrock API token (bedrock-api-key-...)

ENVIRONMENT VARIABLES:
    AWS_BEARER_TOKEN_BEDROCK    Alternative way to provide the token
    AWS_REGION                  AWS region (default: ap-northeast-1)

EXAMPLES:
    # Using command line argument
    $0 "bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......"

    # Using environment variable
    export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-..."
    $0

EOF
}

# Check for help flag
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

print_status "Bedrock OpenAI Proxy - Local Lambda Testing"
print_status "==========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Build the project
print_status "Building the project..."
if ! npm run build; then
    print_error "Build failed. Please fix the build errors."
    exit 1
fi
print_success "Build completed successfully"

# Check for Bedrock token
BEDROCK_TOKEN="$1"
if [[ -z "$BEDROCK_TOKEN" ]]; then
    BEDROCK_TOKEN="$AWS_BEARER_TOKEN_BEDROCK"
fi

if [[ -z "$BEDROCK_TOKEN" ]]; then
    print_error "No Bedrock API token provided!"
    echo ""
    show_usage
    exit 1
fi

# Validate token format
if [[ ! "$BEDROCK_TOKEN" =~ ^bedrock-api-key- ]]; then
    print_warning "Token does not start with 'bedrock-api-key-'"
    print_warning "This might cause authentication issues."
fi

# Set environment variables
export AWS_BEARER_TOKEN_BEDROCK="$BEDROCK_TOKEN"
export AWS_REGION="${AWS_REGION:-ap-northeast-1}"

print_status "Starting local Lambda function tests..."
print_status "Token: ${BEDROCK_TOKEN:0:20}..."
print_status "Region: $AWS_REGION"
echo ""

# Run the local tests
node scripts/test-lambda-local.js

# Check the exit code
if [[ $? -eq 0 ]]; then
    echo ""
    print_success "All tests completed successfully!"
    print_success "Your Lambda function can successfully call the Bedrock API"
else
    echo ""
    print_error "Some tests failed. Please check the output above."
    print_error "Common issues:"
    print_error "  - Invalid Bedrock API token"
    print_error "  - Insufficient AWS permissions"
    print_error "  - Network connectivity issues"
    print_error "  - Bedrock service unavailable in your region"
    exit 1
fi