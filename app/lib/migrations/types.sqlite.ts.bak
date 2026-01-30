/**
 * Migration System Types
 * Type definitions for the database migration system.
 */

import type Database from 'better-sqlite3';

/**
 * Migration status
 */
export type MigrationStatus = 'pending' | 'applied' | 'failed' | 'rolled_back';

/**
 * A single migration definition
 */
export interface Migration {
  /** Unique version identifier (timestamp-based, e.g., "20240101_000000") */
  version: string;
  /** Human-readable description */
  name: string;
  /** SQL or function to apply the migration */
  up: string | ((db: Database.Database) => void);
  /** SQL or function to reverse the migration */
  down: string | ((db: Database.Database) => void);
}

/**
 * Record of an applied migration stored in the database
 */
export interface MigrationRecord {
  version: string;
  name: string;
  applied_at: string;
  execution_time_ms: number;
  checksum: string;
  status: MigrationStatus;
  error_message: string | null;
}

/**
 * Result of running a migration
 */
export interface MigrationResult {
  version: string;
  name: string;
  success: boolean;
  executionTimeMs: number;
  error?: string;
}

/**
 * Options for running migrations
 */
export interface MigrationOptions {
  /** Run in dry-run mode (don't actually apply) */
  dryRun?: boolean;
  /** Target version to migrate to (up or down) */
  targetVersion?: string;
  /** Force run even if checksum mismatch */
  force?: boolean;
}

/**
 * Migration history entry for logging
 */
export interface MigrationHistoryEntry {
  id: number;
  version: string;
  name: string;
  action: 'up' | 'down';
  status: 'success' | 'failed';
  execution_time_ms: number;
  error_message: string | null;
  executed_at: string;
  executed_by: string;
}

/**
 * Summary of migration status
 */
export interface MigrationStatus {
  currentVersion: string | null;
  pendingCount: number;
  appliedCount: number;
  pendingMigrations: Array<{ version: string; name: string }>;
  appliedMigrations: Array<{ version: string; name: string; appliedAt: string }>;
}

/**
 * Configuration for the migration runner
 */
export interface MigrationConfig {
  /** Directory containing migration files */
  migrationsDir?: string;
  /** Table name for tracking migrations (default: schema_versions) */
  tableName?: string;
  /** Whether to run migrations automatically on startup */
  autoRun?: boolean;
  /** Log level for migration output */
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Default configuration values
 */
export const DEFAULT_MIGRATION_CONFIG: Required<MigrationConfig> = {
  migrationsDir: 'app/lib/migrations/scripts',
  tableName: 'schema_versions',
  autoRun: true,
  logLevel: 'info',
};
