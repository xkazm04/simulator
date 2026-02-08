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
import { clockWipe } from '@remotion/transitions/clock-wipe';
import {
  ShowcaseVideoProps,
  ShowcaseSketchItem,
  ShowcaseWhatifItem,
  SHOWCASE_VIDEO_DEFAULTS,
} from '../types';
import { TitleCard } from './TitleCard';

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
// Sketch Grid - Adaptive layout based on image count
// ============================================================================

function SketchGrid({ images }: { images: ShowcaseSketchItem[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.95, 1]);

  const count = images.length;

  // Determine grid layout: cols x rows
  let cols: number;
  let rows: number;
  if (count <= 1) {
    cols = 1; rows = 1;
  } else if (count <= 2) {
    cols = 2; rows = 1;
  } else if (count <= 4) {
    cols = 2; rows = 2;
  } else {
    cols = 3; rows = 2;
  }

  const gap = 12;
  const padding = 48;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {/* Section label */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 3,
            height: 20,
            backgroundColor: '#ca8a04',
            borderRadius: 2,
          }}
        />
        <div
          style={{
            color: '#ca8a04',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Sketches
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap,
          padding,
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          paddingTop: padding + 32,
        }}
      >
        {images.slice(0, 6).map((img, i) => {
          // Stagger entrance per image
          const itemProgress = spring({
            frame: frame - i * 3,
            fps,
            config: { damping: 18, stiffness: 120 },
          });
          const itemOpacity = interpolate(itemProgress, [0, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const cellWidth = `calc(${100 / cols}% - ${gap}px)`;
          const cellHeight = `calc(${100 / rows}% - ${gap}px)`;

          return (
            <div
              key={img.id}
              style={{
                width: cellWidth,
                height: cellHeight,
                borderRadius: 8,
                overflow: 'hidden',
                opacity: itemOpacity,
                position: 'relative',
              }}
            >
              <Img
                src={img.imageUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              {/* Label overlay */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '6px 10px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                  color: '#e2e8f0',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {img.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ============================================================================
// Whatif Slide - Before/After comparison
// ============================================================================

function WhatifSlide({
  whatif,
  currentIndex,
  totalCount,
}: {
  whatif: ShowcaseWhatifItem;
  currentIndex: number;
  totalCount: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);

  // Before image slides in from left
  const beforeX = interpolate(progress, [0, 1], [-30, 0]);
  // After image slides in from right
  const afterX = interpolate(progress, [0, 1], [30, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
      }}
    >
      {/* Section label */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 3,
            height: 20,
            backgroundColor: '#06b6d4',
            borderRadius: 2,
          }}
        />
        <div
          style={{
            color: '#06b6d4',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          What If {totalCount > 1 ? `${currentIndex + 1}/${totalCount}` : ''}
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '72px 48px 48px',
          gap: 24,
          boxSizing: 'border-box',
        }}
      >
        {/* Before */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            transform: `translateX(${beforeX}px)`,
          }}
        >
          <div
            style={{
              color: '#94a3b8',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Before
          </div>
          <div
            style={{
              flex: 1,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <Img
              src={whatif.beforeImageUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
          {whatif.beforeCaption && (
            <div
              style={{
                color: '#94a3b8',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 14,
                textAlign: 'center',
                padding: '0 8px',
              }}
            >
              {whatif.beforeCaption}
            </div>
          )}
        </div>

        {/* Center divider */}
        <div
          style={{
            width: 2,
            alignSelf: 'stretch',
            marginTop: 32,
            marginBottom: 16,
            background: 'linear-gradient(to bottom, transparent, #334155, transparent)',
            borderRadius: 1,
          }}
        />

        {/* After */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            transform: `translateX(${afterX}px)`,
          }}
        >
          <div
            style={{
              color: '#06b6d4',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            After
          </div>
          <div
            style={{
              flex: 1,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid rgba(6, 182, 212, 0.2)',
            }}
          >
            <Img
              src={whatif.afterImageUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
          {whatif.afterCaption && (
            <div
              style={{
                color: '#94a3b8',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 14,
                textAlign: 'center',
                padding: '0 8px',
              }}
            >
              {whatif.afterCaption}
            </div>
          )}
        </div>
      </div>
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
  sketches = [],
  whatifs = [],
  coverDuration = SHOWCASE_VIDEO_DEFAULTS.coverDuration,
  videoDuration = SHOWCASE_VIDEO_DEFAULTS.estimatedVideoDuration,
  titleDuration = SHOWCASE_VIDEO_DEFAULTS.titleDuration,
  sketchDuration = SHOWCASE_VIDEO_DEFAULTS.sketchDuration,
  whatifDuration = SHOWCASE_VIDEO_DEFAULTS.whatifDuration,
}: ShowcaseVideoProps) {
  const { transitionDuration, width, height } = SHOWCASE_VIDEO_DEFAULTS;

  // Transitions rotate through fade, slide, clockWipe
  const transitions = [
    fade(),
    slide({ direction: 'from-right' }),
    clockWipe({ width, height }),
  ];

  // Track transition index for consistent rotation across all slide types
  let transitionIndex = 0;

  const hasContent = coverUrl || sketches.length > 0 || whatifs.length > 0 || (videos && videos.length > 0);

  // Empty state
  if (!hasContent) {
    return <EmptyState />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <TransitionSeries>
        {/* Title card always first */}
        <TransitionSeries.Sequence durationInFrames={titleDuration}>
          <TitleCard projectName={projectName} subtitle="Project Showcase" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Cover image if available */}
        {coverUrl && (
          <>
            <TransitionSeries.Sequence durationInFrames={coverDuration}>
              <CoverSlide url={coverUrl} />
            </TransitionSeries.Sequence>
            {(sketches.length > 0 || whatifs.length > 0 || (videos && videos.length > 0)) && (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: transitionDuration })}
              />
            )}
          </>
        )}

        {/* Sketch grid if sketches exist */}
        {sketches.length > 0 && (
          <>
            <TransitionSeries.Sequence durationInFrames={sketchDuration}>
              <SketchGrid images={sketches} />
            </TransitionSeries.Sequence>
            {(whatifs.length > 0 || (videos && videos.length > 0)) && (
              <TransitionSeries.Transition
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                presentation={transitions[transitionIndex++ % transitions.length] as any}
                timing={linearTiming({ durationInFrames: transitionDuration })}
              />
            )}
          </>
        )}

        {/* Whatif before/after pairs */}
        {whatifs.map((whatif, index) => (
          <React.Fragment key={whatif.id}>
            <TransitionSeries.Sequence durationInFrames={whatifDuration}>
              <WhatifSlide
                whatif={whatif}
                currentIndex={index}
                totalCount={whatifs.length}
              />
            </TransitionSeries.Sequence>

            {/* Transition after each whatif (not after the last one if no videos follow) */}
            {(index < whatifs.length - 1 || (videos && videos.length > 0)) && (
              <TransitionSeries.Transition
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                presentation={transitions[transitionIndex++ % transitions.length] as any}
                timing={linearTiming({ durationInFrames: transitionDuration })}
              />
            )}
          </React.Fragment>
        ))}

        {/* Video slides with transitions between them */}
        {videos.map((video, index) => (
          <React.Fragment key={video.id}>
            <TransitionSeries.Sequence durationInFrames={videoDuration}>
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                presentation={transitions[transitionIndex++ % transitions.length] as any}
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
