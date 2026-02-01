/**
 * useViewModeStore - Zustand store for managing simulator view mode
 *
 * Manages the active view mode across components:
 * - 'cmd': Command mode - main prompt generation workflow
 * - 'whatif': WhatIf mode - before/after comparison
 * - 'poster': Poster mode - project poster management
 */

import { create } from 'zustand';

export type ViewMode = 'cmd' | 'whatif' | 'poster';

interface ViewModeState {
  /** Current active view mode */
  viewMode: ViewMode;
  /** Set the view mode */
  setViewMode: (mode: ViewMode) => void;
}

export const useViewModeStore = create<ViewModeState>((set) => ({
  viewMode: 'cmd',
  setViewMode: (mode) => set({ viewMode: mode }),
}));
