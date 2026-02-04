/**
 * useUndoStack - Generalized state snapshot pattern for undo operations
 *
 * Implements the Memento pattern for capturing and restoring state snapshots.
 * This enables undo functionality across all simulator operations, not just image parsing.
 *
 * @example
 * ```typescript
 * // Simple undo with automatic state management
 * const { canUndo, pushSnapshot, undo } = useUndoStack<DimensionState>();
 *
 * // Before making a change, capture current state
 * pushSnapshot({ dimensions, baseImage, outputMode });
 *
 * // Later, undo if needed
 * if (canUndo) {
 *   const previousState = undo();
 *   setDimensions(previousState.dimensions);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Tagged snapshots for different operation types
 * const { pushSnapshot, undoByTag } = useUndoStack<AppState>();
 *
 * // Tag snapshots by operation
 * pushSnapshot(currentState, 'dimension-change');
 * pushSnapshot(currentState, 'image-parse');
 *
 * // Undo specific operation type
 * undoByTag('image-parse');
 * ```
 */

'use client';

import { useState, useCallback, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A snapshot of application state at a point in time
 */
export interface StateSnapshot<T> {
  /** The captured state */
  state: T;
  /** Optional tag to categorize this snapshot (e.g., 'dimension-change', 'image-parse') */
  tag?: string;
  /** Timestamp when snapshot was created */
  timestamp: number;
  /** Optional description for debugging/logging */
  description?: string;
}

/**
 * Configuration options for the undo stack
 */
export interface UndoStackOptions {
  /** Maximum number of snapshots to keep (default: 10) */
  maxSize?: number;
  /** Whether to deduplicate consecutive identical snapshots (default: true) */
  deduplicateConsecutive?: boolean;
  /** Custom equality function for deduplication */
  isEqual?: <T>(a: T, b: T) => boolean;
}

/**
 * Return type for useUndoStack hook
 */
export interface UndoStackReturn<T> {
  /** Whether undo is available (stack has snapshots) */
  canUndo: boolean;
  /** Number of snapshots in the stack */
  stackSize: number;
  /** Push a new snapshot onto the stack */
  pushSnapshot: (state: T, tag?: string, description?: string) => void;
  /** Pop and return the most recent snapshot */
  undo: () => StateSnapshot<T> | null;
  /** Peek at the most recent snapshot without removing it */
  peek: () => StateSnapshot<T> | null;
  /** Undo to the most recent snapshot with a specific tag */
  undoByTag: (tag: string) => StateSnapshot<T> | null;
  /** Clear all snapshots */
  clear: () => void;
  /** Get all snapshots (for debugging) */
  getStack: () => ReadonlyArray<StateSnapshot<T>>;
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

const DEFAULT_OPTIONS: Required<UndoStackOptions> = {
  maxSize: 10,
  deduplicateConsecutive: true,
  isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * A generalized undo stack hook implementing the Memento pattern
 *
 * @param options - Configuration options for the stack
 * @returns Undo stack state and actions
 */
export function useUndoStack<T>(
  options: UndoStackOptions = {}
): UndoStackReturn<T> {
  const opts = useMemo(
    () => ({ ...DEFAULT_OPTIONS, ...options }),
    [options]
  );

  const [stack, setStack] = useState<StateSnapshot<T>[]>([]);

  const canUndo = stack.length > 0;
  const stackSize = stack.length;

  /**
   * Push a new snapshot onto the stack
   */
  const pushSnapshot = useCallback(
    (state: T, tag?: string, description?: string) => {
      setStack((prev) => {
        // Deduplicate consecutive identical snapshots
        if (opts.deduplicateConsecutive && prev.length > 0) {
          const lastSnapshot = prev[prev.length - 1];
          if (opts.isEqual(lastSnapshot.state, state)) {
            return prev;
          }
        }

        const newSnapshot: StateSnapshot<T> = {
          state,
          tag,
          timestamp: Date.now(),
          description,
        };

        const newStack = [...prev, newSnapshot];

        // Trim stack if it exceeds max size
        if (newStack.length > opts.maxSize) {
          return newStack.slice(-opts.maxSize);
        }

        return newStack;
      });
    },
    [opts]
  );

  /**
   * Pop and return the most recent snapshot
   */
  const undo = useCallback((): StateSnapshot<T> | null => {
    let poppedSnapshot: StateSnapshot<T> | null = null;

    setStack((prev) => {
      if (prev.length === 0) return prev;
      poppedSnapshot = prev[prev.length - 1];
      return prev.slice(0, -1);
    });

    return poppedSnapshot;
  }, []);

  /**
   * Peek at the most recent snapshot without removing it
   */
  const peek = useCallback((): StateSnapshot<T> | null => {
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }, [stack]);

  /**
   * Undo to the most recent snapshot with a specific tag
   */
  const undoByTag = useCallback(
    (tag: string): StateSnapshot<T> | null => {
      let foundSnapshot: StateSnapshot<T> | null = null;

      setStack((prev) => {
        // Find the most recent snapshot with the given tag
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].tag === tag) {
            foundSnapshot = prev[i];
            // Remove this snapshot and all after it
            return prev.slice(0, i);
          }
        }
        return prev;
      });

      return foundSnapshot;
    },
    []
  );

  /**
   * Clear all snapshots
   */
  const clear = useCallback(() => {
    setStack([]);
  }, []);

  /**
   * Get all snapshots (for debugging)
   */
  const getStack = useCallback((): ReadonlyArray<StateSnapshot<T>> => {
    return stack;
  }, [stack]);

  return {
    canUndo,
    stackSize,
    pushSnapshot,
    undo,
    peek,
    undoByTag,
    clear,
    getStack,
  };
}

// ============================================================================
// UTILITY TYPES FOR COMMON USE CASES
// ============================================================================

/**
 * Common snapshot type for dimension-related operations
 */
export interface DimensionSnapshot {
  dimensions: Array<{
    id: string;
    type: string;
    reference: string;
    label: string;
  }>;
  baseImage: string;
  outputMode: string;
}

/**
 * Common snapshot type for prompt-related operations
 */
export interface PromptSnapshot {
  prompts: Array<{
    id: string;
    prompt: string;
    locked: boolean;
  }>;
  lockedElements: Array<{
    id: string;
    text: string;
  }>;
}

/**
 * Full simulator state snapshot
 */
export interface SimulatorSnapshot {
  dimensions: DimensionSnapshot['dimensions'];
  baseImage: string;
  visionSentence: string | null;
  outputMode: string;
  feedback: { positive: string; negative: string };
  prompts: PromptSnapshot['prompts'];
  lockedElements: PromptSnapshot['lockedElements'];
}

// ============================================================================
// OPERATION TAGS
// ============================================================================

/**
 * Standard operation tags for categorizing snapshots
 */
export const UNDO_TAGS = {
  /** Image was parsed by AI */
  IMAGE_PARSE: 'image-parse',
  /** Dimension was changed manually */
  DIMENSION_CHANGE: 'dimension-change',
  /** Element was locked/unlocked */
  ELEMENT_LOCK: 'element-lock',
  /** Prompt was regenerated */
  PROMPT_REGENERATE: 'prompt-regenerate',
  /** Smart breakdown was applied */
  SMART_BREAKDOWN: 'smart-breakdown',
  /** Feedback was applied */
  FEEDBACK_APPLY: 'feedback-apply',
  /** Project was loaded */
  PROJECT_LOAD: 'project-load',
} as const;

export type UndoTag = (typeof UNDO_TAGS)[keyof typeof UNDO_TAGS];
