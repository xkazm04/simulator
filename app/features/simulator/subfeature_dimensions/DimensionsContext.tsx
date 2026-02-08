/**
 * DimensionsContext - Provides dimension state and actions to the component tree
 *
 * Features:
 * - Dimension state management via useDimensions hook
 * - Auto-persistence to localStorage (debounced 500ms)
 * - Per-project storage keys
 * - SSR-safe initialization
 *
 * Split into separate State and Actions contexts to prevent unnecessary re-renders.
 */

'use client';

import React, { createContext, useContext, ReactNode, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDimensions, DimensionsState, DimensionsActions } from './hooks/useDimensions';
import { createPersistenceManager, loadPersistedDimensions, clearPersistedDimensions } from './lib/dimensionPersistence';

type DimensionsStateValue = DimensionsState & {
  /** Current project ID for persistence */
  currentProjectId: string | undefined;
};

type DimensionsActionsValue = DimensionsActions & {
  /** Set current project ID (triggers load from localStorage) */
  setCurrentProjectId: (projectId: string | undefined) => void;
  /** Clear persisted data for current project */
  clearPersistence: () => void;
};

type DimensionsContextValue = DimensionsStateValue & DimensionsActionsValue;

const DimensionsStateContext = createContext<DimensionsStateValue | null>(null);
const DimensionsActionsContext = createContext<DimensionsActionsValue | null>(null);

export interface DimensionsProviderProps {
  children: ReactNode;
  /** Initial project ID for persistence */
  initialProjectId?: string;
}

export function DimensionsProvider({ children, initialProjectId }: DimensionsProviderProps) {
  const dimensions = useDimensions();
  const projectIdRef = useRef<string | undefined>(initialProjectId);
  const persistenceManager = useRef(createPersistenceManager(500));
  const isInitializedRef = useRef(false);

  // Load persisted dimensions on mount (client-side only)
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const persisted = loadPersistedDimensions(projectIdRef.current);
    if (persisted && persisted.length > 0) {
      dimensions.setDimensions(persisted);
    }
  }, [dimensions.setDimensions]);

  // Auto-save dimensions on change (debounced)
  useEffect(() => {
    // Skip initial render
    if (!isInitializedRef.current) return;

    persistenceManager.current.save(dimensions.dimensions, projectIdRef.current);
  }, [dimensions.dimensions]);

  // Cleanup on unmount
  useEffect(() => {
    const manager = persistenceManager.current;
    return () => {
      manager.flush(); // Save any pending changes
      manager.cancel();
    };
  }, []);

  // Set project ID and load persisted dimensions for that project
  const setCurrentProjectId = useCallback((projectId: string | undefined) => {
    // Flush any pending saves for current project
    persistenceManager.current.flush();

    // Update project ID
    projectIdRef.current = projectId;

    // Load persisted dimensions for new project
    const persisted = loadPersistedDimensions(projectId);
    if (persisted && persisted.length > 0) {
      dimensions.setDimensions(persisted);
    } else {
      // Reset to defaults if no persisted data
      dimensions.resetDimensions();
    }
  }, [dimensions.setDimensions, dimensions.resetDimensions]);

  // Clear persistence for current project
  const clearPersistence = useCallback(() => {
    persistenceManager.current.cancel();
    clearPersistedDimensions(projectIdRef.current);
  }, []);

  const stateValue = useMemo<DimensionsStateValue>(() => ({
    dimensions: dimensions.dimensions,
    pendingDimensionChange: dimensions.pendingDimensionChange,
    canUndoDimension: dimensions.canUndoDimension,
    undoStackSize: dimensions.undoStackSize,
    currentProjectId: projectIdRef.current,
  }), [
    dimensions.dimensions,
    dimensions.pendingDimensionChange,
    dimensions.canUndoDimension,
    dimensions.undoStackSize,
  ]);

  const actionsValue = useMemo<DimensionsActionsValue>(() => ({
    handleDimensionChange: dimensions.handleDimensionChange,
    handleDimensionWeightChange: dimensions.handleDimensionWeightChange,
    handleDimensionFilterModeChange: dimensions.handleDimensionFilterModeChange,
    handleDimensionTransformModeChange: dimensions.handleDimensionTransformModeChange,
    handleDimensionReferenceImageChange: dimensions.handleDimensionReferenceImageChange,
    handleDimensionRemove: dimensions.handleDimensionRemove,
    handleDimensionAdd: dimensions.handleDimensionAdd,
    handleDimensionReorder: dimensions.handleDimensionReorder,
    handleDropElementOnDimension: dimensions.handleDropElementOnDimension,
    handleUndoDimensionChange: dimensions.handleUndoDimensionChange,
    handleUndoDimensionChangeByTag: dimensions.handleUndoDimensionChangeByTag,
    handleConvertElementsToDimensions: dimensions.handleConvertElementsToDimensions,
    setDimensions: dimensions.setDimensions,
    setDimensionsWithUndo: dimensions.setDimensionsWithUndo,
    resetDimensions: dimensions.resetDimensions,
    loadExampleDimensions: dimensions.loadExampleDimensions,
    clearDimensionUndoStack: dimensions.clearDimensionUndoStack,
    setCurrentProjectId,
    clearPersistence,
  }), [
    dimensions.handleDimensionChange,
    dimensions.handleDimensionWeightChange,
    dimensions.handleDimensionFilterModeChange,
    dimensions.handleDimensionTransformModeChange,
    dimensions.handleDimensionReferenceImageChange,
    dimensions.handleDimensionRemove,
    dimensions.handleDimensionAdd,
    dimensions.handleDimensionReorder,
    dimensions.handleDropElementOnDimension,
    dimensions.handleUndoDimensionChange,
    dimensions.handleUndoDimensionChangeByTag,
    dimensions.handleConvertElementsToDimensions,
    dimensions.setDimensions,
    dimensions.setDimensionsWithUndo,
    dimensions.resetDimensions,
    dimensions.loadExampleDimensions,
    dimensions.clearDimensionUndoStack,
    setCurrentProjectId,
    clearPersistence,
  ]);

  return (
    <DimensionsStateContext.Provider value={stateValue}>
      <DimensionsActionsContext.Provider value={actionsValue}>
        {children}
      </DimensionsActionsContext.Provider>
    </DimensionsStateContext.Provider>
  );
}

export function useDimensionsState(): DimensionsStateValue {
  const context = useContext(DimensionsStateContext);
  if (!context) {
    throw new Error('useDimensionsState must be used within a DimensionsProvider');
  }
  return context;
}

export function useDimensionsActions(): DimensionsActionsValue {
  const context = useContext(DimensionsActionsContext);
  if (!context) {
    throw new Error('useDimensionsActions must be used within a DimensionsProvider');
  }
  return context;
}

/** Backward-compatible hook returning both state and actions */
export function useDimensionsContext(): DimensionsContextValue {
  const state = useDimensionsState();
  const actions = useDimensionsActions();
  return { ...state, ...actions };
}
