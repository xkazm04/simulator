/**
 * Project Poster API - Individual project poster operations
 *
 * GET /api/projects/[id]/poster - Get project poster
 * POST /api/projects/[id]/poster - Save/update project poster
 * DELETE /api/projects/[id]/poster - Delete project poster
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, DbProjectPoster } from '@/app/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get project poster
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const poster = db.prepare(`
      SELECT id, project_id, image_url, prompt, dimensions_json, created_at
      FROM project_posters WHERE project_id = ?
    `).get(id) as DbProjectPoster | undefined;

    if (!poster) {
      return NextResponse.json({
        success: true,
        poster: null,
      });
    }

    return NextResponse.json({
      success: true,
      poster,
    });
  } catch (error) {
    console.error('Get poster error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get poster' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save/update project poster (upsert)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { imageUrl, prompt, dimensionsJson } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'imageUrl is required' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if poster already exists
    const existingPoster = db.prepare(
      'SELECT id FROM project_posters WHERE project_id = ?'
    ).get(id) as { id: string } | undefined;

    let poster: DbProjectPoster;

    if (existingPoster) {
      // Update existing poster
      db.prepare(`
        UPDATE project_posters
        SET image_url = ?, prompt = ?, dimensions_json = ?, created_at = datetime('now')
        WHERE project_id = ?
      `).run(imageUrl, prompt || null, dimensionsJson || null, id);

      poster = db.prepare(`
        SELECT id, project_id, image_url, prompt, dimensions_json, created_at
        FROM project_posters WHERE project_id = ?
      `).get(id) as DbProjectPoster;
    } else {
      // Create new poster
      const posterId = uuidv4();
      db.prepare(`
        INSERT INTO project_posters (id, project_id, image_url, prompt, dimensions_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(posterId, id, imageUrl, prompt || null, dimensionsJson || null);

      poster = db.prepare(`
        SELECT id, project_id, image_url, prompt, dimensions_json, created_at
        FROM project_posters WHERE id = ?
      `).get(posterId) as DbProjectPoster;
    }

    return NextResponse.json({
      success: true,
      poster,
    });
  } catch (error) {
    console.error('Save poster error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save poster' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Save/update project poster (alias for POST)
 */
export async function PUT(request: NextRequest, routeParams: RouteParams) {
  return POST(request, routeParams);
}

/**
 * DELETE - Delete project poster
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const result = db.prepare('DELETE FROM project_posters WHERE project_id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json({
        success: true,
        deleted: false,
        message: 'No poster found to delete',
      });
    }

    return NextResponse.json({
      success: true,
      deleted: true,
    });
  } catch (error) {
    console.error('Delete poster error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete poster' },
      { status: 500 }
    );
  }
}
