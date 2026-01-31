/**
 * Remotion composition types for Simulator video showcase
 */

/**
 * Image data for ShowcaseVideo composition
 */
export interface ShowcaseImage {
  id: string;
  url: string;
  label: string;
}

/**
 * Props for the ShowcaseVideo composition
 */
export interface ShowcaseVideoProps {
  projectName: string;
  images: ShowcaseImage[];
  /** Duration per image in frames. Default: 120 (4 seconds at 30fps) */
  durationPerImage?: number;
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
  /** Default duration per image in frames (4 seconds at 30fps) */
  durationPerImage: 120,
  /** Fade transition duration in frames (0.5 seconds at 30fps) */
  fadeFrames: 15,
} as const;
