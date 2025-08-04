#!/usr/bin/env python3
"""
Bedrock OpenAI Proxy - Python httpx Client Example

This example demonstrates how to use the Bedrock OpenAI Proxy API
with Python's httpx library for both OpenAI-compatible and Claude-native requests.
"""

import asyncio
import httpx
import json
import os
from typing import Dict, Any, Optional


class BedrockOpenAIClient:
    """Client for Bedrock OpenAI Proxy API using httpx"""
    
    def __init__(self, base_url: str, aws_bearer_token: str):
        """
        Initialize the client
        
        Args:
            base_url: The base URL of your deployed API (e.g., https://openai.ez2.click/dev)
            aws_bearer_token: Your Bedrock API Token in format bedrock-api-key-<base64-encoded-data>
        """
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {aws_bearer_token}'
        }
    
    async def chat_completion(
        self,
        messages: list,
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = 1000,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Send a chat completion request (OpenAI-compatible format)
        
        Args:
            messages: List of message objects with 'role' and 'content'
            model: Model name (will be mapped to Bedrock model)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            
        Returns:
            Response from the API
        """
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    async def list_models(self) -> Dict[str, Any]:
        """
        List available models
        
        Returns:
            List of available models
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v1/models",
                headers=self.headers,
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()


async def main():
    """Example usage of the Bedrock OpenAI Proxy client"""
    
    # Configuration - replace with your actual values
    BASE_URL = os.getenv('BEDROCK_OPENAI_BASE_URL', 'https://openai.ez2.click/')
    AWS_BEARER_TOKEN = os.getenv('AWS_BEARER_TOKEN_BEDROCK', 'bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......')
    
    if AWS_BEARER_TOKEN == 'bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......':
        print("⚠️  Please set your Bedrock API Token in the AWS_BEARER_TOKEN_BEDROCK environment variable")
        print("   Format: bedrock-api-key-<base64-encoded-data>")
        print("   export AWS_BEARER_TOKEN_BEDROCK=bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......")
        return
    
    # Initialize client
    client = BedrockOpenAIClient(BASE_URL, AWS_BEARER_TOKEN)
    
    print("🚀 Bedrock OpenAI Proxy Client Examples\n")
    
    try:
        # Example 1: List available models
        print("📋 Listing available models...")
        models = await client.list_models()
        print(f"Available models: {json.dumps(models, indent=2)}\n")
        
        # Example 2: Simple chat completion (OpenAI format)
        print("💬 OpenAI-compatible chat completion...")
        messages = [
            {"role": "user", "content": "Hello! Can you tell me about AWS Bedrock?"}
        ]
        
        response = await client.chat_completion(
            messages=messages,
            model="gpt-3.5-turbo",
            temperature=0.7,
            max_tokens=500
        )
        
        print(f"Response: {response['choices'][0]['message']['content']}\n")
        print(f"Usage: {response['usage']}\n")
        
        # Example 3: Chat with system message
        print("🎭 Chat with system message...")
        messages_with_system = [
            {"role": "system", "content": "You are a helpful AWS expert assistant."},
            {"role": "user", "content": "What are the benefits of using AWS Bedrock?"}
        ]
        
        response = await client.chat_completion(
            messages=messages_with_system,
            model="gpt-4",
            temperature=0.5,
            max_tokens=300
        )
        
        print(f"Response: {response['choices'][0]['message']['content']}\n")
        
        # Example 4: Vision model (if supported)
        print("👁️  Vision model example...")
        vision_messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What do you see in this image?"},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                        }
                    }
                ]
            }
        ]
        
        try:
            vision_response = await client.chat_completion(
                messages=vision_messages,
                model="claude-3-sonnet",
                temperature=0.5,
                max_tokens=300
            )
            print(f"Vision Response: {vision_response['choices'][0]['message']['content']}\n")
        except Exception as e:
            print(f"Vision model not available or error: {e}\n")
        
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP Error: {e.response.status_code}")
        print(f"Response: {e.response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())