/**
 * useResponsive - Hook for responsive breakpoint detection
 *
 * Provides reactive breakpoint state and utilities for responsive design:
 * - Breakpoint detection (mobile, tablet, desktop)
 * - Device capability detection (touch, haptic feedback)
 * - Orientation tracking
 * - Safe area insets (for notched devices)
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Breakpoint definitions matching Tailwind defaults
 */
export const BREAKPOINTS = {
  mobile: 0,      // 0px - 639px
  sm: 640,        // 640px - 767px (large phones, small tablets)
  tablet: 768,    // 768px - 1023px
  lg: 1024,       // 1024px - 1279px (small laptops)
  desktop: 1280,  // 1280px+ (desktop)
  xl: 1536,       // 1536px+ (large desktop)
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export interface ResponsiveState {
  /** Current breakpoint */
  breakpoint: Breakpoint;
  /** Screen width in pixels */
  width: number;
  /** Screen height in pixels */
  height: number;
  /** Is mobile viewport (< 640px) */
  isMobile: boolean;
  /** Is tablet viewport (640px - 1023px) */
  isTablet: boolean;
  /** Is desktop viewport (>= 1024px) */
  isDesktop: boolean;
  /** Is large desktop (>= 1280px) */
  isLargeDesktop: boolean;
  /** Device supports touch */
  isTouch: boolean;
  /** Device orientation */
  orientation: 'portrait' | 'landscape';
  /** Is portrait orientation */
  isPortrait: boolean;
  /** Is landscape orientation */
  isLandscape: boolean;
  /** Device pixel ratio */
  devicePixelRatio: number;
  /** Supports haptic feedback */
  supportsHaptic: boolean;
  /** Is standalone PWA mode */
  isStandalone: boolean;
  /** Safe area insets (for notched devices) */
  safeArea: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Get current breakpoint from width
 */
function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'mobile';
}

/**
 * Get safe area insets from CSS environment variables
 */
function getSafeAreaInsets(): ResponsiveState['safeArea'] {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const computedStyle = getComputedStyle(document.documentElement);
  return {
    top: parseInt(computedStyle.getPropertyValue('--sat') || '0', 10) || 0,
    right: parseInt(computedStyle.getPropertyValue('--sar') || '0', 10) || 0,
    bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0', 10) || 0,
    left: parseInt(computedStyle.getPropertyValue('--sal') || '0', 10) || 0,
  };
}

/**
 * Check if device supports haptic feedback
 */
function checkHapticSupport(): boolean {
  if (typeof window === 'undefined') return false;
  return 'vibrate' in navigator;
}

/**
 * Check if app is running as standalone PWA
 */
function checkStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for iOS standalone mode
  if ('standalone' in window.navigator) {
    return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }

  // Check for display-mode: standalone media query
  return window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Check if device supports touch
 */
function checkTouchSupport(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * useResponsive hook - Main responsive hook
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    // Initial state for SSR
    if (typeof window === 'undefined') {
      return {
        breakpoint: 'desktop',
        width: 1280,
        height: 800,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isLargeDesktop: true,
        isTouch: false,
        orientation: 'landscape',
        isPortrait: false,
        isLandscape: true,
        devicePixelRatio: 1,
        supportsHaptic: false,
        isStandalone: false,
        safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const breakpoint = getBreakpoint(width);
    const orientation = height > width ? 'portrait' : 'landscape';

    return {
      breakpoint,
      width,
      height,
      isMobile: width < BREAKPOINTS.sm,
      isTablet: width >= BREAKPOINTS.sm && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      isLargeDesktop: width >= BREAKPOINTS.desktop,
      isTouch: checkTouchSupport(),
      orientation,
      isPortrait: orientation === 'portrait',
      isLandscape: orientation === 'landscape',
      devicePixelRatio: window.devicePixelRatio || 1,
      supportsHaptic: checkHapticSupport(),
      isStandalone: checkStandalone(),
      safeArea: getSafeAreaInsets(),
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateState = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const breakpoint = getBreakpoint(width);
      const orientation = height > width ? 'portrait' : 'landscape';

      setState({
        breakpoint,
        width,
        height,
        isMobile: width < BREAKPOINTS.sm,
        isTablet: width >= BREAKPOINTS.sm && width < BREAKPOINTS.lg,
        isDesktop: width >= BREAKPOINTS.lg,
        isLargeDesktop: width >= BREAKPOINTS.desktop,
        isTouch: checkTouchSupport(),
        orientation,
        isPortrait: orientation === 'portrait',
        isLandscape: orientation === 'landscape',
        devicePixelRatio: window.devicePixelRatio || 1,
        supportsHaptic: checkHapticSupport(),
        isStandalone: checkStandalone(),
        safeArea: getSafeAreaInsets(),
      });
    };

    // Initial update
    updateState();

    // Listen for resize
    window.addEventListener('resize', updateState);

    // Listen for orientation change
    window.addEventListener('orientationchange', updateState);

    // Listen for display-mode change (PWA)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = () => updateState();
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('resize', updateState);
      window.removeEventListener('orientationchange', updateState);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  return state;
}

/**
 * useBreakpoint - Simple hook that returns just the current breakpoint
 */
export function useBreakpoint(): Breakpoint {
  const { breakpoint } = useResponsive();
  return breakpoint;
}

/**
 * useMediaQuery - Hook for custom media queries
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * useIsMobile - Simple hook for mobile detection
 */
export function useIsMobile(): boolean {
  const { isMobile } = useResponsive();
  return isMobile;
}

/**
 * useIsTouch - Simple hook for touch device detection
 */
export function useIsTouch(): boolean {
  const { isTouch } = useResponsive();
  return isTouch;
}

/**
 * useHapticFeedback - Hook for triggering haptic feedback
 */
export function useHapticFeedback() {
  const { supportsHaptic } = useResponsive();

  const trigger = useCallback(
    (pattern: 'light' | 'medium' | 'heavy' | number | number[] = 'light') => {
      if (!supportsHaptic) return;

      let vibrationPattern: number | number[];

      switch (pattern) {
        case 'light':
          vibrationPattern = 10;
          break;
        case 'medium':
          vibrationPattern = 25;
          break;
        case 'heavy':
          vibrationPattern = [50, 30, 50];
          break;
        default:
          vibrationPattern = pattern;
      }

      navigator.vibrate(vibrationPattern);
    },
    [supportsHaptic]
  );

  return { trigger, supported: supportsHaptic };
}

/**
 * useKeyboardHeight - Track virtual keyboard height on mobile
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use visualViewport API if available (better keyboard tracking)
    if (window.visualViewport) {
      const handleResize = () => {
        const viewportHeight = window.visualViewport!.height;
        const windowHeight = window.innerHeight;
        const height = Math.max(0, windowHeight - viewportHeight);
        setKeyboardHeight(height);
      };

      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }

    return;
  }, []);

  return keyboardHeight;
}

/**
 * Progressive disclosure helper - determine what features to show based on screen size
 */
export interface ProgressiveFeatures {
  /** Show full dimension cards vs compact chips */
  showFullDimensionCards: boolean;
  /** Show side panels */
  showSidePanels: boolean;
  /** Show advanced options */
  showAdvancedOptions: boolean;
  /** Show keyboard shortcuts */
  showKeyboardShortcuts: boolean;
  /** Number of prompts to show at once */
  visiblePromptCount: number;
  /** Number of dimensions visible without scroll */
  visibleDimensionCount: number;
  /** Use bottom sheet for modals */
  useBottomSheet: boolean;
  /** Use carousel for prompts */
  usePromptCarousel: boolean;
}

export function useProgressiveFeatures(): ProgressiveFeatures {
  const { isMobile, isTablet, isDesktop, isTouch } = useResponsive();

  return useMemo(() => ({
    showFullDimensionCards: isDesktop,
    showSidePanels: isDesktop,
    showAdvancedOptions: !isMobile,
    showKeyboardShortcuts: !isTouch,
    visiblePromptCount: isMobile ? 1 : isTablet ? 2 : 4,
    visibleDimensionCount: isMobile ? 2 : isTablet ? 3 : 6,
    useBottomSheet: isMobile || (isTablet && isTouch),
    usePromptCarousel: isMobile,
  }), [isMobile, isTablet, isDesktop, isTouch]);
}
