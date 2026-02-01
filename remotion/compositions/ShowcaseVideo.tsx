/**
 * ShowcaseVideo - Clean Remotion composition for video showcase
 *
 * Uses @remotion/transitions TransitionSeries for proper transitions.
 * Optimized for performance - no GPU-intensive effects.
 *
 * Based on Remotion best practices:
 * - https://www.remotion.dev/docs/performance
 * - https://www.remotion.dev/docs/transitions/transitionseries
 */

import React from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { ShowcaseVideoProps, SHOWCASE_VIDEO_DEFAULTS } from '../types';

// ============================================================================
// Cover Slide - Static poster image
// ============================================================================

function CoverSlide({ url }: { url: string }) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Img
        src={url}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </AbsoluteFill>
  );
}

// ============================================================================
// Lower Third - Video label overlay
// ============================================================================

function LowerThird({
  label,
  currentIndex,
  totalCount,
  showDuration,
}: {
  label: string;
  currentIndex: number;
  totalCount: number;
  showDuration: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Simple slide in
  const progress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 120 },
  });

  // Fade out at end
  const fadeOut = frame > showDuration - 20
    ? interpolate(frame, [showDuration - 20, showDuration], [1, 0], { extrapolateRight: 'clamp' })
    : 1;

  const opacity = progress * fadeOut;
  const translateX = interpolate(progress, [0, 1], [-50, 0]);

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 48,
        left: 32,
        opacity,
        transform: `translateX(${translateX}px)`,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: 6,
          padding: '10px 16px',
          borderLeft: '3px solid #ca8a04',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(202, 138, 4, 0.2)',
            borderRadius: 4,
            padding: '3px 8px',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            fontWeight: 700,
            color: '#ca8a04',
          }}
        >
          {currentIndex + 1}/{totalCount}
        </div>
        <div
          style={{
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Progress Dots
// ============================================================================

function ProgressDots({
  currentIndex,
  totalCount,
}: {
  currentIndex: number;
  totalCount: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame: frame - 10,
    fps,
    config: { damping: 25 },
  });

  if (opacity <= 0.1) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 6,
        opacity,
      }}
    >
      {Array.from({ length: totalCount }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === currentIndex ? 18 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === currentIndex
              ? '#ca8a04'
              : i < currentIndex
                ? 'rgba(202, 138, 4, 0.5)'
                : 'rgba(255, 255, 255, 0.3)',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Video Slide - Single video with overlays
// ============================================================================

function VideoSlide({
  videoUrl,
  label,
  currentIndex,
  totalCount,
}: {
  videoUrl: string;
  label: string;
  currentIndex: number;
  totalCount: number;
}) {
  const { lowerThirdDuration } = SHOWCASE_VIDEO_DEFAULTS;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <OffthreadVideo
        src={videoUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
      <LowerThird
        label={label}
        currentIndex={currentIndex}
        totalCount={totalCount}
        showDuration={lowerThirdDuration}
      />
      <ProgressDots currentIndex={currentIndex} totalCount={totalCount} />
    </AbsoluteFill>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          color: '#64748b',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 18,
        }}
      >
        No videos to display
      </div>
    </AbsoluteFill>
  );
}

// ============================================================================
// Main Composition - Uses TransitionSeries for proper transitions
// ============================================================================

export function ShowcaseVideo({
  projectName,
  coverUrl,
  videos,
  coverDuration = SHOWCASE_VIDEO_DEFAULTS.coverDuration,
}: ShowcaseVideoProps) {
  const { estimatedVideoDuration, transitionDuration } = SHOWCASE_VIDEO_DEFAULTS;

  // Empty state
  if (!videos || videos.length === 0) {
    if (coverUrl) {
      return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
          <CoverSlide url={coverUrl} />
        </AbsoluteFill>
      );
    }
    return <EmptyState />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <TransitionSeries>
        {/* Cover image if available */}
        {coverUrl && (
          <>
            <TransitionSeries.Sequence durationInFrames={coverDuration}>
              <CoverSlide url={coverUrl} />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: transitionDuration })}
            />
          </>
        )}

        {/* Video slides with transitions between them */}
        {videos.map((video, index) => (
          <React.Fragment key={video.id}>
            <TransitionSeries.Sequence durationInFrames={estimatedVideoDuration}>
              <VideoSlide
                videoUrl={video.videoUrl}
                label={video.label}
                currentIndex={index}
                totalCount={videos.length}
              />
            </TransitionSeries.Sequence>

            {/* Transition to next video (not after last) */}
            {index < videos.length - 1 && (
              <TransitionSeries.Transition
                presentation={index % 2 === 0 ? slide({ direction: 'from-right' }) : fade()}
                timing={linearTiming({ durationInFrames: transitionDuration })}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
}

export default ShowcaseVideo;
