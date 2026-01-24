/**
 * Project Prompts API - Generated prompts persistence
 *
 * GET /api/projects/[id]/prompts - Get all generated prompts for project
 * POST /api/projects/[id]/prompts - Save generated prompts (replaces all)
 * PUT /api/projects/[id]/prompts - Update a single prompt
 * DELETE /api/projects/[id]/prompts - Delete prompts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, DbGeneratedPrompt } from '@/app/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get all generated prompts for a project
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

    const prompts = db.prepare(`
      SELECT id, project_id, scene_number, scene_type, prompt, negative_prompt, copied, rating, locked, elements_json, created_at
      FROM generated_prompts WHERE project_id = ?
      ORDER BY scene_number
    `).all(id) as DbGeneratedPrompt[];

    return NextResponse.json({
      success: true,
      prompts,
    });
  } catch (error) {
    console.error('Get prompts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get prompts' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save generated prompts (replaces all existing)
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

    const { prompts } = body;

    if (!Array.isArray(prompts)) {
      return NextResponse.json(
        { success: false, error: 'prompts must be an array' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Use a transaction to replace all prompts
    const deleteStmt = db.prepare('DELETE FROM generated_prompts WHERE project_id = ?');
    const insertStmt = db.prepare(`
      INSERT INTO generated_prompts (id, project_id, scene_number, scene_type, prompt, negative_prompt, copied, rating, locked, elements_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      // Clear existing prompts
      deleteStmt.run(id);

      // Insert new prompts
      for (const p of prompts) {
        insertStmt.run(
          p.id,
          id,
          p.sceneNumber,
          p.sceneType,
          p.prompt,
          p.negativePrompt || null,
          p.copied ? 1 : 0,
          p.rating || null,
          p.locked ? 1 : 0,
          p.elements ? JSON.stringify(p.elements) : null,
          now
        );
      }
    });

    transaction();

    // Update project timestamp
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, id);

    return NextResponse.json({
      success: true,
      count: prompts.length,
    });
  } catch (error) {
    console.error('Save prompts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save prompts' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a single prompt
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { promptId, updates } = body;

    if (!promptId || !updates) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: promptId, updates' },
        { status: 400 }
      );
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: (string | number | null)[] = [];

    if (updates.copied !== undefined) {
      updateFields.push('copied = ?');
      updateValues.push(updates.copied ? 1 : 0);
    }
    if (updates.rating !== undefined) {
      updateFields.push('rating = ?');
      updateValues.push(updates.rating);
    }
    if (updates.locked !== undefined) {
      updateFields.push('locked = ?');
      updateValues.push(updates.locked ? 1 : 0);
    }
    if (updates.elements !== undefined) {
      updateFields.push('elements_json = ?');
      updateValues.push(JSON.stringify(updates.elements));
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No updates provided',
      });
    }

    updateValues.push(promptId);
    updateValues.push(id);

    const result = db.prepare(`
      UPDATE generated_prompts
      SET ${updateFields.join(', ')}
      WHERE id = ? AND project_id = ?
    `).run(...updateValues);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Update prompt error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete prompts
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
      // Delete specific prompt
      db.prepare(`
        DELETE FROM generated_prompts WHERE id = ? AND project_id = ?
      `).run(body.promptId, id);
    } else {
      // Delete all prompts for project
      db.prepare(`
        DELETE FROM generated_prompts WHERE project_id = ?
      `).run(id);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete prompts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete prompts' },
      { status: 500 }
    );
  }
}
