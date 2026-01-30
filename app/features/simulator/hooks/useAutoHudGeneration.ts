/**
 * useAutoHudGeneration - Hook for auto-generating HUD overlays
 *
 * Wraps the regeneration API to provide a clean interface for
 * applying HUD overlays to gameplay images in bulk.
 *
 * Uses Gemini's image-to-image mode with 'overlay' to add
 * game UI elements on top of existing images.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { HudGenerationResult } from '../types';
import { regenerateImage, buildHudPrompt } from '../subfeature_panels/lib/regenerationApi';

export interface UseAutoHudGenerationOptions {
  /** Game UI dimension reference (e.g., "Dark Souls style HUD") */
  gameUIDimension?: string;
}

export interface UseAutoHudGenerationReturn {
  /** Generate HUD overlays for multiple images */
  generateHudForImages: (imageUrls: string[]) => Promise<HudGenerationResult[]>;
  /** Current generation progress */
  isGenerating: boolean;
  /** Number of images processed so far */
  progress: { current: number; total: number };
  /** Results from the most recent generation */
  results: HudGenerationResult[];
  /** Abort current generation */
  abort: () => void;
  /** Reset state */
  reset: () => void;
}

export function useAutoHudGeneration(
  options: UseAutoHudGenerationOptions = {}
): UseAutoHudGenerationReturn {
  const { gameUIDimension } = options;

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<HudGenerationResult[]>([]);

  const abortRequestedRef = useRef(false);

  /**
   * Generate HUD overlays for a batch of images
   * Processes sequentially to avoid rate limiting
   */
  const generateHudForImages = useCallback(async (
    imageUrls: string[]
  ): Promise<HudGenerationResult[]> => {
    if (imageUrls.length === 0) {
      return [];
    }

    // Use provided dimension or default
    const hudReference = gameUIDimension || 'Game UI overlay with health bar, minimap, and action icons';

    setIsGenerating(true);
    setProgress({ current: 0, total: imageUrls.length });
    setResults([]);
    abortRequestedRef.current = false;

    const generationResults: HudGenerationResult[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      // Check for abort
      if (abortRequestedRef.current) {
        console.log('[AutoHUD] Aborted after', i, 'images');
        break;
      }

      const imageUrl = imageUrls[i];
      setProgress({ current: i + 1, total: imageUrls.length });

      try {
        // Build the HUD prompt
        const prompt = buildHudPrompt(hudReference);

        // Generate HUD overlay using Gemini
        const response = await regenerateImage({
          prompt,
          sourceImageUrl: imageUrl,
          aspectRatio: '16:9',
          mode: 'overlay',
        });

        if (response.success && response.imageUrl) {
          generationResults.push({
            originalUrl: imageUrl,
            hudUrl: response.imageUrl,
            success: true,
          });
        } else {
          generationResults.push({
            originalUrl: imageUrl,
            success: false,
            error: response.error || 'HUD generation failed',
          });
        }
      } catch (error) {
        console.error(`[AutoHUD] Failed to generate HUD for image ${i + 1}:`, error);
        generationResults.push({
          originalUrl: imageUrl,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Update results incrementally
      setResults([...generationResults]);
    }

    setIsGenerating(false);
    return generationResults;
  }, [gameUIDimension]);

  /**
   * Abort current generation
   */
  const abort = useCallback(() => {
    abortRequestedRef.current = true;
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress({ current: 0, total: 0 });
    setResults([]);
    abortRequestedRef.current = false;
  }, []);

  return {
    generateHudForImages,
    isGenerating,
    progress,
    results,
    abort,
    reset,
  };
}
