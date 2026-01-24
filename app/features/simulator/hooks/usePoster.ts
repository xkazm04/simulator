/**
 * usePoster - Hook for managing project poster generation
 *
 * Handles:
 * - Generating 4 poster variations with polling
 * - Selecting and saving a poster
 * - Cleaning up unselected posters from Leonardo
 * - Fetching and deleting existing posters
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ProjectPoster, Dimension } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Poster generation status for each of the 4 variations
export interface PosterGeneration {
  index: number;
  generationId: string;
  prompt: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  imageUrl?: string;
  error?: string;
}

interface UsePosterReturn {
  // Saved poster
  poster: ProjectPoster | null;

  // Generation state
  isGenerating: boolean;
  posterGenerations: PosterGeneration[];
  selectedIndex: number | null;

  // Actions
  generatePosters: (projectId: string, dimensions: Dimension[], basePrompt: string) => Promise<void>;
  selectPoster: (index: number) => void;
  savePoster: (projectId: string) => Promise<ProjectPoster | null>;
  cancelGeneration: () => Promise<void>;
  fetchPoster: (projectId: string) => Promise<ProjectPoster | null>;
  deletePoster: (projectId: string) => Promise<boolean>;
  setPoster: (poster: ProjectPoster | null) => void;

  // Error state
  error: string | null;
  clearError: () => void;
}

interface GenerationStartResponse {
  success: boolean;
  generations?: Array<{
    index: number;
    generationId: string;
    prompt: string;
    status: 'started' | 'failed';
    error?: string;
  }>;
  dimensionsJson?: string;
  error?: string;
}

interface GenerationCheckResponse {
  success: boolean;
  generationId: string;
  status: 'pending' | 'complete' | 'failed';
  images?: Array<{ url: string; id: string }>;
  error?: string;
}

const POLL_INTERVAL = 2000;
const MAX_POLL_ATTEMPTS = 60;

/**
 * Parse raw API poster response to ProjectPoster
 */
function parsePoster(data: unknown): ProjectPoster {
  const d = data as Record<string, unknown>;
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
  // Saved poster state
  const [poster, setPosterState] = useState<ProjectPoster | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [posterGenerations, setPosterGenerations] = useState<PosterGeneration[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store dimensions for save
  const dimensionsJsonRef = useRef<string>('');

  // Polling refs
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pollAttemptsRef = useRef<Map<string, number>>(new Map());

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.forEach((timeout) => clearTimeout(timeout));
      pollingRef.current.clear();
    };
  }, []);

  /**
   * Poll for a single generation's completion
   */
  const pollGeneration = useCallback(async (generationId: string, index: number) => {
    const attempts = pollAttemptsRef.current.get(generationId) || 0;

    if (attempts >= MAX_POLL_ATTEMPTS) {
      setPosterGenerations((prev) =>
        prev.map((gen) =>
          gen.index === index
            ? { ...gen, status: 'failed' as const, error: 'Generation timed out' }
            : gen
        )
      );
      pollingRef.current.delete(generationId);
      pollAttemptsRef.current.delete(generationId);
      return;
    }

    try {
      const response = await fetch(`/api/ai/generate-poster?generationId=${generationId}`);
      const data: GenerationCheckResponse = await response.json();

      if (data.status === 'complete' && data.images && data.images.length > 0) {
        setPosterGenerations((prev) =>
          prev.map((gen) =>
            gen.index === index
              ? { ...gen, status: 'complete' as const, imageUrl: data.images![0].url }
              : gen
          )
        );
        pollingRef.current.delete(generationId);
        pollAttemptsRef.current.delete(generationId);
      } else if (data.status === 'failed') {
        setPosterGenerations((prev) =>
          prev.map((gen) =>
            gen.index === index
              ? { ...gen, status: 'failed' as const, error: data.error || 'Generation failed' }
              : gen
          )
        );
        pollingRef.current.delete(generationId);
        pollAttemptsRef.current.delete(generationId);
      } else {
        pollAttemptsRef.current.set(generationId, attempts + 1);
        const timeout = setTimeout(() => pollGeneration(generationId, index), POLL_INTERVAL);
        pollingRef.current.set(generationId, timeout);
      }
    } catch (err) {
      console.error('Polling error:', err);
      pollAttemptsRef.current.set(generationId, attempts + 1);
      const timeout = setTimeout(() => pollGeneration(generationId, index), POLL_INTERVAL);
      pollingRef.current.set(generationId, timeout);
    }
  }, []);

  /**
   * Generate 4 poster variations
   */
  const generatePosters = useCallback(
    async (projectId: string, dimensions: Dimension[], basePrompt: string): Promise<void> => {
      setIsGenerating(true);
      setError(null);
      setSelectedIndex(null);

      // Initialize 4 pending generations
      const initialGenerations: PosterGeneration[] = Array.from({ length: 4 }, (_, i) => ({
        index: i,
        generationId: '',
        prompt: '',
        status: 'pending' as const,
      }));
      setPosterGenerations(initialGenerations);

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

        const data: GenerationStartResponse = await response.json();

        if (!data.success || !data.generations) {
          setError(data.error || 'Failed to start generation');
          setIsGenerating(false);
          setPosterGenerations([]);
          return;
        }

        // Store dimensions for later save
        dimensionsJsonRef.current = data.dimensionsJson || JSON.stringify(dimensions);

        // Update generations with started status
        const updatedGenerations = data.generations.map((gen) => ({
          index: gen.index,
          generationId: gen.generationId,
          prompt: gen.prompt,
          status: gen.status === 'started' ? ('generating' as const) : ('failed' as const),
          error: gen.error,
        }));
        setPosterGenerations(updatedGenerations);

        // Start polling for each successful generation
        data.generations.forEach((gen) => {
          if (gen.status === 'started' && gen.generationId) {
            pollAttemptsRef.current.set(gen.generationId, 0);
            const timeout = setTimeout(
              () => pollGeneration(gen.generationId, gen.index),
              POLL_INTERVAL
            );
            pollingRef.current.set(gen.generationId, timeout);
          }
        });
      } catch (err) {
        console.error('Generate posters error:', err);
        setError(err instanceof Error ? err.message : 'Network error');
        setIsGenerating(false);
        setPosterGenerations([]);
      }
    },
    [pollGeneration]
  );

  /**
   * Select a poster for saving
   */
  const selectPoster = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  /**
   * Save the selected poster and delete others
   */
  const savePoster = useCallback(
    async (projectId: string): Promise<ProjectPoster | null> => {
      if (selectedIndex === null) {
        setError('No poster selected');
        return null;
      }

      const selectedGen = posterGenerations.find((g) => g.index === selectedIndex);
      if (!selectedGen || selectedGen.status !== 'complete' || !selectedGen.imageUrl) {
        setError('Selected poster is not ready');
        return null;
      }

      try {
        // 1. Delete unselected generations from Leonardo
        const unselectedIds = posterGenerations
          .filter((g) => g.index !== selectedIndex && g.generationId)
          .map((g) => g.generationId);

        if (unselectedIds.length > 0) {
          await fetch('/api/ai/generate-poster', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generationIds: unselectedIds }),
          });
        }

        // 2. Save selected poster to database
        const saveResponse = await fetch(`/api/projects/${projectId}/poster`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: selectedGen.imageUrl,
            prompt: selectedGen.prompt,
            dimensionsJson: dimensionsJsonRef.current,
          }),
        });

        const saveData = await saveResponse.json();

        if (!saveData.success) {
          setError(saveData.error || 'Failed to save poster');
          return null;
        }

        const savedPoster = parsePoster(saveData.poster);
        setPosterState(savedPoster);

        // Clear generation state
        setPosterGenerations([]);
        setSelectedIndex(null);
        setIsGenerating(false);

        return savedPoster;
      } catch (err) {
        console.error('Save poster error:', err);
        setError(err instanceof Error ? err.message : 'Failed to save poster');
        return null;
      }
    },
    [selectedIndex, posterGenerations]
  );

  /**
   * Cancel ongoing generation and clean up
   */
  const cancelGeneration = useCallback(async () => {
    // Stop all polling
    pollingRef.current.forEach((timeout) => clearTimeout(timeout));
    pollingRef.current.clear();
    pollAttemptsRef.current.clear();

    // Delete all generations from Leonardo
    const generationIds = posterGenerations
      .filter((g) => g.generationId)
      .map((g) => g.generationId);

    if (generationIds.length > 0) {
      try {
        await fetch('/api/ai/generate-poster', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generationIds }),
        });
      } catch (err) {
        console.error('Failed to delete generations:', err);
      }
    }

    // Clear state
    setPosterGenerations([]);
    setSelectedIndex(null);
    setIsGenerating(false);
  }, [posterGenerations]);

  /**
   * Fetch existing poster for a project
   */
  const fetchPoster = useCallback(async (projectId: string): Promise<ProjectPoster | null> => {
    try {
      const response = await fetch(`/api/projects/${projectId}/poster`);
      const data = await response.json();

      if (!data.success) {
        console.error('Failed to fetch poster:', data.error);
        return null;
      }

      if (!data.poster) {
        setPosterState(null);
        return null;
      }

      const fetchedPoster = parsePoster(data.poster as unknown as Record<string, unknown>);
      setPosterState(fetchedPoster);
      return fetchedPoster;
    } catch (err) {
      console.error('Fetch poster error:', err);
      return null;
    }
  }, []);

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
        setPosterState(null);
        return true;
      }

      console.error('Failed to delete poster:', data.error);
      return false;
    } catch (err) {
      console.error('Delete poster error:', err);
      return false;
    }
  }, []);

  /**
   * Set poster directly
   */
  const setPoster = useCallback((newPoster: ProjectPoster | null) => {
    setPosterState(newPoster);
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Update isGenerating when all generations are done
  useEffect(() => {
    if (posterGenerations.length > 0) {
      const allDone = posterGenerations.every(
        (gen) => gen.status === 'complete' || gen.status === 'failed'
      );
      if (allDone) {
        setIsGenerating(false);
      }
    }
  }, [posterGenerations]);

  return useMemo(
    () => ({
      poster,
      isGenerating,
      posterGenerations,
      selectedIndex,
      generatePosters,
      selectPoster,
      savePoster,
      cancelGeneration,
      fetchPoster,
      deletePoster,
      setPoster,
      error,
      clearError,
    }),
    [
      poster,
      isGenerating,
      posterGenerations,
      selectedIndex,
      generatePosters,
      selectPoster,
      savePoster,
      cancelGeneration,
      fetchPoster,
      deletePoster,
      setPoster,
      error,
      clearError,
    ]
  );
}
