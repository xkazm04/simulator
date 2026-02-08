/**
 * usePosterHandlers - Poster generation and upload handlers
 *
 * Extracted from SimulatorFeature to reduce complexity.
 * Handles:
 * - Generate poster (calls usePoster.generatePosters)
 * - Select poster from grid
 * - Save selected poster
 * - Cancel poster generation
 * - Upload poster from file
 */

import { useState, useCallback } from 'react';
import { usePoster } from './usePoster';
import { useDimensionsState } from '../subfeature_dimensions';
import { useBrainState } from '../subfeature_brain';

interface UsePosterHandlersOptions {
  setShowPosterOverlay: (show: boolean) => void;
  /** Shared poster instance from useProjectManager to avoid duplicate state */
  poster: ReturnType<typeof usePoster>;
  /** Current project from useProjectManager - required for poster generation */
  currentProject: { id: string; name: string } | null;
}

export function usePosterHandlers({ setShowPosterOverlay, poster, currentProject }: UsePosterHandlersOptions) {
  const dimensions = useDimensionsState();
  const brain = useBrainState();

  const [isSavingPoster, setIsSavingPoster] = useState(false);

  // Generate 4 poster variations
  const handleGeneratePoster = useCallback(async () => {
    if (!currentProject) {
      console.warn('[Poster] No current project - cannot generate poster');
      // Could auto-create project here, but for now just warn
      return;
    }

    if (!brain.baseImage?.trim()) {
      console.warn('[Poster] No base prompt - cannot generate poster');
      return;
    }

    console.log('[Poster] Starting generation for project:', currentProject.id);
    setShowPosterOverlay(true);
    await poster.generatePosters(
      currentProject.id,
      currentProject.name,
      dimensions.dimensions,
      brain.baseImage
    );
  }, [currentProject, dimensions.dimensions, brain.baseImage, poster, setShowPosterOverlay]);

  // Select a poster from the grid
  const handleSelectPoster = useCallback((index: number) => {
    poster.selectPoster(index);
  }, [poster]);

  // Save the selected poster
  const handleSavePoster = useCallback(async () => {
    if (!currentProject) return;

    setIsSavingPoster(true);
    const savedPoster = await poster.savePoster(currentProject.id);
    setIsSavingPoster(false);

    if (savedPoster) {
      poster.setPoster(savedPoster);
    }
  }, [currentProject, poster]);

  // Cancel poster generation
  const handleCancelPosterGeneration = useCallback(async () => {
    await poster.cancelGeneration();
  }, [poster]);

  // Upload poster from local file
  const handleUploadPoster = useCallback(async (imageDataUrl: string) => {
    if (!currentProject) return;

    try {
      const response = await fetch(`/api/projects/${currentProject.id}/poster`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageDataUrl,
          prompt: 'Uploaded poster',
          dimensionsJson: JSON.stringify(dimensions.dimensions),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.poster) {
          poster.setPoster({
            id: data.poster.id,
            projectId: data.poster.project_id,
            imageUrl: data.poster.image_url,
            prompt: data.poster.prompt || 'Uploaded poster',
            dimensionsJson: data.poster.dimensions_json || '',
            createdAt: data.poster.created_at,
          });
          setShowPosterOverlay(true);
        }
      }
    } catch (err) {
      console.error('Failed to upload poster:', err);
    }
  }, [currentProject, dimensions.dimensions, poster, setShowPosterOverlay]);

  return {
    poster,
    isSavingPoster,
    handleGeneratePoster,
    handleSelectPoster,
    handleSavePoster,
    handleCancelPosterGeneration,
    handleUploadPoster,
  };
}
