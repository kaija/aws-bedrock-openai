#!/bin/bash

# Build script for Bedrock OpenAI Proxy

set -e

echo "🔨 Building Bedrock OpenAI Proxy..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm test

# Build TypeScript
echo "🏗️  Compiling TypeScript..."
npm run build

# Copy package.json for Lambda
echo "📋 Copying package.json..."
cp package.json dist/

# Install production dependencies in dist
echo "📦 Installing production dependencies..."
cd dist && npm ci --only=production && cd ..

echo "✅ Build completed successfully!"
echo "📁 Output directory: dist/"