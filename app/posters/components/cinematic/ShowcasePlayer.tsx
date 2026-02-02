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
    titleDuration,
    estimatedVideoDuration,
    transitionDuration,
  } = SHOWCASE_VIDEO_DEFAULTS;

  // Calculate total duration for TransitionSeries
  // TransitionSeries overlaps scenes during transitions, so:
  // Total = sum(sequences) - sum(transitions)
  // Sequence: Title card -> Cover (if exists) -> Videos (if any)
  const durationInFrames = useMemo(() => {
    // Title card always shows
    let totalSequenceDuration = titleDuration;

    // Count transitions starting with title -> cover/video
    let numTransitions = 0;

    // Cover sequence
    if (coverUrl) {
      totalSequenceDuration += coverDuration;
      numTransitions++; // title -> cover
    }

    // Video sequences
    if (videos.length > 0) {
      totalSequenceDuration += videos.length * estimatedVideoDuration;
      // Transition from cover to first video (or title to first video if no cover)
      if (!coverUrl) numTransitions++; // title -> first video
      else numTransitions++; // cover -> first video
      // Transitions between videos
      numTransitions += Math.max(0, videos.length - 1);
    }

    const transitionOverlap = numTransitions * transitionDuration;
    return Math.max(1, totalSequenceDuration - transitionOverlap);
  }, [
    titleDuration,
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
      titleDuration,
    }),
    [projectName, coverUrl, videos, coverDuration, titleDuration]
  );

  // Handle empty state - title card always shows, so we need cover or videos for meaningful content
  const hasContent = Boolean(coverUrl) || (videos && videos.length > 0);
  if (!hasContent) {
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
