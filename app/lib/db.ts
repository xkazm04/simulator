/**
 * SQLite Database Connection for Simulator Projects
 *
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 * Database is stored in data/simulator.db
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database path
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'simulator.db');
const SCHEMA_PATH = path.join(process.cwd(), 'db', 'simulator-schema.sql');

// Singleton database instance
let db: Database.Database | null = null;

/**
 * Get or create the database instance
 */
export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Create/open database
  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Initialize schema if needed
  initializeSchema(db);

  return db;
}

/**
 * Initialize database schema
 */
function initializeSchema(database: Database.Database): void {
  // Check if projects table exists
  const projectsTableExists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'"
  ).get();

  if (!projectsTableExists) {
    // Read and execute full schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    database.exec(schema);
  } else {
    // Check if project_posters table exists (added later)
    const postersTableExists = database.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='project_posters'"
    ).get();

    if (!postersTableExists) {
      // Add the project_posters table to existing database
      database.exec(`
        CREATE TABLE IF NOT EXISTS project_posters (
          id TEXT PRIMARY KEY,
          project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
          image_url TEXT NOT NULL,
          prompt TEXT,
          dimensions_json TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(project_id)
        );
        CREATE INDEX IF NOT EXISTS idx_project_posters_project ON project_posters(project_id);
      `);
    }

    // Check if interactive_prototypes table exists (added for full state persistence)
    const prototypesTableExists = database.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='interactive_prototypes'"
    ).get();

    if (!prototypesTableExists) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS interactive_prototypes (
          id TEXT PRIMARY KEY,
          project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
          prompt_id TEXT NOT NULL,
          image_id TEXT,
          mode TEXT NOT NULL CHECK(mode IN ('static', 'webgl', 'clickable', 'trailer')),
          status TEXT NOT NULL CHECK(status IN ('pending', 'generating', 'ready', 'failed')),
          error TEXT,
          config_json TEXT,
          assets_json TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(project_id, prompt_id)
        );
        CREATE INDEX IF NOT EXISTS idx_interactive_prototypes_project ON interactive_prototypes(project_id);
      `);
    }

    // Check if generated_prompts table exists (added for session state persistence)
    const promptsTableExists = database.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='generated_prompts'"
    ).get();

    if (!promptsTableExists) {
      database.exec(`
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
          elements_json TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_generated_prompts_project ON generated_prompts(project_id);
      `);
    }
  }
}

/**
 * Close database connection (for cleanup)
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Type definitions for database models

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
  output_mode: string;
  dimensions_json: string | null;
  feedback_json: string | null;
  updated_at: string;
}

export interface DbPanelImage {
  id: string;
  project_id: string;
  side: 'left' | 'right';
  slot_index: number;
  image_url: string;
  prompt: string | null;
  created_at: string;
}

export interface DbProjectPoster {
  id: string;
  project_id: string;
  image_url: string;
  prompt: string | null;
  dimensions_json: string | null;
  created_at: string;
}

export interface DbInteractivePrototype {
  id: string;
  project_id: string;
  prompt_id: string;
  image_id: string | null;
  mode: 'static' | 'webgl' | 'clickable';
  status: 'pending' | 'generating' | 'ready' | 'failed';
  error: string | null;
  config_json: string | null;
  assets_json: string | null;
  created_at: string;
}

export interface DbGeneratedPrompt {
  id: string;
  project_id: string;
  scene_number: number;
  scene_type: string;
  prompt: string;
  negative_prompt: string | null;
  copied: number; // 0 or 1 in SQLite
  rating: 'up' | 'down' | null;
  locked: number; // 0 or 1 in SQLite
  elements_json: string | null;
  created_at: string;
}

// Project with full state
export interface ProjectWithState extends DbProject {
  state: DbProjectState | null;
  panelImages: DbPanelImage[];
  poster?: DbProjectPoster | null;
  prototypes?: DbInteractivePrototype[];
  generatedPrompts?: DbGeneratedPrompt[];
}
