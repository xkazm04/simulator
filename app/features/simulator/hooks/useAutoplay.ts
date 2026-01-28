/**
 * useAutoplay - State machine hook for autoplay orchestration
 *
 * Manages the generate -> evaluate -> refine loop using useReducer.
 * Does NOT directly call APIs - instead exposes state and actions
 * that the orchestration layer (Plan 03) will wire to actual services.
 *
 * Key responsibilities:
 * - State machine transitions (idle -> generating -> evaluating -> refining -> complete)
 * - Iteration tracking and history
 * - Abort handling with AbortController
 * - Hard cap enforcement (max 3 iterations)
 */

'use client';

import { useReducer, useCallback, useRef, useMemo } from 'react';
import {
  AutoplayState,
  AutoplayAction,
  AutoplayConfig,
  AutoplayIteration,
} from '../types';

// Hard cap on iterations to prevent runaway API costs
const MAX_ITERATIONS_HARD_CAP = 3;

// Initial state factory
const createInitialState = (): AutoplayState => ({
  status: 'idle',
  config: { targetSavedCount: 2, maxIterations: MAX_ITERATIONS_HARD_CAP },
  currentIteration: 0,
  iterations: [],
  totalSaved: 0,
  abortRequested: false,
});

/**
 * Autoplay reducer - handles all state transitions
 */
function autoplayReducer(state: AutoplayState, action: AutoplayAction): AutoplayState {
  switch (action.type) {
    case 'START': {
      // Enforce hard cap on iterations
      const maxIterations = Math.min(action.config.maxIterations, MAX_ITERATIONS_HARD_CAP);
      return {
        ...createInitialState(),
        status: 'generating',
        config: { ...action.config, maxIterations },
        currentIteration: 1,
        iterations: [{
          iterationNumber: 1,
          promptIds: [],
          evaluations: [],
          savedCount: 0,
          startedAt: new Date().toISOString(),
        }],
      };
    }

    case 'GENERATION_COMPLETE': {
      if (state.status !== 'generating') return state;

      // Update current iteration with prompt IDs, transition to evaluating
      const updatedIterations = [...state.iterations];
      const currentIdx = updatedIterations.length - 1;
      updatedIterations[currentIdx] = {
        ...updatedIterations[currentIdx],
        promptIds: action.promptIds,
      };

      return {
        ...state,
        status: 'evaluating',
        iterations: updatedIterations,
      };
    }

    case 'EVALUATION_COMPLETE': {
      if (state.status !== 'evaluating') return state;

      // Store evaluation results
      const updatedIterations = [...state.iterations];
      const currentIdx = updatedIterations.length - 1;
      updatedIterations[currentIdx] = {
        ...updatedIterations[currentIdx],
        evaluations: action.evaluations,
      };

      // Check if any images were approved - if so, transition to saving phase
      // The actual saving happens externally, we just track it
      // Either way, go to refining to decide next step
      return {
        ...state,
        status: 'refining',
        iterations: updatedIterations,
      };
    }

    case 'IMAGES_SAVED': {
      const newTotal = state.totalSaved + action.count;

      // Update iteration saved count
      const updatedIterations = [...state.iterations];
      const currentIdx = updatedIterations.length - 1;
      updatedIterations[currentIdx] = {
        ...updatedIterations[currentIdx],
        savedCount: action.count,
      };

      // Check if target met
      if (newTotal >= state.config.targetSavedCount) {
        return {
          ...state,
          status: 'complete',
          totalSaved: newTotal,
          iterations: updatedIterations,
        };
      }

      return {
        ...state,
        totalSaved: newTotal,
        iterations: updatedIterations,
      };
    }

    case 'REFINE_COMPLETE': {
      // Feedback has been applied, ready for next iteration check
      return state; // No state change, ITERATION_COMPLETE handles the transition
    }

    case 'ITERATION_COMPLETE': {
      if (state.status !== 'refining') return state;

      // Mark current iteration complete
      const updatedIterations = [...state.iterations];
      const currentIdx = updatedIterations.length - 1;
      updatedIterations[currentIdx] = {
        ...updatedIterations[currentIdx],
        completedAt: new Date().toISOString(),
      };

      // Check for completion conditions
      if (state.abortRequested) {
        return {
          ...state,
          status: 'complete',
          iterations: updatedIterations,
        };
      }

      if (state.totalSaved >= state.config.targetSavedCount) {
        return {
          ...state,
          status: 'complete',
          iterations: updatedIterations,
        };
      }

      if (state.currentIteration >= state.config.maxIterations) {
        return {
          ...state,
          status: 'complete',
          iterations: updatedIterations,
        };
      }

      // Start next iteration
      const nextIteration = state.currentIteration + 1;
      return {
        ...state,
        status: 'generating',
        currentIteration: nextIteration,
        iterations: [
          ...updatedIterations,
          {
            iterationNumber: nextIteration,
            promptIds: [],
            evaluations: [],
            savedCount: 0,
            startedAt: new Date().toISOString(),
          },
        ],
      };
    }

    case 'COMPLETE': {
      return {
        ...state,
        status: 'complete',
      };
    }

    case 'ERROR': {
      return {
        ...state,
        status: 'error',
        error: action.error,
      };
    }

    case 'ABORT': {
      // Mark abort requested - will complete at next safe point
      return {
        ...state,
        abortRequested: true,
      };
    }

    case 'RESET': {
      return createInitialState();
    }

    default:
      return state;
  }
}

export interface UseAutoplayReturn {
  /** Current autoplay state */
  state: AutoplayState;
  /** Whether autoplay is currently running */
  isRunning: boolean;
  /** Whether autoplay can be started (not already running) */
  canStart: boolean;
  /** Current iteration info */
  currentIteration: AutoplayIteration | null;
  /** Completion reason if complete */
  completionReason: 'target_met' | 'max_iterations' | 'aborted' | 'error' | null;

  // Actions
  /** Start autoplay with given config */
  start: (config: AutoplayConfig) => void;
  /** Signal that generation phase completed */
  onGenerationComplete: (promptIds: string[]) => void;
  /** Signal that evaluation phase completed */
  onEvaluationComplete: (evaluations: AutoplayIteration['evaluations']) => void;
  /** Signal that images were saved */
  onImagesSaved: (count: number) => void;
  /** Signal that refinement (feedback application) completed */
  onRefineComplete: () => void;
  /** Signal that current iteration is complete, check for next */
  onIterationComplete: () => void;
  /** Request abort (will complete at next safe point) */
  abort: () => void;
  /** Reset to initial state */
  reset: () => void;
  /** Mark as errored */
  setError: (error: string) => void;

  // AbortController for external cancellation
  abortController: AbortController | null;
}

export function useAutoplay(): UseAutoplayReturn {
  const [state, dispatch] = useReducer(autoplayReducer, undefined, createInitialState);

  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Derived state
  const isRunning = state.status !== 'idle' && state.status !== 'complete' && state.status !== 'error';
  const canStart = state.status === 'idle' || state.status === 'complete' || state.status === 'error';

  const currentIteration = useMemo(() => {
    if (state.iterations.length === 0) return null;
    return state.iterations[state.iterations.length - 1];
  }, [state.iterations]);

  const completionReason = useMemo((): UseAutoplayReturn['completionReason'] => {
    if (state.status !== 'complete') return null;
    if (state.error) return 'error';
    if (state.abortRequested) return 'aborted';
    if (state.totalSaved >= state.config.targetSavedCount) return 'target_met';
    return 'max_iterations';
  }, [state]);

  // Actions
  const start = useCallback((config: AutoplayConfig) => {
    // Create new abort controller for this session
    abortControllerRef.current = new AbortController();
    dispatch({ type: 'START', config });
  }, []);

  const onGenerationComplete = useCallback((promptIds: string[]) => {
    dispatch({ type: 'GENERATION_COMPLETE', promptIds });
  }, []);

  const onEvaluationComplete = useCallback((evaluations: AutoplayIteration['evaluations']) => {
    dispatch({ type: 'EVALUATION_COMPLETE', evaluations });
  }, []);

  const onImagesSaved = useCallback((count: number) => {
    dispatch({ type: 'IMAGES_SAVED', count });
  }, []);

  const onRefineComplete = useCallback(() => {
    dispatch({ type: 'REFINE_COMPLETE' });
  }, []);

  const onIterationComplete = useCallback(() => {
    dispatch({ type: 'ITERATION_COMPLETE' });
  }, []);

  const abort = useCallback(() => {
    // Signal abort to in-flight requests
    abortControllerRef.current?.abort();
    dispatch({ type: 'ABORT' });
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  const setError = useCallback((error: string) => {
    dispatch({ type: 'ERROR', error });
  }, []);

  return {
    state,
    isRunning,
    canStart,
    currentIteration,
    completionReason,
    start,
    onGenerationComplete,
    onEvaluationComplete,
    onImagesSaved,
    onRefineComplete,
    onIterationComplete,
    abort,
    reset,
    setError,
    abortController: abortControllerRef.current,
  };
}
