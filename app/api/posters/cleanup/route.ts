/**
 * Posters Cleanup API
 *
 * POST /api/posters/cleanup - Verify poster URLs and delete dead records
 *
 * Unlike the per-project cleanup endpoint, this works across all projects.
 * Accepts poster IDs, HEAD-requests their CDN URLs, and removes records
 * returning HTTP 403 (permanently deleted on Leonardo).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/app/lib/supabase';

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
 * POST - Verify poster URLs and delete records returning 403
 */
export async function POST(request: NextRequest) {
  try {
    const { posterIds } = await request.json();

    if (!Array.isArray(posterIds) || posterIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'posterIds array is required' },
        { status: 400 },
      );
    }

    if (posterIds.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 posters per cleanup request' },
        { status: 400 },
      );
    }

    const supabase = getDb();

    // Fetch poster URLs
    const { data: posters } = await supabase
      .from(TABLES.projectPosters)
      .select('id, image_url')
      .in('id', posterIds);

    if (!posters || posters.length === 0) {
      return NextResponse.json({ success: true, deleted: [] });
    }

    // HEAD-request all URLs in parallel
    const results = await Promise.all(
      posters.map(async (poster) => ({
        id: poster.id,
        status: await checkImageUrl(poster.image_url),
      })),
    );

    // Only delete records that returned exactly 403
    const toDelete = results.filter(r => r.status === 403).map(r => r.id);

    if (toDelete.length === 0) {
      return NextResponse.json({ success: true, deleted: [] });
    }

    const { error } = await supabase
      .from(TABLES.projectPosters)
      .delete()
      .in('id', toDelete);

    if (error) {
      console.error('Posters cleanup: failed to delete:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete dead posters' },
        { status: 500 },
      );
    }

    console.log(`[Posters Cleanup] Removed ${toDelete.length} dead poster(s)`, toDelete);

    return NextResponse.json({ success: true, deleted: toDelete });
  } catch (error) {
    console.error('Posters cleanup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cleanup posters' },
      { status: 500 },
    );
  }
}
