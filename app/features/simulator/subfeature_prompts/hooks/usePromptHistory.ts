/**
 * usePromptHistory - Manages undo/redo history for generated prompts
 *
 * Stores the last N generation snapshots including prompts, dimensions,
 * and baseImage — allowing users to navigate between different generation
 * results and fully restore the creative context of each step.
 *
 * History is project-scoped: cleared automatically when the active project changes.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GeneratedPrompt, Dimension } from '../../types';

const MAX_HISTORY_SIZE = 10;

/** A single snapshot in the history stack */
export interface HistoryEntry {
  prompts: GeneratedPrompt[];
  dimensions: Dimension[];
  baseImage: string;
}

export interface PromptHistoryState {
  /** Current history stack (oldest first) */
  history: HistoryEntry[];
  /** Current position in history (0 = oldest, length-1 = most recent) */
  currentIndex: number;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of history entries */
  historyLength: number;
  /** Current position label (e.g., "2 of 10") */
  positionLabel: string;
}

export interface PromptHistoryActions {
  /** Push a new snapshot onto history (happens on each generation) */
  push: (entry: HistoryEntry) => void;
  /** Move back to previous snapshot */
  undo: () => HistoryEntry | null;
  /** Move forward to next snapshot */
  redo: () => HistoryEntry | null;
  /** Get current snapshot from history position */
  getCurrent: () => HistoryEntry | null;
  /** Clear all history */
  clear: () => void;
  /** Navigate to a specific history index */
  goTo: (index: number) => HistoryEntry | null;
  /** Set project ID — clears history when project changes */
  setProjectId: (id: string | null) => void;
}

export function usePromptHistory(): PromptHistoryState & PromptHistoryActions {
  // History stack - array of snapshots
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // Current position in history (-1 means no history yet)
  const [currentIndex, setCurrentIndex] = useState(-1);
  // Track current project to clear on switch
  const projectIdRef = useRef<string | null>(null);

  // Derived state
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  const historyLength = history.length;

  const positionLabel = useMemo(() => {
    if (history.length === 0) return '';
    return `${currentIndex + 1} of ${history.length}`;
  }, [currentIndex, history.length]);

  /**
   * Push new snapshot onto history
   * If we're not at the end of history (after undo), truncate future entries
   */
  const push = useCallback((entry: HistoryEntry) => {
    if (!entry.prompts || entry.prompts.length === 0) return;

    setHistory(prev => {
      // If we're in the middle of history, truncate everything after current position
      const truncated = currentIndex >= 0 ? prev.slice(0, currentIndex + 1) : prev;

      // Add new entry
      const newHistory = [...truncated, entry];

      // Limit to MAX_HISTORY_SIZE
      if (newHistory.length > MAX_HISTORY_SIZE) {
        return newHistory.slice(newHistory.length - MAX_HISTORY_SIZE);
      }

      return newHistory;
    });

    setCurrentIndex(() => {
      // Calculate new index after push
      const truncatedLength = currentIndex >= 0 ? currentIndex + 1 : history.length;
      const newLength = Math.min(truncatedLength + 1, MAX_HISTORY_SIZE);
      return newLength - 1;
    });
  }, [currentIndex, history.length]);

  /**
   * Move back to previous snapshot
   */
  const undo = useCallback(() => {
    if (!canUndo) return null;

    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    return history[newIndex] || null;
  }, [canUndo, currentIndex, history]);

  /**
   * Move forward to next snapshot
   */
  const redo = useCallback(() => {
    if (!canRedo) return null;

    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    return history[newIndex] || null;
  }, [canRedo, currentIndex, history]);

  /**
   * Get current snapshot from history position
   */
  const getCurrent = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= history.length) return null;
    return history[currentIndex];
  }, [currentIndex, history]);

  /**
   * Navigate to a specific history index
   */
  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= history.length) return null;
    setCurrentIndex(index);
    return history[index];
  }, [history]);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  /**
   * Set project ID — clears history when project changes
   */
  const setProjectId = useCallback((id: string | null) => {
    if (id !== projectIdRef.current) {
      projectIdRef.current = id;
      setHistory([]);
      setCurrentIndex(-1);
    }
  }, []);

  return {
    // State
    history,
    currentIndex,
    canUndo,
    canRedo,
    historyLength,
    positionLabel,
    // Actions
    push,
    undo,
    redo,
    getCurrent,
    clear,
    goTo,
    setProjectId,
  };
}
