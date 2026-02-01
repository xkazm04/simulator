'use client';

import Link from 'next/link';
import { RotateCcw, Loader2, Check, AlertCircle } from 'lucide-react';
import { EXAMPLE_SIMULATIONS } from '../../subfeature_dimensions/lib/defaultDimensions';
import { ProjectSelector } from './ProjectSelector';
import { SaveStatus } from '../../hooks/usePersistedEntity';
import {
  StatusBadge,
  calculateProjectStatus,
  TimestampDisplay,
  GenerationCountBadge,
} from '../../components/StatusBadge';
import {
  ActivitySparkline,
  generateActivityData,
} from '../../components/ActivitySparkline';
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

  // Generate activity data for current project
  const activityData = currentProject
    ? generateActivityData(
        currentProject.created_at,
        currentProject.updated_at,
        currentProject.generationCount || 0,
        7
      )
    : [];

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
          <div className="flex items-center gap-1.5 px-2 py-1 text-green-400" title={lastSavedAt ? `Saved ${formatSavedTime(lastSavedAt)}` : 'Saved'}>
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
    <div className="flex flex-col border-b border-slate-800/50 bg-surface-primary relative z-20">
      {/* First Row: Project Selector + Navigation */}
      <div className="flex items-center gap-md px-lg py-2">
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

        {/* Navigation - centered */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center p-1 bg-slate-900/80 rounded-lg border border-slate-800/50 backdrop-blur-sm">
            <button className="px-4 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider shadow-sm transition-all shadow-cyan-900/20 text-cyan-400 bg-cyan-950/30 border border-cyan-500/20">
              Main Simulator
            </button>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <Link href="/character-studio">
              <button className="px-4 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
                Character Studio
              </button>
            </Link>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <Link href="/posters">
              <button className="px-4 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
                Posters
              </button>
            </Link>
          </div>
        </div>

        {/* Save Status */}
        {renderSaveStatus()}
      </div>

      {/* Second Row: Actions + Activity Line */}
      {currentProject && (
        <div className="flex items-center gap-md px-lg py-1.5 border-t border-slate-800/30 bg-slate-900/20">
          {/* Left: Action buttons */}
          <div className="flex items-center gap-2">
            {/* Reset button */}
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-2.5 py-1 font-mono text-xs text-slate-500
                       hover:text-slate-300 hover:bg-slate-800/50 rounded-md transition-colors border border-transparent hover:border-slate-800"
            >
              <RotateCcw size={11} />
              Reset
            </button>

            {/* Divider */}
            <div className="w-px h-4 bg-slate-800" />

            {/* Project Status Badge */}
            <StatusBadge
              status={calculateProjectStatus(currentProject)}
              size="sm"
            />

            {/* Generation Count */}
            {currentProject.generationCount !== undefined && currentProject.generationCount > 0 && (
              <GenerationCountBadge count={currentProject.generationCount} />
            )}
          </div>

          {/* Center: View Mode Switcher + Activity Sparkline */}
          <div className="flex-1 flex items-center justify-center gap-4">
            <ViewModeSwitcher />
            {activityData.length > 0 && (
              <>
                <div className="w-px h-4 bg-slate-700" />
                <span className="font-mono text-[10px] text-slate-600 uppercase tracking-wider">Activity</span>
                <ActivitySparkline
                  data={activityData}
                  width={120}
                  height={20}
                  color="#00d4ff"
                  fillColor="rgba(0, 212, 255, 0.1)"
                />
              </>
            )}
          </div>

          {/* Right: Timestamp */}
          <div className="flex items-center gap-2">
            <TimestampDisplay
              date={currentProject.updated_at}
              prefix="Updated"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default SimulatorHeader;
