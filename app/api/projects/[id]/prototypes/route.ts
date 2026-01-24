/**
 * Project Prototypes API - Interactive prototype persistence
 *
 * GET /api/projects/[id]/prototypes - Get all prototypes for project
 * POST /api/projects/[id]/prototypes - Save/update a prototype
 * DELETE /api/projects/[id]/prototypes - Delete a prototype or all prototypes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, DbInteractivePrototype } from '@/app/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get all prototypes for a project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    // Check project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const prototypes = db.prepare(`
      SELECT id, project_id, prompt_id, image_id, mode, status, error, config_json, assets_json, created_at
      FROM interactive_prototypes WHERE project_id = ?
    `).all(id) as DbInteractivePrototype[];

    return NextResponse.json({
      success: true,
      prototypes,
    });
  } catch (error) {
    console.error('Get prototypes error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get prototypes' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save or update a prototype
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    // Check project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const {
      promptId,
      imageId,
      mode,
      status,
      error: prototypeError,
      config,
      assets,
    } = body;

    if (!promptId || !mode || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: promptId, mode, status' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Use INSERT OR REPLACE to handle both insert and update
    const prototypeId = uuidv4();
    db.prepare(`
      INSERT INTO interactive_prototypes (id, project_id, prompt_id, image_id, mode, status, error, config_json, assets_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, prompt_id) DO UPDATE SET
        image_id = excluded.image_id,
        mode = excluded.mode,
        status = excluded.status,
        error = excluded.error,
        config_json = excluded.config_json,
        assets_json = excluded.assets_json
    `).run(
      prototypeId,
      id,
      promptId,
      imageId || null,
      mode,
      status,
      prototypeError || null,
      config ? JSON.stringify(config) : null,
      assets ? JSON.stringify(assets) : null,
      now
    );

    return NextResponse.json({
      success: true,
      prototypeId,
    });
  } catch (error) {
    console.error('Save prototype error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save prototype' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete prototype(s)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    // Check project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    if (body.promptId) {
      // Delete specific prototype by promptId
      db.prepare(`
        DELETE FROM interactive_prototypes WHERE project_id = ? AND prompt_id = ?
      `).run(id, body.promptId);
    } else if (body.prototypeId) {
      // Delete specific prototype by id
      db.prepare(`
        DELETE FROM interactive_prototypes WHERE id = ? AND project_id = ?
      `).run(body.prototypeId, id);
    } else {
      // Delete all prototypes for project
      db.prepare(`
        DELETE FROM interactive_prototypes WHERE project_id = ?
      `).run(id);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete prototype error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete prototype' },
      { status: 500 }
    );
  }
}
