-- Migration: 001_baseline_schema
-- Description: Create all baseline tables for the simulator app
-- Created: 2025-01-30
-- Target: Supabase PostgreSQL
-- Note: All tables prefixed with 'simulator_' to avoid conflicts

-- ============================================================================
-- Projects table (core entity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulator_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Project state (current dimensions, base prompt, output mode)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulator_project_state (
  project_id TEXT PRIMARY KEY REFERENCES simulator_projects(id) ON DELETE CASCADE,
  base_prompt TEXT,
  base_image_file TEXT,
  vision_sentence TEXT,
  breakdown_json JSONB,
  output_mode TEXT DEFAULT 'gameplay',
  dimensions_json JSONB,
  feedback_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Saved panel images (left/right panels, 5 slots each)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulator_panel_images (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES simulator_projects(id) ON DELETE CASCADE,
  side TEXT CHECK(side IN ('left', 'right')),
  slot_index INTEGER CHECK(slot_index >= 0 AND slot_index < 5),
  image_url TEXT NOT NULL,
  video_url TEXT,
  prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, side, slot_index)
);

-- ============================================================================
-- Project posters (one per project)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulator_project_posters (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES simulator_projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  prompt TEXT,
  dimensions_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- ============================================================================
-- Interactive prototypes (persisted per project)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulator_interactive_prototypes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES simulator_projects(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL,
  image_id TEXT,
  mode TEXT NOT NULL CHECK(mode IN ('static', 'webgl', 'clickable', 'trailer')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'generating', 'ready', 'failed')),
  error TEXT,
  config_json JSONB,
  assets_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, prompt_id)
);

-- ============================================================================
-- Generated prompts (session state per project)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulator_generated_prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES simulator_projects(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  scene_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  copied BOOLEAN DEFAULT FALSE,
  rating TEXT CHECK(rating IN ('up', 'down') OR rating IS NULL),
  locked BOOLEAN DEFAULT FALSE,
  elements_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Project metadata (tags, favorites, analytics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulator_project_metadata (
  project_id TEXT PRIMARY KEY REFERENCES simulator_projects(id) ON DELETE CASCADE,
  tags_json JSONB,
  category TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);

-- ============================================================================
-- Sessions (analytics tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulator_sessions (
  id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  project_id TEXT REFERENCES simulator_projects(id) ON DELETE SET NULL,
  actions_count INTEGER DEFAULT 0,
  generations_count INTEGER DEFAULT 0,
  duration_seconds INTEGER
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_simulator_panel_images_project ON simulator_panel_images(project_id);
CREATE INDEX IF NOT EXISTS idx_simulator_project_state_project ON simulator_project_state(project_id);
CREATE INDEX IF NOT EXISTS idx_simulator_project_posters_project ON simulator_project_posters(project_id);
CREATE INDEX IF NOT EXISTS idx_simulator_interactive_prototypes_project ON simulator_interactive_prototypes(project_id);
CREATE INDEX IF NOT EXISTS idx_simulator_generated_prompts_project ON simulator_generated_prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_simulator_project_metadata_category ON simulator_project_metadata(category);
CREATE INDEX IF NOT EXISTS idx_simulator_project_metadata_favorite ON simulator_project_metadata(is_favorite);
CREATE INDEX IF NOT EXISTS idx_simulator_sessions_project ON simulator_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_simulator_sessions_started ON simulator_sessions(started_at);

-- ============================================================================
-- Updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION simulator_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_simulator_projects_updated_at ON simulator_projects;
CREATE TRIGGER update_simulator_projects_updated_at
  BEFORE UPDATE ON simulator_projects
  FOR EACH ROW
  EXECUTE FUNCTION simulator_update_updated_at_column();

DROP TRIGGER IF EXISTS update_simulator_project_state_updated_at ON simulator_project_state;
CREATE TRIGGER update_simulator_project_state_updated_at
  BEFORE UPDATE ON simulator_project_state
  FOR EACH ROW
  EXECUTE FUNCTION simulator_update_updated_at_column();
