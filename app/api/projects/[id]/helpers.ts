/**
 * Project API Helpers
 * Shared utilities for project operations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  TABLES,
  DbProject,
  DbProjectState,
  DbPanelImage,
  DbProjectPoster,
  DbInteractivePrototype,
  DbGeneratedPrompt,
  ProjectWithState,
} from '@/app/lib/supabase';

/**
 * Fetch a project by ID with validation
 */
export async function fetchProject(
  supabase: SupabaseClient,
  id: string
): Promise<DbProject | null> {
  const { data, error } = await supabase
    .from(TABLES.projects)
    .select('id, name, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as DbProject;
}

/**
 * Fetch full project with all related data
 */
export async function fetchProjectWithState(
  supabase: SupabaseClient,
  id: string
): Promise<ProjectWithState | null> {
  const project = await fetchProject(supabase, id);
  if (!project) return null;

  const [state, panelImages, poster, prototypes, generatedPrompts] = await Promise.all([
    supabase.from(TABLES.projectState).select('*').eq('project_id', id).single(),
    supabase.from(TABLES.panelImages).select('*').eq('project_id', id).order('side').order('slot_index'),
    supabase.from(TABLES.projectPosters).select('*').eq('project_id', id).single(),
    supabase.from(TABLES.interactivePrototypes).select('*').eq('project_id', id),
    supabase.from(TABLES.generatedPrompts).select('*').eq('project_id', id).order('scene_number'),
  ]);

  return {
    ...project,
    state: (state.data as DbProjectState) || null,
    panelImages: (panelImages.data as DbPanelImage[]) || [],
    poster: (poster.data as DbProjectPoster) || null,
    prototypes: (prototypes.data as DbInteractivePrototype[]) || [],
    generatedPrompts: (generatedPrompts.data as DbGeneratedPrompt[]) || [],
  };
}

/**
 * Build state update object from request body
 */
export function buildStateUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const stateUpdate: Record<string, unknown> = {};

  const fieldMap: Record<string, string> = {
    basePrompt: 'base_prompt',
    baseImageFile: 'base_image_file',
    visionSentence: 'vision_sentence',
    outputMode: 'output_mode',
    dimensions: 'dimensions_json',
    feedback: 'feedback_json',
    breakdown: 'breakdown_json',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (body[key] !== undefined) {
      stateUpdate[dbField] = body[key];
    }
  }

  return stateUpdate;
}

/**
 * Update project timestamp
 */
export async function touchProject(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase
    .from(TABLES.projects)
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);
}
