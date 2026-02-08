/**
 * useProjectManager - Combines project loading, selection, and state management
 *
 * Extracted from SimulatorFeature to reduce complexity.
 * Handles:
 * - Auto-loading projects on mount
 * - Auto-creating default Demo project
 * - Auto-selecting first project
 * - Project selection with state restoration
 * - Project creation with reset
 * - Project reset (clear all data)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dimension, OutputMode } from '../types';
import { useProjectContext } from '../contexts';
import { usePoster } from './usePoster';
import { useImageGeneration } from './useImageGeneration';
import { useDimensionsContext } from '../subfeature_dimensions';
import { useBrainContext } from '../subfeature_brain';
import { useSimulatorContext } from '../SimulatorContext';
import { usePromptsContext } from '../subfeature_prompts';
import { useViewModeStore } from '../stores';

// LocalStorage key for persisting last selected project
const LAST_PROJECT_KEY = 'simulator:lastProjectId';

interface ProjectState {
  basePrompt: string;
  baseImageFile: string | null;
  visionSentence: string | null;
  breakdown: { baseImage: { format: string; keyElements: string[] }; reasoning: string } | null;
  outputMode: OutputMode;
  dimensions: Dimension[];
  feedback: { positive: string; negative: string };
}

interface UseProjectManagerOptions {
  imageGen: ReturnType<typeof useImageGeneration>;
  /** Callback when project changes (for updating project-scoped state) */
  onProjectChange?: (projectId: string | null) => void;
}

export function useProjectManager({ imageGen, onProjectChange }: UseProjectManagerOptions) {
  const project = useProjectContext();
  const poster = usePoster();
  const dimensions = useDimensionsContext();
  const brain = useBrainContext();
  const simulator = useSimulatorContext();
  const prompts = usePromptsContext();
  const { setViewMode } = useViewModeStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [savedPromptIds, setSavedPromptIds] = useState<Set<string>>(new Set());
  const [showPosterOverlay, setShowPosterOverlay] = useState(false);

  // Track which prompt IDs have been submitted for image generation
  const submittedForGenerationRef = useRef<Set<string>>(new Set());

  // Helper to restore project state to simulator contexts
  // Sets isRestoring flag to prevent autosave race conditions
  const restoreProjectState = useCallback((state: ProjectState) => {
    // Set restoring flag to prevent autosave during state restoration
    project.setIsRestoring(true);

    simulator.handleReset();
    if (state.basePrompt) {
      brain.setBaseImage(state.basePrompt);
    }
    if (state.baseImageFile) {
      brain.setBaseImageFile(state.baseImageFile);
    }
    if (state.visionSentence) {
      brain.setVisionSentence(state.visionSentence);
    }
    // Restore breakdown (null for old projects is fine)
    brain.setBreakdown(state.breakdown || null);
    if (state.outputMode) {
      brain.setOutputMode(state.outputMode);
    }
    if (state.dimensions?.length > 0) {
      dimensions.setDimensions(state.dimensions);
    }
    if (state.feedback) {
      brain.setFeedback(state.feedback);
    }

    // Clear restoring flag after all state is set
    // Use setTimeout to ensure React has processed all state updates
    setTimeout(() => {
      project.setIsRestoring(false);
    }, 0);
  }, [simulator, brain, dimensions, project]);

  // Load projects on mount
  useEffect(() => {
    const initializeProjects = async () => {
      await project.loadProjects();
      setIsInitialized(true);
    };
    initializeProjects();
  }, [project.loadProjects]);

  // Create default Demo project if none exist
  useEffect(() => {
    const createDefaultProject = async () => {
      if (isInitialized && project.projects.length === 0 && !project.isLoading) {
        await project.createProject('Demo');
      }
    };
    createDefaultProject();
  }, [isInitialized, project.projects.length, project.isLoading, project.createProject]);

  // Auto-select project - prefer last selected from localStorage, fall back to first
  useEffect(() => {
    const selectProject = async () => {
      if (isInitialized && project.projects.length > 0 && !project.currentProject && !project.isLoading) {
        // Check localStorage for last selected project
        let targetProjectId: string | null = null;
        try {
          const lastProjectId = localStorage.getItem(LAST_PROJECT_KEY);
          if (lastProjectId && project.projects.some(p => p.id === lastProjectId)) {
            targetProjectId = lastProjectId;
          }
        } catch {
          // localStorage not available (SSR or private browsing)
        }

        // Fall back to first project if no valid last selection
        if (!targetProjectId) {
          targetProjectId = project.projects[0].id;
        }

        console.log('[useProjectManager] Auto-selecting project:', targetProjectId);
        let projectWithState = await project.selectProject(targetProjectId);

        // If selection failed and we tried localStorage ID, fall back to first project
        if (!projectWithState && targetProjectId !== project.projects[0].id) {
          console.warn('[useProjectManager] Failed to select last project, falling back to first');
          targetProjectId = project.projects[0].id;
          projectWithState = await project.selectProject(targetProjectId);

          // Clear stale localStorage
          try {
            localStorage.removeItem(LAST_PROJECT_KEY);
          } catch {
            // Ignore
          }
        }

        if (projectWithState?.state) {
          restoreProjectState(projectWithState.state);
        }

        // Restore prompts from saved state (already converted to camelCase by parseProjectWithState)
        if (projectWithState?.generatedPrompts && projectWithState.generatedPrompts.length > 0) {
          prompts.restorePrompts(projectWithState.generatedPrompts);
          // Mark restored prompts as already submitted to prevent auto-generation
          projectWithState.generatedPrompts.forEach(p => {
            submittedForGenerationRef.current.add(p.id);
          });
        }

        poster.setPoster(projectWithState?.poster || null);

        // Hydrate panel images from database (replaces local state, survives key change)
        imageGen.hydratePanelImages(projectWithState?.panelImages || []);

        // Persist selection to localStorage only if successful
        if (projectWithState) {
          try {
            localStorage.setItem(LAST_PROJECT_KEY, targetProjectId);
          } catch {
            // localStorage not available
          }

          // Notify parent of project change
          onProjectChange?.(targetProjectId);
        }
      }
    };
    selectProject();
  }, [isInitialized, project.projects.length, project.currentProject?.id, project.isLoading, project.selectProject, restoreProjectState, poster, prompts, onProjectChange, imageGen.hydratePanelImages]);

  // Handle project selection
  const handleProjectSelect = useCallback(async (projectId: string) => {
    console.log('[useProjectManager] handleProjectSelect called with:', projectId);

    // Persist selection to localStorage for next session
    try {
      localStorage.setItem(LAST_PROJECT_KEY, projectId);
    } catch {
      // localStorage not available (SSR or private browsing)
    }

    // Notify parent of project change first (so imageGen updates storage key)
    onProjectChange?.(projectId);

    const projectWithState = await project.selectProject(projectId);
    console.log('[useProjectManager] selectProject result:', projectWithState ? 'success' : 'failed');

    if (projectWithState?.state) {
      restoreProjectState(projectWithState.state);
    } else {
      // Set restoring flag to prevent autosave during reset
      project.setIsRestoring(true);
      simulator.handleReset();
      setTimeout(() => project.setIsRestoring(false), 0);
    }

    // Clear generation tracking before restoring
    imageGen.clearGeneratedImages();
    setSavedPromptIds(new Set());
    submittedForGenerationRef.current.clear();

    // Restore prompts from saved state (already converted to camelCase by parseProjectWithState)
    if (projectWithState?.generatedPrompts && projectWithState.generatedPrompts.length > 0) {
      prompts.restorePrompts(projectWithState.generatedPrompts);
      // Mark restored prompts as already submitted to prevent auto-generation
      projectWithState.generatedPrompts.forEach(p => {
        submittedForGenerationRef.current.add(p.id);
      });
    } else {
      prompts.clearPrompts();
    }

    poster.setPoster(projectWithState?.poster || null);

    // Hydrate panel images from database (replaces local state, survives key change)
    imageGen.hydratePanelImages(projectWithState?.panelImages || []);

    setShowPosterOverlay(false);
  }, [project, simulator, restoreProjectState, imageGen, poster, prompts, onProjectChange]);

  // Handle project creation
  const handleProjectCreate = useCallback(async (name: string) => {
    const newProject = await project.createProject(name);
    if (newProject) {
      // Persist selection to localStorage for next session
      try {
        localStorage.setItem(LAST_PROJECT_KEY, newProject.id);
      } catch {
        // localStorage not available
      }

      // Notify parent of project change
      onProjectChange?.(newProject.id);

      // Set restoring flag to prevent autosave during initialization
      project.setIsRestoring(true);
      simulator.handleReset();
      prompts.clearPrompts();
      imageGen.clearGeneratedImages();
      setSavedPromptIds(new Set());
      submittedForGenerationRef.current.clear();
      poster.setPoster(null);
      setShowPosterOverlay(false);
      setViewMode('cmd');
      // Clear restoring flag after initialization
      setTimeout(() => project.setIsRestoring(false), 0);
    }
  }, [project, simulator, prompts, imageGen, poster, onProjectChange, setViewMode]);

  // Handle project reset
  const handleResetProject = useCallback(async () => {
    simulator.handleReset();
    prompts.clearPrompts();
    imageGen.clearGeneratedImages();
    setSavedPromptIds(new Set());
    submittedForGenerationRef.current.clear();
    poster.setPoster(null);
    setShowPosterOverlay(false);

    if (project.currentProject) {
      project.saveState({
        basePrompt: '',
        baseImageFile: null,
        visionSentence: null,
        breakdown: null,
        outputMode: 'gameplay',
        dimensions: [],
        feedback: { positive: '', negative: '' },
      });
      await poster.deletePoster(project.currentProject.id);
    }
  }, [simulator, prompts, imageGen, project, poster]);

  return {
    project,
    poster,
    isInitialized,
    savedPromptIds,
    setSavedPromptIds,
    showPosterOverlay,
    setShowPosterOverlay,
    submittedForGenerationRef,
    handleProjectSelect,
    handleProjectCreate,
    handleResetProject,
  };
}
