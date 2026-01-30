/**
 * Posters Gallery API - Get all posters across all projects
 *
 * GET /api/posters - Get all posters with project info
 */

import { NextResponse } from 'next/server';
import { getDb, TABLES } from '@/app/lib/supabase';

export interface PosterWithProject {
  id: string;
  project_id: string;
  project_name: string;
  image_url: string;
  prompt: string | null;
  dimensions_json: Record<string, unknown>[] | null;
  created_at: string;
}

/**
 * GET - Get all posters with project names
 */
export async function GET() {
  try {
    const supabase = getDb();

    // Join posters with projects to get project names
    const { data: posters, error } = await supabase
      .from(TABLES.projectPosters)
      .select(`
        id,
        project_id,
        image_url,
        prompt,
        dimensions_json,
        created_at,
        simulator_projects!inner (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get posters error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get posters' },
        { status: 500 }
      );
    }

    // Transform the data to flatten the join
    // Supabase returns the joined relation as an object (not array) when using !inner
    const transformedPosters: PosterWithProject[] = (posters || []).map((poster) => {
      // Handle both array and object project relation
      const projectData = Array.isArray(poster.simulator_projects) ? poster.simulator_projects[0] : poster.simulator_projects;
      return {
        id: poster.id,
        project_id: poster.project_id,
        project_name: projectData?.name || 'Unknown',
        image_url: poster.image_url,
        prompt: poster.prompt,
        dimensions_json: poster.dimensions_json,
        created_at: poster.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      posters: transformedPosters,
      count: transformedPosters.length,
    });
  } catch (error) {
    console.error('Get posters error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get posters' },
      { status: 500 }
    );
  }
}
