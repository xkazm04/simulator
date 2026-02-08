/**
 * usePrompts - Hook for managing generated prompts state
 *
 * Manages:
 * - Generated prompts and their ratings/locks
 * - Prompt elements and element locking
 * - Element acceptance flow
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  GeneratedPrompt,
  PromptElement,
  Dimension,
  SCENE_TYPES,
  OutputMode,
} from '../../types';
import { labelToDimension } from '../../subfeature_brain/lib/simulatorAI';
import { buildMockPromptWithElements } from '../lib/promptBuilder';
import { usePromptHistory, PromptHistoryState, HistoryEntry } from './usePromptHistory';
import {
  startGenerationSession,
  recordGenerationIteration,
  markSessionSatisfied,
  endSessionUnsuccessful,
  getActiveSession,
  processFeedback,
  learnStylePreferences,
  processEnhancedFeedback,
} from '../../lib/preferenceEngine';

export interface PromptsState {
  generatedPrompts: GeneratedPrompt[];
  lockedElements: PromptElement[];
  hasLockedPrompts: boolean;
  acceptingElementId: string | null;
  promptHistory: Pick<PromptHistoryState, 'canUndo' | 'canRedo' | 'historyLength' | 'positionLabel'>;
}

export interface PromptsActions {
  handlePromptRate: (id: string, rating: 'up' | 'down' | null) => void;
  handlePromptLock: (id: string) => void;
  handleElementLock: (promptId: string, elementId: string) => void;
  handleCopy: (id: string) => void;
  handleAcceptElement: (
    element: PromptElement,
    dimensions: Dimension[],
    onDimensionUpdate: (updater: (prev: Dimension[]) => Dimension[]) => void,
    setPendingChange: (change: { element: PromptElement; previousDimensions: Dimension[] } | null) => void
  ) => Promise<void>;
  setGeneratedPrompts: (prompts: GeneratedPrompt[]) => void;
  clearPrompts: () => void;
  handlePromptUndo: () => void;
  handlePromptRedo: () => void;
  pushToHistory: (entry: HistoryEntry) => void;
  clearHistory: () => void;
  setHistoryProjectId: (id: string | null) => void;
  generateFallbackPrompts: (
    baseImage: string,
    dimensions: Dimension[],
    outputMode: OutputMode
  ) => GeneratedPrompt[];
  /** Restore prompts from saved state (used when loading a project) */
  restorePrompts: (prompts: GeneratedPrompt[]) => void;
}

export interface UsePromptsOptions {
  /** Callback to persist prompts */
  onSavePrompts?: (prompts: GeneratedPrompt[]) => Promise<void>;
  /** Callback to update a single prompt */
  onUpdatePrompt?: (promptId: string, updates: Partial<GeneratedPrompt>) => Promise<void>;
  /** Callback to delete all prompts */
  onDeletePrompts?: () => Promise<void>;
  /** Initial prompts to restore (from project load) */
  initialPrompts?: GeneratedPrompt[];
  /** Callback to restore dimensions when undoing/redoing */
  onRestoreDimensions?: (dimensions: Dimension[]) => void;
  /** Callback to restore baseImage when undoing/redoing */
  onRestoreBaseImage?: (baseImage: string) => void;
}

export function usePrompts(options: UsePromptsOptions = {}): PromptsState & PromptsActions {
  const { onSavePrompts, onUpdatePrompt, onDeletePrompts, initialPrompts, onRestoreDimensions, onRestoreBaseImage } = options;

  const [generatedPrompts, setGeneratedPromptsState] = useState<GeneratedPrompt[]>(
    initialPrompts || []
  );
  const [acceptingElementId, setAcceptingElementId] = useState<string | null>(null);

  // Prompt history
  const promptHistoryHook = usePromptHistory();

  // Derived state (memoized to prevent recalculation on unrelated state changes)
  const hasLockedPrompts = useMemo(
    () => generatedPrompts.some((p) => p.locked),
    [generatedPrompts]
  );
  const lockedElements = useMemo(
    () => generatedPrompts.flatMap((p) => p.elements.filter((e) => e.locked)),
    [generatedPrompts]
  );

  // Prompt handlers with enhanced learning
  const handlePromptRate = useCallback(async (id: string, rating: 'up' | 'down' | null) => {
    setGeneratedPromptsState((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, rating } : p));

      // Enhanced learning: track feedback and learn from ratings
      const ratedPrompt = updated.find((p) => p.id === id);
      if (ratedPrompt && rating) {
        // Process feedback asynchronously
        const feedback = {
          id: uuidv4(),
          promptId: id,
          rating,
          createdAt: new Date().toISOString(),
        };

        // Learn from this rating (async, don't block UI)
        processFeedback(feedback, ratedPrompt).catch(console.error);
        processEnhancedFeedback(feedback, ratedPrompt).catch(console.error);

        // If positive rating, potentially mark session as satisfied
        if (rating === 'up') {
          const session = getActiveSession();
          if (session) {
            markSessionSatisfied().catch(console.error);
          }
        }
      }

      return updated;
    });
  }, []);

  const handlePromptLock = useCallback((id: string) => {
    setGeneratedPromptsState((prev) => prev.map((p) => (p.id === id ? { ...p, locked: !p.locked } : p)));
  }, []);

  const handleElementLock = useCallback((promptId: string, elementId: string) => {
    setGeneratedPromptsState((prev) =>
      prev.map((p) =>
        p.id === promptId
          ? { ...p, elements: p.elements.map((e) => (e.id === elementId ? { ...e, locked: !e.locked } : e)) }
          : p
      )
    );
  }, []);

  const handleCopy = useCallback((id: string) => {
    setGeneratedPromptsState((prev) => prev.map((p) => (p.id === id ? { ...p, copied: true } : p)));
  }, []);

  // Accept element - refines dimensions based on clicked element
  const handleAcceptElement = useCallback(async (
    element: PromptElement,
    dimensions: Dimension[],
    onDimensionUpdate: (updater: (prev: Dimension[]) => Dimension[]) => void,
    setPendingChange: (change: { element: PromptElement; previousDimensions: Dimension[] } | null) => void
  ) => {
    if (acceptingElementId || dimensions.length === 0) return;

    setAcceptingElementId(element.id);

    try {
      const dimensionsForApi = dimensions
        .filter((d) => d.reference.trim())
        .map((d) => ({ type: d.type, reference: d.reference }));

      if (dimensionsForApi.length === 0) {
        setAcceptingElementId(null);
        return;
      }

      const result = await labelToDimension(
        { text: element.text, category: element.category },
        dimensionsForApi
      );

      if (result.affectedDimensions.length > 0) {
        setPendingChange({ element, previousDimensions: [...dimensions] });
        onDimensionUpdate((prev) =>
          prev.map((dim) => {
            const change = result.affectedDimensions.find((c) => c.type === dim.type);
            return change ? { ...dim, reference: change.newValue } : dim;
          })
        );
      }
    } catch (err) {
      console.error('Failed to refine dimensions:', err);
    } finally {
      setAcceptingElementId(null);
    }
  }, [acceptingElementId]);

  const setGeneratedPrompts = useCallback((prompts: GeneratedPrompt[]) => {
    setGeneratedPromptsState(prompts);

    // Persist prompts
    if (onSavePrompts) {
      onSavePrompts(prompts).catch(err => {
        console.error('Failed to persist prompts:', err);
      });
    }
  }, [onSavePrompts]);

  /**
   * Restore prompts from saved state (used when loading a project)
   * Does not trigger persistence callback since these are already saved
   */
  const restorePrompts = useCallback((prompts: GeneratedPrompt[]) => {
    setGeneratedPromptsState(prompts);
  }, []);

  const clearPrompts = useCallback(() => {
    setGeneratedPromptsState([]);

    // Persist deletion
    if (onDeletePrompts) {
      onDeletePrompts().catch(err => {
        console.error('Failed to delete prompts:', err);
      });
    }
  }, [onDeletePrompts]);

  // Prompt history handlers — restore full snapshot (prompts + dimensions + baseImage)
  const handlePromptUndo = useCallback(() => {
    const entry = promptHistoryHook.undo();
    if (entry) {
      setGeneratedPromptsState(entry.prompts);
      onRestoreDimensions?.(entry.dimensions);
      onRestoreBaseImage?.(entry.baseImage);
    }
  }, [promptHistoryHook, onRestoreDimensions, onRestoreBaseImage]);

  const handlePromptRedo = useCallback(() => {
    const entry = promptHistoryHook.redo();
    if (entry) {
      setGeneratedPromptsState(entry.prompts);
      onRestoreDimensions?.(entry.dimensions);
      onRestoreBaseImage?.(entry.baseImage);
    }
  }, [promptHistoryHook, onRestoreDimensions, onRestoreBaseImage]);

  const pushToHistory = useCallback((entry: HistoryEntry) => {
    promptHistoryHook.push(entry);
  }, [promptHistoryHook]);

  const clearHistory = useCallback(() => {
    promptHistoryHook.clear();
  }, [promptHistoryHook]);

  const setHistoryProjectId = useCallback((id: string | null) => {
    promptHistoryHook.setProjectId(id);
  }, [promptHistoryHook]);

  // Generate fallback prompts (client-side) when API fails
  // Also starts a generation session for learning
  const generateFallbackPrompts = useCallback((
    baseImage: string,
    dimensions: Dimension[],
    outputMode: OutputMode
  ): GeneratedPrompt[] => {
    const filledDimensions = dimensions.filter((d) => d.reference.trim());
    const selectedScenes = SCENE_TYPES.slice(0, 4);

    // Start a new generation session for time-to-satisfaction tracking
    const session = getActiveSession();
    if (!session) {
      startGenerationSession(dimensions, baseImage, outputMode);
    }

    const prompts = selectedScenes.map((sceneType, index) => {
      const promptId = uuidv4();
      const { prompt, elements } = buildMockPromptWithElements(
        baseImage,
        filledDimensions,
        sceneType,
        index,
        lockedElements,
        outputMode
      );
      return {
        id: promptId,
        sceneNumber: index + 1,
        sceneType,
        prompt,
        copied: false,
        rating: null,
        locked: false,
        elements,
      };
    });

    // Record this generation iteration
    recordGenerationIteration(prompts.map((p) => p.id));

    return prompts;
  }, [lockedElements]);

  // Prompt history state
  const promptHistory = useMemo(
    () => ({
      canUndo: promptHistoryHook.canUndo,
      canRedo: promptHistoryHook.canRedo,
      historyLength: promptHistoryHook.historyLength,
      positionLabel: promptHistoryHook.positionLabel,
    }),
    [promptHistoryHook.canUndo, promptHistoryHook.canRedo, promptHistoryHook.historyLength, promptHistoryHook.positionLabel]
  );

  return {
    // State
    generatedPrompts,
    lockedElements,
    hasLockedPrompts,
    acceptingElementId,
    promptHistory,
    // Actions
    handlePromptRate,
    handlePromptLock,
    handleElementLock,
    handleCopy,
    handleAcceptElement,
    setGeneratedPrompts,
    clearPrompts,
    handlePromptUndo,
    handlePromptRedo,
    pushToHistory,
    clearHistory,
    setHistoryProjectId,
    generateFallbackPrompts,
    restorePrompts,
  };
}
