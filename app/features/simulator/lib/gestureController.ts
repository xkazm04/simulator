/**
 * GestureController - Unified touch gesture handling
 *
 * Provides gesture recognition and handling utilities:
 * - Swipe detection (horizontal/vertical)
 * - Pinch-to-zoom
 * - Long press
 * - Drag with momentum
 * - Double tap
 *
 * Integrates with @use-gesture/react for React components.
 */

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeEvent {
  direction: SwipeDirection;
  velocity: number;
  distance: number;
}

export interface PinchEvent {
  scale: number;
  center: { x: number; y: number };
  delta: number;
}

export interface DragEvent {
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
  direction: [number, number];
  distance: number;
  initial: { x: number; y: number };
  movement: { x: number; y: number };
  down: boolean;
  active: boolean;
  first: boolean;
  last: boolean;
}

export interface LongPressEvent {
  position: { x: number; y: number };
  duration: number;
}

export interface GestureConfig {
  /** Minimum swipe velocity (px/ms) */
  swipeVelocityThreshold: number;
  /** Minimum swipe distance (px) */
  swipeDistanceThreshold: number;
  /** Long press duration (ms) */
  longPressDuration: number;
  /** Enable haptic feedback */
  hapticFeedback: boolean;
  /** Drag threshold before starting drag (px) */
  dragThreshold: number;
  /** Pinch threshold before starting pinch */
  pinchThreshold: number;
  /** Double tap max delay (ms) */
  doubleTapDelay: number;
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  swipeVelocityThreshold: 0.5,
  swipeDistanceThreshold: 50,
  longPressDuration: 500,
  hapticFeedback: true,
  dragThreshold: 10,
  pinchThreshold: 0.1,
  doubleTapDelay: 300,
};

/**
 * Detect swipe direction from movement vector
 */
export function detectSwipeDirection(
  dx: number,
  dy: number,
  velocityX: number,
  velocityY: number,
  config: Partial<GestureConfig> = {}
): SwipeEvent | null {
  const mergedConfig = { ...DEFAULT_GESTURE_CONFIG, ...config };

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const absVelX = Math.abs(velocityX);
  const absVelY = Math.abs(velocityY);

  // Check if it qualifies as a swipe
  const isHorizontalSwipe =
    absX > mergedConfig.swipeDistanceThreshold &&
    absVelX > mergedConfig.swipeVelocityThreshold &&
    absX > absY;

  const isVerticalSwipe =
    absY > mergedConfig.swipeDistanceThreshold &&
    absVelY > mergedConfig.swipeVelocityThreshold &&
    absY > absX;

  if (isHorizontalSwipe) {
    return {
      direction: dx > 0 ? 'right' : 'left',
      velocity: absVelX,
      distance: absX,
    };
  }

  if (isVerticalSwipe) {
    return {
      direction: dy > 0 ? 'down' : 'up',
      velocity: absVelY,
      distance: absY,
    };
  }

  return null;
}

/**
 * Calculate pinch scale from two touch points
 */
export function calculatePinchScale(
  touches: { x: number; y: number }[],
  initialDistance: number
): PinchEvent | null {
  if (touches.length < 2 || initialDistance <= 0) return null;

  const dx = touches[1].x - touches[0].x;
  const dy = touches[1].y - touches[0].y;
  const currentDistance = Math.sqrt(dx * dx + dy * dy);
  const scale = currentDistance / initialDistance;

  return {
    scale,
    center: {
      x: (touches[0].x + touches[1].x) / 2,
      y: (touches[0].y + touches[1].y) / 2,
    },
    delta: scale - 1,
  };
}

/**
 * Momentum calculation for drag release
 */
export function calculateMomentum(
  velocity: { x: number; y: number },
  friction: number = 0.95
): (elapsed: number) => { x: number; y: number } {
  return (elapsed: number) => {
    const decay = Math.pow(friction, elapsed / 16); // 16ms frame
    return {
      x: velocity.x * decay,
      y: velocity.y * decay,
    };
  };
}

/**
 * Clamp value between bounds with optional rubber band effect
 */
export function rubberBand(
  value: number,
  min: number,
  max: number,
  coefficient: number = 0.55
): number {
  if (value < min) {
    const overflow = min - value;
    return min - overflow * coefficient;
  }
  if (value > max) {
    const overflow = value - max;
    return max + overflow * coefficient;
  }
  return value;
}

/**
 * Trigger haptic feedback
 */
export function triggerHaptic(
  type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' = 'light'
): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

  const patterns: Record<string, number | number[]> = {
    light: 10,
    medium: 25,
    heavy: 50,
    selection: 15,
    success: [20, 50, 30],
    warning: [50, 30, 50],
    error: [100, 50, 100, 50, 100],
  };

  navigator.vibrate(patterns[type] || 10);
}

/**
 * Gesture config presets for different use cases
 */
export const GESTURE_PRESETS = {
  carousel: {
    swipeVelocityThreshold: 0.3,
    swipeDistanceThreshold: 30,
    dragThreshold: 5,
    hapticFeedback: true,
  },
  bottomSheet: {
    swipeVelocityThreshold: 0.5,
    swipeDistanceThreshold: 100,
    dragThreshold: 10,
    hapticFeedback: true,
  },
  imagePinch: {
    pinchThreshold: 0.05,
    hapticFeedback: false,
  },
  list: {
    swipeVelocityThreshold: 0.3,
    swipeDistanceThreshold: 50,
    longPressDuration: 400,
    hapticFeedback: true,
  },
} as const;

/**
 * Types for use-gesture handlers
 * These are used with @use-gesture/react hooks
 */
export interface UseGestureHandlers {
  onSwipe?: (event: SwipeEvent) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (event: PinchEvent) => void;
  onLongPress?: (event: LongPressEvent) => void;
  onDoubleTap?: () => void;
  onDragStart?: (event: DragEvent) => void;
  onDrag?: (event: DragEvent) => void;
  onDragEnd?: (event: DragEvent) => void;
}

/**
 * Create gesture handler configuration for use-gesture
 * This is a helper to create config for @use-gesture/react
 */
export function createGestureConfig(
  handlers: UseGestureHandlers,
  config: Partial<GestureConfig> = {}
) {
  const mergedConfig = { ...DEFAULT_GESTURE_CONFIG, ...config };

  return {
    drag: {
      threshold: mergedConfig.dragThreshold,
      filterTaps: true,
      rubberband: true,
    },
    pinch: {
      threshold: mergedConfig.pinchThreshold,
      rubberband: true,
    },
    swipe: {
      velocity: mergedConfig.swipeVelocityThreshold,
      distance: mergedConfig.swipeDistanceThreshold,
    },
    handlers,
  };
}

/**
 * Snap to nearest point (for carousel-style snapping)
 */
export function snapToNearest(
  value: number,
  snapPoints: number[],
  velocity: number = 0,
  velocityThreshold: number = 0.5
): number {
  if (snapPoints.length === 0) return value;
  if (snapPoints.length === 1) return snapPoints[0];

  // If moving fast, snap in direction of movement
  if (Math.abs(velocity) > velocityThreshold) {
    const direction = velocity > 0 ? 1 : -1;
    const sortedPoints = [...snapPoints].sort((a, b) =>
      direction > 0 ? a - b : b - a
    );

    for (const point of sortedPoints) {
      if (direction > 0 ? point > value : point < value) {
        return point;
      }
    }
  }

  // Otherwise snap to nearest
  return snapPoints.reduce((nearest, point) =>
    Math.abs(point - value) < Math.abs(nearest - value) ? point : nearest
  );
}

/**
 * Calculate spring animation parameters for natural feel
 */
export function calculateSpringConfig(
  distance: number,
  velocity: number
): { stiffness: number; damping: number } {
  const absDistance = Math.abs(distance);
  const absVelocity = Math.abs(velocity);

  // Faster animation for short distances
  const stiffness = Math.min(1000, Math.max(100, 400 - absDistance * 2));

  // More damping for slower movements
  const damping = Math.min(40, Math.max(15, 25 - absVelocity * 5));

  return { stiffness, damping };
}
