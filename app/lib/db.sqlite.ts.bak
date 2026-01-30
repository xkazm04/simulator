/**
 * SQLite Database Connection for Simulator Projects
 *
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 * Database is stored in data/simulator.db
 * Includes automatic migration system for schema versioning.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { MigrationRunner, migrations } from './migrations';

// Database path
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'simulator.db');

// Singleton database instance
let db: Database.Database | null = null;
let migrationRunner: MigrationRunner | null = null;

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

  // Run migrations
  runMigrations(db);

  return db;
}

/**
 * Get the migration runner instance
 */
export function getMigrationRunner(): MigrationRunner {
  if (!migrationRunner) {
    const database = getDb();
    migrationRunner = new MigrationRunner(database, {
      logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    });
    migrationRunner.registerMigrations(migrations);
  }
  return migrationRunner;
}

/**
 * Run database migrations
 */
function runMigrations(database: Database.Database): void {
  try {
    const runner = new MigrationRunner(database, {
      logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    });
    runner.registerMigrations(migrations);

    // Check for pending migrations
    const status = runner.getStatus();
    if (status.pendingCount > 0) {
      console.info(`[db] Running ${status.pendingCount} pending migration(s)...`);
      const results = runner.runPending();

      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        console.error('[db] Some migrations failed:', failed.map((f) => `${f.version}: ${f.error}`));
      } else {
        console.info(`[db] All migrations completed successfully`);
      }
    }

    // Store runner for later use
    migrationRunner = runner;
  } catch (error) {
    console.error('[db] Migration error:', error);
    // Don't throw - let the app continue with existing schema
  }
}

/**
 * Get migration status
 */
export function getMigrationStatus(): {
  currentVersion: string | null;
  pendingCount: number;
  appliedCount: number;
  pendingMigrations: Array<{ version: string; name: string }>;
  appliedMigrations: Array<{ version: string; name: string; appliedAt: string }>;
} {
  const runner = getMigrationRunner();
  return runner.getStatus();
}

/**
 * Manually trigger pending migrations
 */
export function runPendingMigrations(): {
  success: boolean;
  results: Array<{
    version: string;
    name: string;
    success: boolean;
    error?: string;
  }>;
} {
  const runner = getMigrationRunner();
  const results = runner.runPending();
  return {
    success: results.every((r) => r.success),
    results: results.map((r) => ({
      version: r.version,
      name: r.name,
      success: r.success,
      error: r.error,
    })),
  };
}

/**
 * Rollback to a specific version
 */
export function rollbackMigration(targetVersion?: string): {
  success: boolean;
  results: Array<{
    version: string;
    name: string;
    success: boolean;
    error?: string;
  }>;
} {
  const runner = getMigrationRunner();
  const results = runner.rollback(targetVersion);
  return {
    success: results.every((r) => r.success),
    results: results.map((r) => ({
      version: r.version,
      name: r.name,
      success: r.success,
      error: r.error,
    })),
  };
}

/**
 * Get migration history
 */
export function getMigrationHistory(limit = 50) {
  const runner = getMigrationRunner();
  return runner.getHistory(limit);
}

/**
 * Verify migration checksums
 */
export function verifyMigrationChecksums() {
  const runner = getMigrationRunner();
  return runner.verifyChecksums();
}

/**
 * Close database connection (for cleanup)
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    migrationRunner = null;
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
  vision_sentence: string | null;
  breakdown_json: string | null;  // Smart Breakdown result (format, keyElements, reasoning)
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
  video_url: string | null;
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

export interface DbProjectMetadata {
  project_id: string;
  tags_json: string | null;
  category: string | null;
  is_favorite: number; // 0 or 1 in SQLite
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

// Project with full state
export interface ProjectWithState extends DbProject {
  state: DbProjectState | null;
  panelImages: DbPanelImage[];
  poster?: DbProjectPoster | null;
  prototypes?: DbInteractivePrototype[];
  generatedPrompts?: DbGeneratedPrompt[];
  metadata?: DbProjectMetadata | null;
}
