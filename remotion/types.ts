/**
 * Remotion composition types for Simulator video showcase
 */

/**
 * Video item for ShowcaseVideo composition
 */
export interface ShowcaseVideoItem {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  label: string;
}

/**
 * Props for the ShowcaseVideo composition
 * Sequence: Cover image (poster) → Videos in order
 */
export interface ShowcaseVideoProps {
  projectName: string;
  /** Cover/poster image URL to show first */
  coverUrl: string | null;
  /** Videos to play after the cover */
  videos: ShowcaseVideoItem[];
  /** Duration for cover image in frames. Default: 90 (3 seconds at 30fps) */
  coverDuration?: number;
}

/**
 * Default composition settings
 */
export const SHOWCASE_VIDEO_DEFAULTS = {
  /** Frames per second */
  fps: 30,
  /** Video width in pixels */
  width: 1920,
  /** Video height in pixels (16:9 aspect ratio) */
  height: 1080,
  /** Default duration for cover image in frames (3 seconds at 30fps) */
  coverDuration: 90,
  /** Estimated duration per video in frames (5 seconds at 30fps) */
  estimatedVideoDuration: 150,
  /** Transition duration between slides in frames (0.5 seconds at 30fps) */
  transitionDuration: 15,
  /** Lower third display duration in frames (2 seconds at 30fps) */
  lowerThirdDuration: 60,
} as const;
