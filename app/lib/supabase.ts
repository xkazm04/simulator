/**
 * Supabase Client for Simulator Projects
 *
 * Replaces better-sqlite3 for serverless deployment on Vercel.
 * Uses Supabase PostgreSQL as the backend database.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Table Names (prefixed to avoid conflicts with other apps)
// =============================================================================
export const TABLES = {
  projects: 'simulator_projects',
  projectState: 'simulator_project_state',
  panelImages: 'simulator_panel_images',
  projectPosters: 'simulator_project_posters',
  projectWhatifs: 'simulator_project_whatifs',
  interactivePrototypes: 'simulator_interactive_prototypes',
  generatedPrompts: 'simulator_generated_prompts',
  projectMetadata: 'simulator_project_metadata',
  sessions: 'simulator_sessions',
} as const;

// =============================================================================
// Environment & Client Setup
// =============================================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

/** Get Supabase client for browser/client-side use */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  return browserClient;
}

/** Get Supabase client for server-side use (bypasses RLS) */
export function getSupabaseServerClient(): SupabaseClient {
  if (serverClient) return serverClient;
  const key = supabaseServiceKey || supabaseAnonKey;
  serverClient = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serverClient;
}

/** Alias for backward compatibility */
export function getDb(): SupabaseClient {
  return getSupabaseServerClient();
}

/** Check database connectivity */
export async function checkConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const client = getSupabaseServerClient();
    const { error } = await client.from(TABLES.projects).select('id').limit(1);
    if (error && error.code !== '42P01') {
      return { connected: false, error: error.message };
    }
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// =============================================================================
// Type Definitions
// =============================================================================
export interface DbProject {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface DbProjectState {
  project_id: string;
  base_prompt: string | null;
  base_image_file: string | null;
  vision_sentence: string | null;
  breakdown_json: Record<string, unknown> | null;
  output_mode: string;
  dimensions_json: Record<string, unknown>[] | null;
  feedback_json: Record<string, unknown> | null;
  updated_at: string;
}

export interface DbPanelImage {
  id: string;
  project_id: string;
  side: 'left' | 'right';
  slot_index: number;
  image_url: string;
  video_url: string | null;
  prompt: string | null;
  type: 'gameplay' | 'trailer' | 'sketch' | 'poster' | 'realistic' | null;
  created_at: string;
}

export interface DbProjectPoster {
  id: string;
  project_id: string;
  image_url: string;
  prompt: string | null;
  dimensions_json: Record<string, unknown>[] | null;
  created_at: string;
}

export interface DbProjectWhatif {
  id: string;
  project_id: string;
  before_image_url: string | null;
  before_caption: string | null;
  after_image_url: string | null;
  after_caption: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbInteractivePrototype {
  id: string;
  project_id: string;
  prompt_id: string;
  image_id: string | null;
  mode: 'static' | 'webgl' | 'clickable' | 'trailer';
  status: 'pending' | 'generating' | 'ready' | 'failed';
  error: string | null;
  config_json: Record<string, unknown> | null;
  assets_json: Record<string, unknown> | null;
  created_at: string;
}

export interface DbGeneratedPrompt {
  id: string;
  project_id: string;
  scene_number: number;
  scene_type: string;
  prompt: string;
  negative_prompt: string | null;
  copied: boolean;
  rating: 'up' | 'down' | null;
  locked: boolean;
  elements_json: Record<string, unknown>[] | null;
  created_at: string;
}

export interface DbProjectMetadata {
  project_id: string;
  tags_json: string[] | null;
  category: string | null;
  is_favorite: boolean;
  view_count: number;
  last_viewed_at: string | null;
}

export interface DbSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  project_id: string | null;
  actions_count: number;
  generations_count: number;
  duration_seconds: number | null;
}

export interface ProjectWithState extends DbProject {
  state: DbProjectState | null;
  panelImages: DbPanelImage[];
  poster?: DbProjectPoster | null;
  prototypes?: DbInteractivePrototype[];
  generatedPrompts?: DbGeneratedPrompt[];
  metadata?: DbProjectMetadata | null;
  whatifs?: DbProjectWhatif[];
}
