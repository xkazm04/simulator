/**
 * ViewModeSwitcher - Compact tab switcher for Command/Poster/WhatIf views
 *
 * Used in SimulatorHeader to switch between different view modes.
 * Uses context store for state management.
 */

'use client';

import React from 'react';
import { Terminal, Film, GitCompare } from 'lucide-react';
import { useViewModeStore, ViewMode } from '../../stores';

const VIEW_TABS: Array<{ id: ViewMode; label: string; icon: React.ReactNode; title: string }> = [
  { id: 'cmd', label: 'CMD', icon: <Terminal size={12} />, title: 'Command - Main prompt workflow' },
  { id: 'poster', label: 'POSTER', icon: <Film size={12} />, title: 'Poster - Project artwork' },
  { id: 'whatif', label: 'COMPARE', icon: <GitCompare size={12} />, title: 'Compare - Before/After comparison' },
];

export function ViewModeSwitcher() {
  const { viewMode, setViewMode } = useViewModeStore();

  return (
    <div className="inline-flex items-center bg-slate-900/80 border border-slate-700/50 rounded-lg p-0.5">
      {VIEW_TABS.map((tab) => {
        const isActive = viewMode === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            title={tab.title}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider
              transition-all duration-150 rounded-md
              focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50
              ${isActive
                ? 'bg-cyan-950/50 text-cyan-400 shadow-sm border border-cyan-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ViewModeSwitcher;
