/**
 * ProjectSelector - Left-side drawer for project management
 * Design: Clean, readable list with clear visual separation
 *
 * Shows current project name, opens drawer with:
 * - Space-efficient list of projects sorted by name
 * - Full project titles without truncation
 * - Thin dividers and subtle backgrounds for row separation
 * - Create, rename, duplicate, delete actions
 */

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Plus, Trash2, Folder, Loader2, Pencil, Check, X, Copy, AlertTriangle, PanelLeftClose, Clock } from 'lucide-react';
import { scaleIn, fadeIn, transitions } from '../../lib/motion';

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  hasContent?: boolean;
  isComplete?: boolean;
  isArchived?: boolean;
  generationCount?: number;
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

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
  const [deleteModalProject, setDeleteModalProject] = useState<Project | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Sort projects by name ascending
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  // Close drawer on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

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

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setDeleteModalProject(project);
  };

  const handleConfirmDelete = () => {
    if (deleteModalProject) {
      onDelete(deleteModalProject.id);
      setDeleteModalProject(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalProject(null);
  };

  const handleStartEdit = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
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

  const handleRowClick = (project: Project) => {
    if (editingId === project.id) return; // Don't select while editing
    onSelect(project.id);
    setIsOpen(false);
  };

  const handleDuplicateClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (onDuplicate) {
      onDuplicate(projectId);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
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
        <span className="font-mono text-sm max-w-[200px] truncate">
          {currentProject?.name || 'Select Project'}
        </span>
        <ChevronRight size={14} className="text-slate-500" />
      </button>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setIsOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[420px] max-w-[90vw]
                         bg-surface-primary border-r border-slate-800
                         flex flex-col shadow-2xl shadow-black/50"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-surface-elevated">
                <div className="flex items-center gap-3">
                  <Folder size={20} className="text-cyan-500" />
                  <span className="font-semibold text-slate-200">
                    Projects
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full">
                    {sortedProjects.length}
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>

              {/* Project List */}
              <div className="flex-1 overflow-y-auto" data-testid="project-list-container">
                {sortedProjects.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <Folder size={32} className="mx-auto mb-3 text-slate-700" />
                    <p className="text-slate-500 text-sm">No projects yet</p>
                    <p className="text-slate-600 text-xs mt-1">Create your first project below</p>
                  </div>
                ) : (
                  <div>
                    {sortedProjects.map((project, index) => {
                      const isSelected = currentProject?.id === project.id;
                      const isEven = index % 2 === 0;

                      return (
                        <div
                          key={project.id}
                          onClick={() => handleRowClick(project)}
                          className={`group cursor-pointer transition-all duration-150 border-b border-slate-800/40
                                      ${isSelected
                                        ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500'
                                        : `${isEven ? 'bg-surface-secondary/30' : 'bg-transparent'} border-l-2 border-l-transparent hover:bg-slate-800/40 hover:border-l-slate-600`
                                      }`}
                        >
                          {editingId === project.id ? (
                            // Inline edit mode
                            <div className="flex items-center gap-2 px-5 py-4" onClick={(e) => e.stopPropagation()}>
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                className="flex-1 px-3 py-2 bg-slate-900 border border-cyan-500/50
                                           rounded-lg text-sm text-slate-200
                                           focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveEdit();
                                }}
                                className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                                title="Save"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
                                className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            // Normal display mode
                            <div className="px-5 py-4">
                              {/* Main row: Name + Actions */}
                              <div className="flex items-center gap-3">
                                {/* Project name */}
                                <span
                                  className={`flex-1 text-sm leading-relaxed
                                              ${isSelected ? 'text-cyan-300 font-medium' : 'text-slate-300'}`}
                                  title={project.name}
                                >
                                  {project.name}
                                </span>

                                {/* Timestamp - always visible */}
                                <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
                                  <Clock size={11} />
                                  <span>{formatRelativeTime(project.updated_at)}</span>
                                </div>

                                {/* Action buttons - show on hover */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  {onRename && (
                                    <button
                                      onClick={(e) => handleStartEdit(e, project)}
                                      className="p-1.5 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                                      title="Rename"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                  )}
                                  {onDuplicate && (
                                    <button
                                      onClick={(e) => handleDuplicateClick(e, project.id)}
                                      className="p-1.5 rounded-md text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                                      title="Duplicate"
                                    >
                                      <Copy size={13} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => handleDeleteClick(e, project)}
                                    className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {/* Generation count if available */}
                              {project.generationCount !== undefined && project.generationCount > 0 && (
                                <div className="mt-1.5 text-xs text-slate-600">
                                  {project.generationCount} generation{project.generationCount !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Create New Section */}
              <div className="border-t border-slate-800 p-4 bg-surface-elevated">
                {isCreating ? (
                  <div className="space-y-3">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter project name..."
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700
                                 rounded-lg text-sm text-slate-200 placeholder-slate-500
                                 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreate}
                        disabled={!newProjectName.trim()}
                        className="flex-1 px-4 py-2.5 bg-cyan-600 text-white
                                   rounded-lg text-sm font-medium
                                   hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed
                                   transition-colors"
                      >
                        Create Project
                      </button>
                      <button
                        onClick={() => {
                          setIsCreating(false);
                          setNewProjectName('');
                        }}
                        className="px-4 py-2.5 text-slate-400 hover:text-slate-200
                                   text-sm font-medium hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3
                               text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800
                               rounded-lg transition-colors border border-slate-700/50 hover:border-slate-600"
                  >
                    <Plus size={18} />
                    <span className="font-medium">New Project</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
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
              className="bg-surface-elevated border border-slate-700 rounded-xl shadow-2xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Warning Icon */}
              <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20">
                <AlertTriangle size={28} className="text-red-400" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-center text-slate-200 mb-2">
                Delete Project?
              </h3>

              {/* Message */}
              <p className="text-sm text-center text-slate-400 mb-6">
                Are you sure you want to delete{' '}
                <span className="text-slate-200 font-medium">&quot;{deleteModalProject.name}&quot;</span>?
                <br />
                <span className="text-slate-500">This action cannot be undone.</span>
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCancelDelete}
                  className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg
                           text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-slate-200
                           transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 rounded-lg
                           text-sm font-medium text-white hover:bg-red-500
                           transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ProjectSelector;
