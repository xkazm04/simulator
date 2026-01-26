/**
 * useCopyFeedback - Hook for managing copy-to-clipboard feedback state
 *
 * Provides state management and animation timing for copy feedback:
 * - Tracks copied state per item
 * - Auto-resets after configurable timeout (default 2s)
 * - Handles cleanup on unmount
 * - Supports multiple rapid copies
 *
 * Usage:
 * ```tsx
 * const { isCopied, triggerCopy } = useCopyFeedback();
 *
 * const handleCopy = async () => {
 *   await navigator.clipboard.writeText(text);
 *   triggerCopy();
 * };
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseCopyFeedbackOptions {
  /** Duration in ms before resetting (default: 2000) */
  resetDelay?: number;
  /** Callback when copy feedback triggers */
  onCopy?: () => void;
  /** Callback when copy feedback resets */
  onReset?: () => void;
}

interface UseCopyFeedbackReturn {
  /** Whether the item was just copied */
  isCopied: boolean;
  /** Trigger the copied state and start reset timer */
  triggerCopy: () => void;
  /** Manually reset the copied state */
  reset: () => void;
}

/**
 * Hook for managing single-item copy feedback
 */
export function useCopyFeedback(options: UseCopyFeedbackOptions = {}): UseCopyFeedbackReturn {
  const { resetDelay = 2000, onCopy, onReset } = options;
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    setIsCopied(false);
    onReset?.();
  }, [onReset]);

  const triggerCopy = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsCopied(true);
    onCopy?.();

    // Start reset timer
    timeoutRef.current = setTimeout(() => {
      reset();
    }, resetDelay);
  }, [resetDelay, onCopy, reset]);

  return { isCopied, triggerCopy, reset };
}

/**
 * Hook for managing copy feedback across multiple items
 * Useful for lists of copyable items
 */
interface UseMultiCopyFeedbackOptions {
  /** Duration in ms before resetting (default: 2000) */
  resetDelay?: number;
}

interface UseMultiCopyFeedbackReturn {
  /** Check if a specific item was just copied */
  isCopied: (id: string) => boolean;
  /** Trigger copied state for a specific item */
  triggerCopy: (id: string) => void;
  /** Reset a specific item's copied state */
  reset: (id: string) => void;
  /** Reset all copied states */
  resetAll: () => void;
  /** Get the ID of the last copied item */
  lastCopiedId: string | null;
}

export function useMultiCopyFeedback(
  options: UseMultiCopyFeedbackOptions = {}
): UseMultiCopyFeedbackReturn {
  const { resetDelay = 2000 } = options;
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  const isCopied = useCallback((id: string) => copiedIds.has(id), [copiedIds]);

  const reset = useCallback((id: string) => {
    setCopiedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (timeoutsRef.current.has(id)) {
      clearTimeout(timeoutsRef.current.get(id));
      timeoutsRef.current.delete(id);
    }
  }, []);

  const triggerCopy = useCallback((id: string) => {
    // Clear existing timeout for this id
    if (timeoutsRef.current.has(id)) {
      clearTimeout(timeoutsRef.current.get(id));
    }

    setCopiedIds(prev => new Set(prev).add(id));
    setLastCopiedId(id);

    // Start reset timer
    const timeout = setTimeout(() => {
      reset(id);
    }, resetDelay);
    timeoutsRef.current.set(id, timeout);
  }, [resetDelay, reset]);

  const resetAll = useCallback(() => {
    setCopiedIds(new Set());
    setLastCopiedId(null);
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
  }, []);

  return { isCopied, triggerCopy, reset, resetAll, lastCopiedId };
}

export default useCopyFeedback;
