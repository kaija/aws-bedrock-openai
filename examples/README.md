# Bedrock OpenAI Proxy - Examples

This directory contains examples for using the Bedrock OpenAI Proxy API and direct AWS SDK integration.

## Files

### Node.js Examples
- `nodejs_bedrock_direct.js` - Direct AWS SDK Bedrock client with comprehensive examples
- `package.json` - Node.js dependencies

### Python Examples  
- `python_httpx_client.py` - Comprehensive async client with multiple examples
- `python_sync_client.py` - Simple synchronous client for basic usage

### Documentation
- `README.md` - This file

## Setup

### Node.js Setup

1. Install Node.js dependencies:
   ```bash
   cd examples
   npm install
   ```

2. Set your Bedrock API token:
   ```bash
   export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......"
   export AWS_REGION="ap-northeast-1"  # Optional, defaults to ap-northeast-1
   ```

3. Run the Node.js example:
   ```bash
   npm run direct
   # or
   node nodejs_bedrock_direct.js
   ```

### Python Setup

1. Install Python dependencies:
   ```bash
   pip install httpx asyncio
   # or
   npm run install-python-deps
   ```

2. Set your environment variables:
   ```bash
   export BEDROCK_OPENAI_BASE_URL="https://your-api-domain.com/dev"
   export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......"
   ```

## Usage

### Node.js Direct AWS SDK Example

```bash
npm run direct
```

Features:
- ✅ Direct AWS SDK Bedrock integration
- ✅ Converse API and Legacy API support
- ✅ Automatic API selection based on model
- ✅ Comprehensive error handling
- ✅ Multi-turn conversations
- ✅ System message support
- ✅ Usage token tracking
- ✅ Model listing
- ✅ Same credential flow as the proxy

### Python Async Client (Proxy)

```bash
npm run async
# or
python python_httpx_client.py
```

Features:
- ✅ OpenAI-compatible chat completions via proxy
- ✅ Model listing via proxy
- ✅ Vision model support
- ✅ System messages
- ✅ Async/await support

### Python Synchronous Client (Proxy)

```bash
npm run sync  
# or
python python_sync_client.py
```

Features:
- ✅ OpenAI-compatible chat completions via proxy
- ✅ Model listing via proxy
- ✅ Simple synchronous API
- ✅ Multi-turn conversations

## Node.js Direct AWS SDK Usage

The `nodejs_bedrock_direct.js` example demonstrates how to use the AWS SDK directly with the same credential flow as the proxy:

### Basic Usage

```javascript
const { DirectBedrockClient } = require('./nodejs_bedrock_direct');

// Initialize with Bedrock API token
const client = new DirectBedrockClient('ap-northeast-1', 'bedrock-api-key-...');

// Simple chat
const response = await client.invokeModel(
    'anthropic.claude-3-haiku-20240307-v1:0',
    [{ role: 'user', content: 'Hello!' }],
    { temperature: 0.7, maxTokens: 200 }
);

console.log(response.content[0].text);
```

### Advanced Features

```javascript
// Multi-turn conversation
const conversation = [
    { role: 'user', content: 'What is AWS Bedrock?' },
    { role: 'assistant', content: 'AWS Bedrock is...' },
    { role: 'user', content: 'Which models are available?' }
];

const response = await client.invokeModel(
    'anthropic.claude-3-sonnet-20240229-v1:0',
    conversation,
    { 
        temperature: 0.3, 
        maxTokens: 400,
        systemMessage: 'You are a helpful AWS expert.'
    }
);
```

### Direct API Calls

```javascript
// Use Converse API directly
const response = await client.callConverseAPI(
    'anthropic.claude-3-5-sonnet-20240620-v1:0',
    messages,
    { temperature: 0.7, maxTokens: 1000 }
);

// Use Legacy API directly  
const claudeRequest = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 150,
    temperature: 0.8,
    messages: [{ role: 'user', content: 'Hello!' }]
};

const response = await client.callLegacyAPI(
    'anthropic.claude-instant-v1',
    claudeRequest
);
```

## API Endpoints

### Chat Completions (OpenAI Compatible)
```python
response = await client.chat_completion(
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    model="gpt-3.5-turbo",
    temperature=0.7,
    max_tokens=1000
)
```

### Claude Native Format
```python
response = await client.claude_native(
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    model="claude-3-sonnet",
    system="You are a helpful assistant."
)
```

### List Models
```python
models = await client.list_models()
```

## Model Mapping

The proxy automatically maps OpenAI model names to Bedrock models:

| OpenAI Model | Bedrock Model (ap-northeast-1) |
|--------------|--------------------------------|
| `gpt-3.5-turbo` | `anthropic.claude-3-haiku-20240307-v1:0` |
| `gpt-4` | `anthropic.claude-3-sonnet-20240229-v1:0` |
| `gpt-4-turbo` | `anthropic.claude-3-5-sonnet-20240620-v1:0` |
| `gpt-4o` | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| `claude-instant` | `anthropic.claude-instant-v1` |
| `claude-3-haiku` | `anthropic.claude-3-haiku-20240307-v1:0` |
| `claude-3-sonnet` | `anthropic.claude-3-sonnet-20240229-v1:0` |
| `claude-3-5-sonnet` | `anthropic.claude-3-5-sonnet-20240620-v1:0` |
| `claude-3-5-sonnet-v2` | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| `claude-3-7-sonnet` | `anthropic.claude-3-7-sonnet-20250219-v1:0` |
| `claude-4-sonnet` | `anthropic.claude-sonnet-4-20250514-v1:0` |
| `nova-pro` | `amazon.nova-pro-v1:0` |
| `nova-lite` | `amazon.nova-lite-v1:0` |
| `nova-micro` | `amazon.nova-micro-v1:0` |

## Vision Support

For vision-capable models, you can include images in your messages:

```python
messages = [
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
```

## Error Handling

The client includes proper error handling for:
- HTTP errors (4xx, 5xx)
- Network timeouts
- Invalid responses
- Authentication failures

## Environment Variables

### For Node.js Direct AWS SDK
| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_BEARER_TOKEN_BEDROCK` | Bedrock API token | `bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......` |
| `AWS_REGION` | AWS region for Bedrock | `ap-northeast-1` |

### For Python Proxy Clients
| Variable | Description | Example |
|----------|-------------|---------|
| `BEDROCK_OPENAI_BASE_URL` | Base URL of your deployed API | `https://openai.ez2.click/dev` |
| `AWS_BEARER_TOKEN_BEDROCK` | Bedrock API token | `bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......` |

## Integration with OpenAI Libraries

You can also use the standard OpenAI Python library by setting the base URL:

```python
from openai import OpenAI

client = OpenAI(
    api_key="bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......",
    base_url="https://your-api-domain.com/dev/v1"
)

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)
```

## LangChain Integration

```python
from langchain.chat_models import ChatOpenAI

llm = ChatOpenAI(
    openai_api_key="bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......",
    openai_api_base="https://your-api-domain.com/dev/v1",
    model_name="gpt-3.5-turbo"
)

response = llm.predict("What is AWS Bedrock?")
```

## Running All Examples

To test all examples at once:

```bash
# Install all dependencies
cd examples
npm install
npm run install-python-deps

# Set environment variables
export AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......"
export BEDROCK_OPENAI_BASE_URL="https://your-api-domain.com/dev"
export AWS_REGION="ap-northeast-1"

# Run all examples
npm run test-all
```