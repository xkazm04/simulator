/**
 * PromptsContext - Provides prompts state and actions to the component tree
 * Handles automatic persistence to the project API.
 *
 * Split into separate State and Actions contexts to prevent unnecessary re-renders.
 */

'use client';

import React, { createContext, useContext, ReactNode, useCallback, useEffect, useRef, useMemo } from 'react';
import { usePrompts, PromptsState, PromptsActions, UsePromptsOptions } from './hooks/usePrompts';
import { useProjectContext } from '../contexts';
import { useDimensionsContext } from '../subfeature_dimensions';
import { useBrainContext } from '../subfeature_brain';
import { GeneratedPrompt } from '../types';

const PromptsStateContext = createContext<PromptsState | null>(null);
const PromptsActionsContext = createContext<PromptsActions | null>(null);

export interface PromptsProviderProps {
  children: ReactNode;
}

export function PromptsProvider({ children }: PromptsProviderProps) {
  const project = useProjectContext();
  const dimensions = useDimensionsContext();
  const brain = useBrainContext();
  const projectIdRef = useRef<string | null>(null);

  // Track project ID changes
  useEffect(() => {
    projectIdRef.current = project.currentProject?.id || null;
  }, [project.currentProject?.id]);

  // Persist prompts to API
  const onSavePrompts = useCallback(async (prompts: GeneratedPrompt[]) => {
    const projectId = projectIdRef.current;
    if (!projectId) return;

    try {
      await fetch(`/api/projects/${projectId}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: prompts.map(p => ({
          id: p.id,
          sceneNumber: p.sceneNumber,
          sceneType: p.sceneType,
          prompt: p.prompt,
          copied: p.copied,
          rating: p.rating,
          locked: p.locked,
          elements: p.elements,
        })) }),
      });
    } catch (err) {
      console.error('[PromptsProvider] Failed to save prompts:', err);
    }
  }, []);

  // Delete all prompts from API
  const onDeletePrompts = useCallback(async () => {
    const projectId = projectIdRef.current;
    if (!projectId) return;

    try {
      await fetch(`/api/projects/${projectId}/prompts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (err) {
      console.error('[PromptsProvider] Failed to delete prompts:', err);
    }
  }, []);

  // Restore callbacks for undo/redo — set dimensions and baseImage from history entry
  const onRestoreDimensions = useCallback((dims: import('../types').Dimension[]) => {
    dimensions.setDimensions(dims);
  }, [dimensions]);

  const onRestoreBaseImage = useCallback((baseImage: string) => {
    brain.setBaseImage(baseImage);
  }, [brain]);

  const options: UsePromptsOptions = {
    onSavePrompts,
    onDeletePrompts,
    onRestoreDimensions,
    onRestoreBaseImage,
  };

  const prompts = usePrompts(options);

  // Track project changes — clear history when project switches
  const currentProjectId = project.currentProject?.id || null;
  useEffect(() => {
    prompts.setHistoryProjectId(currentProjectId);
  }, [currentProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stateValue = useMemo<PromptsState>(() => ({
    generatedPrompts: prompts.generatedPrompts,
    lockedElements: prompts.lockedElements,
    hasLockedPrompts: prompts.hasLockedPrompts,
    acceptingElementId: prompts.acceptingElementId,
    promptHistory: prompts.promptHistory,
  }), [
    prompts.generatedPrompts,
    prompts.lockedElements,
    prompts.hasLockedPrompts,
    prompts.acceptingElementId,
    prompts.promptHistory,
  ]);

  const actionsValue = useMemo<PromptsActions>(() => ({
    handlePromptRate: prompts.handlePromptRate,
    handlePromptLock: prompts.handlePromptLock,
    handleElementLock: prompts.handleElementLock,
    handleCopy: prompts.handleCopy,
    handleAcceptElement: prompts.handleAcceptElement,
    setGeneratedPrompts: prompts.setGeneratedPrompts,
    clearPrompts: prompts.clearPrompts,
    handlePromptUndo: prompts.handlePromptUndo,
    handlePromptRedo: prompts.handlePromptRedo,
    pushToHistory: prompts.pushToHistory,
    clearHistory: prompts.clearHistory,
    setHistoryProjectId: prompts.setHistoryProjectId,
    generateFallbackPrompts: prompts.generateFallbackPrompts,
    restorePrompts: prompts.restorePrompts,
  }), [
    prompts.handlePromptRate,
    prompts.handlePromptLock,
    prompts.handleElementLock,
    prompts.handleCopy,
    prompts.handleAcceptElement,
    prompts.setGeneratedPrompts,
    prompts.clearPrompts,
    prompts.handlePromptUndo,
    prompts.handlePromptRedo,
    prompts.pushToHistory,
    prompts.clearHistory,
    prompts.setHistoryProjectId,
    prompts.generateFallbackPrompts,
    prompts.restorePrompts,
  ]);

  return (
    <PromptsStateContext.Provider value={stateValue}>
      <PromptsActionsContext.Provider value={actionsValue}>
        {children}
      </PromptsActionsContext.Provider>
    </PromptsStateContext.Provider>
  );
}

export function usePromptsState(): PromptsState {
  const context = useContext(PromptsStateContext);
  if (!context) {
    throw new Error('usePromptsState must be used within a PromptsProvider');
  }
  return context;
}

export function usePromptsActions(): PromptsActions {
  const context = useContext(PromptsActionsContext);
  if (!context) {
    throw new Error('usePromptsActions must be used within a PromptsProvider');
  }
  return context;
}

/** Backward-compatible hook returning both state and actions */
export function usePromptsContext(): PromptsState & PromptsActions {
  const state = usePromptsState();
  const actions = usePromptsActions();
  return { ...state, ...actions };
}
