/**
 * POST /api/ai/generate-poster
 * Generate a key art poster for a project using LLM + Leonardo AI
 *
 * This endpoint:
 * 1. Takes project dimensions and base prompt
 * 2. Uses Claude to create an artistic poster prompt
 * 3. Generates image with Leonardo (portrait 2:3 aspect ratio)
 * 4. Saves the poster to the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, DbProjectPoster } from '@/app/lib/db';
import { getLeonardoService, LeonardoService } from '@/app/lib/services/leonardo';

interface Dimension {
  type: string;
  reference: string;
}

interface GeneratePosterRequest {
  projectId: string;
  dimensions: Dimension[];
  basePrompt: string;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const USE_REAL_API = process.env.NEXT_PUBLIC_USE_REAL_SIMULATOR_AI === 'true';

// ============================================================================
// POSTER PROMPT GENERATION
// ============================================================================

const POSTER_SYSTEM_PROMPT = `You are a creative director designing a video game poster/key art.
Given the game's dimensions (characters, environment, mood, style), create a single impactful poster prompt.

Your poster should:
- Capture the essence of the game's identity in ONE iconic image
- Use dramatic composition typical of AAA game covers
- Feature key visual elements in an artistic, iconic way
- Focus on one powerful visual moment or composition
- Include stylistic elements like dramatic lighting, cinematic depth
- Leave space for potential title treatment (top or bottom area)
- Feel epic, memorable, and marketable

DO NOT:
- Include any text, titles, or logos in the image description
- Mention UI elements or HUD
- Describe multiple separate scenes
- Use vague or generic descriptions

OUTPUT: Return ONLY the image generation prompt text, nothing else. Make it detailed but focused.`;

async function generatePosterPromptWithClaude(
  dimensions: Dimension[],
  basePrompt: string
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const dimensionsList = dimensions
    .filter(d => d.reference && d.reference.trim())
    .map(d => `- ${d.type}: ${d.reference}`)
    .join('\n');

  const userPrompt = `Create a poster prompt for a game with these elements:

BASE CONCEPT:
${basePrompt || 'No base concept provided'}

DIMENSIONS:
${dimensionsList || 'No specific dimensions provided'}

Generate a detailed, evocative prompt for a vertical poster (2:3 aspect ratio) that captures the essence of this game.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: POSTER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text.trim();
}

function generateMockPosterPrompt(
  dimensions: Dimension[],
  basePrompt: string
): string {
  // Create a mock poster prompt based on dimensions
  const environment = dimensions.find(d => d.type === 'environment')?.reference || 'fantasy world';
  const characters = dimensions.find(d => d.type === 'characters')?.reference || 'heroic figure';
  const mood = dimensions.find(d => d.type === 'mood')?.reference || 'epic and dramatic';
  const style = dimensions.find(d => d.type === 'artStyle')?.reference || 'cinematic digital art';

  return `Epic key art poster, ${style} style. A ${characters} stands heroically in the foreground,
silhouetted against a dramatic ${environment} backdrop. ${mood} atmosphere with volumetric
lighting, god rays breaking through clouds. Cinematic composition with the figure occupying
the lower third, vast landscape stretching behind. Rich color palette, professional game
cover quality, AAA production values, highly detailed, dramatic shadows and highlights,
painterly elements blended with photorealistic details.`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GeneratePosterRequest = await request.json();
    const { projectId, dimensions, basePrompt } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Check if Leonardo API is available
    if (!LeonardoService.isAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Leonardo API key not configured' },
        { status: 503 }
      );
    }

    const db = getDb();

    // Check project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Step 1: Generate poster prompt using LLM
    let posterPrompt: string;
    if (USE_REAL_API && ANTHROPIC_API_KEY) {
      try {
        posterPrompt = await generatePosterPromptWithClaude(dimensions, basePrompt);
      } catch (error) {
        console.error('Claude API error, falling back to mock:', error);
        posterPrompt = generateMockPosterPrompt(dimensions, basePrompt);
      }
    } else {
      posterPrompt = generateMockPosterPrompt(dimensions, basePrompt);
    }

    // Step 2: Generate image with Leonardo (portrait aspect ratio)
    const leonardo = getLeonardoService();
    const generationResult = await leonardo.generateImages({
      prompt: posterPrompt,
      width: 768,   // Portrait: 2:3 aspect ratio
      height: 1152,
      numImages: 1,
    });

    if (!generationResult.success || generationResult.images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate poster image' },
        { status: 500 }
      );
    }

    const imageUrl = generationResult.images[0].url;

    // Step 3: Save poster to database (upsert)
    const existingPoster = db.prepare(
      'SELECT id FROM project_posters WHERE project_id = ?'
    ).get(projectId) as { id: string } | undefined;

    let poster: DbProjectPoster;
    const dimensionsJson = JSON.stringify(dimensions);

    if (existingPoster) {
      // Update existing poster
      db.prepare(`
        UPDATE project_posters
        SET image_url = ?, prompt = ?, dimensions_json = ?, created_at = datetime('now')
        WHERE project_id = ?
      `).run(imageUrl, posterPrompt, dimensionsJson, projectId);

      poster = db.prepare(`
        SELECT id, project_id, image_url, prompt, dimensions_json, created_at
        FROM project_posters WHERE project_id = ?
      `).get(projectId) as DbProjectPoster;
    } else {
      // Create new poster
      const posterId = uuidv4();
      db.prepare(`
        INSERT INTO project_posters (id, project_id, image_url, prompt, dimensions_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(posterId, projectId, imageUrl, posterPrompt, dimensionsJson);

      poster = db.prepare(`
        SELECT id, project_id, image_url, prompt, dimensions_json, created_at
        FROM project_posters WHERE id = ?
      `).get(posterId) as DbProjectPoster;
    }

    return NextResponse.json({
      success: true,
      poster: {
        id: poster.id,
        projectId: poster.project_id,
        imageUrl: poster.image_url,
        prompt: poster.prompt,
        dimensionsJson: poster.dimensions_json,
        createdAt: poster.created_at,
      },
    });
  } catch (error) {
    console.error('Generate poster error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate poster',
      },
      { status: 500 }
    );
  }
}
