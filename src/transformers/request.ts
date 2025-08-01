import { OpenAIMessage, ClaudeMessage, ValidationResult } from '../types';

/**
 * Processes image URL and extracts base64 data with proper media type detection
 */
function processImageUrl(imageUrl: string): { data: string; mediaType: string } {
  let base64Image: string;
  let mediaType = 'image/jpeg'; // Default fallback

  if (imageUrl.startsWith('data:')) {
    // Standard data URL format: data:image/jpeg;base64,/9j/4AAQ...
    const [header, data] = imageUrl.split(',');
    if (!data) {
      throw new Error('Invalid data URL format');
    }

    // Extract media type from header
    const mediaTypeMatch = header.match(/data:([^;]+)/);
    if (mediaTypeMatch) {
      mediaType = mediaTypeMatch[1];
    }

    base64Image = data;
  } else if (imageUrl.includes('{') && imageUrl.includes('}')) {
    // Custom format from original sample.ts: {base64data}
    base64Image = imageUrl.substring(
      imageUrl.indexOf('{') + 1,
      imageUrl.indexOf('}')
    );

    // Try to detect format from base64 header
    mediaType = detectImageFormatFromBase64(base64Image);
  } else {
    // Assume the entire URL is base64 data
    base64Image = imageUrl;
    mediaType = detectImageFormatFromBase64(base64Image);
  }

  // Validate base64 data
  if (!isValidBase64(base64Image)) {
    throw new Error('Invalid base64 image data');
  }

  // Validate image for vision processing
  const validation = validateImageForVision(base64Image, mediaType);
  if (!validation.isValid) {
    throw new Error(validation.error!);
  }

  // Optimize image for vision models
  const optimized = optimizeImageForVision(base64Image, mediaType);

  return optimized;
}

/**
 * Detects image format from base64 data header
 */
function detectImageFormatFromBase64(base64Data: string): string {
  // Common image format signatures in base64
  const signatures = {
    '/9j/': 'image/jpeg',  // JPEG
    'iVBORw0KGgo': 'image/png',  // PNG
    'R0lGOD': 'image/gif',  // GIF
    'UklGR': 'image/webp'   // WebP
  };

  for (const [signature, mimeType] of Object.entries(signatures)) {
    if (base64Data.startsWith(signature)) {
      return mimeType;
    }
  }

  return 'image/jpeg'; // Default fallback
}

/**
 * Validates base64 string format
 */
function isValidBase64(str: string): boolean {
  try {
    // Check if string contains only valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(str) && str.length % 4 === 0;
  } catch {
    return false;
  }
}

/**
 * Optimizes image for vision models
 */
function optimizeImageForVision(base64Data: string, mediaType: string): { data: string; mediaType: string } {
  // For now, return as-is. In the future, could implement:
  // - Image resizing for large images
  // - Format conversion for better compatibility
  // - Compression for faster processing

  const estimatedSize = (base64Data.length * 3) / 4;

  // Log image info for monitoring
  console.log('Processing vision image', {
    mediaType,
    estimatedSizeBytes: estimatedSize,
    estimatedSizeMB: Math.round(estimatedSize / (1024 * 1024) * 100) / 100
  });

  return { data: base64Data, mediaType };
}

/**
 * Validates image content for vision models
 */
function validateImageForVision(base64Data: string, mediaType: string): { isValid: boolean; error?: string } {
  // Check file size limits (20MB for Bedrock)
  const estimatedSize = (base64Data.length * 3) / 4;
  const maxSize = 20 * 1024 * 1024; // 20MB

  if (estimatedSize > maxSize) {
    return {
      isValid: false,
      error: `Image size (${Math.round(estimatedSize / (1024 * 1024) * 100) / 100}MB) exceeds maximum allowed size (20MB)`
    };
  }

  // Check supported formats
  const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!supportedFormats.includes(mediaType)) {
    return {
      isValid: false,
      error: `Unsupported image format: ${mediaType}. Supported formats: ${supportedFormats.join(', ')}`
    };
  }

  // Check minimum size (avoid tiny images that might be tracking pixels)
  const minSize = 100; // 100 bytes minimum
  if (estimatedSize < minSize) {
    return {
      isValid: false,
      error: 'Image too small to be processed'
    };
  }

  return { isValid: true };
}

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
          try {
            const processedImage = processImageUrl(item.image_url.url);
            claudeMessage.content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: processedImage.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: processedImage.data
              }
            });
          } catch (error) {
            console.warn('Failed to process image URL:', error);
            // Skip invalid images rather than failing the entire request
          }
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
  // Check if body exists
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: 'Invalid request body' };
  }

  // Validate required model parameter
  if (!body.model || typeof body.model !== 'string') {
    return { isValid: false, error: 'Missing or invalid required parameter: model' };
  }

  // Validate required messages parameter
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return { isValid: false, error: 'Missing or empty messages array' };
  }

  // Validate message structure
  for (let i = 0; i < body.messages.length; i++) {
    const message = body.messages[i];

    // Validate role
    if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
      return {
        isValid: false,
        error: `Invalid role in message ${i}: ${message.role}`,
        details: { messageIndex: i, role: message.role }
      };
    }

    // Validate content
    if (!message.content) {
      return {
        isValid: false,
        error: `Missing content in message ${i}`,
        details: { messageIndex: i }
      };
    }

    // Validate content structure for complex content
    if (Array.isArray(message.content)) {
      for (let j = 0; j < message.content.length; j++) {
        const contentItem = message.content[j];

        if (!contentItem.type) {
          return {
            isValid: false,
            error: `Missing type in content item ${j} of message ${i}`,
            details: { messageIndex: i, contentIndex: j }
          };
        }

        if (contentItem.type === 'text' && !contentItem.text) {
          return {
            isValid: false,
            error: `Missing text in text content item ${j} of message ${i}`,
            details: { messageIndex: i, contentIndex: j }
          };
        }

        if (contentItem.type === 'image_url' && (!contentItem.image_url || !contentItem.image_url.url)) {
          return {
            isValid: false,
            error: `Missing or invalid image_url in content item ${j} of message ${i}`,
            details: { messageIndex: i, contentIndex: j }
          };
        }
      }
    }
  }

  // Validate optional parameters with proper ranges
  if (body.temperature !== undefined) {
    if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) {
      return { isValid: false, error: 'Temperature must be a number between 0 and 2' };
    }
  }

  if (body.max_tokens !== undefined) {
    if (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 8192) {
      return { isValid: false, error: 'max_tokens must be an integer between 1 and 8192' };
    }
  }

  if (body.top_p !== undefined) {
    if (typeof body.top_p !== 'number' || body.top_p < 0 || body.top_p > 1) {
      return { isValid: false, error: 'top_p must be a number between 0 and 1' };
    }
  }

  if (body.top_k !== undefined) {
    if (!Number.isInteger(body.top_k) || body.top_k < 1 || body.top_k > 500) {
      return { isValid: false, error: 'top_k must be an integer between 1 and 500' };
    }
  }

  if (body.stream !== undefined && typeof body.stream !== 'boolean') {
    return { isValid: false, error: 'stream must be a boolean' };
  }

  // Validate message count limits
  if (body.messages.length > 100) {
    return { isValid: false, error: 'Too many messages (max 100)' };
  }

  // Validate vision model usage
  const hasImages = body.messages.some((msg: any) =>
    Array.isArray(msg.content) &&
    msg.content.some((item: any) => item.type === 'image_url')
  );

  if (hasImages) {
    const visionValidation = validateVisionModelUsage(body.model, body.messages);
    if (!visionValidation.isValid) {
      return visionValidation;
    }
  }

  return { isValid: true };
}

/**
 * Validates vision model usage
 */
function validateVisionModelUsage(model: string, messages: any[]): ValidationResult {
  // List of vision-capable models
  const visionModels = [
    'claude-3-haiku',
    'claude-3-sonnet',
    'claude-3-opus',
    'claude-3-5-sonnet',
    'claude-3-5-sonnet-v2',
    'claude-3-7-sonnet',
    'claude-4-sonnet',
    'gpt-4-vision-preview',
    'gpt-4o',
    'anthropic.claude-3-haiku-20240307-v1:0',
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'anthropic.claude-3-opus-20240229-v1:0',
    'anthropic.claude-3-5-sonnet-20240620-v1:0',
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-3-7-sonnet-20250219-v1:0',
    'anthropic.claude-sonnet-4-20250514-v1:0'
  ];

  const isVisionModel = visionModels.some(visionModel =>
    model.includes(visionModel) || visionModel.includes(model)
  );

  if (!isVisionModel) {
    return {
      isValid: false,
      error: `Model ${model} does not support vision/image inputs. Please use a vision-capable model like claude-3-sonnet or gpt-4o.`
    };
  }

  // Count images across all messages
  let totalImages = 0;
  for (const message of messages) {
    if (Array.isArray(message.content)) {
      const imageCount = message.content.filter((item: any) => item.type === 'image_url').length;
      totalImages += imageCount;
    }
  }

  // Validate image count limits (Bedrock typically supports up to 20 images per request)
  if (totalImages > 20) {
    return {
      isValid: false,
      error: `Too many images (${totalImages}). Maximum 20 images per request.`
    };
  }

  return { isValid: true };
}
