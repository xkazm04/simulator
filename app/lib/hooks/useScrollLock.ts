'use client';

import { useEffect } from 'react';

/**
 * useScrollLock - Lock body scroll with scrollbar width compensation
 *
 * When locked:
 * - Sets body overflow to hidden to prevent scrolling
 * - Adds padding-right equal to scrollbar width to prevent layout shift
 * - Restores original styles on unlock or cleanup
 *
 * @param isLocked - Whether scroll should be locked
 *
 * @example
 * useScrollLock(isModalOpen);
 */
export function useScrollLock(isLocked: boolean): void {
  useEffect(() => {
    // SSR safety check
    if (typeof window === 'undefined') return;
    if (!isLocked) return;

    // Calculate scrollbar width to prevent layout shift
    // This is the difference between window width and viewport width
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Store original values to restore later
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Apply scroll lock with scrollbar compensation
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      // Restore original values
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isLocked]);
}

export default useScrollLock;
