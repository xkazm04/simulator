/**
 * Migration Runner
 * Handles executing, tracking, and rolling back database migrations.
 */

import type Database from 'better-sqlite3';
import crypto from 'crypto';
import type {
  Migration,
  MigrationRecord,
  MigrationResult,
  MigrationOptions,
  MigrationHistoryEntry,
  MigrationConfig,
} from './types';
import { DEFAULT_MIGRATION_CONFIG } from './types';

/**
 * MigrationRunner - Execute and track database migrations
 */
export class MigrationRunner {
  private db: Database.Database;
  private config: Required<MigrationConfig>;
  private migrations: Migration[] = [];

  constructor(db: Database.Database, config: Partial<MigrationConfig> = {}) {
    this.db = db;
    this.config = { ...DEFAULT_MIGRATION_CONFIG, ...config };
    this.ensureSchemaTable();
    this.ensureHistoryTable();
  }

  /**
   * Register migrations with the runner
   */
  registerMigrations(migrations: Migration[]): void {
    // Sort by version to ensure correct order
    this.migrations = [...migrations].sort((a, b) =>
      a.version.localeCompare(b.version)
    );
  }

  /**
   * Get migration status summary
   */
  getStatus(): {
    currentVersion: string | null;
    pendingCount: number;
    appliedCount: number;
    pendingMigrations: Array<{ version: string; name: string }>;
    appliedMigrations: Array<{ version: string; name: string; appliedAt: string }>;
  } {
    const applied = this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((m) => m.version));

    const pending = this.migrations.filter(
      (m) => !appliedVersions.has(m.version)
    );

    const currentVersion =
      applied.length > 0 ? applied[applied.length - 1].version : null;

    return {
      currentVersion,
      pendingCount: pending.length,
      appliedCount: applied.length,
      pendingMigrations: pending.map((m) => ({
        version: m.version,
        name: m.name,
      })),
      appliedMigrations: applied.map((m) => ({
        version: m.version,
        name: m.name,
        appliedAt: m.applied_at,
      })),
    };
  }

  /**
   * Run all pending migrations
   */
  runPending(options: MigrationOptions = {}): MigrationResult[] {
    const results: MigrationResult[] = [];
    const applied = this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((m) => m.version));

    // Filter to pending migrations
    let pending = this.migrations.filter(
      (m) => !appliedVersions.has(m.version)
    );

    // If target version specified, limit migrations
    if (options.targetVersion) {
      pending = pending.filter(
        (m) => m.version <= options.targetVersion!
      );
    }

    if (pending.length === 0) {
      this.log('info', 'No pending migrations to run');
      return results;
    }

    this.log('info', `Running ${pending.length} pending migration(s)...`);

    for (const migration of pending) {
      const result = this.runMigration(migration, 'up', options);
      results.push(result);

      if (!result.success) {
        this.log('error', `Migration ${migration.version} failed: ${result.error}`);
        break; // Stop on first failure
      }
    }

    return results;
  }

  /**
   * Run a single migration up
   */
  runUp(version: string, options: MigrationOptions = {}): MigrationResult {
    const migration = this.migrations.find((m) => m.version === version);
    if (!migration) {
      return {
        version,
        name: 'Unknown',
        success: false,
        executionTimeMs: 0,
        error: `Migration ${version} not found`,
      };
    }

    return this.runMigration(migration, 'up', options);
  }

  /**
   * Rollback to a specific version (or latest if no version specified)
   */
  rollback(targetVersion?: string, options: MigrationOptions = {}): MigrationResult[] {
    const results: MigrationResult[] = [];
    const applied = this.getAppliedMigrations();

    if (applied.length === 0) {
      this.log('info', 'No migrations to rollback');
      return results;
    }

    // Determine which migrations to rollback
    let toRollback: MigrationRecord[];
    if (targetVersion) {
      toRollback = applied.filter((m) => m.version > targetVersion);
    } else {
      // Rollback just the latest
      toRollback = [applied[applied.length - 1]];
    }

    // Rollback in reverse order
    toRollback.reverse();

    this.log('info', `Rolling back ${toRollback.length} migration(s)...`);

    for (const record of toRollback) {
      const migration = this.migrations.find((m) => m.version === record.version);
      if (!migration) {
        this.log('warn', `Migration ${record.version} not found in registry, skipping`);
        continue;
      }

      const result = this.runMigration(migration, 'down', options);
      results.push(result);

      if (!result.success) {
        this.log('error', `Rollback ${migration.version} failed: ${result.error}`);
        break;
      }
    }

    return results;
  }

  /**
   * Get migration history
   */
  getHistory(limit = 50): MigrationHistoryEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM migration_history
      ORDER BY executed_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as MigrationHistoryEntry[];
  }

  /**
   * Verify migration checksums match
   */
  verifyChecksums(): Array<{ version: string; expected: string; actual: string }> {
    const mismatches: Array<{ version: string; expected: string; actual: string }> = [];
    const applied = this.getAppliedMigrations();

    for (const record of applied) {
      const migration = this.migrations.find((m) => m.version === record.version);
      if (migration) {
        const currentChecksum = this.computeChecksum(migration);
        if (currentChecksum !== record.checksum) {
          mismatches.push({
            version: record.version,
            expected: record.checksum,
            actual: currentChecksum,
          });
        }
      }
    }

    return mismatches;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private ensureSchemaTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.config.tableName} (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now')),
        execution_time_ms INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'applied', 'failed', 'rolled_back')),
        error_message TEXT
      )
    `);
  }

  private ensureHistoryTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL,
        name TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('up', 'down')),
        status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
        execution_time_ms INTEGER NOT NULL,
        error_message TEXT,
        executed_at TEXT DEFAULT (datetime('now')),
        executed_by TEXT DEFAULT 'system'
      )
    `);
  }

  private getAppliedMigrations(): MigrationRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.config.tableName}
      WHERE status = 'applied'
      ORDER BY version ASC
    `);
    return stmt.all() as MigrationRecord[];
  }

  private runMigration(
    migration: Migration,
    direction: 'up' | 'down',
    options: MigrationOptions
  ): MigrationResult {
    const startTime = Date.now();

    this.log('info', `${direction === 'up' ? 'Applying' : 'Rolling back'} migration: ${migration.version} - ${migration.name}`);

    if (options.dryRun) {
      this.log('info', `[DRY RUN] Would ${direction === 'up' ? 'apply' : 'rollback'} ${migration.version}`);
      return {
        version: migration.version,
        name: migration.name,
        success: true,
        executionTimeMs: 0,
      };
    }

    const sql = direction === 'up' ? migration.up : migration.down;

    try {
      // Run in transaction
      const runMigration = this.db.transaction(() => {
        if (typeof sql === 'string') {
          this.db.exec(sql);
        } else {
          sql(this.db);
        }
      });

      runMigration();

      const executionTime = Date.now() - startTime;

      // Update tracking table
      if (direction === 'up') {
        this.recordApplied(migration, executionTime);
      } else {
        this.recordRolledBack(migration.version);
      }

      // Log to history
      this.logToHistory(migration, direction, 'success', executionTime, null);

      this.log('info', `Migration ${migration.version} ${direction === 'up' ? 'applied' : 'rolled back'} in ${executionTime}ms`);

      return {
        version: migration.version,
        name: migration.name,
        success: true,
        executionTimeMs: executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failure to history
      this.logToHistory(migration, direction, 'failed', executionTime, errorMessage);

      // Update status in tracking table
      if (direction === 'up') {
        this.recordFailed(migration, executionTime, errorMessage);
      }

      return {
        version: migration.version,
        name: migration.name,
        success: false,
        executionTimeMs: executionTime,
        error: errorMessage,
      };
    }
  }

  private recordApplied(migration: Migration, executionTime: number): void {
    const checksum = this.computeChecksum(migration);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ${this.config.tableName}
      (version, name, applied_at, execution_time_ms, checksum, status, error_message)
      VALUES (?, ?, datetime('now'), ?, ?, 'applied', NULL)
    `);
    stmt.run(migration.version, migration.name, executionTime, checksum);
  }

  private recordFailed(migration: Migration, executionTime: number, error: string): void {
    const checksum = this.computeChecksum(migration);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ${this.config.tableName}
      (version, name, applied_at, execution_time_ms, checksum, status, error_message)
      VALUES (?, ?, datetime('now'), ?, ?, 'failed', ?)
    `);
    stmt.run(migration.version, migration.name, executionTime, checksum, error);
  }

  private recordRolledBack(version: string): void {
    const stmt = this.db.prepare(`
      UPDATE ${this.config.tableName}
      SET status = 'rolled_back'
      WHERE version = ?
    `);
    stmt.run(version);
  }

  private logToHistory(
    migration: Migration,
    action: 'up' | 'down',
    status: 'success' | 'failed',
    executionTime: number,
    errorMessage: string | null
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO migration_history
      (version, name, action, status, execution_time_ms, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(migration.version, migration.name, action, status, executionTime, errorMessage);
  }

  private computeChecksum(migration: Migration): string {
    const upContent = typeof migration.up === 'string' ? migration.up : '[function]';
    const downContent = typeof migration.down === 'string' ? migration.down : '[function]';
    const content = `${migration.version}:${migration.name}:${upContent}:${downContent}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string): void {
    const levels = ['silent', 'error', 'warn', 'info', 'debug'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);

    if (messageLevel <= configLevel) {
      const prefix = `[migrations]`;
      switch (level) {
        case 'error':
          console.error(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        case 'info':
          console.info(prefix, message);
          break;
        case 'debug':
          console.debug(prefix, message);
          break;
      }
    }
  }
}

/**
 * Create a migration definition helper
 */
export function defineMigration(
  version: string,
  name: string,
  up: string | ((db: Database.Database) => void),
  down: string | ((db: Database.Database) => void)
): Migration {
  return { version, name, up, down };
}

/**
 * Generate a version timestamp for new migrations
 */
export function generateMigrationVersion(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}
