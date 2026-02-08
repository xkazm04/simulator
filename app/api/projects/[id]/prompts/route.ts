/**
 * Project Prompts API - Generated prompts persistence
 *
 * GET /api/projects/[id]/prompts - Get all generated prompts for project
 * POST /api/projects/[id]/prompts - Save generated prompts (replaces all)
 * PUT /api/projects/[id]/prompts - Update a single prompt
 * DELETE /api/projects/[id]/prompts - Delete prompts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES, DbGeneratedPrompt } from '@/app/lib/supabase';
import { fetchProject, touchProject } from '../helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get all generated prompts for a project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = getDb();

    const project = await fetchProject(supabase, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const { data: prompts, error } = await supabase
      .from(TABLES.generatedPrompts).select('*').eq('project_id', id).order('scene_number');

    if (error) {
      console.error('Get prompts error:', error);
      return NextResponse.json({ success: false, error: 'Failed to get prompts' }, { status: 500 });
    }

    return NextResponse.json({ success: true, prompts: prompts as DbGeneratedPrompt[] }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Get prompts error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get prompts' }, { status: 500 });
  }
}

/**
 * POST - Save generated prompts (replaces all existing)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { prompts } = await request.json();
    const supabase = getDb();

    const project = await fetchProject(supabase, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    if (!Array.isArray(prompts)) {
      return NextResponse.json({ success: false, error: 'prompts must be an array' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Delete existing and insert new
    await supabase.from(TABLES.generatedPrompts).delete().eq('project_id', id);

    if (prompts.length > 0) {
      const promptsToInsert = prompts.map((p: Record<string, unknown>) => ({
        id: p.id, project_id: id, scene_number: p.sceneNumber, scene_type: p.sceneType,
        prompt: p.prompt, negative_prompt: null,
        copied: p.copied || false, rating: p.rating || null, locked: p.locked || false,
        elements_json: p.elements || null, created_at: now,
      }));

      const { error } = await supabase.from(TABLES.generatedPrompts).insert(promptsToInsert);
      if (error) {
        console.error('Insert prompts error:', error);
        return NextResponse.json({ success: false, error: 'Failed to save prompts' }, { status: 500 });
      }
    }

    await touchProject(supabase, id);
    return NextResponse.json({ success: true, count: prompts.length });
  } catch (error) {
    console.error('Save prompts error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save prompts' }, { status: 500 });
  }
}

/**
 * PUT - Update a single prompt
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { promptId, updates } = await request.json();
    const supabase = getDb();

    const project = await fetchProject(supabase, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    if (!promptId || !updates) {
      return NextResponse.json({ success: false, error: 'Missing required fields: promptId, updates' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (updates.copied !== undefined) updateData.copied = updates.copied;
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.locked !== undefined) updateData.locked = updates.locked;
    if (updates.elements !== undefined) updateData.elements_json = updates.elements;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, message: 'No updates provided' });
    }

    const { error, count } = await supabase.from(TABLES.generatedPrompts)
      .update(updateData).eq('id', promptId).eq('project_id', id);

    if (error) {
      console.error('Update prompt error:', error);
      return NextResponse.json({ success: false, error: 'Failed to update prompt' }, { status: 500 });
    }
    if (count === 0) {
      return NextResponse.json({ success: false, error: 'Prompt not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update prompt error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update prompt' }, { status: 500 });
  }
}

/**
 * DELETE - Delete prompts
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getDb();

    const project = await fetchProject(supabase, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    if (body.promptId) {
      await supabase.from(TABLES.generatedPrompts).delete().eq('id', body.promptId).eq('project_id', id);
    } else {
      await supabase.from(TABLES.generatedPrompts).delete().eq('project_id', id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete prompts error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete prompts' }, { status: 500 });
  }
}
