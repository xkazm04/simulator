/**
 * Bulk Sync Panel Images API
 *
 * POST /api/projects/[id]/images/sync - Sync all panel images from client to database
 * Used for migrating existing localStorage/IndexedDB images to Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/app/lib/supabase';
import { fetchProject, touchProject } from '../../helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface SyncImageData {
  id: string;
  side: 'left' | 'right';
  slotIndex: number;
  imageUrl: string;
  videoUrl?: string | null;
  prompt?: string | null;
  createdAt?: string;
}

interface SyncRequestBody {
  images: SyncImageData[];
  projectName?: string;
}

/**
 * POST - Bulk sync panel images from client storage to database
 * Creates the project if it doesn't exist
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const { images, projectName } = await request.json() as SyncRequestBody;

    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ success: false, error: 'images array is required' }, { status: 400 });
    }

    const supabase = getDb();
    let project = await fetchProject(supabase, projectId);

    // Create project if it doesn't exist
    if (!project) {
      console.log(`[sync] Project ${projectId} not found, creating...`);
      const now = new Date().toISOString();
      const { error: createError } = await supabase.from(TABLES.projects).insert({
        id: projectId,
        name: projectName || `Migrated Project ${projectId.substring(0, 8)}`,
        created_at: now,
        updated_at: now,
      });

      if (createError) {
        console.error('[sync] Failed to create project:', createError);
        return NextResponse.json({ success: false, error: `Failed to create project: ${createError.message}` }, { status: 500 });
      }

      // Also create project state
      await supabase.from(TABLES.projectState).insert({
        project_id: projectId,
        base_prompt: '',
        output_mode: 'gameplay',
        dimensions_json: [],
        feedback_json: { positive: '', negative: '' },
        updated_at: now,
      });

      console.log(`[sync] Created project ${projectId}`);
      project = await fetchProject(supabase, projectId);
    }

    console.log(`[sync] Syncing ${images.length} images for project ${projectId}`);

    const results: { synced: number; errors: string[] } = { synced: 0, errors: [] };

    for (const img of images) {
      // Validate each image
      if (!img.id || !img.side || img.slotIndex === undefined || !img.imageUrl) {
        results.errors.push(`Invalid image data: ${JSON.stringify(img).substring(0, 100)}`);
        continue;
      }

      if (!['left', 'right'].includes(img.side)) {
        results.errors.push(`Invalid side for image ${img.id}: ${img.side}`);
        continue;
      }

      if (img.slotIndex < 0 || img.slotIndex >= 10) {
        results.errors.push(`Invalid slotIndex for image ${img.id}: ${img.slotIndex}`);
        continue;
      }

      try {
        // Delete existing image in this slot (if any)
        await supabase.from(TABLES.panelImages).delete()
          .eq('project_id', projectId)
          .eq('side', img.side)
          .eq('slot_index', img.slotIndex);

        // Also delete by ID if it exists (for ID conflicts)
        await supabase.from(TABLES.panelImages).delete()
          .eq('id', img.id);

        // Insert the image with client-provided ID
        const { error } = await supabase.from(TABLES.panelImages).insert({
          id: img.id,
          project_id: projectId,
          side: img.side,
          slot_index: img.slotIndex,
          image_url: img.imageUrl,
          video_url: img.videoUrl || null,
          prompt: img.prompt || null,
          created_at: img.createdAt || new Date().toISOString(),
        });

        if (error) {
          console.error(`[sync] Error inserting image ${img.id}:`, error);
          results.errors.push(`Failed to sync image ${img.id}: ${error.message}`);
        } else {
          results.synced++;
          console.log(`[sync] Synced image ${img.id} to ${img.side}[${img.slotIndex}]`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`Error syncing image ${img.id}: ${errMsg}`);
      }
    }

    await touchProject(supabase, projectId);

    console.log(`[sync] Completed: ${results.synced} synced, ${results.errors.length} errors`);

    return NextResponse.json({
      success: true,
      synced: results.synced,
      errors: results.errors,
    });
  } catch (error) {
    console.error('Bulk sync error:', error);
    return NextResponse.json({ success: false, error: 'Failed to sync images' }, { status: 500 });
  }
}
