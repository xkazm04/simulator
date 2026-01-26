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
import { useProject } from './useProject';
import { usePoster } from './usePoster';
import { useImageGeneration } from './useImageGeneration';
import { useDimensionsContext } from '../subfeature_dimensions';
import { useBrainContext } from '../subfeature_brain';
import { useSimulatorContext } from '../SimulatorContext';

interface ProjectState {
  basePrompt: string;
  baseImageFile: string | null;
  outputMode: OutputMode;
  dimensions: Dimension[];
  feedback: { positive: string; negative: string };
}

interface UseProjectManagerOptions {
  imageGen: ReturnType<typeof useImageGeneration>;
}

export function useProjectManager({ imageGen }: UseProjectManagerOptions) {
  const project = useProject();
  const poster = usePoster();
  const dimensions = useDimensionsContext();
  const brain = useBrainContext();
  const simulator = useSimulatorContext();

  const [isInitialized, setIsInitialized] = useState(false);
  const [savedPromptIds, setSavedPromptIds] = useState<Set<string>>(new Set());
  const [showPosterOverlay, setShowPosterOverlay] = useState(false);

  // Track which prompt IDs have been submitted for image generation
  const submittedForGenerationRef = useRef<Set<string>>(new Set());

  // Helper to restore project state to simulator contexts
  const restoreProjectState = useCallback((state: ProjectState) => {
    simulator.handleReset();
    if (state.basePrompt) {
      brain.setBaseImage(state.basePrompt);
    }
    if (state.baseImageFile) {
      brain.setBaseImageFile(state.baseImageFile);
    }
    if (state.outputMode) {
      brain.setOutputMode(state.outputMode);
    }
    if (state.dimensions?.length > 0) {
      dimensions.setDimensions(state.dimensions);
    }
    if (state.feedback) {
      brain.setFeedback(state.feedback);
    }
  }, [simulator, brain, dimensions]);

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

  // Auto-select first project
  useEffect(() => {
    const selectFirstProject = async () => {
      if (isInitialized && project.projects.length > 0 && !project.currentProject && !project.isLoading) {
        const projectWithState = await project.selectProject(project.projects[0].id);
        if (projectWithState?.state) {
          restoreProjectState(projectWithState.state);
        }
        poster.setPoster(projectWithState?.poster || null);
      }
    };
    selectFirstProject();
  }, [isInitialized, project.projects.length, project.currentProject?.id, project.isLoading, project.selectProject, restoreProjectState, poster]);

  // Handle project selection
  const handleProjectSelect = useCallback(async (projectId: string) => {
    const projectWithState = await project.selectProject(projectId);
    if (projectWithState?.state) {
      restoreProjectState(projectWithState.state);
    } else {
      simulator.handleReset();
    }
    imageGen.clearGeneratedImages();
    setSavedPromptIds(new Set());
    submittedForGenerationRef.current.clear();
    poster.setPoster(projectWithState?.poster || null);
    setShowPosterOverlay(false);
  }, [project, simulator, restoreProjectState, imageGen, poster]);

  // Handle project creation
  const handleProjectCreate = useCallback(async (name: string) => {
    const newProject = await project.createProject(name);
    if (newProject) {
      simulator.handleReset();
      imageGen.clearGeneratedImages();
      setSavedPromptIds(new Set());
      submittedForGenerationRef.current.clear();
      poster.setPoster(null);
      setShowPosterOverlay(false);
    }
  }, [project, simulator, imageGen, poster]);

  // Handle project reset
  const handleResetProject = useCallback(async () => {
    simulator.handleReset();
    imageGen.clearGeneratedImages();
    setSavedPromptIds(new Set());
    submittedForGenerationRef.current.clear();
    poster.setPoster(null);
    setShowPosterOverlay(false);

    if (project.currentProject) {
      project.saveState({
        basePrompt: '',
        baseImageFile: null,
        outputMode: 'gameplay',
        dimensions: [],
        feedback: { positive: '', negative: '' },
      });
      await poster.deletePoster(project.currentProject.id);
    }
  }, [simulator, imageGen, project, poster]);

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
