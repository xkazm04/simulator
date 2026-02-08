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
  DbProjectWhatif,
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
 * Handles missing related records gracefully
 */
export async function fetchProjectWithState(
  supabase: SupabaseClient,
  id: string
): Promise<ProjectWithState | null> {
  const project = await fetchProject(supabase, id);
  if (!project) return null;

  // Use maybeSingle() instead of single() to handle missing records gracefully
  const [stateResult, panelImagesResult, posterResult, prototypesResult, promptsResult, whatifResult] = await Promise.all([
    supabase.from(TABLES.projectState).select('*').eq('project_id', id).maybeSingle(),
    supabase.from(TABLES.panelImages).select('*').eq('project_id', id).order('side').order('slot_index'),
    supabase.from(TABLES.projectPosters).select('*').eq('project_id', id).maybeSingle(),
    supabase.from(TABLES.interactivePrototypes).select('*').eq('project_id', id),
    supabase.from(TABLES.generatedPrompts).select('*').eq('project_id', id).order('scene_number'),
    supabase.from(TABLES.projectWhatifs).select('*').eq('project_id', id).order('display_order'),
  ]);

  return {
    ...project,
    state: (stateResult.data as DbProjectState) || null,
    panelImages: (panelImagesResult.data as DbPanelImage[]) || [],
    poster: (posterResult.data as DbProjectPoster) || null,
    prototypes: (prototypesResult.data as DbInteractivePrototype[]) || [],
    generatedPrompts: (promptsResult.data as DbGeneratedPrompt[]) || [],
    whatifs: (whatifResult.data as DbProjectWhatif[]) || [],
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

  console.log('[buildStateUpdate] Input body keys:', Object.keys(body));
  console.log('[buildStateUpdate] Input body:', body);

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (body[key] !== undefined) {
      stateUpdate[dbField] = body[key];
      console.log(`[buildStateUpdate] Mapping ${key} -> ${dbField}:`, body[key]);
    } else {
      console.log(`[buildStateUpdate] Skipping ${key} (undefined)`);
    }
  }

  console.log('[buildStateUpdate] Final stateUpdate:', stateUpdate);
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

/**
 * Ensure project state exists (create if missing)
 */
export async function ensureProjectState(
  supabase: SupabaseClient,
  projectId: string
): Promise<boolean> {
  const { data: existing } = await supabase
    .from(TABLES.projectState)
    .select('project_id')
    .eq('project_id', projectId)
    .maybeSingle();

  if (existing) return true;

  const { error } = await supabase.from(TABLES.projectState).insert({
    project_id: projectId,
    base_prompt: '',
    output_mode: 'gameplay',
    dimensions_json: [],
    feedback_json: { positive: '', negative: '' },
    updated_at: new Date().toISOString(),
  });

  return !error;
}
