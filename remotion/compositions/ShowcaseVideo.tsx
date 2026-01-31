/**
 * ShowcaseVideo - Main Remotion composition for project video showcase
 *
 * Sequences project images with fade transitions for cinematic playback.
 * Used with @remotion/player for in-browser preview.
 *
 * Key patterns:
 * - Uses Remotion's Img component (not Next.js Image - prevents flickering)
 * - Sequence-based timing for precise image scheduling
 * - Simple fade transitions via interpolate
 */

import { Sequence, Img, useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';
import { ShowcaseVideoProps, SHOWCASE_VIDEO_DEFAULTS } from '../types';

/**
 * Single image slide with fade in/out transitions
 */
function ImageSlide({
  url,
  label,
  durationInFrames,
}: {
  url: string;
  label: string;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fadeFrames } = SHOWCASE_VIDEO_DEFAULTS;

  // Fade in at start, fade out at end
  const opacity = interpolate(
    frame,
    [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        opacity,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Img
        src={url}
        alt={label}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Empty state when no images available
 */
function EmptyState() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0f172a', // slate-900
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          color: '#94a3b8', // slate-400
          fontFamily: 'system-ui, sans-serif',
          fontSize: 24,
          textAlign: 'center',
        }}
      >
        No images to display
      </div>
    </AbsoluteFill>
  );
}

/**
 * ShowcaseVideo composition
 *
 * Renders project images in sequence with fade transitions.
 * Each image displays for durationPerImage frames (default 4 seconds at 30fps).
 */
export function ShowcaseVideo({
  projectName,
  images,
  durationPerImage = SHOWCASE_VIDEO_DEFAULTS.durationPerImage,
}: ShowcaseVideoProps) {
  // Handle empty state
  if (!images || images.length === 0) {
    return <EmptyState />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {images.map((image, index) => (
        <Sequence
          key={image.id}
          from={index * durationPerImage}
          durationInFrames={durationPerImage}
          name={`Image: ${image.label || `Slide ${index + 1}`}`}
        >
          <ImageSlide
            url={image.url}
            label={image.label}
            durationInFrames={durationPerImage}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export default ShowcaseVideo;
