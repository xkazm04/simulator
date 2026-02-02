'use client';

/**
 * useVideoExport - Client-side video export using Remotion's WebCodecs renderer
 *
 * Exports video showcase to MP4 entirely in the browser (no server required).
 * Uses @remotion/web-renderer for WebCodecs-based rendering.
 */

import { useState, useCallback } from 'react';
import { renderMediaOnWeb } from '@remotion/web-renderer';
import { ShowcaseVideo } from '@/remotion/compositions/ShowcaseVideo';
import { ShowcaseVideoProps, SHOWCASE_VIDEO_DEFAULTS } from '@/remotion/types';

/**
 * Export progress state
 */
export interface ExportProgress {
  stage: 'idle' | 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error';
  progress: number; // 0-100
  error?: string;
}

/**
 * Options for video export
 */
export interface UseVideoExportOptions {
  projectName: string;
  inputProps: ShowcaseVideoProps;
  durationInFrames: number;
}

/**
 * Hook return type
 */
export interface UseVideoExportReturn {
  exportState: ExportProgress;
  exportVideo: (options: UseVideoExportOptions) => Promise<void>;
  resetExport: () => void;
  isExporting: boolean;
}

/**
 * Client-side video export hook
 *
 * @returns Export state and handlers
 */
export function useVideoExport(): UseVideoExportReturn {
  const [exportState, setExportState] = useState<ExportProgress>({
    stage: 'idle',
    progress: 0,
  });

  const exportVideo = useCallback(async (options: UseVideoExportOptions) => {
    const { projectName, inputProps, durationInFrames } = options;
    const { fps, width, height } = SHOWCASE_VIDEO_DEFAULTS;

    try {
      setExportState({ stage: 'preparing', progress: 0 });

      const result = await renderMediaOnWeb({
        composition: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          component: ShowcaseVideo as any,
          durationInFrames,
          fps,
          width,
          height,
          id: 'showcase-video',
        },
        inputProps,
        onProgress: ({ renderedFrames }) => {
          // Calculate progress as percentage of rendered frames
          const progressPercent = Math.round((renderedFrames / durationInFrames) * 100);
          setExportState({
            stage: 'rendering',
            progress: Math.min(progressPercent, 94), // Cap at 94%, encoding goes to 100%
          });
        },
      });

      setExportState({ stage: 'encoding', progress: 95 });

      // Get the blob from render result
      const blob = await result.getBlob();

      // Create download link with sanitized filename
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const sanitizedName = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `showcase-${sanitizedName}-${timestamp}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportState({ stage: 'complete', progress: 100 });

      // Reset to idle after short delay
      setTimeout(() => {
        setExportState({ stage: 'idle', progress: 0 });
      }, 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportState({
        stage: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Export failed',
      });
    }
  }, []);

  const resetExport = useCallback(() => {
    setExportState({ stage: 'idle', progress: 0 });
  }, []);

  return {
    exportState,
    exportVideo,
    resetExport,
    isExporting:
      exportState.stage !== 'idle' &&
      exportState.stage !== 'complete' &&
      exportState.stage !== 'error',
  };
}
