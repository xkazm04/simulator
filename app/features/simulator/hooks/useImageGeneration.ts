/**
 * useImageGeneration - Hook for managing Leonardo AI image generation
 *
 * Composes useLocalPersistedEntity with generation-specific logic:
 * - Starting parallel generations for multiple prompts
 * - Polling for completion
 * - Tracking generation status
 * - Saving completed images to panel slots
 * - Persisting saved images to IndexedDB (for large base64 images)
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GeneratedImage, SavedPanelImage, PanelSlot } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useLocalPersistedEntity } from './useLocalPersistedEntity';

const STORAGE_KEY_PREFIX = 'panel_images';

// Generate project-scoped storage key
const getStorageKey = (projectId: string | null) =>
  projectId ? `${STORAGE_KEY_PREFIX}_${projectId}` : STORAGE_KEY_PREFIX;

interface GenerationStartResponse {
  success: boolean;
  generations?: Array<{
    promptId: string;
    generationId: string;
    status: 'started' | 'failed';
    error?: string;
  }>;
  error?: string;
}

interface GenerationCheckResponse {
  success: boolean;
  generationId: string;
  status: 'pending' | 'complete' | 'failed';
  images?: Array<{ url: string; id: string }>;
  error?: string;
}

interface PanelSlotsData {
  leftSlots: PanelSlot[];
  rightSlots: PanelSlot[];
}

interface UseImageGenerationOptions {
  /** Current project ID - used for project-scoped panel image storage */
  projectId: string | null;
}

interface UseImageGenerationReturn {
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  leftPanelSlots: PanelSlot[];
  rightPanelSlots: PanelSlot[];
  generateImagesFromPrompts: (prompts: Array<{ id: string; prompt: string; negativePrompt?: string }>) => Promise<void>;
  saveImageToPanel: (promptId: string, promptText: string) => void;
  removePanelImage: (imageId: string) => void;
  updatePanelImage: (imageId: string, newUrl: string) => void;
  updatePanelImageVideo: (imageId: string, videoUrl: string) => void;
  clearGeneratedImages: () => void;
  deleteAllGenerations: () => Promise<void>;
  clearPanelSlots: () => void;
}

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_ATTEMPTS = 60; // 2 minutes max

const createEmptySlots = (): PanelSlot[] =>
  Array.from({ length: 5 }, (_, i) => ({ index: i, image: null }));

const initialPanelData: PanelSlotsData = {
  leftSlots: createEmptySlots(),
  rightSlots: createEmptySlots(),
};

export function useImageGeneration(options: UseImageGenerationOptions): UseImageGenerationReturn {
  const { projectId } = options;
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  // Track active polling
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pollAttemptsRef = useRef<Map<string, number>>(new Map());

  // Track saved prompt IDs to prevent duplicates (ref for synchronous check)
  const savedPromptIdsRef = useRef<Set<string>>(new Set());

  // Use local persistence hook for panel slots (IndexedDB)
  // Storage key is project-scoped so each project has separate panel images
  const storageKey = getStorageKey(projectId);
  const panelStorage = useLocalPersistedEntity<PanelSlotsData>({
    storageKey,
    initialValue: initialPanelData,
    onLoaded: (data) => {
      // Rebuild saved prompt IDs ref when loaded
      savedPromptIdsRef.current.clear();
      data.leftSlots.forEach((slot) => {
        if (slot.image?.promptId) {
          savedPromptIdsRef.current.add(slot.image.promptId);
        }
      });
      data.rightSlots.forEach((slot) => {
        if (slot.image?.promptId) {
          savedPromptIdsRef.current.add(slot.image.promptId);
        }
      });
    },
  });

  // Extract panel slots with proper padding
  const leftPanelSlots = useMemo(() => {
    const slots = panelStorage.data.leftSlots.slice(0, 5);
    while (slots.length < 5) {
      slots.push({ index: slots.length, image: null });
    }
    return slots;
  }, [panelStorage.data.leftSlots]);

  const rightPanelSlots = useMemo(() => {
    const slots = panelStorage.data.rightSlots.slice(0, 5);
    while (slots.length < 5) {
      slots.push({ index: slots.length, image: null });
    }
    return slots;
  }, [panelStorage.data.rightSlots]);

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
  const pollGeneration = useCallback(async (generationId: string, promptId: string) => {
    const attempts = pollAttemptsRef.current.get(generationId) || 0;

    if (attempts >= MAX_POLL_ATTEMPTS) {
      // Timeout - mark as failed
      setGeneratedImages((prev) =>
        prev.map((img) =>
          img.promptId === promptId
            ? { ...img, status: 'failed' as const, error: 'Generation timed out' }
            : img
        )
      );
      pollingRef.current.delete(generationId);
      pollAttemptsRef.current.delete(generationId);
      return;
    }

    try {
      const response = await fetch(`/api/ai/generate-images?generationId=${generationId}`);
      const data: GenerationCheckResponse = await response.json();

      if (data.status === 'complete' && data.images && data.images.length > 0) {
        // Success - update with image URL
        setGeneratedImages((prev) =>
          prev.map((img) =>
            img.promptId === promptId
              ? { ...img, status: 'complete' as const, url: data.images![0].url }
              : img
          )
        );
        pollingRef.current.delete(generationId);
        pollAttemptsRef.current.delete(generationId);
      } else if (data.status === 'failed') {
        // Failed - update status
        setGeneratedImages((prev) =>
          prev.map((img) =>
            img.promptId === promptId
              ? { ...img, status: 'failed' as const, error: data.error || 'Generation failed' }
              : img
          )
        );
        pollingRef.current.delete(generationId);
        pollAttemptsRef.current.delete(generationId);
      } else {
        // Still pending - continue polling
        pollAttemptsRef.current.set(generationId, attempts + 1);
        const timeout = setTimeout(() => pollGeneration(generationId, promptId), POLL_INTERVAL);
        pollingRef.current.set(generationId, timeout);
      }
    } catch (error) {
      console.error('Polling error:', error);
      // Continue polling on network errors
      pollAttemptsRef.current.set(generationId, attempts + 1);
      const timeout = setTimeout(() => pollGeneration(generationId, promptId), POLL_INTERVAL);
      pollingRef.current.set(generationId, timeout);
    }
  }, []);

  /**
   * Delete previous generations from Leonardo to free up storage
   */
  const deletePreviousGenerations = useCallback(async () => {
    const generationIds = generatedImages
      .filter((img) => img.generationId)
      .map((img) => img.generationId!);

    if (generationIds.length === 0) return;

    try {
      await fetch('/api/ai/generate-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationIds }),
      });
    } catch (error) {
      console.error('Failed to delete previous generations:', error);
      // Continue even if deletion fails
    }
  }, [generatedImages]);

  /**
   * Generate images from an array of prompts
   */
  const generateImagesFromPrompts = useCallback(
    async (prompts: Array<{ id: string; prompt: string; negativePrompt?: string }>) => {
      if (prompts.length === 0) return;

      // Step 1: Delete previous generations from Leonardo
      await deletePreviousGenerations();

      setIsGeneratingImages(true);

      // Initialize all images as pending
      const initialImages: GeneratedImage[] = prompts.map((p) => ({
        id: uuidv4(),
        promptId: p.id,
        url: null,
        status: 'pending' as const,
      }));
      setGeneratedImages(initialImages);

      try {
        // Start all generations with 16:9 aspect ratio for cinematic look
        const response = await fetch('/api/ai/generate-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompts: prompts.map((p) => ({
              id: p.id,
              text: p.prompt,
              negativePrompt: p.negativePrompt,
            })),
            width: 1344,  // 16:9 aspect ratio (1344/768 = 1.75)
            height: 768,
          }),
        });

        const data: GenerationStartResponse = await response.json();

        if (!data.success || !data.generations) {
          // All failed to start
          setGeneratedImages((prev) =>
            prev.map((img) => ({
              ...img,
              status: 'failed' as const,
              error: data.error || 'Failed to start generation',
            }))
          );
          setIsGeneratingImages(false);
          return;
        }

        // Update status and start polling for each generation
        setGeneratedImages((prev) =>
          prev.map((img) => {
            const gen = data.generations!.find((g) => g.promptId === img.promptId);
            if (gen) {
              if (gen.status === 'failed') {
                return { ...img, status: 'failed' as const, error: gen.error };
              }
              return { ...img, status: 'generating' as const, generationId: gen.generationId };
            }
            return img;
          })
        );

        // Start polling for each successful generation
        data.generations.forEach((gen) => {
          if (gen.status === 'started' && gen.generationId) {
            pollAttemptsRef.current.set(gen.generationId, 0);
            const timeout = setTimeout(
              () => pollGeneration(gen.generationId, gen.promptId),
              POLL_INTERVAL
            );
            pollingRef.current.set(gen.generationId, timeout);
          }
        });
      } catch (error) {
        console.error('Generation error:', error);
        setGeneratedImages((prev) =>
          prev.map((img) => ({
            ...img,
            status: 'failed' as const,
            error: 'Network error',
          }))
        );
      }

      // Check if all are done (either complete or failed)
      // This will be updated by polling, but we can do an initial check
      setTimeout(() => {
        setGeneratedImages((prev) => {
          const allDone = prev.every((img) => img.status === 'complete' || img.status === 'failed');
          if (allDone) {
            setIsGeneratingImages(false);
          }
          return prev;
        });
      }, 100);
    },
    [pollGeneration, deletePreviousGenerations]
  );

  /**
   * Save a generated image to the next available panel slot
   * Uses ref-based tracking to prevent duplicate saves
   */
  const saveImageToPanel = useCallback((promptId: string, promptText: string) => {
    // Check if already saved using ref (synchronous check)
    if (savedPromptIdsRef.current.has(promptId)) {
      console.log('[saveImageToPanel] Already saved:', promptId);
      return;
    }

    // Find the generated image
    const image = generatedImages.find((img) => img.promptId === promptId);
    if (!image || image.status !== 'complete' || !image.url) {
      console.log('[saveImageToPanel] Image not ready:', promptId, image?.status);
      return;
    }

    // Determine which panel to save to BEFORE any state updates
    const leftEmptyIndex = leftPanelSlots.findIndex((slot) => !slot.image);
    const rightEmptyIndex = rightPanelSlots.findIndex((slot) => !slot.image);

    if (leftEmptyIndex === -1 && rightEmptyIndex === -1) {
      console.log('[saveImageToPanel] No empty slots available');
      return;
    }

    // Mark as saved IMMEDIATELY (before async state updates)
    savedPromptIdsRef.current.add(promptId);
    console.log('[saveImageToPanel] Saving image:', promptId, 'url:', image.url?.substring(0, 50));

    // Determine target panel
    const targetPanel = leftEmptyIndex !== -1 ? 'left' : 'right';
    const targetIndex = leftEmptyIndex !== -1 ? leftEmptyIndex : rightEmptyIndex;

    // Create the saved image object
    const newImage: SavedPanelImage = {
      id: uuidv4(),
      url: image.url,
      prompt: promptText,
      promptId: promptId,
      side: targetPanel,
      slotIndex: targetIndex,
      createdAt: new Date().toISOString(),
    };

    console.log('[saveImageToPanel] Saving to', targetPanel, 'slot:', targetIndex);

    // Update panel storage using the local persistence hook
    panelStorage.setData((prev) => {
      if (targetPanel === 'left') {
        return {
          ...prev,
          leftSlots: prev.leftSlots.map((slot, i) =>
            i === targetIndex ? { ...slot, image: newImage } : slot
          ),
        };
      } else {
        return {
          ...prev,
          rightSlots: prev.rightSlots.map((slot, i) =>
            i === targetIndex ? { ...slot, image: newImage } : slot
          ),
        };
      }
    });
  }, [generatedImages, leftPanelSlots, rightPanelSlots, panelStorage]);

  /**
   * Remove an image from a panel slot
   */
  const removePanelImage = useCallback((imageId: string) => {
    panelStorage.setData((prev) => ({
      leftSlots: prev.leftSlots.map((slot) => {
        if (slot.image?.id === imageId) {
          // Clean up ref tracking
          if (slot.image.promptId) {
            savedPromptIdsRef.current.delete(slot.image.promptId);
          }
          return { ...slot, image: null };
        }
        return slot;
      }),
      rightSlots: prev.rightSlots.map((slot) => {
        if (slot.image?.id === imageId) {
          // Clean up ref tracking
          if (slot.image.promptId) {
            savedPromptIdsRef.current.delete(slot.image.promptId);
          }
          return { ...slot, image: null };
        }
        return slot;
      }),
    }));
  }, [panelStorage]);

  /**
   * Update an image's URL (for Gemini regeneration)
   */
  const updatePanelImage = useCallback((imageId: string, newUrl: string) => {
    panelStorage.setData((prev) => ({
      leftSlots: prev.leftSlots.map((slot) =>
        slot.image?.id === imageId
          ? { ...slot, image: { ...slot.image, url: newUrl } }
          : slot
      ),
      rightSlots: prev.rightSlots.map((slot) =>
        slot.image?.id === imageId
          ? { ...slot, image: { ...slot.image, url: newUrl } }
          : slot
      ),
    }));
  }, [panelStorage]);

  /**
   * Update an image's video URL (for Seedance video generation)
   */
  const updatePanelImageVideo = useCallback((imageId: string, videoUrl: string) => {
    panelStorage.setData((prev) => ({
      leftSlots: prev.leftSlots.map((slot) =>
        slot.image?.id === imageId
          ? { ...slot, image: { ...slot.image, videoUrl } }
          : slot
      ),
      rightSlots: prev.rightSlots.map((slot) =>
        slot.image?.id === imageId
          ? { ...slot, image: { ...slot.image, videoUrl } }
          : slot
      ),
    }));
  }, [panelStorage]);

  /**
   * Clear all generated images
   */
  const clearGeneratedImages = useCallback(() => {
    // Stop all polling
    pollingRef.current.forEach((timeout) => clearTimeout(timeout));
    pollingRef.current.clear();
    pollAttemptsRef.current.clear();

    setGeneratedImages([]);
    setIsGeneratingImages(false);
  }, []);

  /**
   * Delete all generations from Leonardo and clear local state
   * Does NOT affect panel slots - only clears generated images
   */
  const deleteAllGenerations = useCallback(async () => {
    // Stop all polling first
    pollingRef.current.forEach((timeout) => clearTimeout(timeout));
    pollingRef.current.clear();
    pollAttemptsRef.current.clear();

    // Get generation IDs to delete from Leonardo
    const generationIds = generatedImages
      .filter((img) => img.generationId)
      .map((img) => img.generationId!);

    // Clear local state immediately for responsive UI
    setGeneratedImages([]);
    setIsGeneratingImages(false);

    // Delete from Leonardo in background (don't block UI)
    if (generationIds.length > 0) {
      try {
        await fetch('/api/ai/generate-images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generationIds }),
        });
      } catch (error) {
        console.error('Failed to delete generations from Leonardo:', error);
        // Continue even if deletion fails - local state is already cleared
      }
    }
  }, [generatedImages]);

  /**
   * Clear all panel slots (reset to empty)
   */
  const clearPanelSlots = useCallback(() => {
    savedPromptIdsRef.current.clear();
    panelStorage.setData(initialPanelData);
  }, [panelStorage]);

  // Update isGeneratingImages when all images are done
  useEffect(() => {
    if (generatedImages.length > 0) {
      const allDone = generatedImages.every(
        (img) => img.status === 'complete' || img.status === 'failed'
      );
      if (allDone) {
        setIsGeneratingImages(false);
      }
    }
  }, [generatedImages]);

  return {
    generatedImages,
    isGeneratingImages,
    leftPanelSlots,
    rightPanelSlots,
    generateImagesFromPrompts,
    saveImageToPanel,
    removePanelImage,
    updatePanelImage,
    updatePanelImageVideo,
    clearGeneratedImages,
    deleteAllGenerations,
    clearPanelSlots,
  };
}
