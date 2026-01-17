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
import { ChevronDown, Plus, Trash2, Folder, Loader2, Pencil, Check, X, Copy, AlertTriangle } from 'lucide-react';
import { slideDown, scaleIn, fadeIn, transitions } from '../../lib/motion';

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
  onRename?: (id: string, newName: string) => void;
  onDuplicate?: (id: string) => void;
}

export function ProjectSelector({
  projects,
  currentProject,
  isLoading,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onDuplicate,
}: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Delete confirmation modal state
  const [deleteModalProject, setDeleteModalProject] = useState<Project | null>(null);

  // Rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
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

  // Focus input when editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

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

  const handleDeleteClick = (project: Project) => {
    setDeleteModalProject(project);
  };

  const handleConfirmDelete = () => {
    if (deleteModalProject) {
      onDelete(deleteModalProject.id);
      setDeleteModalProject(null);
      setIsOpen(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalProject(null);
  };

  // Rename handlers
  const handleStartEdit = (project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
  };

  const handleSaveEdit = async () => {
    if (editingId && editName.trim() && onRename) {
      await onRename(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
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
                    {editingId === project.id ? (
                      // Inline edit mode
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          className="flex-1 px-1.5 py-0.5 bg-slate-800 border border-cyan-500/50
                                     rounded-sm text-sm text-slate-200 font-mono
                                     focus:outline-none focus:border-cyan-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdit();
                          }}
                          className="p-1 rounded-sm bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                          title="Save"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="p-1 rounded-sm text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                          title="Cancel"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      // Normal display mode
                      <>
                        <button
                          onClick={() => {
                            onSelect(project.id);
                            setIsOpen(false);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (onRename) handleStartEdit(project);
                          }}
                          className="flex-1 text-left font-mono text-sm truncate"
                          title="Double-click to rename"
                        >
                          {project.name}
                        </button>

                        {/* Edit button */}
                        {onRename && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(project);
                            }}
                            className="p-1 rounded-sm transition-colors
                                        opacity-0 group-hover:opacity-100 hover:bg-cyan-500/20 text-slate-500 hover:text-cyan-400"
                            title="Rename project"
                          >
                            <Pencil size={12} />
                          </button>
                        )}

                        {/* Duplicate button */}
                        {onDuplicate && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicate(project.id);
                              setIsOpen(false);
                            }}
                            className="p-1 rounded-sm transition-colors
                                        opacity-0 group-hover:opacity-100 hover:bg-purple-500/20 text-slate-500 hover:text-purple-400"
                            title="Duplicate project"
                          >
                            <Copy size={12} />
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(project);
                          }}
                          className="p-1 rounded-sm transition-colors
                                     opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400"
                          title="Delete project"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModalProject && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.fast}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleCancelDelete}
          >
            <motion.div
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitions.fast}
              className="bg-surface-elevated border border-slate-700 rounded-lg shadow-floating max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Warning Icon */}
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30">
                <AlertTriangle size={24} className="text-red-400" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-mono text-center text-slate-200 mb-2">
                Delete Project?
              </h3>

              {/* Message */}
              <p className="text-sm text-center text-slate-400 mb-6">
                Are you sure you want to delete{' '}
                <span className="font-mono text-slate-200">&quot;{deleteModalProject.name}&quot;</span>?
                This action cannot be undone.
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCancelDelete}
                  className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md
                           text-sm font-mono text-slate-300 hover:bg-slate-700 hover:text-slate-200
                           transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-md
                           text-sm font-mono text-red-400 hover:bg-red-500/30 hover:text-red-300
                           transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProjectSelector;
