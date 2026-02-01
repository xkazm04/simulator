/**
 * useVideoPreloader - Preloads video URLs and tracks loading progress
 *
 * Uses browser's video element to preload videos before playback.
 * Tracks individual and overall progress for UI feedback.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface VideoLoadState {
  url: string;
  loaded: boolean;
  progress: number; // 0-100
  error: string | null;
}

interface UseVideoPreloaderResult {
  /** Overall loading progress 0-100 */
  progress: number;
  /** Whether all videos are loaded and ready */
  isReady: boolean;
  /** Whether currently loading */
  isLoading: boolean;
  /** Individual video states */
  videoStates: VideoLoadState[];
  /** Number of videos loaded */
  loadedCount: number;
  /** Total number of videos */
  totalCount: number;
  /** Any errors encountered */
  errors: string[];
  /** Retry loading failed videos */
  retry: () => void;
}

/**
 * Preloads an array of video URLs and tracks progress
 */
export function useVideoPreloader(videoUrls: string[]): UseVideoPreloaderResult {
  const [videoStates, setVideoStates] = useState<VideoLoadState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const videoElementsRef = useRef<HTMLVideoElement[]>([]);

  // Initialize states when URLs change
  useEffect(() => {
    if (videoUrls.length === 0) {
      setVideoStates([]);
      setIsLoading(false);
      return;
    }

    // Initialize all videos as not loaded
    setVideoStates(
      videoUrls.map(url => ({
        url,
        loaded: false,
        progress: 0,
        error: null,
      }))
    );
  }, [videoUrls.join(',')]); // Use joined string as dependency to avoid array reference issues

  // Load videos
  const loadVideos = useCallback(async () => {
    if (videoUrls.length === 0) return;

    // Cancel any previous loading
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Clean up previous video elements
    videoElementsRef.current.forEach(video => {
      video.src = '';
      video.load();
    });
    videoElementsRef.current = [];

    setIsLoading(true);

    // Create video elements for preloading
    const loadPromises = videoUrls.map((url, index) => {
      return new Promise<void>((resolve) => {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        videoElementsRef.current.push(video);

        // Track progress
        video.onprogress = () => {
          if (video.buffered.length > 0 && video.duration > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            const progress = Math.min(100, (bufferedEnd / video.duration) * 100);

            setVideoStates(prev => {
              const newStates = [...prev];
              if (newStates[index]) {
                newStates[index] = { ...newStates[index], progress };
              }
              return newStates;
            });
          }
        };

        // Handle successful load
        video.oncanplaythrough = () => {
          setVideoStates(prev => {
            const newStates = [...prev];
            if (newStates[index]) {
              newStates[index] = { ...newStates[index], loaded: true, progress: 100 };
            }
            return newStates;
          });
          resolve();
        };

        // Handle metadata loaded (minimum required for playback)
        video.onloadedmetadata = () => {
          // Update progress to at least 50% when metadata is ready
          setVideoStates(prev => {
            const newStates = [...prev];
            if (newStates[index] && newStates[index].progress < 50) {
              newStates[index] = { ...newStates[index], progress: 50 };
            }
            return newStates;
          });
        };

        // Handle errors
        video.onerror = () => {
          const errorMsg = `Failed to load video: ${url}`;
          setVideoStates(prev => {
            const newStates = [...prev];
            if (newStates[index]) {
              newStates[index] = { ...newStates[index], error: errorMsg, progress: 0 };
            }
            return newStates;
          });
          resolve(); // Resolve anyway to not block other videos
        };

        // Handle timeout (30 seconds)
        const timeout = setTimeout(() => {
          if (!videoStates[index]?.loaded) {
            // Mark as ready if we have enough buffered (at least metadata)
            if (video.readyState >= 1) {
              setVideoStates(prev => {
                const newStates = [...prev];
                if (newStates[index]) {
                  newStates[index] = { ...newStates[index], loaded: true, progress: 100 };
                }
                return newStates;
              });
            }
            resolve();
          }
        }, 30000);

        // Start loading
        video.src = url;
        video.load();

        // Cleanup timeout on success
        video.oncanplaythrough = () => {
          clearTimeout(timeout);
          setVideoStates(prev => {
            const newStates = [...prev];
            if (newStates[index]) {
              newStates[index] = { ...newStates[index], loaded: true, progress: 100 };
            }
            return newStates;
          });
          resolve();
        };
      });
    });

    // Wait for all videos to load (or timeout/error)
    await Promise.all(loadPromises);
    setIsLoading(false);
  }, [videoUrls]);

  // Start loading when URLs are set
  useEffect(() => {
    if (videoUrls.length > 0 && videoStates.length > 0) {
      loadVideos();
    }

    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      videoElementsRef.current.forEach(video => {
        video.src = '';
        video.load();
      });
      videoElementsRef.current = [];
    };
  }, [videoUrls.length, videoStates.length > 0]);

  // Calculate derived values
  const loadedCount = videoStates.filter(s => s.loaded).length;
  const totalCount = videoStates.length;
  const progress = totalCount > 0
    ? Math.round(videoStates.reduce((sum, s) => sum + s.progress, 0) / totalCount)
    : 0;
  const isReady = totalCount > 0 && loadedCount === totalCount;
  const errors = videoStates.filter(s => s.error).map(s => s.error!);

  const retry = useCallback(() => {
    // Reset error states and reload
    setVideoStates(prev =>
      prev.map(s => ({ ...s, error: null, loaded: false, progress: 0 }))
    );
    loadVideos();
  }, [loadVideos]);

  return {
    progress,
    isReady,
    isLoading,
    videoStates,
    loadedCount,
    totalCount,
    errors,
    retry,
  };
}

export default useVideoPreloader;
