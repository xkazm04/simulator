/**
 * ProjectSelector - Header dropdown for project management
 * Design: Clean Manuscript style
 *
 * Shows current project name, allows:
 * - Selecting existing projects
 * - Creating new projects
 * - Deleting projects
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Trash2, Folder, Loader2 } from 'lucide-react';
import { slideDown, transitions } from '../lib/motion';

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ProjectSelectorProps {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectSelector({
  projects,
  currentProject,
  isLoading,
  onSelect,
  onCreate,
  onDelete,
}: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setConfirmDelete(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreate = () => {
    if (newProjectName.trim()) {
      onCreate(newProjectName.trim());
      setNewProjectName('');
      setIsCreating(false);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewProjectName('');
    }
  };

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      onDelete(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-sm px-sm py-sm rounded-md
                   bg-surface-secondary border border-slate-800 hover:border-slate-700
                   text-slate-200 transition-colors"
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin text-slate-500" />
        ) : (
          <Folder size={16} className="text-cyan-500" />
        )}
        <span className="font-mono text-sm max-w-[180px] truncate">
          {currentProject?.name || 'Select Project'}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={slideDown}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.fast}
            className="absolute top-full left-0 mt-xs w-64 z-50
                       bg-surface-elevated border border-slate-800 rounded-lg shadow-floating
                       overflow-hidden"
          >
            {/* Project List */}
            <div className="max-h-60 overflow-y-auto custom-scrollbar" data-testid="project-list-container">
              {projects.length === 0 ? (
                <div className="px-sm py-md text-center text-slate-500 text-sm">
                  No projects yet
                </div>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className={`flex items-center gap-sm px-sm py-sm cursor-pointer
                                transition-colors group
                                ${currentProject?.id === project.id
                                  ? 'bg-cyan-500/10 text-accent-primary'
                                  : 'hover:bg-slate-800 text-slate-300'}`}
                  >
                    <button
                      onClick={() => {
                        onSelect(project.id);
                        setIsOpen(false);
                      }}
                      className="flex-1 text-left font-mono text-sm truncate"
                    >
                      {project.name}
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project.id);
                      }}
                      className={`p-1 rounded-sm transition-colors
                                  ${confirmDelete === project.id
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400'}`}
                      title={confirmDelete === project.id ? 'Click again to confirm' : 'Delete project'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-800" />

            {/* Create New */}
            {isCreating ? (
              <div className="p-sm">
                <input
                  ref={inputRef}
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Project name..."
                  className="w-full px-sm py-sm bg-slate-800 border border-slate-700
                             rounded-sm text-sm text-slate-200 placeholder-slate-500
                             focus:outline-none focus:border-accent-primary"
                />
                <div className="flex gap-sm mt-sm">
                  <button
                    onClick={handleCreate}
                    disabled={!newProjectName.trim()}
                    className="flex-1 px-3 py-1.5 bg-cyan-500/20 text-cyan-400
                               rounded-md text-xs font-mono uppercase tracking-wide
                               hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setNewProjectName('');
                    }}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-300
                               text-xs font-mono uppercase tracking-wide"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-sm w-full px-sm py-sm
                           text-slate-400 hover:text-slate-200 hover:bg-slate-800
                           transition-colors"
              >
                <Plus size={14} />
                <span className="font-mono text-sm">New Project</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProjectSelector;
