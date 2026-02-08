/**
 * WhatIf Pairs API
 *
 * GET /api/projects/[id]/whatifs - Get all whatif pairs for a project
 * POST /api/projects/[id]/whatifs - Create or update a whatif pair
 * DELETE /api/projects/[id]/whatifs - Delete a whatif pair
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES, DbProjectWhatif } from '@/app/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { fetchProject, touchProject } from '../helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get all whatif pairs for a project
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const supabase = getDb();

    const project = await fetchProject(supabase, projectId);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from(TABLES.projectWhatifs)
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Fetch whatifs error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch whatifs' }, { status: 500 });
    }

    return NextResponse.json({ success: true, whatifs: data as DbProjectWhatif[] }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Get whatifs error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch whatifs' }, { status: 500 });
  }
}

/**
 * POST - Create or update a whatif pair
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const {
      id: whatifId,
      beforeImageUrl,
      beforeCaption,
      afterImageUrl,
      afterCaption,
      displayOrder = 0,
    } = body;

    const supabase = getDb();
    const project = await fetchProject(supabase, projectId);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const id = whatifId || uuidv4();

    // Check if updating existing or creating new
    if (whatifId) {
      // Update existing
      const { error } = await supabase
        .from(TABLES.projectWhatifs)
        .update({
          before_image_url: beforeImageUrl ?? null,
          before_caption: beforeCaption ?? null,
          after_image_url: afterImageUrl ?? null,
          after_caption: afterCaption ?? null,
          display_order: displayOrder,
          updated_at: now,
        })
        .eq('id', whatifId)
        .eq('project_id', projectId);

      if (error) {
        console.error('Update whatif error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update whatif' }, { status: 500 });
      }
    } else {
      // Create new
      const { error } = await supabase.from(TABLES.projectWhatifs).insert({
        id,
        project_id: projectId,
        before_image_url: beforeImageUrl ?? null,
        before_caption: beforeCaption ?? null,
        after_image_url: afterImageUrl ?? null,
        after_caption: afterCaption ?? null,
        display_order: displayOrder,
        created_at: now,
        updated_at: now,
      });

      if (error) {
        console.error('Insert whatif error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create whatif' }, { status: 500 });
      }
    }

    await touchProject(supabase, projectId);

    // Fetch and return the updated/created record
    const { data: whatif } = await supabase
      .from(TABLES.projectWhatifs)
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json({ success: true, whatif: whatif as DbProjectWhatif });
  } catch (error) {
    console.error('Save whatif error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save whatif' }, { status: 500 });
  }
}

/**
 * DELETE - Delete a whatif pair
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const { whatifId } = await request.json();

    if (!whatifId) {
      return NextResponse.json({ success: false, error: 'WhatIf ID is required' }, { status: 400 });
    }

    const supabase = getDb();
    const { error, count } = await supabase
      .from(TABLES.projectWhatifs)
      .delete()
      .eq('id', whatifId)
      .eq('project_id', projectId);

    if (error) {
      console.error('Delete whatif error:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete whatif' }, { status: 500 });
    }

    if (count === 0) {
      return NextResponse.json({ success: false, error: 'WhatIf not found' }, { status: 404 });
    }

    await touchProject(supabase, projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete whatif error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete whatif' }, { status: 500 });
  }
}
