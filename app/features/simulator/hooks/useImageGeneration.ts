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
import { SLOTS_PER_SIDE } from '../subfeature_panels/components/SidePanel';

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

/** Info about a saved panel image - for database sync */
export interface SavedPanelImageInfo {
  id: string;
  side: 'left' | 'right';
  slotIndex: number;
  imageUrl: string;
  prompt: string;
  type?: 'gameplay' | 'trailer' | 'sketch' | 'poster' | 'realistic' | null;
}

interface UseImageGenerationOptions {
  /** Current project ID - used for project-scoped panel image storage */
  projectId: string | null;
  /** Optional callback fired when an image is saved to panel - for database sync */
  onImageSaved?: (info: SavedPanelImageInfo) => void;
  /** Current output mode - saved with panel images for filtering */
  outputMode?: 'gameplay' | 'trailer' | 'sketch' | 'poster' | 'realistic';
}

interface UseImageGenerationReturn {
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  leftPanelSlots: PanelSlot[];
  rightPanelSlots: PanelSlot[];
  generateImagesFromPrompts: (prompts: Array<{ id: string; prompt: string }>) => Promise<void>;
  saveImageToPanel: (promptId: string, promptText: string) => boolean;
  /** Upload an external image URL to a specific panel slot */
  uploadImageToPanel: (side: 'left' | 'right', slotIndex: number, imageUrl: string, prompt?: string) => void;
  removePanelImage: (imageId: string) => void;
  updatePanelImage: (imageId: string, newUrl: string) => Promise<void>;
  updatePanelImageVideo: (imageId: string, videoUrl: string) => Promise<void>;
  /** Update a generated image's URL in-memory (for polish operations before save) */
  updateGeneratedImageUrl: (promptId: string, newUrl: string) => void;
  clearGeneratedImages: () => void;
  deleteAllGenerations: () => Promise<void>;
  /** Delete a single generated image by prompt ID */
  deleteGeneration: (promptId: string) => Promise<void>;
  clearPanelSlots: () => void;
  /** Rebuild savedPromptIdsRef from actual slot state — call before new autoplay sessions */
  resetSaveTracking: () => void;
  /** Hydrate panel slots from database images (fills empty local slots with DB data) */
  hydratePanelImages: (dbImages: SavedPanelImage[]) => void;
}

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_ATTEMPTS = 60; // 2 minutes max

const createEmptySlots = (): PanelSlot[] =>
  Array.from({ length: SLOTS_PER_SIDE }, (_, i) => ({ index: i, image: null }));

const initialPanelData: PanelSlotsData = {
  leftSlots: createEmptySlots(),
  rightSlots: createEmptySlots(),
};

export function useImageGeneration(options: UseImageGenerationOptions): UseImageGenerationReturn {
  const { projectId, onImageSaved, outputMode } = options;
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  // Track active polling
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pollAttemptsRef = useRef<Map<string, number>>(new Map());

  // Track saved prompt IDs to prevent duplicates (ref for synchronous check)
  const savedPromptIdsRef = useRef<Set<string>>(new Set());

  // Track pending slot allocations to prevent race conditions when saving multiple images
  const pendingSlotsRef = useRef<{ left: Set<number>; right: Set<number> }>({
    left: new Set(),
    right: new Set(),
  });

  // Ref to always access current slot state (avoids stale closure issues with memoized callbacks)
  const currentSlotsRef = useRef<{ left: PanelSlot[]; right: PanelSlot[] }>({
    left: [],
    right: [],
  });

  // Ref to always access current generated images (avoids stale closure in saveImageToPanel)
  const generatedImagesRef = useRef<GeneratedImage[]>([]);

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
    const slots = panelStorage.data.leftSlots.slice(0, SLOTS_PER_SIDE);
    while (slots.length < SLOTS_PER_SIDE) {
      slots.push({ index: slots.length, image: null });
    }
    return slots;
  }, [panelStorage.data.leftSlots]);

  const rightPanelSlots = useMemo(() => {
    const slots = panelStorage.data.rightSlots.slice(0, SLOTS_PER_SIDE);
    while (slots.length < SLOTS_PER_SIDE) {
      slots.push({ index: slots.length, image: null });
    }
    return slots;
  }, [panelStorage.data.rightSlots]);

  // Keep refs in sync with current state (for use in callbacks that might be stale)
  useEffect(() => {
    currentSlotsRef.current = { left: leftPanelSlots, right: rightPanelSlots };
  }, [leftPanelSlots, rightPanelSlots]);

  useEffect(() => {
    generatedImagesRef.current = generatedImages;
  }, [generatedImages]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.forEach((timeout) => clearTimeout(timeout));
      pollingRef.current.clear();
    };
  }, []);

  // Clear pending slots AFTER React state updates are processed
  // Only clear slots that are ACTUALLY filled in state - keeps pending for in-flight saves
  useEffect(() => {
    // Clear pending for slots that now have images in state
    panelStorage.data.leftSlots.forEach((slot, i) => {
      if (slot.image) {
        pendingSlotsRef.current.left.delete(i);
      }
    });
    panelStorage.data.rightSlots.forEach((slot, i) => {
      if (slot.image) {
        pendingSlotsRef.current.right.delete(i);
      }
    });
  }, [panelStorage.data]);

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
    async (prompts: Array<{ id: string; prompt: string }>) => {
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
   * Uses ref-based tracking to prevent duplicate saves and slot collisions
   */
  const saveImageToPanel = useCallback((promptId: string, promptText: string): boolean => {
    console.log('[saveImageToPanel] Called:', { promptId, promptText: promptText?.substring(0, 50) });

    // Guard: Don't save while IndexedDB is still loading - slots would appear empty
    if (!panelStorage.isInitialized) {
      console.warn('[saveImageToPanel] BLOCKED: panel data not yet loaded from IndexedDB');
      return false;
    }

    // CRITICAL: Look up the generated image FIRST — we need its URL for dedup
    // Use ref to get CURRENT generated images, not stale closure values
    const currentImages = generatedImagesRef.current;
    const image = currentImages.find((img) => img.promptId === promptId);
    if (!image || image.status !== 'complete' || !image.url) {
      console.warn('[saveImageToPanel] BLOCKED: image not found or not complete', {
        found: !!image,
        status: image?.status,
        hasUrl: !!image?.url,
        refImagesCount: currentImages.length,
        closureImagesCount: generatedImages.length,
      });
      return false;
    }

    // Check if this EXACT image (by URL) is already in a panel slot.
    // IMPORTANT: Match by URL, NOT by promptId — deterministic promptIds like
    // 'sketch-portrait-002' are reused across autoplay iterations for different images.
    const allSlots = [...currentSlotsRef.current.left, ...currentSlotsRef.current.right];
    const alreadyInSlot = allSlots.some(slot => slot.image?.url === image.url);
    if (alreadyInSlot) {
      savedPromptIdsRef.current.add(promptId);
      console.warn('[saveImageToPanel] BLOCKED: exact image URL already in panel slot');
      return false;
    }

    // Check savedPromptIdsRef for rapid concurrent saves
    if (savedPromptIdsRef.current.has(promptId)) {
      // Ref says this promptId was saved, but the current image URL isn't in any slot.
      // This means it's a stale entry (e.g. different iteration reusing same promptId).
      // Clear it and proceed with the save.
      console.log('[saveImageToPanel] Clearing stale savedPromptIdsRef entry for', promptId, '(new URL, not in slots)');
      savedPromptIdsRef.current.delete(promptId);
    }

    // CRITICAL: Use ref to get CURRENT slot state, not stale closure values
    // This fixes the issue where memoized callbacks have outdated slot data
    const currentLeftSlots = currentSlotsRef.current.left;
    const currentRightSlots = currentSlotsRef.current.right;

    console.log('[saveImageToPanel] Slot state:', {
      leftCount: currentLeftSlots.length,
      rightCount: currentRightSlots.length,
      emptyLeft: currentLeftSlots.filter(s => !s.image).length,
      emptyRight: currentRightSlots.filter(s => !s.image).length,
      pendingLeft: pendingSlotsRef.current.left.size,
      pendingRight: pendingSlotsRef.current.right.size,
    });

    // Find AND claim first available slot atomically
    // This prevents race conditions when saving multiple images rapidly
    const findAndClaimSlot = (
      slots: PanelSlot[],
      pendingSet: Set<number>
    ): number => {
      for (let i = 0; i < slots.length; i++) {
        if (!slots[i].image && !pendingSet.has(i)) {
          // IMMEDIATELY claim this slot before returning
          pendingSet.add(i);
          return i;
        }
      }
      return -1;
    };

    // Mark as saved IMMEDIATELY (before any async operations)
    savedPromptIdsRef.current.add(promptId);

    // Try left panel first, then right - claiming slot atomically
    let targetPanel: 'left' | 'right';
    let targetIndex: number;

    const leftEmptyIndex = findAndClaimSlot(currentLeftSlots, pendingSlotsRef.current.left);
    if (leftEmptyIndex !== -1) {
      targetPanel = 'left';
      targetIndex = leftEmptyIndex;
    } else {
      const rightEmptyIndex = findAndClaimSlot(currentRightSlots, pendingSlotsRef.current.right);
      if (rightEmptyIndex !== -1) {
        targetPanel = 'right';
        targetIndex = rightEmptyIndex;
      } else {
        // No slots available - undo the savedPromptIds claim
        console.warn('[saveImageToPanel] BLOCKED: no empty slots available');
        savedPromptIdsRef.current.delete(promptId);
        return false;
      }
    }

    console.log('[saveImageToPanel] SUCCESS: saving to', targetPanel, 'slot', targetIndex);

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

    // Update panel storage using the local persistence hook
    // NOTE: We must ensure slots array has SLOTS_PER_SIDE elements to support indices 0-9
    // Old data from IndexedDB may only have 5 slots
    panelStorage.setData((prev) => {
      // Helper to normalize slots array to SLOTS_PER_SIDE length
      const normalizeSlots = (slots: PanelSlot[]): PanelSlot[] => {
        const result: PanelSlot[] = [];
        for (let i = 0; i < SLOTS_PER_SIDE; i++) {
          result.push(slots[i] || { index: i, image: null });
        }
        return result;
      };

      if (targetPanel === 'left') {
        const normalizedSlots = normalizeSlots(prev.leftSlots);
        return {
          ...prev,
          leftSlots: normalizedSlots.map((slot, i) =>
            i === targetIndex ? { ...slot, image: newImage } : slot
          ),
        };
      } else {
        const normalizedSlots = normalizeSlots(prev.rightSlots);
        return {
          ...prev,
          rightSlots: normalizedSlots.map((slot, i) =>
            i === targetIndex ? { ...slot, image: newImage } : slot
          ),
        };
      }
    });
    console.log('[saveImageToPanel] panelStorage.setData called for', targetPanel, 'slot', targetIndex);
    // NOTE: Don't clear pending here - it's cleared by useEffect after state updates

    // Call callback for database sync (if provided)
    if (onImageSaved) {
      onImageSaved({
        id: newImage.id,
        side: targetPanel,
        slotIndex: targetIndex,
        imageUrl: image.url,
        prompt: promptText,
        type: outputMode || null,
      });
    }

    return true;
  }, [generatedImages, panelStorage, onImageSaved, outputMode]);
  // Note: leftPanelSlots/rightPanelSlots removed - we use currentSlotsRef to avoid stale closures

  /**
   * Upload an external image URL to a specific panel slot
   * Unlike saveImageToPanel, this takes a specific slot rather than finding the next available
   */
  const uploadImageToPanel = useCallback((
    side: 'left' | 'right',
    slotIndex: number,
    imageUrl: string,
    prompt: string = 'Uploaded image'
  ) => {
    // Guard: Don't save while IndexedDB is still loading - slots would appear empty
    if (!panelStorage.isInitialized) {
      console.warn('[uploadImageToPanel] Skipping upload - panel data not yet loaded from IndexedDB');
      return;
    }

    // Validate slot index
    if (slotIndex < 0 || slotIndex >= SLOTS_PER_SIDE) {
      console.warn('[uploadImageToPanel] Invalid slot index:', slotIndex);
      return;
    }

    // Check if slot is already occupied
    const slots = side === 'left' ? leftPanelSlots : rightPanelSlots;
    if (slots[slotIndex]?.image) {
      console.warn('[uploadImageToPanel] Slot is already occupied:', side, slotIndex);
      return;
    }

    // Create the saved image object (no promptId since this is an external upload)
    const newImage: SavedPanelImage = {
      id: uuidv4(),
      url: imageUrl,
      prompt,
      promptId: undefined, // External upload, no associated prompt
      side,
      slotIndex,
      createdAt: new Date().toISOString(),
    };

    // Update panel storage
    // NOTE: Normalize slots to SLOTS_PER_SIDE to handle old data with only 5 slots
    panelStorage.setData((prev) => {
      const normalizeSlots = (slots: PanelSlot[]): PanelSlot[] => {
        const result: PanelSlot[] = [];
        for (let i = 0; i < SLOTS_PER_SIDE; i++) {
          result.push(slots[i] || { index: i, image: null });
        }
        return result;
      };

      if (side === 'left') {
        const normalizedSlots = normalizeSlots(prev.leftSlots);
        return {
          ...prev,
          leftSlots: normalizedSlots.map((slot, i) =>
            i === slotIndex ? { ...slot, image: newImage } : slot
          ),
        };
      } else {
        const normalizedSlots = normalizeSlots(prev.rightSlots);
        return {
          ...prev,
          rightSlots: normalizedSlots.map((slot, i) =>
            i === slotIndex ? { ...slot, image: newImage } : slot
          ),
        };
      }
    });

    // Call callback for database sync (if provided)
    if (onImageSaved) {
      onImageSaved({
        id: newImage.id,
        side,
        slotIndex,
        imageUrl,
        prompt,
      });
    }
  }, [leftPanelSlots, rightPanelSlots, panelStorage, onImageSaved]);

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
   * Updates both local state and persists to database
   */
  const updatePanelImage = useCallback(async (imageId: string, newUrl: string) => {
    // Update local state immediately for responsive UI
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

    // Persist to database if we have a project ID
    if (projectId) {
      try {
        await fetch(`/api/projects/${projectId}/images`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId, imageUrl: newUrl }),
        });
      } catch (err) {
        console.error('[useImageGeneration] Failed to persist image update:', err);
      }
    }
  }, [panelStorage, projectId]);

  /**
   * Update an image's video URL (for Seedance video generation)
   * Updates both local state and persists to database
   */
  const updatePanelImageVideo = useCallback(async (imageId: string, videoUrl: string) => {
    console.log('[useImageGeneration] updatePanelImageVideo called:', { imageId, videoUrl: videoUrl?.substring(0, 50), projectId });

    // Update local state immediately for responsive UI
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

    // Persist to database if we have a project ID
    if (projectId) {
      try {
        console.log('[useImageGeneration] Saving video URL to database...');
        const response = await fetch(`/api/projects/${projectId}/images`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId, videoUrl }),
        });
        const result = await response.json();
        console.log('[useImageGeneration] Video URL save result:', result);
        if (!result.success) {
          console.error('[useImageGeneration] Video URL save failed:', result.error);
        }
      } catch (err) {
        console.error('[useImageGeneration] Failed to persist video URL update:', err);
      }
    } else {
      console.warn('[useImageGeneration] No projectId - video URL not saved to database');
    }
  }, [panelStorage, projectId]);

  /**
   * Update a generated image's URL in-memory (for polish operations).
   * Called before saveImageToPanel so the polished URL gets saved instead of the original.
   */
  const updateGeneratedImageUrl = useCallback((promptId: string, newUrl: string) => {
    setGeneratedImages(prev =>
      prev.map(img => img.promptId === promptId ? { ...img, url: newUrl } : img)
    );
  }, []);

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
   * Delete a single generated image by prompt ID
   * Removes from local state and deletes from Leonardo API
   */
  const deleteGeneration = useCallback(async (promptId: string) => {
    // Find the image to delete
    const imageToDelete = generatedImages.find((img) => img.promptId === promptId);
    if (!imageToDelete) return;

    // Stop polling for this image if active
    const pollTimeout = pollingRef.current.get(promptId);
    if (pollTimeout) {
      clearTimeout(pollTimeout);
      pollingRef.current.delete(promptId);
    }
    pollAttemptsRef.current.delete(promptId);

    // Remove from local state immediately for responsive UI
    setGeneratedImages((prev) => prev.filter((img) => img.promptId !== promptId));

    // Delete from Leonardo in background (don't block UI)
    if (imageToDelete.generationId) {
      try {
        await fetch('/api/ai/generate-images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generationIds: [imageToDelete.generationId] }),
        });
      } catch (error) {
        console.error('Failed to delete generation from Leonardo:', error);
        // Continue even if deletion fails - local state is already cleared
      }
    }
  }, [generatedImages]);

  /**
   * Rebuild savedPromptIdsRef from actual panel slot state.
   * Call this before starting a new autoplay session to clear stale entries
   * where the ref thinks an image is saved but it's not actually in any slot.
   */
  const resetSaveTracking = useCallback(() => {
    const left = currentSlotsRef.current.left;
    const right = currentSlotsRef.current.right;
    savedPromptIdsRef.current.clear();
    pendingSlotsRef.current.left.clear();
    pendingSlotsRef.current.right.clear();
    [...left, ...right].forEach(slot => {
      if (slot.image?.promptId) {
        savedPromptIdsRef.current.add(slot.image.promptId);
      }
    });
    console.log('[resetSaveTracking] Rebuilt savedPromptIdsRef with', savedPromptIdsRef.current.size, 'entries from', left.length + right.length, 'slots');
  }, []);

  /**
   * Clear all panel slots (reset to empty)
   */
  const clearPanelSlots = useCallback(() => {
    savedPromptIdsRef.current.clear();
    pendingSlotsRef.current.left.clear();
    pendingSlotsRef.current.right.clear();
    panelStorage.setData(initialPanelData);
  }, [panelStorage]);

  /**
   * Hydrate panel slots from database images.
   * Fully replaces local slot data with DB data (DB is source of truth).
   * Uses overrideNextLoad to survive storage key changes (project switch).
   */
  const hydratePanelImages = useCallback((dbImages: SavedPanelImage[]) => {
    savedPromptIdsRef.current.clear();
    pendingSlotsRef.current.left.clear();
    pendingSlotsRef.current.right.clear();

    const newLeft = createEmptySlots();
    const newRight = createEmptySlots();

    if (dbImages && dbImages.length > 0) {
      for (const dbImg of dbImages) {
        const targetSlots = dbImg.side === 'left' ? newLeft : newRight;
        const idx = dbImg.slotIndex;
        if (idx < 0 || idx >= SLOTS_PER_SIDE) continue;

        targetSlots[idx] = { index: idx, image: dbImg };
        if (dbImg.promptId) {
          savedPromptIdsRef.current.add(dbImg.promptId);
        }
      }
    }

    const newData = { leftSlots: newLeft, rightSlots: newRight };

    // Use overrideNextLoad so the data survives the storageKey change
    // that happens when onProjectChange fires after hydration.
    // When loadFromStorage fires for the new key, it uses this data
    // instead of reading (potentially stale) IndexedDB data.
    panelStorage.overrideNextLoad(newData);
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
    uploadImageToPanel,
    removePanelImage,
    updatePanelImage,
    updatePanelImageVideo,
    updateGeneratedImageUrl,
    clearGeneratedImages,
    deleteAllGenerations,
    deleteGeneration,
    clearPanelSlots,
    resetSaveTracking,
    hydratePanelImages,
  };
}
