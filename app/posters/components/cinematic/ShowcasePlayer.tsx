'use client';

/**
 * ShowcasePlayer - Remotion Player wrapper for in-browser video preview
 *
 * Wraps @remotion/player to display the ShowcaseVideo composition.
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
import { ShowcaseVideoProps, SHOWCASE_VIDEO_DEFAULTS } from '@/remotion/types';

export interface ShowcasePlayerProps {
  projectName: string;
  images: Array<{
    id: string;
    url: string;
    label: string;
  }>;
  className?: string;
}

/**
 * Empty state placeholder when no images available
 */
function EmptyPlaceholder() {
  return (
    <div className="w-full aspect-video bg-slate-900 rounded-lg flex items-center justify-center">
      <div className="text-center text-slate-500">
        <div className="text-lg font-mono mb-2">No images to preview</div>
        <div className="text-sm">Add images to your project to generate a video</div>
      </div>
    </div>
  );
}

/**
 * ShowcasePlayer component
 *
 * Renders Remotion Player with ShowcaseVideo composition.
 * Handles empty state gracefully.
 */
export function ShowcasePlayer({
  projectName,
  images,
  className,
}: ShowcasePlayerProps) {
  const { fps, width, height, durationPerImage } = SHOWCASE_VIDEO_DEFAULTS;

  // Calculate total duration based on number of images
  const durationInFrames = images.length * durationPerImage;

  // CRITICAL: Memoize inputProps to prevent Player re-render cascade
  // Without this, Player re-renders thousands of times causing 200-800ms overhead
  const inputProps: ShowcaseVideoProps = useMemo(
    () => ({
      projectName,
      images,
      durationPerImage,
    }),
    [projectName, images, durationPerImage]
  );

  // Handle empty state - don't render Player with no content
  if (!images || images.length === 0) {
    return <EmptyPlaceholder />;
  }

  return (
    <div className={className}>
      <Player
        component={ShowcaseVideo}
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
        autoPlay={false}
        loop
      />
    </div>
  );
}

export default ShowcasePlayer;
