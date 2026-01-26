-- Simulator Project Database Schema
-- SQLite database for storing projects with dimensions, prompts, and saved images

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Project state (current dimensions, base prompt, output mode)
CREATE TABLE IF NOT EXISTS project_state (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  base_prompt TEXT,
  base_image_file TEXT,  -- Data URL of uploaded image
  output_mode TEXT DEFAULT 'gameplay',
  dimensions_json TEXT,  -- JSON serialized dimensions array
  feedback_json TEXT,    -- JSON serialized feedback object
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Saved panel images
CREATE TABLE IF NOT EXISTS panel_images (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  side TEXT CHECK(side IN ('left', 'right')),
  slot_index INTEGER CHECK(slot_index >= 0 AND slot_index < 5),
  image_url TEXT NOT NULL,
  video_url TEXT,  -- Generated video URL from Seedance
  prompt TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, side, slot_index)
);

-- Project posters (one per project)
CREATE TABLE IF NOT EXISTS project_posters (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  prompt TEXT,
  dimensions_json TEXT,  -- Snapshot of dimensions used
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id)  -- One poster per project
);

-- Interactive prototypes (persisted per project)
CREATE TABLE IF NOT EXISTS interactive_prototypes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL,
  image_id TEXT,
  mode TEXT NOT NULL CHECK(mode IN ('static', 'webgl', 'clickable', 'trailer')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'generating', 'ready', 'failed')),
  error TEXT,
  config_json TEXT,       -- JSON: WebGLSceneConfig | TrailerConfig | { regions: InteractiveRegion[] }
  assets_json TEXT,       -- JSON: { thumbnail?, sceneData?, videoUrl?, regions? }
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, prompt_id)  -- One prototype per prompt per project
);

-- Generated prompts (session state per project)
CREATE TABLE IF NOT EXISTS generated_prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  scene_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  copied INTEGER DEFAULT 0,
  rating TEXT CHECK(rating IN ('up', 'down') OR rating IS NULL),
  locked INTEGER DEFAULT 0,
  elements_json TEXT,     -- JSON array of PromptElement
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_panel_images_project ON panel_images(project_id);
CREATE INDEX IF NOT EXISTS idx_project_state_project ON project_state(project_id);
CREATE INDEX IF NOT EXISTS idx_project_posters_project ON project_posters(project_id);
CREATE INDEX IF NOT EXISTS idx_interactive_prototypes_project ON interactive_prototypes(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_prompts_project ON generated_prompts(project_id);
