/**
 * useWhatif - Hook for managing WhatIf before/after comparison pairs
 *
 * Handles:
 * - Loading whatif pairs from database
 * - Creating/updating whatif pairs
 * - Uploading images via server API (bypasses RLS)
 * - Deleting whatif pairs
 */

'use client';

import { useState, useCallback, useEffect } from 'react';

export interface WhatifPair {
  id: string;
  projectId: string;
  beforeImageUrl: string | null;
  beforeCaption: string | null;
  afterImageUrl: string | null;
  afterCaption: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface UseWhatifOptions {
  projectId: string | null;
}

interface UseWhatifReturn {
  /** Current whatif pair (first one for now - can extend to list) */
  whatif: WhatifPair | null;
  /** All whatif pairs */
  whatifs: WhatifPair[];
  /** Loading state */
  isLoading: boolean;
  /** Uploading state */
  isUploading: boolean;
  /** Error message */
  error: string | null;
  /** Upload before image */
  uploadBeforeImage: (file: File) => Promise<void>;
  /** Upload after image */
  uploadAfterImage: (file: File) => Promise<void>;
  /** Update caption */
  updateCaption: (side: 'before' | 'after', caption: string) => Promise<void>;
  /** Clear an image */
  clearImage: (side: 'before' | 'after') => Promise<void>;
  /** Delete the whatif pair */
  deleteWhatif: () => Promise<void>;
  /** Reload whatifs */
  reload: () => Promise<void>;
}

/**
 * Parse API response to WhatifPair
 */
function parseWhatif(data: Record<string, unknown>): WhatifPair {
  return {
    id: data.id as string,
    projectId: data.project_id as string,
    beforeImageUrl: data.before_image_url as string | null,
    beforeCaption: data.before_caption as string | null,
    afterImageUrl: data.after_image_url as string | null,
    afterCaption: data.after_caption as string | null,
    displayOrder: data.display_order as number,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export function useWhatif({ projectId }: UseWhatifOptions): UseWhatifReturn {
  const [whatifs, setWhatifs] = useState<WhatifPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the first whatif (for simple single-pair UI)
  const whatif = whatifs.length > 0 ? whatifs[0] : null;

  /**
   * Load whatifs from database
   */
  const loadWhatifs = useCallback(async () => {
    if (!projectId) {
      setWhatifs([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/whatifs`, { cache: 'no-store' });
      const result = await response.json();

      if (result.success && result.whatifs) {
        setWhatifs(result.whatifs.map(parseWhatif));
      } else {
        setError(result.error || 'Failed to load whatifs');
      }
    } catch (err) {
      console.error('Load whatifs error:', err);
      setError('Failed to load whatifs');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load on mount and when projectId changes
  useEffect(() => {
    loadWhatifs();
  }, [loadWhatifs]);

  /**
   * Upload image via server API (bypasses RLS) and update whatif
   */
  const uploadImage = useCallback(async (file: File, side: 'before' | 'after') => {
    if (!projectId) {
      setError('No project selected');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Use FormData to upload via server API (bypasses RLS)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('side', side);
      if (whatif?.id) {
        formData.append('whatifId', whatif.id);
      }
      if (whatif?.beforeImageUrl) {
        formData.append('beforeImageUrl', whatif.beforeImageUrl);
      }
      if (whatif?.beforeCaption) {
        formData.append('beforeCaption', whatif.beforeCaption);
      }
      if (whatif?.afterImageUrl) {
        formData.append('afterImageUrl', whatif.afterImageUrl);
      }
      if (whatif?.afterCaption) {
        formData.append('afterCaption', whatif.afterCaption);
      }

      const response = await fetch(`/api/projects/${projectId}/whatifs/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success && result.whatif) {
        const updated = parseWhatif(result.whatif);
        setWhatifs(prev => {
          const idx = prev.findIndex(w => w.id === updated.id);
          if (idx >= 0) {
            const newList = [...prev];
            newList[idx] = updated;
            return newList;
          }
          return [updated, ...prev];
        });
      } else {
        setError(result.error || 'Failed to upload image');
      }
    } catch (err) {
      console.error('Upload image error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  }, [projectId, whatif]);

  const uploadBeforeImage = useCallback(async (file: File) => {
    await uploadImage(file, 'before');
  }, [uploadImage]);

  const uploadAfterImage = useCallback(async (file: File) => {
    await uploadImage(file, 'after');
  }, [uploadImage]);

  /**
   * Update caption for before/after
   */
  const updateCaption = useCallback(async (side: 'before' | 'after', caption: string) => {
    if (!projectId || !whatif) {
      setError('No whatif to update');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/whatifs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: whatif.id,
          beforeImageUrl: whatif.beforeImageUrl,
          beforeCaption: side === 'before' ? caption : whatif.beforeCaption,
          afterImageUrl: whatif.afterImageUrl,
          afterCaption: side === 'after' ? caption : whatif.afterCaption,
          displayOrder: whatif.displayOrder,
        }),
      });

      const result = await response.json();
      if (result.success && result.whatif) {
        const updated = parseWhatif(result.whatif);
        setWhatifs(prev => prev.map(w => w.id === updated.id ? updated : w));
      }
    } catch (err) {
      console.error('Update caption error:', err);
      setError('Failed to update caption');
    }
  }, [projectId, whatif]);

  /**
   * Clear an image (set to null)
   */
  const clearImage = useCallback(async (side: 'before' | 'after') => {
    if (!projectId || !whatif) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/whatifs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: whatif.id,
          beforeImageUrl: side === 'before' ? null : whatif.beforeImageUrl,
          beforeCaption: side === 'before' ? null : whatif.beforeCaption,
          afterImageUrl: side === 'after' ? null : whatif.afterImageUrl,
          afterCaption: side === 'after' ? null : whatif.afterCaption,
          displayOrder: whatif.displayOrder,
        }),
      });

      const result = await response.json();
      if (result.success && result.whatif) {
        const updated = parseWhatif(result.whatif);
        setWhatifs(prev => prev.map(w => w.id === updated.id ? updated : w));
      }
    } catch (err) {
      console.error('Clear image error:', err);
      setError('Failed to clear image');
    }
  }, [projectId, whatif]);

  /**
   * Delete the whatif pair
   */
  const deleteWhatif = useCallback(async () => {
    if (!projectId || !whatif) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/whatifs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatifId: whatif.id }),
      });

      const result = await response.json();
      if (result.success) {
        setWhatifs(prev => prev.filter(w => w.id !== whatif.id));
      } else {
        setError(result.error || 'Failed to delete whatif');
      }
    } catch (err) {
      console.error('Delete whatif error:', err);
      setError('Failed to delete whatif');
    }
  }, [projectId, whatif]);

  return {
    whatif,
    whatifs,
    isLoading,
    isUploading,
    error,
    uploadBeforeImage,
    uploadAfterImage,
    updateCaption,
    clearImage,
    deleteWhatif,
    reload: loadWhatifs,
  };
}
