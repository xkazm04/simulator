/**
 * Project API - Individual project operations
 *
 * GET /api/projects/[id] - Get project with state and images
 * PUT /api/projects/[id] - Update project state (autosave)
 * PATCH /api/projects/[id] - Update project metadata (name only)
 * DELETE /api/projects/[id] - Delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, DbProject, DbProjectState, DbPanelImage, DbProjectPoster, DbInteractivePrototype, DbGeneratedPrompt, ProjectWithState } from '@/app/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get project with full state
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    // Get project
    const project = db.prepare(`
      SELECT id, name, created_at, updated_at
      FROM projects WHERE id = ?
    `).get(id) as DbProject | undefined;

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get state
    const state = db.prepare(`
      SELECT project_id, base_prompt, base_image_file, vision_sentence, breakdown_json, output_mode, dimensions_json, feedback_json, updated_at
      FROM project_state WHERE project_id = ?
    `).get(id) as DbProjectState | undefined;

    // Get panel images
    const panelImages = db.prepare(`
      SELECT id, project_id, side, slot_index, image_url, video_url, prompt, created_at
      FROM panel_images WHERE project_id = ?
      ORDER BY side, slot_index
    `).all(id) as DbPanelImage[];

    // Get poster
    const poster = db.prepare(`
      SELECT id, project_id, image_url, prompt, dimensions_json, created_at
      FROM project_posters WHERE project_id = ?
    `).get(id) as DbProjectPoster | undefined;

    // Get interactive prototypes
    let prototypes: DbInteractivePrototype[] = [];
    try {
      prototypes = db.prepare(`
        SELECT id, project_id, prompt_id, image_id, mode, status, error, config_json, assets_json, created_at
        FROM interactive_prototypes WHERE project_id = ?
      `).all(id) as DbInteractivePrototype[];
    } catch {
      // Table may not exist yet in older databases
      prototypes = [];
    }

    // Get generated prompts
    let generatedPrompts: DbGeneratedPrompt[] = [];
    try {
      generatedPrompts = db.prepare(`
        SELECT id, project_id, scene_number, scene_type, prompt, negative_prompt, copied, rating, locked, elements_json, created_at
        FROM generated_prompts WHERE project_id = ?
        ORDER BY scene_number
      `).all(id) as DbGeneratedPrompt[];
    } catch {
      // Table may not exist yet in older databases
      generatedPrompts = [];
    }

    const projectWithState: ProjectWithState = {
      ...project,
      state: state || null,
      panelImages,
      poster: poster || null,
      prototypes,
      generatedPrompts,
    };

    return NextResponse.json({
      success: true,
      project: projectWithState,
    });
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get project' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update project state (autosave)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const db = getDb();
    const now = new Date().toISOString();

    // Check project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Update project name if provided
    if (body.name !== undefined) {
      db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?')
        .run(body.name, now, id);
    }

    // Update state
    const updateFields: string[] = [];
    const updateValues: (string | null)[] = [];

    if (body.basePrompt !== undefined) {
      updateFields.push('base_prompt = ?');
      updateValues.push(body.basePrompt);
    }
    if (body.baseImageFile !== undefined) {
      updateFields.push('base_image_file = ?');
      updateValues.push(body.baseImageFile);
    }
    if (body.visionSentence !== undefined) {
      updateFields.push('vision_sentence = ?');
      updateValues.push(body.visionSentence);
    }
    if (body.outputMode !== undefined) {
      updateFields.push('output_mode = ?');
      updateValues.push(body.outputMode);
    }
    if (body.dimensions !== undefined) {
      updateFields.push('dimensions_json = ?');
      updateValues.push(JSON.stringify(body.dimensions));
    }
    if (body.feedback !== undefined) {
      updateFields.push('feedback_json = ?');
      updateValues.push(JSON.stringify(body.feedback));
    }
    if (body.breakdown !== undefined) {
      updateFields.push('breakdown_json = ?');
      updateValues.push(body.breakdown ? JSON.stringify(body.breakdown) : null);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateValues.push(now);
      updateValues.push(id);

      db.prepare(`
        UPDATE project_state
        SET ${updateFields.join(', ')}
        WHERE project_id = ?
      `).run(...updateValues);

      // Also update project updated_at
      db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?')
        .run(now, id);
    }

    return NextResponse.json({
      success: true,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update project metadata (name only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const db = getDb();
    const now = new Date().toISOString();

    // Check project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Update project name if provided
    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json(
          { success: false, error: 'Project name cannot be empty' },
          { status: 400 }
        );
      }
      db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?')
        .run(body.name.trim(), now, id);
    }

    return NextResponse.json({
      success: true,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Patch project error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete project
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    // Delete project (cascade will delete state and images)
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
