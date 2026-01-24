'use client';

import Link from 'next/link';
import { RotateCcw, Loader2, Check, AlertCircle } from 'lucide-react';
import { EXAMPLE_SIMULATIONS } from '../../subfeature_dimensions/lib/defaultDimensions';
import { ProjectSelector } from './ProjectSelector';
import { SaveStatus } from '../../hooks/usePersistedEntity';

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface SimulatorHeaderProps {
  projects: Project[];
  currentProject: Project | null;
  isLoadingProjects: boolean;
  saveStatus?: SaveStatus;
  lastSavedAt?: Date | null;
  onProjectSelect: (id: string) => void;
  onProjectCreate: (name: string) => void;
  onProjectDelete: (id: string) => void;
  onProjectRename?: (id: string, newName: string) => Promise<boolean>;
  onProjectDuplicate?: (id: string) => Promise<Project | null>;
  onLoadExample: (index: number) => void;
  onReset: () => void;
}

export function SimulatorHeader({
  projects,
  currentProject,
  isLoadingProjects,
  saveStatus = 'idle',
  lastSavedAt,
  onProjectSelect,
  onProjectCreate,
  onProjectDelete,
  onProjectRename,
  onProjectDuplicate,
  onLoadExample,
  onReset,
}: SimulatorHeaderProps) {
  // Format time for "Saved X ago" display
  const formatSavedTime = (date: Date | null | undefined): string => {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render save status indicator
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 text-amber-400" title="Saving...">
            <Loader2 size={12} className="animate-spin" />
            <span className="font-mono ">Saving...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 text-green-400" title={lastSavedAt ? `Saved ${formatSavedTime(lastSavedAt)}` : 'Saved'}>
            <Check size={12} />
            <span className="font-mono ">Saved</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 text-red-400" title="Failed to save">
            <AlertCircle size={12} />
            <span className="font-mono ">Error</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-md px-lg py-md border-b border-slate-800/50 bg-surface-primary relative z-20">
      {/* Project Selector */}
      <ProjectSelector
        projects={projects}
        currentProject={currentProject}
        isLoading={isLoadingProjects}
        onSelect={onProjectSelect}
        onCreate={onProjectCreate}
        onDelete={onProjectDelete}
        onRename={onProjectRename}
        onDuplicate={onProjectDuplicate}
      />

      {/* Save Status Indicator */}
      {renderSaveStatus()}

      {/* Navigation */}
      <div className="flex-1 mx-auto flex justify-center">
        <div className="flex items-center p-1 bg-slate-900/80 rounded-lg border border-slate-800/50 backdrop-blur-sm">
          <button className="px-4 py-1.5 rounded-md  font-mono uppercase tracking-wider shadow-sm transition-all shadow-cyan-900/20 text-cyan-400 bg-cyan-950/30 border border-cyan-500/20">
            Main Simulator
          </button>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <Link href="/character-studio">
            <button className="px-4 py-1.5 rounded-md  font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
              Character Studio
            </button>
          </Link>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <Link href="/posters">
            <button className="px-4 py-1.5 rounded-md  font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
              Posters
            </button>
          </Link>
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-1.5 font-mono  text-slate-500
                   hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-slate-800"
      >
        <RotateCcw size={12} />
        reset
      </button>
    </div>
  );
}

export default SimulatorHeader;
