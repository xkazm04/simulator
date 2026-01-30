/**
 * Seed API - Inject project ideas into database
 *
 * POST /api/seed/project-ideas - Create sample projects from curated ideas
 * GET /api/seed/project-ideas - List available project ideas
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/app/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { PROJECT_IDEAS, ProjectIdea } from './data';

/**
 * GET - List available project ideas
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    count: PROJECT_IDEAS.length,
    ideas: PROJECT_IDEAS.map(idea => ({
      id: idea.id,
      title: idea.title,
      category: idea.category,
      dimensionCount: idea.dimensions.length,
    })),
  });
}

/**
 * POST - Seed project ideas into database
 *
 * Body: { all: true } | { ids: string[] } | { id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getDb();

    const ideasToCreate = resolveIdeas(body);

    if (ideasToCreate.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid project ideas specified. Use { all: true }, { ids: [...] }, or { id: "..." }' },
        { status: 400 }
      );
    }

    const createdProjects = await createProjects(supabase, ideasToCreate);

    return NextResponse.json({
      success: true,
      message: `Created ${createdProjects.length} project(s)`,
      projects: createdProjects,
    });
  } catch (error) {
    console.error('Seed projects error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed projects' },
      { status: 500 }
    );
  }
}

function resolveIdeas(body: { all?: boolean; ids?: string[]; id?: string }): ProjectIdea[] {
  if (body.all) return PROJECT_IDEAS;
  if (body.ids?.length) return PROJECT_IDEAS.filter(idea => body.ids!.includes(idea.id));
  if (body.id) {
    const idea = PROJECT_IDEAS.find(i => i.id === body.id);
    return idea ? [idea] : [];
  }
  return [];
}

async function createProjects(
  supabase: ReturnType<typeof getDb>,
  ideas: ProjectIdea[]
): Promise<Array<{ id: string; name: string; ideaId: string }>> {
  const created: Array<{ id: string; name: string; ideaId: string }> = [];

  for (const idea of ideas) {
    const projectId = uuidv4();
    const now = new Date().toISOString();

    const { error: projectError } = await supabase
      .from(TABLES.projects)
      .insert({ id: projectId, name: idea.title, created_at: now, updated_at: now });

    if (projectError) {
      console.error('Error creating project:', projectError);
      continue;
    }

    const dimensionsWithIds = idea.dimensions.map((dim, i) => ({
      id: `dim-${i}`,
      ...dim,
      weight: 100,
    }));

    const { error: stateError } = await supabase
      .from(TABLES.projectState)
      .insert({
        project_id: projectId,
        base_prompt: idea.basePrompt,
        output_mode: 'gameplay',
        dimensions_json: dimensionsWithIds,
        feedback_json: { positive: '', negative: '' },
        updated_at: now,
      });

    if (stateError) {
      console.error('Error creating project state:', stateError);
      await supabase.from(TABLES.projects).delete().eq('id', projectId);
      continue;
    }

    created.push({ id: projectId, name: idea.title, ideaId: idea.id });
  }

  return created;
}
