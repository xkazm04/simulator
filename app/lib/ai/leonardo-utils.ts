/**
 * Leonardo AI Utilities
 *
 * Shared utility functions for Leonardo AI operations used across API routes.
 *
 * Includes:
 * - Generation status checking (images, posters, videos)
 * - Batch deletion with idempotency
 */

import { NextResponse } from 'next/server';
import { getLeonardoProvider, isLeonardoAvailable, AIError } from './index';
import type { GeneratedImage } from './types';

// ============================================================================
// GENERATION STATUS CHECKING
// ============================================================================

/**
 * Type of generation to check
 */
export type GenerationType = 'image' | 'video';

/**
 * Unified result for generation status check
 */
export interface GenerationStatusResult {
  success: boolean;
  generationId: string;
  status: 'pending' | 'complete' | 'failed';
  /** Images array for image/poster generations */
  images?: GeneratedImage[];
  /** Video URL for video generations */
  videoUrl?: string;
  error?: string;
}

/**
 * Check generation status - unified handler for images, posters, and videos
 *
 * This consolidates the near-identical GET handlers from:
 * - /api/ai/generate-images
 * - /api/ai/generate-poster
 * - /api/ai/generate-video
 *
 * The only difference is video uses checkVideoGeneration vs checkGeneration.
 *
 * @param generationId - The Leonardo generation ID to check
 * @param type - Type of generation ('image' for images/posters, 'video' for videos)
 * @returns NextResponse with generation status
 *
 * @example
 * ```typescript
 * // In a route handler:
 * export async function GET(request: NextRequest) {
 *   const generationId = new URL(request.url).searchParams.get('generationId');
 *   return checkGenerationStatus(generationId, 'image');
 * }
 * ```
 */
export async function checkGenerationStatus(
  generationId: string | null,
  type: GenerationType = 'image'
): Promise<NextResponse<GenerationStatusResult>> {
  try {
    // Validate generationId parameter
    if (!generationId) {
      return NextResponse.json(
        {
          success: false,
          generationId: '',
          status: 'failed' as const,
          error: 'generationId parameter is required',
        },
        { status: 400 }
      );
    }

    // Check Leonardo API availability
    if (!isLeonardoAvailable()) {
      return NextResponse.json(
        {
          success: false,
          generationId,
          status: 'failed' as const,
          error: 'Leonardo API key not configured',
        },
        { status: 503 }
      );
    }

    const leonardo = getLeonardoProvider();

    // Call appropriate check method based on type
    if (type === 'video') {
      const result = await leonardo.checkVideoGeneration(generationId);
      return NextResponse.json({
        success: true,
        generationId,
        status: result.status,
        videoUrl: result.videoUrl,
        error: result.error,
      });
    } else {
      // Image or poster generation
      const result = await leonardo.checkGeneration(generationId);
      return NextResponse.json({
        success: true,
        generationId,
        ...result,
      });
    }
  } catch (error) {
    const errorType = type === 'video' ? 'video' : 'generation';
    console.error(`Check ${errorType} error:`, error);

    return NextResponse.json(
      {
        success: false,
        generationId: generationId || '',
        status: 'failed' as const,
        error: error instanceof Error ? error.message : `Failed to check ${errorType} status`,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// BATCH DELETION
// ============================================================================

/**
 * Result of a batch delete operation
 */
export interface DeleteGenerationsResult {
  success: boolean;
  deleted: string[];
  failed: Array<{ id: string; error: string }>;
  error?: string;
  message?: string;
}

/**
 * Delete multiple generations from Leonardo AI
 *
 * Handles validation, parallel deletion, and 404 idempotency (treats "not found" as success).
 * Used by both generate-images and generate-poster DELETE endpoints.
 *
 * @param generationIds - Array of generation IDs to delete
 * @returns Result with deleted and failed IDs
 */
export async function deleteGenerations(generationIds: unknown): Promise<DeleteGenerationsResult> {
  // Validate input
  if (!generationIds || !Array.isArray(generationIds)) {
    return {
      success: false,
      error: 'generationIds array is required',
      deleted: [],
      failed: [],
    };
  }

  // Filter out invalid IDs
  const validIds = generationIds.filter(
    (id): id is string => typeof id === 'string' && id.trim().length > 0
  );

  if (validIds.length === 0) {
    return {
      success: true,
      deleted: [],
      failed: [],
      message: 'No valid generation IDs provided',
    };
  }

  if (!isLeonardoAvailable()) {
    return {
      success: false,
      error: 'Leonardo API is not configured',
      deleted: [],
      failed: validIds.map(id => ({ id, error: 'API not configured' })),
    };
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

  return {
    success: failed.length === 0,
    deleted,
    failed,
  };
}
