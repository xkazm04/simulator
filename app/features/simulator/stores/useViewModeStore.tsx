/**
 * View Mode Store - React Context-based state management for view mode
 *
 * Manages global view mode state:
 * - 'cmd' (default) - Main prompt generation workflow
 * - 'whatif' - Before/After image comparison
 * - 'poster' - Project poster management
 */

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ViewMode = 'cmd' | 'whatif' | 'poster';

interface ViewModeState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeState | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>('cmd');

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
  }, []);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewModeStore(): ViewModeState {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewModeStore must be used within a ViewModeProvider');
  }
  return context;
}
