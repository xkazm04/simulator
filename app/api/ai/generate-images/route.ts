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
import { getLeonardoProvider, isLeonardoAvailable, AIError } from '@/app/lib/ai';

interface GenerateRequest {
  prompts: Array<{
    id: string;  // Prompt ID to track which prompt this is for
    text: string;
    negativePrompt?: string;  // Negative prompt for elements to avoid
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
          negativePrompt: prompt.negativePrompt,
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
      ...result,
    });
  } catch (error) {
    console.error('Check generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check generation status'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete multiple generations from Leonardo (cleanup)
 * Body: { generationIds: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { generationIds } = body;

    // Validate input
    if (!generationIds || !Array.isArray(generationIds)) {
      return NextResponse.json(
        { success: false, error: 'generationIds array is required', deleted: [], failed: [] },
        { status: 400 }
      );
    }

    // Filter out invalid IDs
    const validIds = generationIds.filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0
    );

    if (validIds.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: [],
        failed: [],
        message: 'No valid generation IDs provided',
      });
    }

    if (!isLeonardoAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Leonardo API is not configured',
          deleted: [],
          failed: validIds.map(id => ({ id, error: 'API not configured' })),
        },
        { status: 503 }
      );
    }

    const leonardo = getLeonardoProvider();
    const deleted: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    // Delete each generation in parallel
    const deletePromises = validIds.map(async (generationId) => {
      try {
        await leonardo.deleteGeneration(generationId);
        return { id: generationId, success: true };
      } catch (error) {
        // 404 means already deleted - treat as success for idempotency
        const errorMsg = error instanceof AIError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error';
        if (errorMsg.includes('404') || errorMsg.includes('not found')) {
          return { id: generationId, success: true };
        }
        return { id: generationId, success: false, error: errorMsg };
      }
    });

    const results = await Promise.allSettled(deletePromises);

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { id, success, error } = result.value;
        if (success) {
          deleted.push(id);
        } else {
          failed.push({ id, error: error || 'Unknown error' });
        }
      }
    });

    // Log failures for monitoring
    if (failed.length > 0) {
      console.error('Batch delete partial failures:', { failed });
    }

    return NextResponse.json({
      success: failed.length === 0,
      deleted,
      failed,
    });
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
