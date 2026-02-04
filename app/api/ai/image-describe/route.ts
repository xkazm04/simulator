import { NextRequest, NextResponse } from 'next/server';
import { getUnifiedProvider, isGeminiAvailable, AIError, parseAIJsonResponse } from '@/app/lib/ai';
import { createErrorResponse, HTTP_STATUS } from '@/app/utils/apiErrorHandling';

/**
 * Image Description API - Uses unified AI provider (Gemini Vision) to analyze images
 *
 * Uses the unified AI provider layer for consistent error handling,
 * rate limiting, caching, and cost tracking.
 *
 * POST /api/ai/image-describe
 * Body: { imageDataUrl: string }
 * Returns: { success: boolean, description?: ImageDescription, error?: string }
 */

// System instruction for image analysis
const IMAGE_ANALYSIS_INSTRUCTION = `You are a visual analysis expert for a creative "What If" image simulator tool.

Your task is to analyze uploaded images and extract structured information that can serve as a BASE FORMAT for creating variations.

CORE CONCEPT: Content-Swap Transformation
The tool PRESERVES the visual FORMAT (camera angle, composition, UI layout, medium) while allowing users to SWAP the CONTENT (characters, environment, technology, etc.).

When analyzing an image, identify:
1. FORMAT elements to PRESERVE: camera angle, composition, lighting style, UI elements if present, aspect ratio feel
2. CONTENT elements that could be SWAPPED: characters, environment, objects, technology, creatures

Be specific about visual elements. Use reference terminology that users would understand (e.g., "isometric RPG view like Baldur's Gate" instead of "3/4 top-down perspective").

OUTPUT: Return ONLY valid JSON, no markdown formatting or code blocks.`;

// Prompt for image analysis
const IMAGE_ANALYSIS_PROMPT = `Analyze this image for use as a base reference in a "What If" image variation tool.

Return JSON with this exact structure:
{
  "success": true,
  "description": {
    "summary": "One sentence describing what this image shows",
    "format": {
      "type": "screenshot|artwork|photo|render|etc",
      "camera": "Specific camera angle/perspective description",
      "composition": "How elements are arranged in frame",
      "medium": "Digital art, 3D render, photograph, etc.",
      "aspectFeel": "Cinematic wide, square portrait, vertical, etc."
    },
    "preserveElements": [
      "List of FORMAT elements that should be preserved when making variations"
    ],
    "swappableContent": {
      "environment": "Description of setting/world that could be swapped",
      "characters": "Description of characters/subjects that could be swapped",
      "technology": "Objects, weapons, items that could be swapped",
      "mood": "Current mood/atmosphere",
      "style": "Art style description"
    },
    "suggestedBaseDescription": "A formatted description suitable as the 'Base Image' field for the simulator - focus on FORMAT not content",
    "suggestedOutputMode": "gameplay|sketch|trailer|poster (gameplay for game UIs, sketch for artistic/concept art, trailer for cinematic scenes, poster for key art)",
    "detectedReferences": ["Any recognizable cultural references - games, movies, art styles"]
  }
}`;

export interface ImageDescription {
  summary: string;
  format: {
    type: string;
    camera: string;
    composition: string;
    medium: string;
    aspectFeel: string;
  };
  preserveElements: string[];
  swappableContent: {
    environment: string;
    characters: string;
    technology: string;
    mood: string;
    style: string;
  };
  suggestedBaseDescription: string;
  suggestedOutputMode: 'gameplay' | 'sketch' | 'trailer' | 'poster';
  detectedReferences: string[];
}

interface ImageDescribeRequest {
  imageDataUrl: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ImageDescribeRequest = await request.json();
    const { imageDataUrl } = body;

    if (!imageDataUrl) {
      return createErrorResponse('No image provided', HTTP_STATUS.BAD_REQUEST);
    }

    // Validate it's a data URL
    if (!imageDataUrl.startsWith('data:image/')) {
      return createErrorResponse('Invalid image format - must be a data URL', HTTP_STATUS.BAD_REQUEST);
    }

    // Check size (rough estimate - data URLs are ~1.37x larger than binary)
    const estimatedSizeBytes = (imageDataUrl.length * 3) / 4;
    const maxSizeMB = 10;
    if (estimatedSizeBytes > maxSizeMB * 1024 * 1024) {
      return createErrorResponse(`Image too large - max ${maxSizeMB}MB`, HTTP_STATUS.BAD_REQUEST);
    }

    // Check if API key is configured
    if (!isGeminiAvailable()) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_AI_API_KEY not configured',
      });
    }

    // Use unified provider for Gemini Vision
    try {
      const provider = getUnifiedProvider();
      const result = await provider.analyzeImage({
        imageDataUrl,
        prompt: IMAGE_ANALYSIS_PROMPT,
        systemInstruction: IMAGE_ANALYSIS_INSTRUCTION,
        temperature: 0.3,
        maxTokens: 1500,
        metadata: { feature: 'image-describe' },
      });

      // Parse JSON from response with robust handling
      const parsed = parseAIJsonResponse(result.text);
      return NextResponse.json(parsed);
    } catch (error) {
      console.error('AI provider error:', error);
      const errorMessage = error instanceof AIError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : 'Failed to analyze image';
      return NextResponse.json({
        success: false,
        error: errorMessage,
      });
    }
  } catch (error) {
    console.error('Image describe error:', error);
    return createErrorResponse('Failed to analyze image', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
