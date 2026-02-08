/**
 * Image Cleanup API
 *
 * POST /api/projects/[id]/images/cleanup - Verify image URLs and delete dead records
 *
 * Accepts a list of image IDs, HEAD-requests each URL on the CDN,
 * and removes database records that return HTTP 403 (permanently deleted on Leonardo).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/app/lib/supabase';
import { fetchProject, touchProject } from '../../helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * HEAD-check a single URL. Returns the HTTP status code,
 * or 0 for network/timeout errors.
 */
async function checkImageUrl(url: string): Promise<number> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    return response.status;
  } catch {
    return 0;
  }
}

/**
 * POST - Verify image URLs and delete records returning 403
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const { imageIds } = await request.json();

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'imageIds array is required' },
        { status: 400 },
      );
    }

    // Cap to prevent abuse
    if (imageIds.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 images per cleanup request' },
        { status: 400 },
      );
    }

    const supabase = getDb();
    const project = await fetchProject(supabase, projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 },
      );
    }

    // Gather URLs for all requested image IDs from both tables
    const [panelResult, posterResult] = await Promise.all([
      supabase
        .from(TABLES.panelImages)
        .select('id, image_url')
        .eq('project_id', projectId)
        .in('id', imageIds),
      supabase
        .from(TABLES.projectPosters)
        .select('id, image_url')
        .eq('project_id', projectId)
        .in('id', imageIds),
    ]);

    const panelImages = (panelResult.data || []) as { id: string; image_url: string }[];
    const posterImages = (posterResult.data || []) as { id: string; image_url: string }[];

    // Build a map of id -> { url, table }
    const imageMap = new Map<string, { url: string; table: 'panel' | 'poster' }>();
    for (const img of panelImages) {
      imageMap.set(img.id, { url: img.image_url, table: 'panel' });
    }
    for (const img of posterImages) {
      imageMap.set(img.id, { url: img.image_url, table: 'poster' });
    }

    if (imageMap.size === 0) {
      return NextResponse.json({ success: true, deleted: [], posterDeleted: false });
    }

    // HEAD-request all URLs in parallel
    const entries = Array.from(imageMap.entries());
    const results = await Promise.all(
      entries.map(async ([id, { url }]) => ({
        id,
        status: await checkImageUrl(url),
      })),
    );

    // Only delete records that returned exactly 403
    const toDelete = results.filter(r => r.status === 403);

    if (toDelete.length === 0) {
      return NextResponse.json({ success: true, deleted: [], posterDeleted: false });
    }

    const deletedIds: string[] = [];
    let posterDeleted = false;

    const panelDeleteIds = toDelete
      .filter(r => imageMap.get(r.id)?.table === 'panel')
      .map(r => r.id);
    const posterDeleteIds = toDelete
      .filter(r => imageMap.get(r.id)?.table === 'poster')
      .map(r => r.id);

    // Delete dead panel images
    if (panelDeleteIds.length > 0) {
      const { error } = await supabase
        .from(TABLES.panelImages)
        .delete()
        .eq('project_id', projectId)
        .in('id', panelDeleteIds);
      if (!error) {
        deletedIds.push(...panelDeleteIds);
      } else {
        console.error('Cleanup: failed to delete panel images:', error);
      }
    }

    // Delete dead poster
    if (posterDeleteIds.length > 0) {
      const { error } = await supabase
        .from(TABLES.projectPosters)
        .delete()
        .eq('project_id', projectId)
        .in('id', posterDeleteIds);
      if (!error) {
        deletedIds.push(...posterDeleteIds);
        posterDeleted = true;
      } else {
        console.error('Cleanup: failed to delete poster:', error);
      }
    }

    if (deletedIds.length > 0) {
      await touchProject(supabase, projectId);
      console.log(
        `[Cleanup] Project ${projectId}: removed ${deletedIds.length} dead image(s)`,
        deletedIds,
      );
    }

    return NextResponse.json({ success: true, deleted: deletedIds, posterDeleted });
  } catch (error) {
    console.error('Image cleanup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cleanup images' },
      { status: 500 },
    );
  }
}
