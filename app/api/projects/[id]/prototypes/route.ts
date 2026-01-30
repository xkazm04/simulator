/**
 * Project Prototypes API - Interactive prototype persistence
 *
 * GET /api/projects/[id]/prototypes - Get all prototypes for project
 * POST /api/projects/[id]/prototypes - Save/update a prototype
 * DELETE /api/projects/[id]/prototypes - Delete a prototype or all prototypes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES, DbInteractivePrototype } from '@/app/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { fetchProject } from '../helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get all prototypes for a project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = getDb();

    const project = await fetchProject(supabase, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const { data: prototypes, error } = await supabase
      .from(TABLES.interactivePrototypes).select('*').eq('project_id', id);

    if (error) {
      console.error('Get prototypes error:', error);
      return NextResponse.json({ success: false, error: 'Failed to get prototypes' }, { status: 500 });
    }

    return NextResponse.json({ success: true, prototypes: prototypes as DbInteractivePrototype[] });
  } catch (error) {
    console.error('Get prototypes error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get prototypes' }, { status: 500 });
  }
}

/**
 * POST - Save or update a prototype
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { promptId, imageId, mode, status, error: protoError, config, assets } = await request.json();
    const supabase = getDb();

    const project = await fetchProject(supabase, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    if (!promptId || !mode || !status) {
      return NextResponse.json({ success: false, error: 'Missing required fields: promptId, mode, status' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from(TABLES.interactivePrototypes).select('id').eq('project_id', id).eq('prompt_id', promptId).single();

    let prototypeId: string;

    if (existing) {
      prototypeId = existing.id;
      const { error: updateError } = await supabase.from(TABLES.interactivePrototypes)
        .update({
          image_id: imageId || null, mode, status, error: protoError || null,
          config_json: config || null, assets_json: assets || null,
        })
        .eq('id', prototypeId);

      if (updateError) {
        console.error('Update prototype error:', updateError);
        return NextResponse.json({ success: false, error: 'Failed to save prototype' }, { status: 500 });
      }
    } else {
      prototypeId = uuidv4();
      const { error: insertError } = await supabase.from(TABLES.interactivePrototypes)
        .insert({
          id: prototypeId, project_id: id, prompt_id: promptId,
          image_id: imageId || null, mode, status, error: protoError || null,
          config_json: config || null, assets_json: assets || null, created_at: now,
        });

      if (insertError) {
        console.error('Insert prototype error:', insertError);
        return NextResponse.json({ success: false, error: 'Failed to save prototype' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, prototypeId });
  } catch (error) {
    console.error('Save prototype error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save prototype' }, { status: 500 });
  }
}

/**
 * DELETE - Delete prototype(s)
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
      await supabase.from(TABLES.interactivePrototypes).delete().eq('project_id', id).eq('prompt_id', body.promptId);
    } else if (body.prototypeId) {
      await supabase.from(TABLES.interactivePrototypes).delete().eq('id', body.prototypeId).eq('project_id', id);
    } else {
      await supabase.from(TABLES.interactivePrototypes).delete().eq('project_id', id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete prototype error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete prototype' }, { status: 500 });
  }
}
