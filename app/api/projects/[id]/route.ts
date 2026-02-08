/**
 * Project API - Individual project operations
 *
 * GET /api/projects/[id] - Get project with state and images
 * PUT /api/projects/[id] - Update project state (autosave)
 * PATCH /api/projects/[id] - Update project metadata (name only)
 * DELETE /api/projects/[id] - Delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/app/lib/supabase';
import { fetchProject, fetchProjectWithState, buildStateUpdate, touchProject, ensureProjectState } from './helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get project with full state
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let projectId: string | undefined;
  try {
    const { id } = await params;
    projectId = id;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid project ID' }, { status: 400 });
    }

    const supabase = getDb();
    const projectWithState = await fetchProjectWithState(supabase, id);

    if (!projectWithState) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, project: projectWithState }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Get project error (id=${projectId}):`, errorMessage);
    return NextResponse.json(
      { success: false, error: `Failed to get project: ${errorMessage}` },
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
    console.log('[API PUT /projects/:id] Received:', { id, body });

    const supabase = getDb();
    const now = new Date().toISOString();

    const project = await fetchProject(supabase, id);
    if (!project) {
      console.log('[API PUT /projects/:id] Project not found:', id);
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Update project name if provided
    if (body.name !== undefined) {
      await supabase
        .from(TABLES.projects)
        .update({ name: body.name, updated_at: now })
        .eq('id', id);
    }

    // Build and apply state update
    const stateUpdate = buildStateUpdate(body);
    console.log('[API PUT /projects/:id] State update:', stateUpdate);

    if (Object.keys(stateUpdate).length > 0) {
      // Ensure project state row exists (it may not for newly created projects)
      const ensured = await ensureProjectState(supabase, id);
      console.log('[API PUT /projects/:id] ensureProjectState result:', ensured);

      stateUpdate.updated_at = now;
      const { error, count } = await supabase.from(TABLES.projectState).update(stateUpdate).eq('project_id', id);
      console.log('[API PUT /projects/:id] Update result:', { error, count });

      if (error) {
        console.error('[API PUT /projects/:id] Update error:', error);
      }

      await touchProject(supabase, id);
    }

    return NextResponse.json({ success: true, updatedAt: now });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update project' }, { status: 500 });
  }
}

/**
 * PATCH - Update project metadata (name only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getDb();
    const now = new Date().toISOString();

    const project = await fetchProject(supabase, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ success: false, error: 'Project name cannot be empty' }, { status: 400 });
      }
      await supabase
        .from(TABLES.projects)
        .update({ name: body.name.trim(), updated_at: now })
        .eq('id', id);
    }

    return NextResponse.json({ success: true, updatedAt: now });
  } catch (error) {
    console.error('Patch project error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update project' }, { status: 500 });
  }
}

/**
 * DELETE - Delete project
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = getDb();

    const { error, count } = await supabase
      .from(TABLES.projects)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete project error:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete project' }, { status: 500 });
    }

    if (count === 0) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete project' }, { status: 500 });
  }
}
