/**
 * Panel Images API
 *
 * POST /api/projects/[id]/images - Save image to panel slot
 * PATCH /api/projects/[id]/images - Update image video URL
 * DELETE /api/projects/[id]/images - Remove image from slot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES, DbPanelImage } from '@/app/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { fetchProject, touchProject } from '../helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST - Save image to panel slot
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const { side, slotIndex, imageUrl, videoUrl, prompt } = await request.json();

    // Validate input
    if (!side || !['left', 'right'].includes(side)) {
      return NextResponse.json({ success: false, error: 'Invalid side (must be "left" or "right")' }, { status: 400 });
    }
    if (slotIndex === undefined || slotIndex < 0 || slotIndex >= 5) {
      return NextResponse.json({ success: false, error: 'Invalid slot index (must be 0-4)' }, { status: 400 });
    }
    if (!imageUrl) {
      return NextResponse.json({ success: false, error: 'Image URL is required' }, { status: 400 });
    }

    const supabase = getDb();
    const project = await fetchProject(supabase, projectId);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Delete existing image in this slot
    await supabase.from(TABLES.panelImages).delete()
      .eq('project_id', projectId).eq('side', side).eq('slot_index', slotIndex);

    // Insert new image
    const imageId = uuidv4();
    const now = new Date().toISOString();
    const { error } = await supabase.from(TABLES.panelImages).insert({
      id: imageId, project_id: projectId, side, slot_index: slotIndex,
      image_url: imageUrl, video_url: videoUrl || null, prompt: prompt || null, created_at: now,
    });

    if (error) {
      console.error('Insert panel image error:', error);
      return NextResponse.json({ success: false, error: 'Failed to save image' }, { status: 500 });
    }

    await touchProject(supabase, projectId);

    const panelImage: DbPanelImage = {
      id: imageId, project_id: projectId, side, slot_index: slotIndex,
      image_url: imageUrl, video_url: videoUrl || null, prompt: prompt || null, created_at: now,
    };

    return NextResponse.json({ success: true, image: panelImage });
  } catch (error) {
    console.error('Save panel image error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save image' }, { status: 500 });
  }
}

/**
 * PATCH - Update image video URL or image URL
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const { imageId, videoUrl, imageUrl } = await request.json();

    if (!imageId) {
      return NextResponse.json({ success: false, error: 'Image ID is required' }, { status: 400 });
    }
    if (videoUrl === undefined && imageUrl === undefined) {
      return NextResponse.json({ success: false, error: 'Either videoUrl or imageUrl is required' }, { status: 400 });
    }

    const supabase = getDb();
    const updateData: Record<string, string | null> = {};
    if (videoUrl !== undefined) updateData.video_url = videoUrl || null;
    if (imageUrl !== undefined) updateData.image_url = imageUrl;

    const { error, count } = await supabase.from(TABLES.panelImages)
      .update(updateData).eq('id', imageId).eq('project_id', projectId);

    if (error) {
      console.error('Update panel image error:', error);
      return NextResponse.json({ success: false, error: 'Failed to update image' }, { status: 500 });
    }
    if (count === 0) {
      return NextResponse.json({ success: false, error: 'Image not found' }, { status: 404 });
    }

    await touchProject(supabase, projectId);

    const { data: updatedImage } = await supabase.from(TABLES.panelImages)
      .select('*').eq('id', imageId).single();

    return NextResponse.json({ success: true, image: updatedImage as DbPanelImage });
  } catch (error) {
    console.error('Update panel image error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update image' }, { status: 500 });
  }
}

/**
 * DELETE - Remove image from slot
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const { imageId } = await request.json();

    if (!imageId) {
      return NextResponse.json({ success: false, error: 'Image ID is required' }, { status: 400 });
    }

    const supabase = getDb();
    const { error, count } = await supabase.from(TABLES.panelImages)
      .delete().eq('id', imageId).eq('project_id', projectId);

    if (error) {
      console.error('Delete panel image error:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete image' }, { status: 500 });
    }
    if (count === 0) {
      return NextResponse.json({ success: false, error: 'Image not found' }, { status: 404 });
    }

    await touchProject(supabase, projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete panel image error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete image' }, { status: 500 });
  }
}
