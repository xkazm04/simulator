/**
 * useProject - Hook for project persistence
 *
 * Composes usePersistedEntity with project-specific logic:
 * - Loading and listing projects
 * - Creating and deleting projects
 * - Selecting active project
 * - Autosave with debouncing
 * - Panel image management
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Dimension, OutputMode, SavedPanelImage, ProjectPoster, GeneratedPrompt } from '../types';
import { usePersistedEntity, SaveStatus } from './usePersistedEntity';

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ProjectState {
  basePrompt: string;
  baseImageFile: string | null;
  visionSentence: string | null;
  breakdown: { baseImage: { format: string; keyElements: string[] }; reasoning: string } | null;
  outputMode: OutputMode;
  dimensions: Dimension[];
  feedback: { positive: string; negative: string };
}

interface ProjectWithState extends Project {
  state: ProjectState | null;
  panelImages: SavedPanelImage[];
  poster: ProjectPoster | null;
  generatedPrompts: GeneratedPrompt[];
}

interface UseProjectReturn {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  // Save status for UI feedback
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;

  /** True when project state is being restored (prevents autosave race conditions) */
  isRestoring: boolean;
  /** Set restoration state - call with true before restoring, false after */
  setIsRestoring: (value: boolean) => void;

  // CRUD operations
  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<Project | null>;
  selectProject: (id: string) => Promise<ProjectWithState | null>;
  deleteProject: (id: string) => Promise<boolean>;
  renameProject: (id: string, newName: string) => Promise<boolean>;
  duplicateProject: (id: string) => Promise<Project | null>;

  // Autosave
  saveState: (state: Partial<ProjectState>) => void;
  savePanelImage: (side: 'left' | 'right', slotIndex: number, imageUrl: string, prompt?: string) => Promise<void>;
  removePanelImage: (imageId: string) => Promise<void>;

  // Generated prompts persistence
  saveGeneratedPrompts: (prompts: GeneratedPrompt[]) => Promise<void>;
  updateGeneratedPrompt: (promptId: string, updates: Partial<GeneratedPrompt>) => Promise<void>;
  deleteGeneratedPrompts: () => Promise<void>;
}

const AUTOSAVE_DEBOUNCE = 500; // 500ms debounce

/**
 * Parse raw API project data to Project interface
 */
function parseProject(data: unknown): Project {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    name: d.name as string,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
  };
}

/**
 * Parse raw API response to ProjectWithState (for selectProject)
 */
/**
 * Helper to parse JSONB field - Supabase returns objects, but SQLite returned strings
 */
function parseJsonField<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function parseProjectWithState(projectWithState: Record<string, unknown>): ProjectWithState {
  // Parse JSON fields (handle both Supabase JSONB objects and SQLite TEXT strings)
  const rawState = projectWithState.state as Record<string, unknown> | null;
  const state: ProjectState | null = rawState
    ? {
        basePrompt: (rawState.base_prompt as string) || '',
        baseImageFile: (rawState.base_image_file as string) || null,
        visionSentence: (rawState.vision_sentence as string) || null,
        breakdown: parseJsonField(rawState.breakdown_json, null),
        outputMode: ((rawState.output_mode as string) || 'gameplay') as OutputMode,
        dimensions: parseJsonField(rawState.dimensions_json, []),
        feedback: parseJsonField(rawState.feedback_json, { positive: '', negative: '' }),
      }
    : null;

  // Convert panel images
  const rawPanelImages = (projectWithState.panelImages || []) as Array<{
    id: string;
    side: string;
    slot_index: number;
    image_url: string;
    video_url: string | null;
    prompt: string | null;
    created_at: string;
  }>;
  const panelImages: SavedPanelImage[] = rawPanelImages.map((img) => ({
    id: img.id,
    url: img.image_url,
    videoUrl: img.video_url || undefined,
    prompt: img.prompt || '',
    side: img.side as 'left' | 'right',
    slotIndex: img.slot_index,
    createdAt: img.created_at,
  }));

  // Convert poster (if exists)
  const rawPoster = projectWithState.poster as {
    id: string;
    project_id: string;
    image_url: string;
    prompt: string | null;
    dimensions_json: string | null;
    created_at: string;
  } | null;
  const poster: ProjectPoster | null = rawPoster
    ? {
        id: rawPoster.id,
        projectId: rawPoster.project_id,
        imageUrl: rawPoster.image_url,
        prompt: rawPoster.prompt || '',
        dimensionsJson: rawPoster.dimensions_json || '',
        createdAt: rawPoster.created_at,
      }
    : null;

  // Convert generated prompts (if exists)
  const rawGeneratedPrompts = (projectWithState.generatedPrompts || []) as Array<{
    id: string;
    scene_number: number;
    scene_type: string;
    prompt: string;
    copied: boolean | number;
    rating: 'up' | 'down' | null;
    locked: boolean | number;
    elements_json: unknown;
    created_at: string;
  }>;
  const generatedPrompts: GeneratedPrompt[] = rawGeneratedPrompts.map((p) => ({
    id: p.id,
    sceneNumber: p.scene_number,
    sceneType: p.scene_type,
    prompt: p.prompt,
    copied: Boolean(p.copied),
    rating: p.rating,
    locked: Boolean(p.locked),
    elements: parseJsonField(p.elements_json, []),
  }));

  return {
    id: projectWithState.id as string,
    name: projectWithState.name as string,
    created_at: projectWithState.created_at as string,
    updated_at: projectWithState.updated_at as string,
    state,
    panelImages,
    poster,
    generatedPrompts,
  };
}

export function useProject(): UseProjectReturn {
  // Track currently selected project separately (for panel image operations)
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Track when project state is being restored (to prevent autosave race conditions)
  const [isRestoring, setIsRestoring] = useState(false);

  // Refs for direct autosave (bypassing usePersistedEntity race condition)
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<Partial<ProjectState> | null>(null);

  // Use the generic persisted entity hook for core CRUD
  const projectEntity = usePersistedEntity<Project, { name: string }, Partial<ProjectState>>({
    api: {
      baseEndpoint: '/api/projects',
      parseResponse: parseProject,
    },
    autosaveDebounce: AUTOSAVE_DEBOUNCE,
    enableAutosave: true,
  });

  /**
   * Load all projects
   */
  const loadProjects = useCallback(async () => {
    await projectEntity.loadAll();
  }, [projectEntity.loadAll]);

  /**
   * Create a new project
   */
  const createProject = useCallback(async (name: string): Promise<Project | null> => {
    const created = await projectEntity.create({ name });
    if (created) {
      setCurrentProject(created);
    }
    return created;
  }, [projectEntity.create]);

  /**
   * Select a project and load its full state
   * This needs custom handling for the complex state structure
   */
  const selectProject = useCallback(async (id: string): Promise<ProjectWithState | null> => {
    console.log('[selectProject] Attempting to select project with id:', id, 'type:', typeof id);

    if (!id || typeof id !== 'string') {
      console.error('[selectProject] Invalid project ID:', id);
      return null;
    }

    try {
      const response = await fetch(`/api/projects/${id}`, { cache: 'no-store' });
      const data = await response.json();
      console.log('[selectProject] API response:', { success: data.success, hasProject: !!data.project, error: data.error });

      if (data.success) {
        const projectWithState = parseProjectWithState(data.project);

        // Update current project
        setCurrentProject({
          id: projectWithState.id,
          name: projectWithState.name,
          created_at: projectWithState.created_at,
          updated_at: projectWithState.updated_at,
        });

        // Update entity in the persisted entity hook
        projectEntity.setEntity({
          id: projectWithState.id,
          name: projectWithState.name,
          created_at: projectWithState.created_at,
          updated_at: projectWithState.updated_at,
        });

        return projectWithState;
      } else {
        console.error('Failed to load project:', data.error);
        return null;
      }
    } catch (err) {
      console.error('Network error loading project');
      return null;
    }
  }, [projectEntity.setEntity]);

  /**
   * Delete a project
   */
  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    const success = await projectEntity.remove(id);
    if (success && currentProject?.id === id) {
      setCurrentProject(null);
    }
    return success;
  }, [projectEntity.remove, currentProject?.id]);

  /**
   * Rename a project
   */
  const renameProject = useCallback(async (id: string, newName: string): Promise<boolean> => {
    if (!newName.trim()) return false;

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the entities list
        projectEntity.setEntities(
          projectEntity.entities.map((p) =>
            p.id === id ? { ...p, name: newName.trim() } : p
          )
        );

        // Update current project if it's the one being renamed
        if (currentProject?.id === id) {
          setCurrentProject((prev) =>
            prev ? { ...prev, name: newName.trim() } : prev
          );
        }

        return true;
      } else {
        console.error('Failed to rename project:', data.error);
        return false;
      }
    } catch (err) {
      console.error('Rename project error:', err);
      return false;
    }
  }, [projectEntity.entities, projectEntity.setEntities, currentProject?.id]);

  /**
   * Duplicate a project with all its state
   */
  const duplicateProject = useCallback(async (id: string): Promise<Project | null> => {
    try {
      // 1. Fetch the source project's full state
      const response = await fetch(`/api/projects/${id}`, { cache: 'no-store' });
      const data = await response.json();

      if (!data.success) {
        console.error('Failed to load source project:', data.error);
        return null;
      }

      const sourceProject = parseProjectWithState(data.project);

      // 2. Create a new project with "(Copy)" suffix
      const newName = `${sourceProject.name} (Copy)`;
      const created = await projectEntity.create({ name: newName });

      if (!created) {
        console.error('Failed to create duplicate project');
        return null;
      }

      // 3. If source has state, save it to the new project
      if (sourceProject.state) {
        try {
          const saveResponse = await fetch(`/api/projects/${created.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              basePrompt: sourceProject.state.basePrompt,
              baseImageFile: sourceProject.state.baseImageFile,
              visionSentence: sourceProject.state.visionSentence,
              outputMode: sourceProject.state.outputMode,
              dimensions: sourceProject.state.dimensions,
              feedback: sourceProject.state.feedback,
            }),
          });

          const saveData = await saveResponse.json();
          if (!saveData.success) {
            console.error('Failed to save duplicated state:', saveData.error);
            // Continue anyway - project was created, just without state
          }
        } catch (err) {
          console.error('Error saving duplicated state:', err);
        }
      }

      // 4. Select the new project
      setCurrentProject(created);
      projectEntity.setEntity(created);

      return created;
    } catch (err) {
      console.error('Duplicate project error:', err);
      return null;
    }
  }, [projectEntity.create, projectEntity.setEntity]);

  /**
   * Autosave state with debouncing
   * Directly calls API to avoid usePersistedEntity ref synchronization issues
   */
  const saveState = useCallback((state: Partial<ProjectState>) => {
    if (!currentProject) {
      console.log('[useProject.saveState] No current project, skipping');
      return;
    }

    console.log('[useProject.saveState] Saving state for project:', currentProject.id, state);

    // Merge with pending state
    pendingStateRef.current = { ...pendingStateRef.current, ...state };

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Debounced save - directly call API
    const projectId = currentProject.id;
    autosaveTimerRef.current = setTimeout(async () => {
      const pendingState = pendingStateRef.current;
      pendingStateRef.current = null;

      if (pendingState && projectId) {
        console.log('[useProject.saveState] Making API call to save:', pendingState);
        try {
          const response = await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pendingState),
          });
          const result = await response.json();
          console.log('[useProject.saveState] API response:', result);
        } catch (err) {
          console.error('[useProject] Autosave error:', err);
        }
      }
    }, AUTOSAVE_DEBOUNCE);
  }, [currentProject]);

  /**
   * Save a panel image
   */
  const savePanelImage = useCallback(
    async (side: 'left' | 'right', slotIndex: number, imageUrl: string, prompt?: string) => {
      if (!currentProject) return;

      try {
        const response = await fetch(`/api/projects/${currentProject.id}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ side, slotIndex, imageUrl, prompt }),
        });

        const data = await response.json();
        if (!data.success) {
          console.error('Failed to save panel image:', data.error);
        }
      } catch (err) {
        console.error('Save panel image error:', err);
      }
    },
    [currentProject]
  );

  /**
   * Remove a panel image
   */
  const removePanelImage = useCallback(
    async (imageId: string) => {
      if (!currentProject) return;

      try {
        const response = await fetch(`/api/projects/${currentProject.id}/images`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId }),
        });

        const data = await response.json();
        if (!data.success) {
          console.error('Failed to remove panel image:', data.error);
        }
      } catch (err) {
        console.error('Remove panel image error:', err);
      }
    },
    [currentProject]
  );

  /**
   * Save generated prompts (replaces all existing)
   */
  const saveGeneratedPrompts = useCallback(
    async (prompts: GeneratedPrompt[]) => {
      if (!currentProject) return;

      try {
        const response = await fetch(`/api/projects/${currentProject.id}/prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompts }),
        });

        const data = await response.json();
        if (!data.success) {
          console.error('Failed to save generated prompts:', data.error);
        }
      } catch (err) {
        console.error('Save generated prompts error:', err);
      }
    },
    [currentProject]
  );

  /**
   * Update a single generated prompt
   */
  const updateGeneratedPrompt = useCallback(
    async (promptId: string, updates: Partial<GeneratedPrompt>) => {
      if (!currentProject) return;

      try {
        const response = await fetch(`/api/projects/${currentProject.id}/prompts`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptId, updates }),
        });

        const data = await response.json();
        if (!data.success) {
          console.error('Failed to update generated prompt:', data.error);
        }
      } catch (err) {
        console.error('Update generated prompt error:', err);
      }
    },
    [currentProject]
  );

  /**
   * Delete all generated prompts for the current project
   */
  const deleteGeneratedPrompts = useCallback(
    async () => {
      if (!currentProject) return;

      try {
        const response = await fetch(`/api/projects/${currentProject.id}/prompts`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        const data = await response.json();
        if (!data.success) {
          console.error('Failed to delete generated prompts:', data.error);
        }
      } catch (err) {
        console.error('Delete generated prompts error:', err);
      }
    },
    [currentProject]
  );

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // Memoized return to prevent unnecessary re-renders
  return useMemo(() => ({
    projects: projectEntity.entities,
    currentProject,
    isLoading: projectEntity.isLoading,
    error: projectEntity.error,
    saveStatus: projectEntity.saveStatus,
    lastSavedAt: projectEntity.lastSavedAt,
    isRestoring,
    setIsRestoring,
    loadProjects,
    createProject,
    selectProject,
    deleteProject,
    renameProject,
    duplicateProject,
    saveState,
    savePanelImage,
    removePanelImage,
    saveGeneratedPrompts,
    updateGeneratedPrompt,
    deleteGeneratedPrompts,
  }), [
    projectEntity.entities,
    projectEntity.isLoading,
    projectEntity.error,
    projectEntity.saveStatus,
    projectEntity.lastSavedAt,
    currentProject,
    isRestoring,
    loadProjects,
    createProject,
    selectProject,
    deleteProject,
    renameProject,
    duplicateProject,
    saveState,
    savePanelImage,
    removePanelImage,
    saveGeneratedPrompts,
    updateGeneratedPrompt,
    deleteGeneratedPrompts,
  ]);
}
