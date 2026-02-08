'use client';

import Link from 'next/link';
import { RotateCcw, Loader2, Check, AlertCircle } from 'lucide-react';
import { ProjectSelector } from './ProjectSelector';
import { SaveStatus } from '../../hooks/usePersistedEntity';
import { ViewModeSwitcher } from '../../subfeature_brain/components/BrainTabSwitcher';

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  // Extended properties for status calculation
  hasContent?: boolean;
  isComplete?: boolean;
  isArchived?: boolean;
  generationCount?: number;
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
  onProjectSelect,
  onProjectCreate,
  onProjectDelete,
  onProjectRename,
  onProjectDuplicate,
  onReset,
}: SimulatorHeaderProps) {
  // Render save status indicator
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 text-amber-400" title="Saving...">
            <Loader2 size={12} className="animate-spin" />
            <span className="font-mono text-xs">Saving...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 text-green-400" title="Saved">
            <Check size={12} />
            <span className="font-mono text-xs">Saved</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 text-red-400" title="Failed to save">
            <AlertCircle size={12} />
            <span className="font-mono text-xs">Error</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-md px-lg py-2 border-b border-slate-800/50 bg-surface-primary relative z-20">
      {/* Left: Project management */}
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
      {renderSaveStatus()}

      {/* Center: View mode tabs */}
      <div className="flex-1 flex justify-center">
        {currentProject && <ViewModeSwitcher />}
      </div>

      {/* Right: Navigation + utilities */}
      <div className="flex items-center gap-2">
        {currentProject && process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
          <>
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-2.5 py-1 font-mono text-xs text-slate-500
                       hover:text-slate-300 hover:bg-slate-800/50 rounded-md transition-colors border border-transparent hover:border-slate-800"
            >
              <RotateCcw size={11} />
              Reset
            </button>
            <div className="w-px h-5 bg-slate-700/50" />
          </>
        )}
        <Link href="/posters">
          <button className="px-3 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors border border-slate-800/50 hover:border-slate-700">
            Posters
          </button>
        </Link>
      </div>
    </div>
  );
}

export default SimulatorHeader;
