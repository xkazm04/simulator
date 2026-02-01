/**
 * WhatIf Image Upload API
 *
 * POST /api/projects/[id]/whatifs/upload - Upload image to Supabase storage
 * Uses service role key to bypass RLS policies
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/app/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { fetchProject, touchProject } from '../../helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST - Upload image for whatif and update/create record
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const side = formData.get('side') as 'before' | 'after' | null;
    const whatifId = formData.get('whatifId') as string | null;
    const beforeImageUrl = formData.get('beforeImageUrl') as string | null;
    const beforeCaption = formData.get('beforeCaption') as string | null;
    const afterImageUrl = formData.get('afterImageUrl') as string | null;
    const afterCaption = formData.get('afterCaption') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!side || !['before', 'after'].includes(side)) {
      return NextResponse.json({ success: false, error: 'Invalid side (must be "before" or "after")' }, { status: 400 });
    }

    const supabase = getDb();
    const project = await fetchProject(supabase, projectId);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Upload file to storage
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${projectId}/${side}_${Date.now()}.${fileExt}`;
    const buffer = await file.arrayBuffer();

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatif-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ success: false, error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('whatif-images')
      .getPublicUrl(uploadData.path);

    const imageUrl = urlData.publicUrl;
    const now = new Date().toISOString();
    const id = whatifId || uuidv4();

    // Prepare data for insert/update
    const newBeforeImageUrl = side === 'before' ? imageUrl : beforeImageUrl;
    const newAfterImageUrl = side === 'after' ? imageUrl : afterImageUrl;

    if (whatifId) {
      // Update existing record
      const { error: updateError } = await supabase
        .from(TABLES.projectWhatifs)
        .update({
          before_image_url: newBeforeImageUrl,
          before_caption: beforeCaption,
          after_image_url: newAfterImageUrl,
          after_caption: afterCaption,
          updated_at: now,
        })
        .eq('id', whatifId)
        .eq('project_id', projectId);

      if (updateError) {
        console.error('Update whatif error:', updateError);
        return NextResponse.json({ success: false, error: 'Failed to update whatif' }, { status: 500 });
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from(TABLES.projectWhatifs)
        .insert({
          id,
          project_id: projectId,
          before_image_url: newBeforeImageUrl,
          before_caption: beforeCaption,
          after_image_url: newAfterImageUrl,
          after_caption: afterCaption,
          display_order: 0,
          created_at: now,
          updated_at: now,
        });

      if (insertError) {
        console.error('Insert whatif error:', insertError);
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

    return NextResponse.json({ success: true, whatif, imageUrl });
  } catch (error) {
    console.error('Upload whatif image error:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload image' }, { status: 500 });
  }
}
