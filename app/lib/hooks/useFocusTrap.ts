'use client';

import { useEffect, useRef, RefObject } from 'react';

/**
 * Selector for all focusable elements within a container.
 * Excludes elements with tabindex="-1" as they are programmatically focused only.
 */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * useFocusTrap - Trap focus within a container element
 *
 * When active:
 * - Stores the previously focused element
 * - Focuses the first focusable element in the container
 * - Tab key cycles through focusable elements (last -> first)
 * - Shift+Tab cycles in reverse (first -> last)
 * - Restores focus to previously focused element on deactivation
 *
 * @param isActive - Whether the focus trap is active
 * @returns RefObject to attach to the container element
 *
 * @example
 * const focusTrapRef = useFocusTrap(isOpen);
 * return <div ref={focusTrapRef}>...</div>;
 */
export function useFocusTrap(isActive: boolean): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // SSR safety check
    if (typeof window === 'undefined') return;
    if (!isActive || !containerRef.current) return;

    // Store currently focused element to restore later
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Get all focusable elements within the container
    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the first element when trap activates
    if (firstElement) {
      // Small delay to ensure the element is rendered and ready
      requestAnimationFrame(() => {
        firstElement.focus();
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      // Re-query focusable elements in case DOM changed
      const currentFocusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const currentFirst = currentFocusables[0];
      const currentLast = currentFocusables[currentFocusables.length - 1];

      if (!currentFirst || !currentLast) return;

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === currentFirst) {
          e.preventDefault();
          currentLast.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === currentLast) {
          e.preventDefault();
          currentFirst.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previously focused element
      if (previouslyFocusedRef.current && typeof previouslyFocusedRef.current.focus === 'function') {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isActive]);

  return containerRef;
}

export default useFocusTrap;
