/**
 * Database Migrations API
 * Provides endpoints for managing database migrations.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getMigrationStatus,
  runPendingMigrations,
  rollbackMigration,
  getMigrationHistory,
  verifyMigrationChecksums,
} from '@/app/lib/db';

/**
 * GET /api/migrations - Get migration status and history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    switch (action) {
      case 'status': {
        const status = getMigrationStatus();
        return NextResponse.json({
          success: true,
          data: status,
        });
      }

      case 'history': {
        const history = getMigrationHistory(limit);
        return NextResponse.json({
          success: true,
          data: history,
        });
      }

      case 'verify': {
        const mismatches = verifyMigrationChecksums();
        return NextResponse.json({
          success: true,
          data: {
            valid: mismatches.length === 0,
            mismatches,
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[api/migrations] GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/migrations - Run migrations or rollback
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, targetVersion, dryRun } = body;

    // Check for admin authorization in production
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      const adminKey = process.env.MIGRATIONS_ADMIN_KEY;

      if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized - admin key required' },
          { status: 401 }
        );
      }
    }

    switch (action) {
      case 'run': {
        if (dryRun) {
          // In dry-run mode, just return pending migrations
          const status = getMigrationStatus();
          return NextResponse.json({
            success: true,
            dryRun: true,
            data: {
              wouldRun: status.pendingMigrations,
              count: status.pendingCount,
            },
          });
        }

        const result = runPendingMigrations();
        return NextResponse.json({
          success: result.success,
          data: result,
        });
      }

      case 'rollback': {
        if (dryRun) {
          const status = getMigrationStatus();
          const currentVersion = status.currentVersion;
          const wouldRollback = targetVersion
            ? status.appliedMigrations.filter((m) => m.version > targetVersion)
            : currentVersion
            ? [status.appliedMigrations[status.appliedMigrations.length - 1]]
            : [];

          return NextResponse.json({
            success: true,
            dryRun: true,
            data: {
              wouldRollback,
              targetVersion: targetVersion || (currentVersion ? 'previous' : null),
            },
          });
        }

        const result = rollbackMigration(targetVersion);
        return NextResponse.json({
          success: result.success,
          data: result,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Use 'run' or 'rollback'` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[api/migrations] POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
