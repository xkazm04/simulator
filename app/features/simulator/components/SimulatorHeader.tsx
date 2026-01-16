'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { EXAMPLE_SIMULATIONS } from '../lib/defaultDimensions';
import { ProjectSelector } from './ProjectSelector';

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
  onProjectSelect: (id: string) => void;
  onProjectCreate: (name: string) => void;
  onProjectDelete: (id: string) => void;
  onLoadExample: (index: number) => void;
  onReset: () => void;
}

export function SimulatorHeader({
  projects,
  currentProject,
  isLoadingProjects,
  onProjectSelect,
  onProjectCreate,
  onProjectDelete,
  onLoadExample,
  onReset,
}: SimulatorHeaderProps) {
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
      />

      {/* Navigation */}
      <div className="flex-1 max-w-xl mx-auto flex justify-center">
        <div className="flex items-center p-1 bg-slate-900/80 rounded-lg border border-slate-800/50 backdrop-blur-sm">
          <button className="px-4 py-1.5 rounded-md type-label font-mono uppercase tracking-wider shadow-sm transition-all shadow-cyan-900/20 text-cyan-400 bg-cyan-950/30 border border-cyan-500/20">
            Main Simulator
          </button>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <Link href="/character-studio">
            <button className="px-4 py-1.5 rounded-md type-label font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
              Character Studio
            </button>
          </Link>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <Link href="/posters">
            <button className="px-4 py-1.5 rounded-md type-label font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
              Posters
            </button>
          </Link>
        </div>
      </div>

      {/* Presets */}
      <div className="hidden md:flex items-center gap-sm mr-md">
        <span className="font-mono type-label text-slate-600 mr-2">// presets:</span>
        {EXAMPLE_SIMULATIONS.map((example, index) => (
          <button
            key={example.id}
            onClick={() => onLoadExample(index)}
            className="group px-3 py-1.5 font-mono type-label text-slate-500 hover:text-cyan-400
                       hover:bg-slate-900/50 border border-transparent hover:border-slate-800 rounded-full transition-all"
            title={example.subtitle}
          >
            {example.title}
          </button>
        ))}
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-1.5 font-mono type-label text-slate-500
                   hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-slate-800"
      >
        <RotateCcw size={12} />
        reset
      </button>
    </div>
  );
}

export default SimulatorHeader;
