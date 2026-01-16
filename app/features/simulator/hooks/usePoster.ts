/**
 * usePoster - Hook for managing project poster generation
 *
 * Composes usePersistedEntity with poster-specific logic:
 * - Generating poster from dimensions
 * - Fetching existing poster
 * - Deleting poster
 */

import { useState, useCallback, useMemo } from 'react';
import { ProjectPoster, Dimension } from '../types';
import { usePersistedEntity } from './usePersistedEntity';

interface UsePosterReturn {
  poster: ProjectPoster | null;
  isGenerating: boolean;
  error: string | null;
  generatePoster: (projectId: string, dimensions: Dimension[], basePrompt: string) => Promise<ProjectPoster | null>;
  fetchPoster: (projectId: string) => Promise<ProjectPoster | null>;
  deletePoster: (projectId: string) => Promise<boolean>;
  setPoster: (poster: ProjectPoster | null) => void;
  clearError: () => void;
}

interface GeneratePosterResponse {
  success: boolean;
  poster?: {
    id: string;
    projectId: string;
    imageUrl: string;
    prompt: string;
    dimensionsJson: string;
    createdAt: string;
  };
  error?: string;
}

interface FetchPosterResponse {
  success: boolean;
  poster?: {
    id: string;
    project_id: string;
    image_url: string;
    prompt: string | null;
    dimensions_json: string | null;
    created_at: string;
  } | null;
  error?: string;
}

/**
 * Parse raw API poster response to ProjectPoster
 */
function parsePoster(data: unknown): ProjectPoster {
  const d = data as Record<string, unknown>;
  // Handle both camelCase (from generate) and snake_case (from fetch) responses
  return {
    id: (d.id as string),
    projectId: (d.projectId || d.project_id) as string,
    imageUrl: (d.imageUrl || d.image_url) as string,
    prompt: ((d.prompt as string) || ''),
    dimensionsJson: ((d.dimensionsJson || d.dimensions_json) as string) || '',
    createdAt: (d.createdAt || d.created_at) as string,
  };
}

export function usePoster(): UsePosterReturn {
  // Generation state (separate from CRUD operations)
  const [isGenerating, setIsGenerating] = useState(false);

  // Use the generic persisted entity hook for poster CRUD
  // Note: We don't use loadAll since posters are loaded per-project
  const posterEntity = usePersistedEntity<ProjectPoster, never, Partial<ProjectPoster>>({
    api: {
      baseEndpoint: '/api/projects', // Base endpoint (project-specific routes are handled manually)
      parseResponse: parsePoster,
    },
    enableAutosave: false, // Posters don't autosave
  });

  /**
   * Generate a new poster for a project
   * This is a custom operation that doesn't fit the standard CRUD pattern
   */
  const generatePoster = useCallback(
    async (
      projectId: string,
      dimensions: Dimension[],
      basePrompt: string
    ): Promise<ProjectPoster | null> => {
      setIsGenerating(true);
      posterEntity.clearError();

      try {
        const response = await fetch('/api/ai/generate-poster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            dimensions: dimensions.map((d) => ({
              type: d.type,
              reference: d.reference,
            })),
            basePrompt,
          }),
        });

        const data: GeneratePosterResponse = await response.json();

        if (!data.success || !data.poster) {
          // Error is handled through the entity hook
          console.error('Failed to generate poster:', data.error);
          setIsGenerating(false);
          return null;
        }

        const newPoster = parsePoster(data.poster);
        posterEntity.setEntity(newPoster);
        setIsGenerating(false);
        return newPoster;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Network error';
        console.error('Generate poster error:', errorMessage);
        setIsGenerating(false);
        return null;
      }
    },
    [posterEntity]
  );

  /**
   * Fetch existing poster for a project
   */
  const fetchPoster = useCallback(async (projectId: string): Promise<ProjectPoster | null> => {
    try {
      const response = await fetch(`/api/projects/${projectId}/poster`);
      const data: FetchPosterResponse = await response.json();

      if (!data.success) {
        console.error('Failed to fetch poster:', data.error);
        return null;
      }

      if (!data.poster) {
        posterEntity.setEntity(null);
        return null;
      }

      const fetchedPoster = parsePoster(data.poster as unknown as Record<string, unknown>);
      posterEntity.setEntity(fetchedPoster);
      return fetchedPoster;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      console.error('Fetch poster error:', errorMessage);
      return null;
    }
  }, [posterEntity]);

  /**
   * Delete poster for a project
   */
  const deletePoster = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/projects/${projectId}/poster`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        posterEntity.setEntity(null);
        return true;
      }

      console.error('Failed to delete poster:', data.error);
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      console.error('Delete poster error:', errorMessage);
      return false;
    }
  }, [posterEntity]);

  /**
   * Set poster directly (for optimistic updates)
   */
  const setPoster = useCallback((poster: ProjectPoster | null) => {
    posterEntity.setEntity(poster);
  }, [posterEntity]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    posterEntity.clearError();
  }, [posterEntity]);

  // Memoized return to prevent unnecessary re-renders
  return useMemo(() => ({
    poster: posterEntity.entity,
    isGenerating,
    error: posterEntity.error,
    generatePoster,
    fetchPoster,
    deletePoster,
    setPoster,
    clearError,
  }), [
    posterEntity.entity,
    posterEntity.error,
    isGenerating,
    generatePoster,
    fetchPoster,
    deletePoster,
    setPoster,
    clearError,
  ]);
}
