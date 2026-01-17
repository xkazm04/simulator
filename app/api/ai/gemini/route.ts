/**
 * POST /api/ai/gemini
 * Image-to-image generation using Gemini's native image generation
 *
 * Takes a source image URL and a modification prompt, returns a regenerated image.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Gemini 2.5 Flash has native image generation capability
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

interface GeminiRequest {
  prompt: string;
  sourceImageUrl: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
}

// Convert URL to base64 data URL
async function urlToBase64(url: string): Promise<{ mimeType: string; data: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return {
    mimeType: contentType,
    data: base64,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GeminiRequest = await request.json();
    const { prompt, sourceImageUrl, aspectRatio = '16:9' } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!sourceImageUrl) {
      return NextResponse.json(
        { success: false, error: 'Source image URL is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GOOGLE_AI_API_KEY not configured' },
        { status: 503 }
      );
    }

    // Fetch and convert source image to base64
    let imageData: { mimeType: string; data: string };
    try {
      imageData = await urlToBase64(sourceImageUrl);
    } catch (error) {
      console.error('Failed to fetch source image:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch source image' },
        { status: 400 }
      );
    }

    // Initialize Gemini client
    const client = new GoogleGenAI({ apiKey });

    // Build the modification prompt - allow full transformations
    const modificationPrompt = `Using the provided image as reference, generate a new image that applies these changes: ${prompt.trim()}

You may change composition, camera angle, style, and any other aspects as needed to fulfill the request. The reference image shows the subject matter and context, but you should transform it according to the user's instructions. Generate a high-quality, detailed image.`;

    // Map aspect ratio to width/height for image generation config
    const aspectRatioMap: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '1:1': { width: 1024, height: 1024 },
      '4:3': { width: 1536, height: 1152 },
      '3:4': { width: 1152, height: 1536 },
    };
    const dimensions = aspectRatioMap[aspectRatio] || aspectRatioMap['16:9'];

    // Generate using Gemini's image generation model
    const response = await client.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: imageData.mimeType,
                data: imageData.data,
              },
            },
            {
              text: modificationPrompt,
            },
          ],
        },
      ],
      config: {
        responseModalities: ['image', 'text'],
        // Image generation specific config
        ...(dimensions && {
          imageGenerationConfig: {
            aspectRatio: aspectRatio,
          },
        }),
      },
    });

    // Extract the generated image from response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No response from Gemini' },
        { status: 500 }
      );
    }

    // Look for image parts in the response
    const parts = candidates[0].content?.parts || [];
    let generatedImageUrl: string | null = null;

    for (const part of parts) {
      // Check for inline data (base64 image)
      if ('inlineData' in part && part.inlineData) {
        const { mimeType, data } = part.inlineData;
        generatedImageUrl = `data:${mimeType};base64,${data}`;
        break;
      }
      // Check for file data (URI reference)
      if ('fileData' in part && part.fileData) {
        generatedImageUrl = part.fileData.fileUri || null;
        break;
      }
    }

    if (!generatedImageUrl) {
      // If no image was generated, check for text response with error
      const textPart = parts.find((p) => 'text' in p && p.text);
      const errorText = textPart && 'text' in textPart ? textPart.text : 'No image generated';
      return NextResponse.json(
        { success: false, error: `Image generation failed: ${errorText}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl: generatedImageUrl,
    });
  } catch (error) {
    console.error('Gemini image generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate image',
      },
      { status: 500 }
    );
  }
}
