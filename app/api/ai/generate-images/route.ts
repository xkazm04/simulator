/**
 * POST /api/ai/generate-images
 * Start image generation for multiple prompts using Leonardo AI
 *
 * Uses the unified AI provider layer for consistent error handling,
 * rate limiting, and cost tracking.
 *
 * GET /api/ai/generate-images?generationId=xxx
 * Check status of a generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeonardoProvider, isLeonardoAvailable, AIError, checkGenerationStatus, deleteGenerations } from '@/app/lib/ai';

interface GenerateRequest {
  prompts: Array<{
    id: string;  // Prompt ID to track which prompt this is for
    text: string;
  }>;
  width?: number;
  height?: number;
}

interface GenerationResult {
  promptId: string;
  generationId: string;
  status: 'started' | 'failed';
  error?: string;
}

/**
 * POST - Start generations for multiple prompts
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Leonardo API is available via unified provider
    if (!isLeonardoAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Leonardo API key not configured' },
        { status: 503 }
      );
    }

    const body: GenerateRequest = await request.json();
    const { prompts, width = 768, height = 768 } = body;

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'prompts array is required' },
        { status: 400 }
      );
    }

    const leonardo = getLeonardoProvider();

    // Start all generations in parallel (non-blocking)
    const generationPromises = prompts.map(async (prompt) => {
      try {
        const result = await leonardo.startGeneration({
          type: 'image-generation',
          prompt: prompt.text,
          width,
          height,
          numImages: 1,
          metadata: { feature: 'generate-images', promptId: prompt.id },
        });

        return {
          promptId: prompt.id,
          generationId: result.generationId,
          status: 'started' as const,
        };
      } catch (error) {
        const errorMessage = error instanceof AIError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : 'Unknown error';
        return {
          promptId: prompt.id,
          generationId: '',
          status: 'failed' as const,
          error: errorMessage,
        };
      }
    });

    const generationResults = await Promise.all(generationPromises);

    return NextResponse.json({
      success: true,
      generations: generationResults,
    });
  } catch (error) {
    console.error('Generate images error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start image generation'
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Check generation status
 * Uses shared utility for consistent status checking across all generation types.
 */
export async function GET(request: NextRequest) {
  const generationId = new URL(request.url).searchParams.get('generationId');
  return checkGenerationStatus(generationId, 'image');
}

/**
 * DELETE - Delete multiple generations from Leonardo (cleanup)
 * Body: { generationIds: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await deleteGenerations(body.generationIds);

    // Return appropriate HTTP status based on result
    if (result.error === 'generationIds array is required') {
      return NextResponse.json(result, { status: 400 });
    }
    if (result.error === 'Leonardo API is not configured') {
      return NextResponse.json(result, { status: 503 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Delete generations error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete generations',
        deleted: [],
        failed: [],
      },
      { status: 500 }
    );
  }
}
