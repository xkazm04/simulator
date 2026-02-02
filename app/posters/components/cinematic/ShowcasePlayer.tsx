'use client';

/**
 * ShowcasePlayer - Remotion Player wrapper for in-browser video preview
 *
 * Plays: Cover image (poster) → Project videos in sequence
 * CRITICAL: Uses useMemo for inputProps to prevent re-render cascade.
 *
 * Key patterns:
 * - Memoized inputProps (prevents 200-800ms re-render overhead)
 * - No interactive children inside Player (triggers 60fps re-renders)
 * - Client-side only (use client directive)
 */

import React, { useMemo } from 'react';
import { Player } from '@remotion/player';
import { ShowcaseVideo } from '@/remotion/compositions/ShowcaseVideo';
import { ShowcaseVideoProps, ShowcaseVideoItem, SHOWCASE_VIDEO_DEFAULTS } from '@/remotion/types';

export interface ShowcasePlayerProps {
  projectName: string;
  /** Cover/poster image URL */
  coverUrl: string | null;
  /** Videos to play after cover */
  videos: ShowcaseVideoItem[];
  className?: string;
  /** Auto-play on mount */
  autoPlay?: boolean;
}

/**
 * Empty state placeholder when no videos available
 */
function EmptyPlaceholder() {
  return (
    <div className="w-full aspect-video bg-slate-900 rounded-lg flex items-center justify-center">
      <div className="text-center text-slate-500">
        <div className="text-lg font-mono mb-2">No videos to preview</div>
        <div className="text-sm">Generate videos for your project images first</div>
      </div>
    </div>
  );
}

/**
 * ShowcasePlayer component
 *
 * Renders Remotion Player with ShowcaseVideo composition.
 * Plays cover image followed by project videos.
 */
export function ShowcasePlayer({
  projectName,
  coverUrl,
  videos,
  className,
  autoPlay = true,
}: ShowcasePlayerProps) {
  const {
    fps,
    width,
    height,
    coverDuration,
    estimatedVideoDuration,
    transitionDuration,
  } = SHOWCASE_VIDEO_DEFAULTS;

  // Calculate total duration for TransitionSeries
  // TransitionSeries overlaps scenes during transitions, so:
  // Total = sum(sequences) - sum(transitions)
  const durationInFrames = useMemo(() => {
    if (videos.length === 0) {
      return coverUrl ? coverDuration : 1;
    }

    // Sum of all sequence durations
    let totalSequenceDuration = 0;

    // Cover sequence
    if (coverUrl) {
      totalSequenceDuration += coverDuration;
    }

    // Video sequences
    totalSequenceDuration += videos.length * estimatedVideoDuration;

    // Count transitions (overlap reduces total duration)
    // - 1 transition from cover to first video (if cover exists)
    // - (videos.length - 1) transitions between videos
    const numTransitions = (coverUrl ? 1 : 0) + Math.max(0, videos.length - 1);
    const transitionOverlap = numTransitions * transitionDuration;

    return Math.max(1, totalSequenceDuration - transitionOverlap);
  }, [
    coverUrl,
    coverDuration,
    videos.length,
    estimatedVideoDuration,
    transitionDuration,
  ]);

  // CRITICAL: Memoize inputProps to prevent Player re-render cascade
  // Without this, Player re-renders thousands of times causing 200-800ms overhead
  const inputProps: ShowcaseVideoProps = useMemo(
    () => ({
      projectName,
      coverUrl,
      videos,
      coverDuration,
    }),
    [projectName, coverUrl, videos, coverDuration]
  );

  // Handle empty state - need at least cover or videos
  if (!coverUrl && (!videos || videos.length === 0)) {
    return <EmptyPlaceholder />;
  }

  return (
    <div className={className}>
      <Player
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={ShowcaseVideo as any}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={width}
        compositionHeight={height}
        style={{
          width: '100%',
          aspectRatio: '16/9',
        }}
        controls
        autoPlay={autoPlay}
        loop
      />
    </div>
  );
}

export default ShowcasePlayer;
