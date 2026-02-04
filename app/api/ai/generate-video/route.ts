/**
 * POST /api/ai/generate-video
 * Start video generation from an image using Leonardo Seedance 1.0
 *
 * GET /api/ai/generate-video?generationId=xxx
 * Check status of a video generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeonardoProvider, isLeonardoAvailable, AIError, checkGenerationStatus } from '@/app/lib/ai';

interface GenerateVideoRequest {
  sourceImageUrl: string;  // URL of the source image
  prompt: string;
  duration?: 4 | 6 | 8;
}

/**
 * POST - Start video generation from image
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Leonardo API is available
    if (!isLeonardoAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Leonardo API key not configured' },
        { status: 503 }
      );
    }

    const body: GenerateVideoRequest = await request.json();
    const { sourceImageUrl, prompt, duration = 8 } = body;

    if (!sourceImageUrl) {
      return NextResponse.json(
        { success: false, error: 'sourceImageUrl is required' },
        { status: 400 }
      );
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: 'prompt is required' },
        { status: 400 }
      );
    }

    const leonardo = getLeonardoProvider();

    // Step 1: Download the source image
    console.log('[generate-video] Fetching source image from:', sourceImageUrl.substring(0, 100));
    const imageResponse = await fetch(sourceImageUrl);
    if (!imageResponse.ok) {
      console.error('[generate-video] Failed to fetch source image:', imageResponse.status, imageResponse.statusText);
      return NextResponse.json(
        { success: false, error: `Failed to fetch source image: ${imageResponse.statusText}` },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    console.log('[generate-video] Image buffer size:', imageBuffer.length, 'bytes');

    // Determine image extension from content type or URL
    const contentType = imageResponse.headers.get('content-type') || '';
    let extension = 'jpg';
    if (contentType.includes('png')) {
      extension = 'png';
    } else if (contentType.includes('webp')) {
      extension = 'webp';
    } else if (sourceImageUrl.endsWith('.png')) {
      extension = 'png';
    } else if (sourceImageUrl.endsWith('.webp')) {
      extension = 'webp';
    }
    console.log('[generate-video] Detected extension:', extension, 'content-type:', contentType);

    // Step 2: Upload image to Leonardo
    console.log('[generate-video] Uploading image to Leonardo...');
    const initImageId = await leonardo.uploadInitImage(imageBuffer, extension);
    console.log('[generate-video] Image uploaded, ID:', initImageId);

    // Step 3: Start video generation
    console.log('[generate-video] Starting video generation with prompt:', prompt.substring(0, 50));
    const { generationId } = await leonardo.startVideoGeneration({
      initImageId,
      prompt: prompt.trim(),
      duration,
    });
    console.log('[generate-video] Video generation started, ID:', generationId);

    return NextResponse.json({
      success: true,
      generationId,
      status: 'pending',
    });
  } catch (error) {
    console.error('Generate video error:', error);

    const errorMessage = error instanceof AIError
      ? `${error.code}: ${error.message}`
      : error instanceof Error
        ? error.message
        : 'Failed to start video generation';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET - Check video generation status
 * Uses shared utility for consistent status checking across all generation types.
 */
export async function GET(request: NextRequest) {
  const generationId = new URL(request.url).searchParams.get('generationId');
  return checkGenerationStatus(generationId, 'video');
}
