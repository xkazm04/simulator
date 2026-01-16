/**
 * Universal Gemini AI Provider
 *
 * Server-side client for Google's Gemini API.
 * Supports text and multimodal (image) inputs.
 */

import { GoogleGenAI } from '@google/genai';

// Default model for vision/multimodal tasks
export const GEMINI_VISION_MODEL = 'gemini-3-flash-preview';

// Initialize the client (server-side only)
let geminiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

/**
 * Content part types for Gemini API
 */
export interface TextPart {
  text: string;
}

export interface ImagePart {
  inlineData: {
    mimeType: string;
    data: string; // base64 encoded
  };
}

export type ContentPart = TextPart | ImagePart;

/**
 * Options for Gemini generation
 */
export interface GeminiOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
}

/**
 * Generate content using Gemini
 * Supports both text-only and multimodal (text + images) inputs
 */
export async function generateContent(
  contents: ContentPart[],
  options: GeminiOptions = {}
): Promise<string> {
  const client = getClient();
  const model = options.model || GEMINI_VISION_MODEL;

  const response = await client.models.generateContent({
    model,
    contents: [{ role: 'user', parts: contents }],
    config: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2048,
      ...(options.systemInstruction && {
        systemInstruction: options.systemInstruction,
      }),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('No text response from Gemini');
  }
  return text;
}

/**
 * Helper to create an image part from a data URL
 * Extracts mime type and base64 data from data URL format
 */
export function createImagePart(dataUrl: string): ImagePart {
  // Parse data URL: data:image/png;base64,xxxxx
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }

  const [, mimeType, data] = matches;
  return {
    inlineData: {
      mimeType,
      data,
    },
  };
}

/**
 * Helper to create a text part
 */
export function createTextPart(text: string): TextPart {
  return { text };
}

/**
 * Analyze an image with a text prompt
 * Convenience function for common vision use case
 */
export async function analyzeImage(
  imageDataUrl: string,
  prompt: string,
  options: Omit<GeminiOptions, 'model'> = {}
): Promise<string> {
  const imagePart = createImagePart(imageDataUrl);
  const textPart = createTextPart(prompt);

  return generateContent([imagePart, textPart], {
    ...options,
    model: GEMINI_VISION_MODEL,
  });
}
