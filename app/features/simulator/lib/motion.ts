/**
 * Motion Design System - Unified Framer Motion animation presets
 *
 * This file provides consistent animation presets for the simulator feature.
 * All animations are designed to feel cohesive and belonging to the same product.
 *
 * Timing Philosophy:
 * - fadeIn: 200ms - Quick, subtle appearance
 * - slideUp: 300ms - Slightly longer for spatial movement
 * - scaleIn: 200ms - Quick scale for snappy feel
 * - staggerChildren: 50ms - Consistent delay between siblings
 */

import { Variants, Transition, TargetAndTransition } from 'framer-motion';
import { useSyncExternalStore } from 'react';

// ============================================
// Reduced Motion Support (WCAG 2.1 Level AAA)
// ============================================

/**
 * Singleton reduced motion state manager
 *
 * Instead of each component creating its own media query listener,
 * this module maintains a single shared listener and state.
 * This dramatically reduces the number of event listeners and
 * prevents unnecessary re-renders across components.
 */
let reducedMotionState: boolean | null = null;
let reducedMotionListeners: Set<() => void> = new Set();
let mediaQuery: MediaQueryList | null = null;

function getReducedMotionSnapshot(): boolean | null {
  // Server-side rendering - return null
  if (typeof window === 'undefined') {
    return null;
  }

  // Initialize on first call
  if (mediaQuery === null) {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionState = mediaQuery.matches;

    // Single listener for all subscribers
    const handleChange = (e: MediaQueryListEvent) => {
      reducedMotionState = e.matches;
      // Notify all subscribers
      reducedMotionListeners.forEach(listener => listener());
    };

    mediaQuery.addEventListener('change', handleChange);
  }

  return reducedMotionState;
}

function subscribeToReducedMotion(callback: () => void): () => void {
  reducedMotionListeners.add(callback);
  return () => {
    reducedMotionListeners.delete(callback);
  };
}

function getServerSnapshot(): boolean | null {
  return null; // Default for SSR
}

/**
 * Singleton hook for reduced motion preference
 *
 * Uses useSyncExternalStore to subscribe to a shared media query listener,
 * ensuring all components share one subscription instead of creating their own.
 *
 * Returns true if user prefers reduced motion (via OS settings)
 *
 * Usage:
 * const prefersReducedMotion = useReducedMotion();
 * const duration = prefersReducedMotion ? 0 : DURATION.normal;
 */
export function useReducedMotion(): boolean | null {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerSnapshot
  );
}

/**
 * Get duration based on reduced motion preference
 * Returns 0 if reduced motion is preferred, otherwise returns the specified duration
 */
export function getReducedMotionDuration(baseDuration: number, prefersReduced: boolean | null): number {
  return prefersReduced ? 0 : baseDuration;
}

/**
 * Create a transition that respects reduced motion preferences
 * @param baseDuration - Duration in seconds when motion is allowed
 * @param prefersReduced - Result from useReducedMotion hook
 * @returns Transition with appropriate duration
 */
export function createReducedMotionTransition(baseDuration: number, prefersReduced: boolean | null): Transition {
  return {
    duration: prefersReduced ? 0 : baseDuration,
    ease: EASE.default,
  };
}

// ============================================
// Core Animation Durations (in seconds)
// ============================================

export const DURATION = {
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  panel: 0.3,
} as const;

// ============================================
// Stagger Delays (in seconds)
// ============================================

export const STAGGER = {
  /** Standard stagger delay between children - 50ms */
  default: 0.05,
  /** Fast stagger for dense lists - 30ms */
  fast: 0.03,
  /** Slow stagger for emphasis - 80ms */
  slow: 0.08,
} as const;

// ============================================
// Easing Curves
// ============================================

export const EASE = {
  /** Default ease for most animations */
  default: [0.4, 0, 0.2, 1],
  /** Ease out for elements appearing */
  out: [0, 0, 0.2, 1],
  /** Ease in for elements disappearing */
  in: [0.4, 0, 1, 1],
  /** Spring-like bounce */
  bounce: [0.68, -0.55, 0.265, 1.55],
} as const;

// ============================================
// Transition Presets
// ============================================

export const transitions = {
  /** Fast transition for hover states and quick feedback */
  fast: {
    duration: DURATION.fast,
    ease: EASE.default,
  } as Transition,

  /** Normal transition for most animations */
  normal: {
    duration: DURATION.normal,
    ease: EASE.default,
  } as Transition,

  /** Slower transition for emphasis */
  slow: {
    duration: DURATION.slow,
    ease: EASE.default,
  } as Transition,

  /** Panel expand/collapse transition */
  panel: {
    duration: DURATION.panel,
    ease: EASE.default,
  } as Transition,

  /** Spring transition for interactive elements */
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  } as Transition,
} as const;

// ============================================
// Animation Variants
// ============================================

/**
 * fadeIn - Simple opacity fade
 * Use for: Overlays, text reveals, subtle appearances
 */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * slideUp - Slide up with fade
 * Use for: Cards, list items, toasts, dropdown content
 */
export const slideUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

/**
 * slideDown - Slide down with fade
 * Use for: Dropdown menus, collapsible content headers
 */
export const slideDown: Variants = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

/**
 * scaleIn - Scale up with fade
 * Use for: Cards, modals, popovers
 */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

/**
 * scaleInSubtle - Very subtle scale with fade
 * Use for: Grid items, dimension cards
 */
export const scaleInSubtle: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

/**
 * modalContent - Modal/dialog content animation
 * Use for: Modal dialogs, full-screen overlays
 */
export const modalContent: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

/**
 * expandCollapse - Height-based expand/collapse
 * Use for: Collapsible panels, accordions
 */
export const expandCollapse: Variants = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
};

/**
 * staggerContainer - Parent container for staggered children
 * Use with staggerItem for lists and grids
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: STAGGER.default,
    },
  },
};

/**
 * staggerContainerFast - Faster stagger for dense lists
 */
export const staggerContainerFast: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: STAGGER.fast,
    },
  },
};

/**
 * staggerItem - Child item for staggered animations
 * Use as child of staggerContainer
 */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// ============================================
// Interactive States (whileHover, whileTap)
// ============================================

export const interactiveStates = {
  /** Subtle scale on hover for clickable elements */
  hoverScale: {
    scale: 1.02,
    transition: transitions.fast,
  } as TargetAndTransition,

  /** Pressed/tap state */
  tapScale: {
    scale: 0.98,
  } as TargetAndTransition,

  /** More prominent hover for larger elements */
  hoverScaleLarge: {
    scale: 1.01,
    transition: transitions.fast,
  } as TargetAndTransition,

  /** Hover for draggable elements */
  hoverDraggable: {
    scale: 1.05,
    transition: transitions.fast,
  } as TargetAndTransition,
} as const;

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate stagger delay for indexed items
 * @param index - Item index in list
 * @param staggerMs - Stagger delay in milliseconds (default 50)
 * @returns Delay in seconds
 */
export function getStaggerDelay(index: number, staggerMs: number = 50): number {
  return index * (staggerMs / 1000);
}

/**
 * Create a staggered item transition with custom delay
 * @param index - Item index
 * @param staggerMs - Stagger delay in ms (default 50)
 * @returns Transition object with calculated delay
 */
export function staggeredTransition(index: number, staggerMs: number = 50): Transition {
  return {
    duration: DURATION.normal,
    delay: getStaggerDelay(index, staggerMs),
    ease: EASE.default,
  };
}

/**
 * Create variants with custom initial/animate states
 * @param initial - Initial state
 * @param animate - Animate state
 * @param exit - Optional exit state (defaults to initial)
 */
export function createVariants(
  initial: TargetAndTransition,
  animate: TargetAndTransition,
  exit?: TargetAndTransition
): Variants {
  return {
    initial,
    animate,
    exit: exit ?? initial,
  };
}

// ============================================
// Component-Specific Presets
// ============================================

/**
 * Preset for prompt/dimension cards with index-based stagger
 */
export const cardPreset = {
  variants: scaleIn,
  transition: transitions.normal,
  getTransition: (index: number) => staggeredTransition(index, 50),
} as const;

/**
 * Preset for dropdown menus
 */
export const dropdownPreset = {
  variants: slideDown,
  transition: transitions.fast,
} as const;

/**
 * Preset for modal overlays (backdrop)
 */
export const modalBackdropPreset = {
  variants: fadeIn,
  transition: transitions.normal,
} as const;

/**
 * Preset for modal content
 */
export const modalContentPreset = {
  variants: modalContent,
  transition: transitions.normal,
} as const;

/**
 * Preset for collapsible panels
 */
export const panelPreset = {
  variants: expandCollapse,
  transition: transitions.panel,
} as const;

/**
 * Preset for gallery/grid items
 */
export const galleryItemPreset = {
  variants: slideUp,
  transition: transitions.slow,
  getTransition: (index: number) => ({
    duration: DURATION.slow,
    delay: getStaggerDelay(index, 50),
    ease: EASE.default,
  }),
} as const;

/**
 * Preset for toast notifications
 */
export const toastPreset = {
  variants: slideUp,
  transition: transitions.normal,
} as const;

// ============================================
// Reduced Motion Aware Transitions
// ============================================

/**
 * Get transitions that respect reduced motion preference
 * @param prefersReduced - Result from useReducedMotion hook
 */
export function getReducedMotionTransitions(prefersReduced: boolean | null) {
  const instant: Transition = { duration: 0, ease: EASE.default };

  return {
    fast: prefersReduced ? instant : transitions.fast,
    normal: prefersReduced ? instant : transitions.normal,
    slow: prefersReduced ? instant : transitions.slow,
    panel: prefersReduced ? instant : transitions.panel,
    spring: prefersReduced ? instant : transitions.spring,
  };
}

/**
 * Get a staggered transition that respects reduced motion
 * @param index - Item index
 * @param prefersReduced - Result from useReducedMotion hook
 * @param staggerMs - Stagger delay in ms (default 50, ignored if reduced motion)
 */
export function getReducedMotionStaggeredTransition(
  index: number,
  prefersReduced: boolean | null,
  staggerMs: number = 50
): Transition {
  if (prefersReduced) {
    return { duration: 0, delay: 0, ease: EASE.default };
  }
  return staggeredTransition(index, staggerMs);
}
