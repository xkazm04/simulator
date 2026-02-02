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
import { ShowcaseVideoProps, SHOWCASE_VIDEO_DEFAULTS, ShowcaseVideoItem } from './types';

/**
 * Calculate total video duration based on video count
 * TransitionSeries overlaps scenes during transitions, so:
 * Total = sum(sequences) - sum(transitions)
 */
export function calculateDuration(
  videoCount: number,
  hasCover: boolean,
  coverDuration: number = SHOWCASE_VIDEO_DEFAULTS.coverDuration,
  estimatedVideoDuration: number = SHOWCASE_VIDEO_DEFAULTS.estimatedVideoDuration,
  transitionDuration: number = SHOWCASE_VIDEO_DEFAULTS.transitionDuration
): number {
  if (videoCount === 0) {
    return hasCover ? coverDuration : 1;
  }

  // Sum of all sequence durations
  let totalSequenceDuration = 0;

  if (hasCover) {
    totalSequenceDuration += coverDuration;
  }

  totalSequenceDuration += videoCount * estimatedVideoDuration;

  // Count transitions (overlap reduces total duration)
  const numTransitions = (hasCover ? 1 : 0) + Math.max(0, videoCount - 1);
  const transitionOverlap = numTransitions * transitionDuration;

  return Math.max(1, totalSequenceDuration - transitionOverlap);
}

/**
 * Default props for ShowcaseVideo composition
 */
export const defaultShowcaseVideoProps: ShowcaseVideoProps = {
  projectName: 'Sample Project',
  coverUrl: null,
  videos: [],
  coverDuration: SHOWCASE_VIDEO_DEFAULTS.coverDuration,
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
export type { ShowcaseVideoProps, ShowcaseVideoItem };
