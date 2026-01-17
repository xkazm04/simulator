/**
 * usePromptHistory - Manages undo/redo history for generated prompts
 *
 * Stores the last N prompt generation snapshots, allowing users to
 * navigate between different generation results for comparison
 * and recovery of good outputs.
 */

import { useState, useCallback, useMemo } from 'react';
import { GeneratedPrompt } from '../../types';

const MAX_HISTORY_SIZE = 5;

export interface PromptHistoryState {
  /** Current history stack (oldest first) */
  history: GeneratedPrompt[][];
  /** Current position in history (0 = oldest, length-1 = most recent) */
  currentIndex: number;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of history entries */
  historyLength: number;
  /** Current position label (e.g., "2 of 5") */
  positionLabel: string;
}

export interface PromptHistoryActions {
  /** Push a new prompt set onto history (happens on each generation) */
  push: (prompts: GeneratedPrompt[]) => void;
  /** Move back to previous prompt set */
  undo: () => GeneratedPrompt[] | null;
  /** Move forward to next prompt set */
  redo: () => GeneratedPrompt[] | null;
  /** Get current prompts from history position */
  getCurrent: () => GeneratedPrompt[] | null;
  /** Clear all history */
  clear: () => void;
  /** Navigate to a specific history index */
  goTo: (index: number) => GeneratedPrompt[] | null;
}

export function usePromptHistory(): PromptHistoryState & PromptHistoryActions {
  // History stack - array of prompt snapshots
  const [history, setHistory] = useState<GeneratedPrompt[][]>([]);
  // Current position in history (-1 means no history yet)
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Derived state
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  const historyLength = history.length;

  const positionLabel = useMemo(() => {
    if (history.length === 0) return '';
    return `${currentIndex + 1} of ${history.length}`;
  }, [currentIndex, history.length]);

  /**
   * Push new prompts onto history
   * If we're not at the end of history (after undo), truncate future entries
   */
  const push = useCallback((prompts: GeneratedPrompt[]) => {
    if (!prompts || prompts.length === 0) return;

    setHistory(prev => {
      // If we're in the middle of history, truncate everything after current position
      const truncated = currentIndex >= 0 ? prev.slice(0, currentIndex + 1) : prev;

      // Add new entry
      const newHistory = [...truncated, prompts];

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
   * Move back to previous prompt set
   */
  const undo = useCallback(() => {
    if (!canUndo) return null;

    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    return history[newIndex] || null;
  }, [canUndo, currentIndex, history]);

  /**
   * Move forward to next prompt set
   */
  const redo = useCallback(() => {
    if (!canRedo) return null;

    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    return history[newIndex] || null;
  }, [canRedo, currentIndex, history]);

  /**
   * Get current prompts from history position
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
  };
}
