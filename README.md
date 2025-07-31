# Bedrock OpenAI Proxy

An OpenAI-compatible API proxy for AWS Bedrock that allows you to use existing OpenAI client libraries with AWS Bedrock foundation models.

## Architecture

This project has been refactored from a single `sample.ts` file into a modular TypeScript architecture:

```
src/
├── types/           # TypeScript interfaces and types
├── transformers/    # Request/response transformation logic
├── services/        # AWS service integrations
├── handlers/        # Lambda request handlers
├── __tests__/       # Unit tests
└── index.ts         # Main Lambda handler
```

## Key Components

### Types (`src/types/`)
- **OpenAI Types**: Interfaces for OpenAI API requests and responses
- **Bedrock Types**: Interfaces for AWS Bedrock/Claude API
- **Lambda Types**: AWS Lambda event and response types

### Transformers (`src/transformers/`)
- **Request Transformer**: Converts OpenAI format to Claude/Bedrock format
- **Response Transformer**: Converts Claude responses back to OpenAI format

### Services (`src/services/`)
- **Bedrock Service**: Handles AWS Bedrock API interactions

### Handlers (`src/handlers/`)
- **Chat Handler**: Processes chat completion requests

## Supported Endpoints

- `POST /v1/chat/completions` - OpenAI-compatible chat completions
- `POST /v1/messages` - Claude-native format (backward compatibility)
- `GET /v1/models` - List available models (basic implementation)

## Features

- ✅ OpenAI to Claude message format transformation
- ✅ Vision model support (image processing)
- ✅ System message handling
- ✅ Error handling and validation
- ✅ CORS support
- ✅ TypeScript with proper typing
- ✅ Unit tests
- ✅ Backward compatibility with original sample.ts

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## Migration from sample.ts

The original `sample.ts` functionality has been preserved while improving:

1. **Modularity**: Code split into logical modules
2. **Type Safety**: Full TypeScript typing
3. **Testability**: Unit tests for all components
4. **Error Handling**: Improved error responses
5. **Extensibility**: Easy to add new providers and features

## Next Steps

This refactored codebase is ready for:
- SAM template deployment
- Additional provider support (OpenAI, Google Gemini)
- Enhanced authentication
- Parameter Store configuration
- Comprehensive monitoring and logging