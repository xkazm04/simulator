/**
 * POST /api/ai/generate-poster
 * Generate 4 unique poster variations using LLM + Leonardo AI
 *
 * This endpoint:
 * 1. Takes project dimensions and base prompt
 * 2. Uses Claude to create 4 unique poster prompts
 * 3. Generates 4 images with Leonardo (portrait 2:3 aspect ratio)
 * 4. Returns generations for polling (NOT auto-saved)
 *
 * GET /api/ai/generate-poster?generationId=xxx
 * Check status of a generation
 *
 * DELETE /api/ai/generate-poster
 * Delete multiple generations from Leonardo (cleanup)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeonardoProvider, isLeonardoAvailable, AIError } from '@/app/lib/ai';

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
// POSTER PROMPT GENERATION - 4 UNIQUE VARIATIONS
// ============================================================================

const POSTER_SYSTEM_PROMPT = `You are a creative director designing video game poster/key art variations.
Given the game's dimensions (characters, environment, mood, style), create EXACTLY 4 unique poster prompts.

Each poster should be DISTINCTLY DIFFERENT in terms of:
1. CAMERA ANGLE: Wide establishing shot, close-up portrait, dramatic low angle, bird's eye view, etc.
2. ART STYLE: Painterly, photorealistic, stylized, minimalist, graphic novel, etc.
3. COMPOSITION: Action scene, contemplative moment, character portrait, landscape, symbolic, etc.
4. LIGHTING: Golden hour, dramatic backlighting, neon-lit, moody shadows, etc.

Your posters should:
- Capture the essence of the game's identity
- Use dramatic composition typical of AAA game covers
- Feature key visual elements in artistic, iconic ways
- Include stylistic elements like dramatic lighting, cinematic depth
- Feel epic, memorable, and marketable

DO NOT:
- Include any text, titles, or logos
- Mention UI elements or HUD
- Make similar prompts - each MUST be visually distinct
- Use vague or generic descriptions

OUTPUT: Return EXACTLY 4 prompts separated by "---" on its own line. Each prompt should be detailed but focused.`;

interface PosterPrompts {
  prompts: string[];
}

async function generatePosterPromptsWithClaude(
  dimensions: Dimension[],
  basePrompt: string
): Promise<PosterPrompts> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const dimensionsList = dimensions
    .filter(d => d.reference && d.reference.trim())
    .map(d => `- ${d.type}: ${d.reference}`)
    .join('\n');

  const userPrompt = `Create 4 unique poster prompts for a game with these elements:

BASE CONCEPT:
${basePrompt || 'No base concept provided'}

DIMENSIONS:
${dimensionsList || 'No specific dimensions provided'}

Generate 4 detailed, evocative prompts for vertical posters (2:3 aspect ratio) that capture the essence of this game.
Each poster MUST be visually distinct - different angle, different style, different composition.
Separate each prompt with "---" on its own line.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
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
  const fullText = data.content[0].text.trim();

  // Split by --- separator
  const prompts = fullText
    .split(/---+/)
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0)
    .slice(0, 4);

  // Ensure we have exactly 4 prompts
  while (prompts.length < 4) {
    prompts.push(prompts[0] || 'Epic game poster with dramatic lighting');
  }

  return { prompts: prompts.slice(0, 4) };
}

function generateMockPosterPrompts(
  dimensions: Dimension[],
  basePrompt: string
): PosterPrompts {
  const environment = dimensions.find(d => d.type === 'environment')?.reference || 'fantasy world';
  const characters = dimensions.find(d => d.type === 'characters')?.reference || 'heroic figure';
  const mood = dimensions.find(d => d.type === 'mood')?.reference || 'epic and dramatic';
  const style = dimensions.find(d => d.type === 'artStyle')?.reference || 'cinematic digital art';

  const prompts = [
    // Wide establishing shot
    `Epic wide establishing shot, ${style} style. A vast ${environment} stretches across the frame, ${characters} as small silhouettes against the massive landscape. ${mood} atmosphere with volumetric lighting, god rays breaking through clouds. Cinematic composition, professional game cover quality, AAA production values.`,
    // Close-up portrait
    `Intimate close-up portrait, ${style} style. Detailed face of ${characters}, eyes reflecting ${environment}. ${mood} expression, dramatic side lighting casting deep shadows. Painterly brushstrokes, emotional depth, character-focused key art.`,
    // Dramatic low angle
    `Dramatic low-angle hero shot, ${style} style. ${characters} towers against a ${environment} sky, cape or elements flowing in the wind. ${mood} backlighting creates a powerful silhouette. Bold composition, action movie poster style, dynamic energy.`,
    // Minimalist symbolic
    `Minimalist symbolic poster, ${style} style. Abstract representation of ${environment} with ${characters} as a central icon. ${mood} color palette, negative space design. Modern graphic design approach, clean lines, striking visual identity.`,
  ];

  return { prompts };
}

// ============================================================================
// MAIN HANDLERS
// ============================================================================

/**
 * POST - Start poster generation (4 unique variations)
 */
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

    if (!isLeonardoAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Leonardo API key not configured' },
        { status: 503 }
      );
    }

    // Step 1: Generate 4 unique poster prompts using LLM
    let posterPrompts: PosterPrompts;
    if (USE_REAL_API && ANTHROPIC_API_KEY) {
      try {
        posterPrompts = await generatePosterPromptsWithClaude(dimensions, basePrompt);
      } catch (error) {
        console.error('Claude API error, falling back to mock:', error);
        posterPrompts = generateMockPosterPrompts(dimensions, basePrompt);
      }
    } else {
      posterPrompts = generateMockPosterPrompts(dimensions, basePrompt);
    }

    // Step 2: Start all 4 generations in parallel
    const leonardo = getLeonardoProvider();
    const generationPromises = posterPrompts.prompts.map(async (prompt, index) => {
      try {
        const result = await leonardo.startGeneration({
          type: 'image-generation',
          prompt,
          width: 768,   // Portrait: 2:3 aspect ratio
          height: 1152,
          numImages: 1,
          metadata: { feature: 'generate-poster', index, projectId },
        });

        return {
          index,
          generationId: result.generationId,
          prompt,
          status: 'started' as const,
        };
      } catch (error) {
        const errorMessage = error instanceof AIError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : 'Unknown error';
        return {
          index,
          generationId: '',
          prompt,
          status: 'failed' as const,
          error: errorMessage,
        };
      }
    });

    const generations = await Promise.all(generationPromises);

    return NextResponse.json({
      success: true,
      generations,
      dimensionsJson: JSON.stringify(dimensions),
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

/**
 * GET - Check generation status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('generationId');

    if (!generationId) {
      return NextResponse.json(
        { success: false, error: 'generationId parameter is required' },
        { status: 400 }
      );
    }

    if (!isLeonardoAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Leonardo API key not configured' },
        { status: 503 }
      );
    }

    const leonardo = getLeonardoProvider();
    const result = await leonardo.checkGeneration(generationId);

    return NextResponse.json({
      success: true,
      generationId,
      ...result,
    });
  } catch (error) {
    console.error('Check generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check generation status'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete multiple generations from Leonardo (cleanup)
 * Body: { generationIds: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { generationIds } = body;

    if (!generationIds || !Array.isArray(generationIds)) {
      return NextResponse.json(
        { success: false, error: 'generationIds array is required', deleted: [], failed: [] },
        { status: 400 }
      );
    }

    const validIds = generationIds.filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0
    );

    if (validIds.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: [],
        failed: [],
        message: 'No valid generation IDs provided',
      });
    }

    if (!isLeonardoAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Leonardo API is not configured',
          deleted: [],
          failed: validIds.map(id => ({ id, error: 'API not configured' })),
        },
        { status: 503 }
      );
    }

    const leonardo = getLeonardoProvider();
    const deleted: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const deletePromises = validIds.map(async (generationId) => {
      try {
        await leonardo.deleteGeneration(generationId);
        return { id: generationId, success: true };
      } catch (error) {
        const errorMsg = error instanceof AIError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error';
        if (errorMsg.includes('404') || errorMsg.includes('not found')) {
          return { id: generationId, success: true };
        }
        return { id: generationId, success: false, error: errorMsg };
      }
    });

    const results = await Promise.allSettled(deletePromises);

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { id, success, error } = result.value;
        if (success) {
          deleted.push(id);
        } else {
          failed.push({ id, error: error || 'Unknown error' });
        }
      }
    });

    if (failed.length > 0) {
      console.error('Batch delete partial failures:', { failed });
    }

    return NextResponse.json({
      success: failed.length === 0,
      deleted,
      failed,
    });
  } catch (error) {
    console.error('Delete generations error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete generations',
        deleted: [],
        failed: [],
      },
      { status: 500 }
    );
  }
}
