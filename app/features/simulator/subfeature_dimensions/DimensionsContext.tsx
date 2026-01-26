/**
 * DimensionsContext - Provides dimension state and actions to the component tree
 *
 * Features:
 * - Dimension state management via useDimensions hook
 * - Auto-persistence to localStorage (debounced 500ms)
 * - Per-project storage keys
 * - SSR-safe initialization
 */

'use client';

import React, { createContext, useContext, ReactNode, useEffect, useRef, useCallback } from 'react';
import { useDimensions, DimensionsState, DimensionsActions } from './hooks/useDimensions';
import { createPersistenceManager, loadPersistedDimensions, clearPersistedDimensions } from './lib/dimensionPersistence';

type DimensionsContextValue = DimensionsState & DimensionsActions & {
  /** Current project ID for persistence */
  currentProjectId: string | undefined;
  /** Set current project ID (triggers load from localStorage) */
  setCurrentProjectId: (projectId: string | undefined) => void;
  /** Clear persisted data for current project */
  clearPersistence: () => void;
};

const DimensionsContext = createContext<DimensionsContextValue | null>(null);

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

  const contextValue: DimensionsContextValue = {
    ...dimensions,
    currentProjectId: projectIdRef.current,
    setCurrentProjectId,
    clearPersistence,
  };

  return (
    <DimensionsContext.Provider value={contextValue}>
      {children}
    </DimensionsContext.Provider>
  );
}

export function useDimensionsContext(): DimensionsContextValue {
  const context = useContext(DimensionsContext);
  if (!context) {
    throw new Error('useDimensionsContext must be used within a DimensionsProvider');
  }
  return context;
}
