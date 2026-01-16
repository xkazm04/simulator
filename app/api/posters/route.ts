/**
 * Posters Gallery API - Get all posters across all projects
 *
 * GET /api/posters - Get all posters with project info
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

export interface PosterWithProject {
  id: string;
  project_id: string;
  project_name: string;
  image_url: string;
  prompt: string | null;
  dimensions_json: string | null;
  created_at: string;
}

/**
 * GET - Get all posters with project names
 */
export async function GET() {
  try {
    const db = getDb();

    const posters = db.prepare(`
      SELECT
        pp.id,
        pp.project_id,
        p.name as project_name,
        pp.image_url,
        pp.prompt,
        pp.dimensions_json,
        pp.created_at
      FROM project_posters pp
      JOIN projects p ON pp.project_id = p.id
      ORDER BY pp.created_at DESC
    `).all() as PosterWithProject[];

    return NextResponse.json({
      success: true,
      posters,
      count: posters.length,
    });
  } catch (error) {
    console.error('Get posters error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get posters' },
      { status: 500 }
    );
  }
}
