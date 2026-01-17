/**
 * CameraController - Smooth camera with multiple modes
 *
 * Provides camera control for 2D game views:
 * - Static: Fixed camera position
 * - Follow: Smoothly follows a target
 * - Cinematic: Predefined camera paths
 * - Free: User-controlled pan/zoom
 *
 * Features:
 * - Smooth interpolation (lerp)
 * - Camera bounds/limits
 * - Zoom controls
 * - Shake effects
 * - Dead zone for follow mode
 */

export type CameraMode = 'static' | 'follow' | 'cinematic' | 'free';

export interface CameraConfig {
  /** Camera mode */
  mode: CameraMode;
  /** World bounds (camera cannot show beyond these) */
  worldBounds: { width: number; height: number };
  /** Viewport size */
  viewport: { width: number; height: number };
  /** Initial position */
  initialPosition: { x: number; y: number };
  /** Initial zoom level (1 = 100%) */
  initialZoom: number;
  /** Minimum zoom level */
  minZoom: number;
  /** Maximum zoom level */
  maxZoom: number;
  /** Follow smoothing factor (0-1, lower = smoother) */
  followSmoothing: number;
  /** Dead zone size for follow mode (in viewport %) */
  deadZone: { x: number; y: number };
  /** Look-ahead distance (in direction of movement) */
  lookAhead: { x: number; y: number };
  /** Enable edge scrolling for free mode */
  edgeScrolling: boolean;
  /** Edge scroll speed */
  edgeScrollSpeed: number;
}

export interface CameraState {
  /** Current camera position (world coordinates) */
  x: number;
  y: number;
  /** Current zoom level */
  zoom: number;
  /** Target position (for lerping) */
  targetX: number;
  targetY: number;
  /** Target zoom (for lerping) */
  targetZoom: number;
  /** Shake offset */
  shakeX: number;
  shakeY: number;
  /** Current shake intensity */
  shakeIntensity: number;
}

export interface CinematicKeyframe {
  /** Time in seconds */
  time: number;
  /** Camera position */
  position: { x: number; y: number };
  /** Zoom level */
  zoom: number;
  /** Easing function */
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

const DEFAULT_CONFIG: CameraConfig = {
  mode: 'follow',
  worldBounds: { width: 1600, height: 1200 },
  viewport: { width: 800, height: 600 },
  initialPosition: { x: 400, y: 300 },
  initialZoom: 1,
  minZoom: 0.5,
  maxZoom: 2,
  followSmoothing: 0.1,
  deadZone: { x: 0.2, y: 0.2 },
  lookAhead: { x: 50, y: 30 },
  edgeScrolling: false,
  edgeScrollSpeed: 5,
};

/**
 * Easing functions for smooth camera movement
 */
const easingFunctions = {
  linear: (t: number) => t,
  'ease-in': (t: number) => t * t,
  'ease-out': (t: number) => t * (2 - t),
  'ease-in-out': (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

/**
 * CameraController class - Manages camera position and movement
 */
export class CameraController {
  private config: CameraConfig;
  private state: CameraState;
  private cinematicKeyframes: CinematicKeyframe[] = [];
  private cinematicTime = 0;
  private isPlaying = false;

  constructor(config: Partial<CameraConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      x: this.config.initialPosition.x,
      y: this.config.initialPosition.y,
      zoom: this.config.initialZoom,
      targetX: this.config.initialPosition.x,
      targetY: this.config.initialPosition.y,
      targetZoom: this.config.initialZoom,
      shakeX: 0,
      shakeY: 0,
      shakeIntensity: 0,
    };
  }

  /**
   * Update camera each frame
   */
  update(deltaTime: number): void {
    // Update shake
    if (this.state.shakeIntensity > 0) {
      this.state.shakeX = (Math.random() - 0.5) * 2 * this.state.shakeIntensity;
      this.state.shakeY = (Math.random() - 0.5) * 2 * this.state.shakeIntensity;
      this.state.shakeIntensity *= 0.9; // Decay
      if (this.state.shakeIntensity < 0.1) {
        this.state.shakeIntensity = 0;
        this.state.shakeX = 0;
        this.state.shakeY = 0;
      }
    }

    // Update based on mode
    switch (this.config.mode) {
      case 'cinematic':
        this.updateCinematic(deltaTime);
        break;
      case 'follow':
      case 'free':
      case 'static':
      default:
        this.updateLerp(deltaTime);
        break;
    }

    // Clamp to bounds
    this.clampToBounds();
  }

  private updateLerp(deltaTime: number): void {
    const smoothing = this.config.followSmoothing;
    const dtFactor = Math.min(deltaTime / 16.67, 2); // Normalize to 60fps

    // Lerp position
    this.state.x += (this.state.targetX - this.state.x) * smoothing * dtFactor;
    this.state.y += (this.state.targetY - this.state.y) * smoothing * dtFactor;

    // Lerp zoom
    this.state.zoom += (this.state.targetZoom - this.state.zoom) * smoothing * dtFactor;
  }

  private updateCinematic(deltaTime: number): void {
    if (!this.isPlaying || this.cinematicKeyframes.length < 2) {
      return;
    }

    this.cinematicTime += deltaTime / 1000;

    // Find current keyframe pair
    let startFrame = this.cinematicKeyframes[0];
    let endFrame = this.cinematicKeyframes[1];

    for (let i = 0; i < this.cinematicKeyframes.length - 1; i++) {
      if (
        this.cinematicTime >= this.cinematicKeyframes[i].time &&
        this.cinematicTime < this.cinematicKeyframes[i + 1].time
      ) {
        startFrame = this.cinematicKeyframes[i];
        endFrame = this.cinematicKeyframes[i + 1];
        break;
      }
    }

    // Check if cinematic is complete
    const lastFrame = this.cinematicKeyframes[this.cinematicKeyframes.length - 1];
    if (this.cinematicTime >= lastFrame.time) {
      this.state.x = lastFrame.position.x;
      this.state.y = lastFrame.position.y;
      this.state.zoom = lastFrame.zoom;
      this.isPlaying = false;
      return;
    }

    // Interpolate between keyframes
    const duration = endFrame.time - startFrame.time;
    const elapsed = this.cinematicTime - startFrame.time;
    const rawT = duration > 0 ? elapsed / duration : 1;
    const t = easingFunctions[endFrame.easing](rawT);

    this.state.x = startFrame.position.x + (endFrame.position.x - startFrame.position.x) * t;
    this.state.y = startFrame.position.y + (endFrame.position.y - startFrame.position.y) * t;
    this.state.zoom = startFrame.zoom + (endFrame.zoom - startFrame.zoom) * t;
  }

  private clampToBounds(): void {
    const { worldBounds, viewport } = this.config;
    const halfViewW = (viewport.width / 2) / this.state.zoom;
    const halfViewH = (viewport.height / 2) / this.state.zoom;

    // Clamp X
    this.state.x = Math.max(halfViewW, Math.min(worldBounds.width - halfViewW, this.state.x));
    this.state.targetX = Math.max(
      halfViewW,
      Math.min(worldBounds.width - halfViewW, this.state.targetX)
    );

    // Clamp Y
    this.state.y = Math.max(halfViewH, Math.min(worldBounds.height - halfViewH, this.state.y));
    this.state.targetY = Math.max(
      halfViewH,
      Math.min(worldBounds.height - halfViewH, this.state.targetY)
    );

    // Clamp zoom
    this.state.zoom = Math.max(
      this.config.minZoom,
      Math.min(this.config.maxZoom, this.state.zoom)
    );
    this.state.targetZoom = Math.max(
      this.config.minZoom,
      Math.min(this.config.maxZoom, this.state.targetZoom)
    );
  }

  /**
   * Follow a target (for follow mode)
   */
  follow(targetX: number, targetY: number, velocityX = 0, velocityY = 0): void {
    if (this.config.mode !== 'follow') return;

    const { viewport, deadZone, lookAhead } = this.config;
    const halfViewW = viewport.width / 2;
    const halfViewH = viewport.height / 2;

    // Calculate dead zone in pixels
    const deadZoneW = halfViewW * deadZone.x;
    const deadZoneH = halfViewH * deadZone.y;

    // Apply look-ahead based on velocity
    const lookAheadX = Math.sign(velocityX) * lookAhead.x * Math.min(Math.abs(velocityX) / 5, 1);
    const lookAheadY = Math.sign(velocityY) * lookAhead.y * Math.min(Math.abs(velocityY) / 5, 1);

    // Calculate target with look-ahead
    const idealX = targetX + lookAheadX;
    const idealY = targetY + lookAheadY;

    // Check if target is outside dead zone
    const dx = idealX - this.state.x;
    const dy = idealY - this.state.y;

    if (Math.abs(dx) > deadZoneW) {
      this.state.targetX = idealX - Math.sign(dx) * deadZoneW;
    }

    if (Math.abs(dy) > deadZoneH) {
      this.state.targetY = idealY - Math.sign(dy) * deadZoneH;
    }
  }

  /**
   * Instantly set camera position
   */
  setPosition(x: number, y: number): void {
    this.state.x = x;
    this.state.y = y;
    this.state.targetX = x;
    this.state.targetY = y;
  }

  /**
   * Set target position (for smooth movement)
   */
  setTarget(x: number, y: number): void {
    this.state.targetX = x;
    this.state.targetY = y;
  }

  /**
   * Pan camera by offset
   */
  pan(dx: number, dy: number): void {
    this.state.targetX += dx / this.state.zoom;
    this.state.targetY += dy / this.state.zoom;
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number): void {
    this.state.targetZoom = Math.max(
      this.config.minZoom,
      Math.min(this.config.maxZoom, zoom)
    );
  }

  /**
   * Zoom by multiplier
   */
  zoom(factor: number, centerX?: number, centerY?: number): void {
    const newZoom = this.state.zoom * factor;
    this.setZoom(newZoom);

    // Zoom toward center point if provided
    if (centerX !== undefined && centerY !== undefined) {
      const worldX = this.screenToWorldX(centerX);
      const worldY = this.screenToWorldY(centerY);

      // Adjust position to keep point under cursor
      const newWorldX = this.state.x + (worldX - this.state.x) * (1 - 1 / factor);
      const newWorldY = this.state.y + (worldY - this.state.y) * (1 - 1 / factor);

      this.setTarget(newWorldX, newWorldY);
    }
  }

  /**
   * Add camera shake
   */
  shake(intensity: number, duration?: number): void {
    this.state.shakeIntensity = Math.max(this.state.shakeIntensity, intensity);

    if (duration) {
      setTimeout(() => {
        this.state.shakeIntensity = 0;
        this.state.shakeX = 0;
        this.state.shakeY = 0;
      }, duration);
    }
  }

  /**
   * Set cinematic keyframes and start playing
   */
  playCinematic(keyframes: CinematicKeyframe[]): void {
    this.cinematicKeyframes = keyframes;
    this.cinematicTime = 0;
    this.isPlaying = true;
    this.config.mode = 'cinematic';
  }

  /**
   * Stop cinematic playback
   */
  stopCinematic(): void {
    this.isPlaying = false;
  }

  /**
   * Set camera mode
   */
  setMode(mode: CameraMode): void {
    this.config.mode = mode;
    if (mode !== 'cinematic') {
      this.isPlaying = false;
    }
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorldX(screenX: number): number {
    const { viewport } = this.config;
    return this.state.x + (screenX - viewport.width / 2) / this.state.zoom;
  }

  screenToWorldY(screenY: number): number {
    const { viewport } = this.config;
    return this.state.y + (screenY - viewport.height / 2) / this.state.zoom;
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: this.screenToWorldX(screenX),
      y: this.screenToWorldY(screenY),
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreenX(worldX: number): number {
    const { viewport } = this.config;
    return (worldX - this.state.x) * this.state.zoom + viewport.width / 2;
  }

  worldToScreenY(worldY: number): number {
    const { viewport } = this.config;
    return (worldY - this.state.y) * this.state.zoom + viewport.height / 2;
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: this.worldToScreenX(worldX),
      y: this.worldToScreenY(worldY),
    };
  }

  /**
   * Get visible world bounds
   */
  getVisibleBounds(): { x: number; y: number; width: number; height: number } {
    const { viewport } = this.config;
    const halfViewW = (viewport.width / 2) / this.state.zoom;
    const halfViewH = (viewport.height / 2) / this.state.zoom;

    return {
      x: this.state.x - halfViewW,
      y: this.state.y - halfViewH,
      width: halfViewW * 2,
      height: halfViewH * 2,
    };
  }

  /**
   * Check if a world point is visible
   */
  isVisible(worldX: number, worldY: number, margin = 0): boolean {
    const bounds = this.getVisibleBounds();
    return (
      worldX >= bounds.x - margin &&
      worldX <= bounds.x + bounds.width + margin &&
      worldY >= bounds.y - margin &&
      worldY <= bounds.y + bounds.height + margin
    );
  }

  /**
   * Apply camera transform to canvas context
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    const { viewport } = this.config;

    ctx.save();

    // Move to center of viewport
    ctx.translate(viewport.width / 2, viewport.height / 2);

    // Apply shake
    ctx.translate(this.state.shakeX, this.state.shakeY);

    // Apply zoom
    ctx.scale(this.state.zoom, this.state.zoom);

    // Move to camera position (negative because we move the world, not camera)
    ctx.translate(-this.state.x, -this.state.y);
  }

  /**
   * Restore canvas context after transform
   */
  restoreTransform(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  /**
   * Get current camera state
   */
  getState(): CameraState {
    return { ...this.state };
  }

  /**
   * Get camera position (with shake applied)
   */
  getPosition(): { x: number; y: number } {
    return {
      x: this.state.x + this.state.shakeX,
      y: this.state.y + this.state.shakeY,
    };
  }

  /**
   * Get zoom level
   */
  getZoom(): number {
    return this.state.zoom;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CameraConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): CameraConfig {
    return { ...this.config };
  }

  /**
   * Reset camera to initial position
   */
  reset(): void {
    this.state = {
      x: this.config.initialPosition.x,
      y: this.config.initialPosition.y,
      zoom: this.config.initialZoom,
      targetX: this.config.initialPosition.x,
      targetY: this.config.initialPosition.y,
      targetZoom: this.config.initialZoom,
      shakeX: 0,
      shakeY: 0,
      shakeIntensity: 0,
    };
    this.cinematicTime = 0;
    this.isPlaying = false;
  }

  /**
   * Serialize camera state for export
   */
  serialize(): string {
    return JSON.stringify({
      config: this.config,
      state: this.state,
      cinematicKeyframes: this.cinematicKeyframes,
    });
  }
}

/**
 * Create camera for specific game type
 */
export function createCameraForGameType(
  gameType: 'platformer' | 'top-down' | 'puzzle' | 'shooter',
  viewport: { width: number; height: number },
  worldBounds: { width: number; height: number }
): CameraController {
  const configs: Record<string, Partial<CameraConfig>> = {
    platformer: {
      mode: 'follow',
      followSmoothing: 0.08,
      deadZone: { x: 0.15, y: 0.25 },
      lookAhead: { x: 80, y: 40 },
    },
    'top-down': {
      mode: 'follow',
      followSmoothing: 0.12,
      deadZone: { x: 0.1, y: 0.1 },
      lookAhead: { x: 30, y: 30 },
    },
    puzzle: {
      mode: 'static',
      followSmoothing: 0.15,
      deadZone: { x: 0.3, y: 0.3 },
      lookAhead: { x: 0, y: 0 },
    },
    shooter: {
      mode: 'follow',
      followSmoothing: 0.15,
      deadZone: { x: 0.05, y: 0.05 },
      lookAhead: { x: 100, y: 60 },
    },
  };

  return new CameraController({
    ...configs[gameType],
    viewport,
    worldBounds,
    initialPosition: { x: viewport.width / 2, y: viewport.height / 2 },
  });
}
