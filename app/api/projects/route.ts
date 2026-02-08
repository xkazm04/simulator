/**
 * Projects API
 *
 * GET /api/projects - List all projects
 * POST /api/projects - Create new project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, DbProject, TABLES } from '@/app/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET - List all projects
 */
export async function GET() {
  try {
    const supabase = getDb();

    const { data: projects, error } = await supabase
      .from(TABLES.projects)
      .select('id, name, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('List projects error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to list projects' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      projects: projects as DbProject[],
    }, {
      headers: { 'Cache-Control': 'no-store' },
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

    const supabase = getDb();
    const projectId = uuidv4();
    const now = new Date().toISOString();

    // Create project
    const { error: projectError } = await supabase
      .from(TABLES.projects)
      .insert({
        id: projectId,
        name: name.trim(),
        created_at: now,
        updated_at: now,
      });

    if (projectError) {
      console.error('Create project error:', projectError);
      return NextResponse.json(
        { success: false, error: 'Failed to create project' },
        { status: 500 }
      );
    }

    // Create initial state
    const { error: stateError } = await supabase
      .from(TABLES.projectState)
      .insert({
        project_id: projectId,
        base_prompt: '',
        output_mode: 'gameplay',
        dimensions_json: [],
        feedback_json: { positive: '', negative: '' },
        updated_at: now,
      });

    if (stateError) {
      console.error('Create project state error:', stateError);
      // Try to clean up the project
      await supabase.from(TABLES.projects).delete().eq('id', projectId);
      return NextResponse.json(
        { success: false, error: 'Failed to create project state' },
        { status: 500 }
      );
    }

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
