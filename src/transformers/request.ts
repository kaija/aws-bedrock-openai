import { OpenAIMessage, ClaudeMessage, ClaudeMessageContent, ValidationResult } from '../types';

/**
 * Transforms OpenAI messages to Claude format
 * Based on the original openaiToClaudeParams function from sample.ts
 */
export function transformOpenAIToClaude(messages: OpenAIMessage[]): ClaudeMessage[] {
  // Filter out system messages as they are handled separately
  const filteredMessages = messages.filter((message) => message.role !== 'system');
  
  return filteredMessages.map((message) => {
    const claudeMessage: ClaudeMessage = {
      role: message.role === 'user' ? 'user' : 'assistant',
      content: []
    };

    if (typeof message.content === 'string') {
      // Simple text content
      claudeMessage.content.push({
        type: 'text',
        text: message.content
      });
    } else if (Array.isArray(message.content)) {
      // Complex content with potential images
      message.content.forEach((item) => {
        if (item.type === 'text' && item.text) {
          claudeMessage.content.push({
            type: 'text',
            text: item.text
          });
        } else if (item.type === 'image_url' && item.image_url) {
          // Extract base64 image data from the URL format
          const imageUrl = item.image_url.url;
          let base64Image: string;
          
          if (imageUrl.includes('data:')) {
            // Standard data URL format: data:image/jpeg;base64,/9j/4AAQ...
            const base64Part = imageUrl.split(',')[1];
            base64Image = base64Part;
          } else if (imageUrl.includes('{') && imageUrl.includes('}')) {
            // Custom format from original sample.ts: {base64data}
            base64Image = imageUrl.substring(
              imageUrl.indexOf('{') + 1,
              imageUrl.indexOf('}')
            );
          } else {
            // Assume the entire URL is base64 data
            base64Image = imageUrl;
          }

          claudeMessage.content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg', // Default to JPEG, could be enhanced to detect format
              data: base64Image
            }
          });
        }
      });
    }

    return claudeMessage;
  });
}

/**
 * Extracts system message from OpenAI messages
 */
export function extractSystemMessage(messages: OpenAIMessage[]): string | undefined {
  const systemMessage = messages.find(message => message.role === 'system');
  if (systemMessage && typeof systemMessage.content === 'string') {
    return systemMessage.content;
  }
  return undefined;
}

/**
 * Validates OpenAI request parameters
 */
export function validateOpenAIRequest(body: any): ValidationResult {
  if (!body.model) {
    return { isValid: false, error: 'Missing required parameter: model' };
  }
  
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return { isValid: false, error: 'Missing or empty messages array' };
  }

  // Validate message structure
  for (let i = 0; i < body.messages.length; i++) {
    const message = body.messages[i];
    if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
      return { 
        isValid: false, 
        error: `Invalid role in message ${i}: ${message.role}`,
        details: { messageIndex: i, role: message.role }
      };
    }
    
    if (!message.content) {
      return { 
        isValid: false, 
        error: `Missing content in message ${i}`,
        details: { messageIndex: i }
      };
    }
  }

  // Validate optional parameters
  if (body.temperature !== undefined && (body.temperature < 0 || body.temperature > 2)) {
    return { isValid: false, error: 'Temperature must be between 0 and 2' };
  }

  if (body.max_tokens !== undefined && body.max_tokens < 1) {
    return { isValid: false, error: 'max_tokens must be greater than 0' };
  }

  if (body.top_p !== undefined && (body.top_p < 0 || body.top_p > 1)) {
    return { isValid: false, error: 'top_p must be between 0 and 1' };
  }

  return { isValid: true };
}