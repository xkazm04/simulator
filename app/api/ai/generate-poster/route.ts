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
import { getLeonardoProvider, isLeonardoAvailable, AIError, checkGenerationStatus, deleteGenerations } from '@/app/lib/ai';
import {
  buildPosterPrompts,
  POSTER_SYSTEM_PROMPT,
  POSTER_VARIANTS,
  type PosterPromptContext,
} from './prompts';

interface Dimension {
  type: string;
  reference: string;
}

interface GeneratePosterRequest {
  projectId: string;
  projectName: string;
  dimensions: Dimension[];
  basePrompt: string;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const USE_REAL_API = process.env.NEXT_PUBLIC_USE_REAL_SIMULATOR_AI === 'true';

// Leonardo AI has a 1500 character limit for prompts
const LEONARDO_MAX_PROMPT_LENGTH = 1500;

/**
 * Truncate prompt to Leonardo's max length, preserving word boundaries
 */
function truncatePrompt(prompt: string): string {
  if (prompt.length <= LEONARDO_MAX_PROMPT_LENGTH) return prompt;
  const truncated = prompt.slice(0, LEONARDO_MAX_PROMPT_LENGTH - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  // Preserve word boundary if we're past 80% of the limit
  if (lastSpace > LEONARDO_MAX_PROMPT_LENGTH * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}

// ============================================================================
// POSTER PROMPT GENERATION - 4 UNIQUE VARIATIONS
// ============================================================================

interface PosterPrompts {
  prompts: string[];
}

/**
 * Generate poster prompts using Claude to enhance the base templates
 * Claude adds specific creative details while maintaining the core composition
 */
async function generatePosterPromptsWithClaude(
  context: PosterPromptContext
): Promise<PosterPrompts> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Build base prompts from templates
  const basePrompts = buildPosterPrompts(context);

  // Enhance each prompt with Claude
  const enhancedPrompts: string[] = [];

  for (let i = 0; i < basePrompts.length; i++) {
    const variant = POSTER_VARIANTS[i];
    const basePrompt = basePrompts[i];

    const userPrompt = `Enhance this ${variant.name} poster prompt for the game "${context.projectName}":

BASE PROMPT:
${basePrompt}

GAME CONCEPT:
${context.basePrompt || 'No additional concept provided'}

Enhance the prompt with specific creative details that match this game's unique identity. Keep the same structure and style, but add vivid, specific details. Return only the enhanced prompt, no explanations.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          system: POSTER_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        enhancedPrompts.push(data.content[0].text.trim());
      } else {
        // Fall back to base prompt if enhancement fails
        enhancedPrompts.push(basePrompt);
      }
    } catch {
      // Fall back to base prompt if enhancement fails
      enhancedPrompts.push(basePrompt);
    }
  }

  return { prompts: enhancedPrompts };
}

/**
 * Generate poster prompts without Claude enhancement (uses templates directly)
 */
function generateMockPosterPrompts(context: PosterPromptContext): PosterPrompts {
  return { prompts: buildPosterPrompts(context) };
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
    const { projectId, projectName, dimensions, basePrompt } = body;

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

    // Build context for poster generation
    const context: PosterPromptContext = {
      projectName: projectName || 'Untitled',
      basePrompt: basePrompt || '',
      dimensions: dimensions || [],
    };

    // Step 1: Generate 4 unique poster prompts using templates (optionally enhanced by LLM)
    let posterPrompts: PosterPrompts;
    if (USE_REAL_API && ANTHROPIC_API_KEY) {
      try {
        posterPrompts = await generatePosterPromptsWithClaude(context);
      } catch (error) {
        console.error('Claude API error, falling back to templates:', error);
        posterPrompts = generateMockPosterPrompts(context);
      }
    } else {
      posterPrompts = generateMockPosterPrompts(context);
    }

    // Step 2: Truncate prompts to Leonardo's limit and start all 4 generations in parallel
    const leonardo = getLeonardoProvider();
    const generationPromises = posterPrompts.prompts.map(async (rawPrompt, index) => {
      const prompt = truncatePrompt(rawPrompt);
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
 * Uses shared utility for consistent status checking across all generation types.
 */
export async function GET(request: NextRequest) {
  const generationId = new URL(request.url).searchParams.get('generationId');
  return checkGenerationStatus(generationId, 'image');
}

/**
 * DELETE - Delete multiple generations from Leonardo (cleanup)
 * Body: { generationIds: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await deleteGenerations(body.generationIds);

    // Return appropriate HTTP status based on result
    if (result.error === 'generationIds array is required') {
      return NextResponse.json(result, { status: 400 });
    }
    if (result.error === 'Leonardo API is not configured') {
      return NextResponse.json(result, { status: 503 });
    }

    return NextResponse.json(result);
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
