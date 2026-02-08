/**
 * Project Poster API - Individual project poster operations
 *
 * GET /api/projects/[id]/poster - Get project poster
 * POST /api/projects/[id]/poster - Save/update project poster
 * DELETE /api/projects/[id]/poster - Delete project poster
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, TABLES, DbProjectPoster } from '@/app/lib/supabase';
import { fetchProject } from '../helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get project poster
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = getDb();

    const { data: poster, error } = await supabase
      .from(TABLES.projectPosters).select('*').eq('project_id', id).single();

    if (error && error.code !== 'PGRST116') {
      console.error('Get poster error:', error);
      return NextResponse.json({ success: false, error: 'Failed to get poster' }, { status: 500 });
    }

    return NextResponse.json({ success: true, poster: (poster as DbProjectPoster) || null }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Get poster error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get poster' }, { status: 500 });
  }
}

/**
 * POST - Save/update project poster (upsert)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { imageUrl, prompt, dimensionsJson } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: 'imageUrl is required' }, { status: 400 });
    }

    const supabase = getDb();
    const project = await fetchProject(supabase, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data: existingPoster } = await supabase
      .from(TABLES.projectPosters).select('id').eq('project_id', id).single();

    let poster: DbProjectPoster;

    if (existingPoster) {
      await supabase.from(TABLES.projectPosters)
        .update({ image_url: imageUrl, prompt: prompt || null, dimensions_json: dimensionsJson || null, created_at: now })
        .eq('project_id', id);
      const { data: updated } = await supabase
        .from(TABLES.projectPosters).select('*').eq('project_id', id).single();
      poster = updated as DbProjectPoster;
    } else {
      const posterId = uuidv4();
      await supabase.from(TABLES.projectPosters).insert({
        id: posterId, project_id: id, image_url: imageUrl,
        prompt: prompt || null, dimensions_json: dimensionsJson || null, created_at: now,
      });
      const { data: inserted } = await supabase
        .from(TABLES.projectPosters).select('*').eq('id', posterId).single();
      poster = inserted as DbProjectPoster;
    }

    return NextResponse.json({ success: true, poster });
  } catch (error) {
    console.error('Save poster error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save poster' }, { status: 500 });
  }
}

/** PUT - Alias for POST */
export async function PUT(request: NextRequest, routeParams: RouteParams) {
  return POST(request, routeParams);
}

/**
 * DELETE - Delete project poster
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = getDb();

    const { error, count } = await supabase
      .from(TABLES.projectPosters).delete().eq('project_id', id);

    if (error) {
      console.error('Delete poster error:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete poster' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: (count ?? 0) > 0,
      message: (count ?? 0) === 0 ? 'No poster found to delete' : undefined,
    });
  } catch (error) {
    console.error('Delete poster error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete poster' }, { status: 500 });
  }
}
