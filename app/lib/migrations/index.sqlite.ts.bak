/**
 * Migration System Entry Point
 * Re-exports all migration functionality and defines all migrations.
 */

export { MigrationRunner, defineMigration, generateMigrationVersion } from './runner';
export type {
  Migration,
  MigrationRecord,
  MigrationResult,
  MigrationOptions,
  MigrationHistoryEntry,
  MigrationConfig,
} from './types';

import type { Migration } from './types';

/**
 * All database migrations in order.
 * Add new migrations to the end of this array.
 */
export const migrations: Migration[] = [
  // ==========================================================================
  // 001 - Baseline schema (initial state of all existing tables)
  // ==========================================================================
  {
    version: '20240101_000000',
    name: 'baseline_schema',
    up: `
      -- This migration establishes the baseline schema.
      -- All tables should already exist from the initial setup.
      -- This just marks the starting point for migration tracking.

      -- Projects table
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Project state
      CREATE TABLE IF NOT EXISTS project_state (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        base_prompt TEXT,
        base_image_file TEXT,
        vision_sentence TEXT,
        breakdown_json TEXT,
        output_mode TEXT DEFAULT 'gameplay',
        dimensions_json TEXT,
        feedback_json TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Panel images
      CREATE TABLE IF NOT EXISTS panel_images (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        side TEXT CHECK(side IN ('left', 'right')),
        slot_index INTEGER CHECK(slot_index >= 0 AND slot_index < 5),
        image_url TEXT NOT NULL,
        video_url TEXT,
        prompt TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(project_id, side, slot_index)
      );

      -- Project posters
      CREATE TABLE IF NOT EXISTS project_posters (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        prompt TEXT,
        dimensions_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(project_id)
      );

      -- Interactive prototypes
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

      -- Generated prompts
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

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_panel_images_project ON panel_images(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_state_project ON project_state(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_posters_project ON project_posters(project_id);
      CREATE INDEX IF NOT EXISTS idx_interactive_prototypes_project ON interactive_prototypes(project_id);
      CREATE INDEX IF NOT EXISTS idx_generated_prompts_project ON generated_prompts(project_id);
    `,
    down: `
      -- Cannot rollback baseline - would destroy all data
      -- This is intentional - baseline should never be rolled back
      SELECT 1;
    `,
  },

  // ==========================================================================
  // 002 - Add project metadata table for tags and categories
  // ==========================================================================
  {
    version: '20240115_000000',
    name: 'add_project_metadata',
    up: `
      CREATE TABLE IF NOT EXISTS project_metadata (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        tags_json TEXT,
        category TEXT,
        is_favorite INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        last_viewed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_project_metadata_category ON project_metadata(category);
      CREATE INDEX IF NOT EXISTS idx_project_metadata_favorite ON project_metadata(is_favorite);
    `,
    down: `
      DROP INDEX IF EXISTS idx_project_metadata_favorite;
      DROP INDEX IF EXISTS idx_project_metadata_category;
      DROP TABLE IF EXISTS project_metadata;
    `,
  },

  // ==========================================================================
  // 003 - Add session tracking for analytics
  // ==========================================================================
  {
    version: '20240201_000000',
    name: 'add_session_tracking',
    up: `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT DEFAULT (datetime('now')),
        ended_at TEXT,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        actions_count INTEGER DEFAULT 0,
        generations_count INTEGER DEFAULT 0,
        duration_seconds INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
    `,
    down: `
      DROP INDEX IF EXISTS idx_sessions_started;
      DROP INDEX IF EXISTS idx_sessions_project;
      DROP TABLE IF EXISTS sessions;
    `,
  },

];

/**
 * Get a specific migration by version
 */
export function getMigration(version: string): Migration | undefined {
  return migrations.find((m) => m.version === version);
}

/**
 * Get pending migrations (not yet applied)
 */
export function getPendingMigrations(appliedVersions: string[]): Migration[] {
  const applied = new Set(appliedVersions);
  return migrations.filter((m) => !applied.has(m.version));
}
