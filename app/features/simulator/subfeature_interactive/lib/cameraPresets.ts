/**
 * Camera Presets - Cinematic camera configurations for WebGL demos
 *
 * Provides preset camera positions and animations for common cinematic shots:
 * - Hero Shot: Center focus with dramatic zoom
 * - Zoom In: Close-up view
 * - Wide Shot: Full scene view
 * - Pan Left/Right: Horizontal sweep
 * - Orbit: Circular motion around center
 *
 * Each preset defines position, zoom, and animation duration for smooth transitions.
 */

import { CinematicKeyframe, CameraController } from './cameraController';

/**
 * Camera preset identifier
 */
export type CameraPresetId =
  | 'default'
  | 'hero'
  | 'zoom-in'
  | 'wide'
  | 'pan-left'
  | 'pan-right'
  | 'orbit';

/**
 * Camera preset configuration
 */
export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  description: string;
  icon: string;
  /** Target position (normalized 0-1, will be scaled to world bounds) */
  position: { x: number; y: number };
  /** Zoom level */
  zoom: number;
  /** Transition duration in seconds */
  duration: number;
  /** Easing function */
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  /** Whether this is an animated sequence (multi-keyframe) */
  isSequence?: boolean;
  /** Keyframes for animated sequences */
  keyframes?: Array<{
    time: number;
    position: { x: number; y: number };
    zoom: number;
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  }>;
}

/**
 * Available camera presets
 */
export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Reset to default view',
    icon: 'RotateCcw',
    position: { x: 0.5, y: 0.5 },
    zoom: 1.0,
    duration: 0.8,
    easing: 'ease-out',
  },
  {
    id: 'hero',
    label: 'Hero Shot',
    description: 'Dramatic center focus with slight zoom',
    icon: 'Focus',
    position: { x: 0.5, y: 0.45 },
    zoom: 1.3,
    duration: 1.2,
    easing: 'ease-in-out',
  },
  {
    id: 'zoom-in',
    label: 'Zoom In',
    description: 'Close-up detail view',
    icon: 'ZoomIn',
    position: { x: 0.5, y: 0.5 },
    zoom: 1.8,
    duration: 1.0,
    easing: 'ease-in-out',
  },
  {
    id: 'wide',
    label: 'Wide Shot',
    description: 'Full scene establishing shot',
    icon: 'Maximize',
    position: { x: 0.5, y: 0.5 },
    zoom: 0.7,
    duration: 1.0,
    easing: 'ease-out',
  },
  {
    id: 'pan-left',
    label: 'Pan Left',
    description: 'Sweep from right to left',
    icon: 'ArrowLeft',
    position: { x: 0.3, y: 0.5 },
    zoom: 1.0,
    duration: 1.5,
    easing: 'ease-in-out',
    isSequence: true,
    keyframes: [
      { time: 0, position: { x: 0.7, y: 0.5 }, zoom: 1.0, easing: 'linear' },
      { time: 1.5, position: { x: 0.3, y: 0.5 }, zoom: 1.0, easing: 'ease-in-out' },
    ],
  },
  {
    id: 'pan-right',
    label: 'Pan Right',
    description: 'Sweep from left to right',
    icon: 'ArrowRight',
    position: { x: 0.7, y: 0.5 },
    zoom: 1.0,
    duration: 1.5,
    easing: 'ease-in-out',
    isSequence: true,
    keyframes: [
      { time: 0, position: { x: 0.3, y: 0.5 }, zoom: 1.0, easing: 'linear' },
      { time: 1.5, position: { x: 0.7, y: 0.5 }, zoom: 1.0, easing: 'ease-in-out' },
    ],
  },
  {
    id: 'orbit',
    label: 'Orbit',
    description: 'Circular motion around center',
    icon: 'RefreshCw',
    position: { x: 0.5, y: 0.5 },
    zoom: 1.1,
    duration: 4.0,
    easing: 'linear',
    isSequence: true,
    keyframes: [
      { time: 0, position: { x: 0.6, y: 0.4 }, zoom: 1.1, easing: 'linear' },
      { time: 1.0, position: { x: 0.6, y: 0.6 }, zoom: 1.15, easing: 'linear' },
      { time: 2.0, position: { x: 0.4, y: 0.6 }, zoom: 1.1, easing: 'linear' },
      { time: 3.0, position: { x: 0.4, y: 0.4 }, zoom: 1.05, easing: 'linear' },
      { time: 4.0, position: { x: 0.6, y: 0.4 }, zoom: 1.1, easing: 'linear' },
    ],
  },
];

/**
 * Auto-play sequence configuration
 */
export interface AutoPlayConfig {
  /** Presets to cycle through (by ID) */
  presets: CameraPresetId[];
  /** Delay between presets in seconds */
  delayBetween: number;
  /** Loop back to start */
  loop: boolean;
}

/**
 * Default auto-play configuration
 */
export const DEFAULT_AUTOPLAY_CONFIG: AutoPlayConfig = {
  presets: ['hero', 'zoom-in', 'wide', 'orbit'],
  delayBetween: 2.0,
  loop: true,
};

/**
 * Get a preset by ID
 */
export function getPreset(id: CameraPresetId): CameraPreset | undefined {
  return CAMERA_PRESETS.find(p => p.id === id);
}

/**
 * Convert normalized position to world coordinates
 */
export function normalizedToWorld(
  normalized: { x: number; y: number },
  worldBounds: { width: number; height: number }
): { x: number; y: number } {
  return {
    x: normalized.x * worldBounds.width,
    y: normalized.y * worldBounds.height,
  };
}

/**
 * Apply a preset to a camera controller
 */
export function applyPresetToCamera(
  camera: CameraController,
  preset: CameraPreset,
  worldBounds: { width: number; height: number }
): void {
  const targetPos = normalizedToWorld(preset.position, worldBounds);

  if (preset.isSequence && preset.keyframes && preset.keyframes.length > 0) {
    // Convert keyframes to cinematic keyframes with world coordinates
    const cinematicKeyframes: CinematicKeyframe[] = preset.keyframes.map(kf => ({
      time: kf.time,
      position: normalizedToWorld(kf.position, worldBounds),
      zoom: kf.zoom,
      easing: kf.easing,
    }));

    camera.playCinematic(cinematicKeyframes);
  } else {
    // Simple transition using target position
    camera.setTarget(targetPos.x, targetPos.y);
    camera.setZoom(preset.zoom);
  }
}

/**
 * Create interpolated position for smooth transitions
 */
export function lerpPosition(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number
): { x: number; y: number } {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

/**
 * Easing functions for preset transitions
 */
export const easingFunctions = {
  linear: (t: number) => t,
  'ease-in': (t: number) => t * t,
  'ease-out': (t: number) => t * (2 - t),
  'ease-in-out': (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

/**
 * Calculate eased progress
 */
export function applyEasing(
  t: number,
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
): number {
  return easingFunctions[easing](Math.max(0, Math.min(1, t)));
}

/**
 * AutoPlay controller for cycling through presets
 */
export class CameraAutoPlayer {
  private camera: CameraController;
  private worldBounds: { width: number; height: number };
  private config: AutoPlayConfig;
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private onPresetChange?: (presetId: CameraPresetId) => void;

  constructor(
    camera: CameraController,
    worldBounds: { width: number; height: number },
    config: AutoPlayConfig = DEFAULT_AUTOPLAY_CONFIG,
    onPresetChange?: (presetId: CameraPresetId) => void
  ) {
    this.camera = camera;
    this.worldBounds = worldBounds;
    this.config = config;
    this.onPresetChange = onPresetChange;
  }

  /**
   * Start auto-play sequence
   */
  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentIndex = 0;
    this.playNext();
  }

  /**
   * Stop auto-play sequence
   */
  stop(): void {
    this.isPlaying = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Check if auto-play is active
   */
  isActive(): boolean {
    return this.isPlaying;
  }

  /**
   * Play the next preset in sequence
   */
  private playNext(): void {
    if (!this.isPlaying) return;

    const presetId = this.config.presets[this.currentIndex];
    const preset = getPreset(presetId);

    if (preset) {
      applyPresetToCamera(this.camera, preset, this.worldBounds);
      this.onPresetChange?.(presetId);

      // Calculate total time for this preset (duration + delay)
      const totalTime = (preset.duration + this.config.delayBetween) * 1000;

      this.timeoutId = setTimeout(() => {
        this.currentIndex++;

        if (this.currentIndex >= this.config.presets.length) {
          if (this.config.loop) {
            this.currentIndex = 0;
            this.playNext();
          } else {
            this.stop();
          }
        } else {
          this.playNext();
        }
      }, totalTime);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoPlayConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop();
  }
}
