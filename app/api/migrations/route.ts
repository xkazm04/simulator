/**
 * Database Migrations API
 * Provides endpoints for managing database migrations with Supabase.
 *
 * For Supabase, migrations are run via the SQL Editor in Supabase Dashboard
 * or through the Supabase CLI. This endpoint provides status checking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, checkConnection, TABLES } from '@/app/lib/supabase';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/migrations - Get migration status and info
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status': {
        const connectionStatus = await checkConnection();
        const supabase = getDb();

        // Try to get table counts to verify schema exists
        const tables = Object.values(TABLES);
        const tableStatus: Record<string, { exists: boolean; count?: number }> = {};

        for (const table of tables) {
          try {
            const { count, error } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true });

            tableStatus[table] = {
              exists: !error || error.code !== '42P01',
              count: count ?? undefined,
            };
          } catch {
            tableStatus[table] = { exists: false };
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            database: 'supabase',
            connected: connectionStatus.connected,
            connectionError: connectionStatus.error,
            tables: tableStatus,
            migrationNote: 'Migrations are managed via Supabase Dashboard SQL Editor. See db/migrations/ for SQL scripts.',
          },
        });
      }

      case 'scripts': {
        // List available migration scripts
        const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
        let scripts: string[] = [];

        try {
          scripts = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
        } catch {
          scripts = [];
        }

        return NextResponse.json({
          success: true,
          data: {
            scripts,
            location: 'db/migrations/',
            instruction: 'Copy these SQL scripts to Supabase Dashboard SQL Editor to run migrations',
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
 * POST /api/migrations - Run migration (only baseline via Supabase)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

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

    if (action === 'verify') {
      // Verify that all required tables exist
      const supabase = getDb();
      const requiredTables = [TABLES.projects, TABLES.projectState, TABLES.panelImages, TABLES.projectPosters];
      const missingTables: string[] = [];

      for (const table of requiredTables) {
        const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error?.code === '42P01') {
          missingTables.push(table);
        }
      }

      if (missingTables.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Missing tables: ${missingTables.join(', ')}. Run the migration SQL in Supabase Dashboard.`,
          data: { missingTables },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'All required tables exist',
      });
    }

    return NextResponse.json({
      success: false,
      error: 'For Supabase, run migrations via Supabase Dashboard SQL Editor. Use ?action=scripts to see available migration files.',
    });
  } catch (error) {
    console.error('[api/migrations] POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
