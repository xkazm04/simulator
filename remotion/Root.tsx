/**
 * Remotion Root - Composition registry for Simulator video showcase
 *
 * This file provides composition utilities and exports for @remotion/player.
 * For brownfield Next.js integration, we use the Player directly with ShowcaseVideo.
 *
 * Note: In a full Remotion setup, this would use registerRoot() with Composition.
 * For our client-side-only approach, we export utilities and the component directly.
 */

import { ShowcaseVideo } from './compositions/ShowcaseVideo';
import { ShowcaseVideoProps, SHOWCASE_VIDEO_DEFAULTS, ShowcaseImage } from './types';

/**
 * Calculate total video duration based on image count
 */
export function calculateDuration(
  imageCount: number,
  durationPerImage: number = SHOWCASE_VIDEO_DEFAULTS.durationPerImage
): number {
  return Math.max(imageCount * durationPerImage, SHOWCASE_VIDEO_DEFAULTS.durationPerImage);
}

/**
 * Default props for ShowcaseVideo composition
 */
export const defaultShowcaseVideoProps: ShowcaseVideoProps = {
  projectName: 'Sample Project',
  images: [],
  durationPerImage: SHOWCASE_VIDEO_DEFAULTS.durationPerImage,
};

/**
 * Composition metadata for Player configuration
 */
export const SHOWCASE_VIDEO_COMPOSITION = {
  id: 'ShowcaseVideo',
  fps: SHOWCASE_VIDEO_DEFAULTS.fps,
  width: SHOWCASE_VIDEO_DEFAULTS.width,
  height: SHOWCASE_VIDEO_DEFAULTS.height,
} as const;

// Re-export composition for direct Player usage
export { ShowcaseVideo };
export { SHOWCASE_VIDEO_DEFAULTS };
export type { ShowcaseVideoProps, ShowcaseImage };
