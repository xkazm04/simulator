/**
 * POST /api/ai/inpainting
 * Start canvas inpainting generation using Leonardo AI
 *
 * GET /api/ai/inpainting?generationId=xxx
 * Check status of an inpainting generation
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import {
  getLeonardoProvider,
  isLeonardoAvailable,
  AIError,
} from '@/app/lib/ai';

interface InpaintingRequest {
  sourceImageUrl: string;  // URL of the source image
  maskDataUrl: string;     // Data URL of the mask (white = edit, black = preserve)
  prompt: string;
  inpaintStrength?: number;  // 0-100, default 85 (higher = more change)
}

/**
 * Normalize dimensions to Leonardo requirements (divisible by 8, max 1536)
 */
function normalizeDimensions(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(32, Math.min(1536, Math.floor(width / 8) * 8)),
    height: Math.max(32, Math.min(1536, Math.floor(height / 8) * 8)),
  };
}

/**
 * Convert base64 data URL to Buffer
 */
function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; extension: string } {
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }
  const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  return { buffer, extension };
}

/**
 * Resize an image buffer to target dimensions using sharp
 */
async function resizeImage(
  buffer: Buffer,
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp' = 'jpeg'
): Promise<Buffer> {
  let sharpInstance = sharp(buffer).resize(width, height, {
    fit: 'fill', // Stretch to exact dimensions (mask needs to match init exactly)
  });

  switch (format) {
    case 'png':
      sharpInstance = sharpInstance.png();
      break;
    case 'webp':
      sharpInstance = sharpInstance.webp();
      break;
    default:
      sharpInstance = sharpInstance.jpeg({ quality: 90 });
  }

  return sharpInstance.toBuffer();
}

/**
 * POST - Start inpainting generation
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

    const body: InpaintingRequest = await request.json();
    const { sourceImageUrl, maskDataUrl, prompt, inpaintStrength = 85 } = body;

    if (!sourceImageUrl) {
      return NextResponse.json(
        { success: false, error: 'sourceImageUrl is required' },
        { status: 400 }
      );
    }

    if (!maskDataUrl) {
      return NextResponse.json(
        { success: false, error: 'maskDataUrl is required' },
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
    console.log('[inpainting] Fetching source image from:', sourceImageUrl.substring(0, 100));
    const imageResponse = await fetch(sourceImageUrl);
    if (!imageResponse.ok) {
      console.error('[inpainting] Failed to fetch source image:', imageResponse.status);
      return NextResponse.json(
        { success: false, error: `Failed to fetch source image: ${imageResponse.statusText}` },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    console.log('[inpainting] Image buffer size:', imageBuffer.length, 'bytes');

    // Step 2: Get actual image dimensions and calculate normalized target dimensions
    const imageMetadata = await sharp(imageBuffer).metadata();
    const originalWidth = imageMetadata.width || 1344;
    const originalHeight = imageMetadata.height || 768;
    console.log('[inpainting] Original image dimensions:', originalWidth, 'x', originalHeight);

    // Normalize to dimensions divisible by 8 (Leonardo requirement)
    const { width, height } = normalizeDimensions(originalWidth, originalHeight);
    console.log('[inpainting] Normalized dimensions:', width, 'x', height);

    // Step 3: Convert mask data URL to buffer
    console.log('[inpainting] Converting mask data URL to buffer...');
    let rawMaskBuffer: Buffer;
    try {
      const maskData = dataUrlToBuffer(maskDataUrl);
      rawMaskBuffer = maskData.buffer;
      console.log('[inpainting] Raw mask buffer size:', rawMaskBuffer.length, 'bytes');
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Invalid mask data URL format' },
        { status: 400 }
      );
    }

    // Step 4: Resize both images to matching dimensions (divisible by 8)
    // Both init image and mask MUST have identical dimensions for Leonardo canvas inpainting
    console.log('[inpainting] Resizing images to:', width, 'x', height);

    const resizedInitBuffer = await resizeImage(imageBuffer, width, height, 'jpeg');
    const resizedMaskBuffer = await resizeImage(rawMaskBuffer, width, height, 'png');

    console.log('[inpainting] Resized init size:', resizedInitBuffer.length, 'bytes');
    console.log('[inpainting] Resized mask size:', resizedMaskBuffer.length, 'bytes');

    // Step 5: Upload both images to Leonardo using the canvas-specific endpoint
    // This endpoint returns IDs that are recognized for canvas inpainting operations
    console.log('[inpainting] Uploading images to Leonardo canvas endpoint...');
    const { initImageId: canvasInitId, maskImageId: canvasMaskId } = await leonardo.uploadCanvasImages(
      resizedInitBuffer,
      resizedMaskBuffer,
      'jpg',
      'png'
    );
    console.log('[inpainting] Canvas images uploaded - init:', canvasInitId, 'mask:', canvasMaskId);

    // Step 6: Start inpainting generation with Leonardo
    // Convert UI strength (0-100, higher = more change) to API init_strength (0-1, lower = more change)
    const initStrength = 1 - (inpaintStrength / 100);
    console.log('[inpainting] Starting inpainting with initStrength:', initStrength, '(UI:', inpaintStrength, '%)');

    const { generationId } = await leonardo.startCanvasInpainting({
      canvasInitId,
      canvasMaskId,
      prompt: prompt.trim(),
      initStrength,
      width,
      height,
    });
    console.log('[inpainting] Inpainting started, ID:', generationId);

    return NextResponse.json({
      success: true,
      generationId,
      status: 'pending',
    });
  } catch (error) {
    console.error('Inpainting error:', error);

    const errorMessage = error instanceof AIError
      ? `${error.code}: ${error.message}`
      : error instanceof Error
        ? error.message
        : 'Failed to start inpainting';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET - Check inpainting generation status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('generationId');

    if (!generationId) {
      return NextResponse.json(
        { success: false, error: 'generationId parameter is required' },
        { status: 400 }
      );
    }

    if (!isLeonardoAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Leonardo API key not configured' },
        { status: 503 }
      );
    }

    const leonardo = getLeonardoProvider();
    const result = await leonardo.checkGeneration(generationId);

    return NextResponse.json({
      success: true,
      generationId,
      status: result.status,
      imageUrl: result.images?.[0]?.url,
      error: result.error,
    });
  } catch (error) {
    console.error('Check inpainting status error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check inpainting status'
      },
      { status: 500 }
    );
  }
}
