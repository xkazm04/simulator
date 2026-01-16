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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_panel_images_project ON panel_images(project_id);
CREATE INDEX IF NOT EXISTS idx_project_state_project ON project_state(project_id);
CREATE INDEX IF NOT EXISTS idx_project_posters_project ON project_posters(project_id);
