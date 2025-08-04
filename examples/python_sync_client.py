#!/usr/bin/env python3
"""
Bedrock OpenAI Proxy - Python Synchronous Client Example

This example demonstrates how to use the Bedrock OpenAI Proxy API
with Python's httpx library using synchronous requests.
"""

import httpx
import json
import os
from typing import Dict, Any, Optional


class BedrockOpenAIClientSync:
    """Synchronous client for Bedrock OpenAI Proxy API using httpx"""
    
    def __init__(self, base_url: str, api_key: str):
        """
        Initialize the client
        
        Args:
            base_url: The base URL of your deployed API (e.g., https://openai.ez2.click/dev)
            api_key: Your Bedrock API Token in format bedrock-api-key-<base64-encoded-data>
        """
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
    
    def chat_completion(
        self,
        messages: list,
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> Dict[str, Any]:
        """
        Send a chat completion request (OpenAI-compatible format)
        
        Args:
            messages: List of message objects with 'role' and 'content'
            model: Model name (will be mapped to Bedrock model)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            
        Returns:
            Response from the API
        """
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        with httpx.Client() as client:
            response = client.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    def list_models(self) -> Dict[str, Any]:
        """
        List available models
        
        Returns:
            List of available models
        """
        with httpx.Client() as client:
            response = client.get(
                f"{self.base_url}/v1/models",
                headers=self.headers,
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()


def main():
    """Example usage of the synchronous Bedrock OpenAI Proxy client"""
    
    # Configuration - replace with your actual values
    BASE_URL = os.getenv('BEDROCK_OPENAI_BASE_URL', 'https://openai.ez2.click/dev')
    AWS_BEARER_TOKEN = os.getenv('AWS_BEARER_TOKEN_BEDROCK', 'bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......')
    
    if AWS_BEARER_TOKEN == 'bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......':
        print("⚠️  Please set your Bedrock API Token in the AWS_BEARER_TOKEN_BEDROCK environment variable")
        print("   Format: bedrock-api-key-<base64-encoded-data>")
        print("   export AWS_BEARER_TOKEN_BEDROCK=bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFte......")
        return
    
    # Initialize client
    client = BedrockOpenAIClientSync(BASE_URL, AWS_BEARER_TOKEN)
    
    print("🚀 Bedrock OpenAI Proxy Synchronous Client Example\n")
    
    try:
        # Example 1: List available models
        print("📋 Listing available models...")
        models = client.list_models()
        print(f"Available models: {json.dumps(models, indent=2)}\n")
        
        # Example 2: Simple chat completion
        print("💬 Simple chat completion...")
        messages = [
            {"role": "user", "content": "What is AWS Bedrock? Please explain in 2 sentences."}
        ]
        
        response = client.chat_completion(
            messages=messages,
            model="gpt-3.5-turbo",
            temperature=0.7,
            max_tokens=200
        )
        
        print(f"Response: {response['choices'][0]['message']['content']}\n")
        print(f"Usage: {response['usage']}\n")
        
        # Example 3: Conversation with multiple messages
        print("🗣️  Multi-turn conversation...")
        conversation = [
            {"role": "system", "content": "You are a helpful AWS expert."},
            {"role": "user", "content": "What is AWS Bedrock?"},
            {"role": "assistant", "content": "AWS Bedrock is a fully managed service that offers foundation models from leading AI companies through a single API."},
            {"role": "user", "content": "What are its main benefits?"}
        ]
        
        response = client.chat_completion(
            messages=conversation,
            model="gpt-4",
            temperature=0.5,
            max_tokens=300
        )
        
        print(f"Response: {response['choices'][0]['message']['content']}\n")
        
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP Error: {e.response.status_code}")
        print(f"Response: {e.response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    main()