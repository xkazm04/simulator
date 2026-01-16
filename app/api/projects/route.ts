/**
 * Projects API
 *
 * GET /api/projects - List all projects
 * POST /api/projects - Create new project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, DbProject } from '@/app/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET - List all projects
 */
export async function GET() {
  try {
    const db = getDb();

    const projects = db.prepare(`
      SELECT id, name, created_at, updated_at
      FROM projects
      ORDER BY updated_at DESC
    `).all() as DbProject[];

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error('List projects error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list projects' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new project
 */
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const projectId = uuidv4();
    const now = new Date().toISOString();

    // Create project
    db.prepare(`
      INSERT INTO projects (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(projectId, name.trim(), now, now);

    // Create initial state
    db.prepare(`
      INSERT INTO project_state (project_id, base_prompt, output_mode, dimensions_json, feedback_json, updated_at)
      VALUES (?, '', 'gameplay', '[]', '{"positive":"","negative":""}', ?)
    `).run(projectId, now);

    const project: DbProject = {
      id: projectId,
      name: name.trim(),
      created_at: now,
      updated_at: now,
    };

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
