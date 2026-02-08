/**
 * BrainContext - Provides brain state and actions to the component tree
 *
 * Split into separate State and Actions contexts to prevent unnecessary re-renders.
 * Components reading only state (e.g., useAutosave) won't re-render when action
 * references change, and vice versa.
 */

'use client';

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useBrain, BrainState, BrainActions } from './hooks/useBrain';

const BrainStateContext = createContext<BrainState | null>(null);
const BrainActionsContext = createContext<BrainActions | null>(null);

export interface BrainProviderProps {
  children: ReactNode;
}

export function BrainProvider({ children }: BrainProviderProps) {
  const brain = useBrain();

  const stateValue = useMemo<BrainState>(() => ({
    baseImage: brain.baseImage,
    baseImageFile: brain.baseImageFile,
    visionSentence: brain.visionSentence,
    breakdown: brain.breakdown,
    feedback: brain.feedback,
    outputMode: brain.outputMode,
    isParsingImage: brain.isParsingImage,
    imageParseError: brain.imageParseError,
    parsedImageDescription: brain.parsedImageDescription,
    preParseSnapshot: brain.preParseSnapshot,
    canUndoParse: brain.canUndoParse,
  }), [
    brain.baseImage,
    brain.baseImageFile,
    brain.visionSentence,
    brain.breakdown,
    brain.feedback,
    brain.outputMode,
    brain.isParsingImage,
    brain.imageParseError,
    brain.parsedImageDescription,
    brain.preParseSnapshot,
    brain.canUndoParse,
  ]);

  const actionsValue = useMemo<BrainActions>(() => ({
    setBaseImage: brain.setBaseImage,
    setBaseImageFile: brain.setBaseImageFile,
    setVisionSentence: brain.setVisionSentence,
    setBreakdown: brain.setBreakdown,
    setFeedback: brain.setFeedback,
    setOutputMode: brain.setOutputMode,
    handleImageParse: brain.handleImageParse,
    undoImageParse: brain.undoImageParse,
    clearUndoSnapshot: brain.clearUndoSnapshot,
    handleSmartBreakdownApply: brain.handleSmartBreakdownApply,
    resetBrain: brain.resetBrain,
    clearFeedback: brain.clearFeedback,
  }), [
    brain.setBaseImage,
    brain.setBaseImageFile,
    brain.setVisionSentence,
    brain.setBreakdown,
    brain.setFeedback,
    brain.setOutputMode,
    brain.handleImageParse,
    brain.undoImageParse,
    brain.clearUndoSnapshot,
    brain.handleSmartBreakdownApply,
    brain.resetBrain,
    brain.clearFeedback,
  ]);

  return (
    <BrainStateContext.Provider value={stateValue}>
      <BrainActionsContext.Provider value={actionsValue}>
        {children}
      </BrainActionsContext.Provider>
    </BrainStateContext.Provider>
  );
}

export function useBrainState(): BrainState {
  const context = useContext(BrainStateContext);
  if (!context) {
    throw new Error('useBrainState must be used within a BrainProvider');
  }
  return context;
}

export function useBrainActions(): BrainActions {
  const context = useContext(BrainActionsContext);
  if (!context) {
    throw new Error('useBrainActions must be used within a BrainProvider');
  }
  return context;
}

/** Backward-compatible hook returning both state and actions */
export function useBrainContext(): BrainState & BrainActions {
  const state = useBrainState();
  const actions = useBrainActions();
  return { ...state, ...actions };
}
