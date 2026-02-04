/**
 * /api/ai/evaluate-poster - Poster selection endpoint using Gemini Vision
 *
 * POST: Compare multiple poster images and select the best one
 * - Fetches all poster images from URLs
 * - Sends to Gemini Vision for comparison
 * - Returns the index of the selected poster with reasoning
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGeminiProvider, parseJsonFromGeminiResponse } from '@/app/lib/ai';
import { fetchImageAsDataUrl } from '@/app/lib/ai/image-utils';
import {
  PosterSelectionRequest,
  PosterSelectionResponse,
  buildPosterSelectionPrompt,
} from '@/app/features/simulator/subfeature_brain/lib/posterEvaluator';
import { PosterSelectionResult } from '@/app/features/simulator/types';

/** Expected shape of Gemini's poster selection response */
interface GeminiPosterSelectionResponse {
  selectedIndex?: number;
  reasoning?: string;
  confidence?: number;
}

/**
 * Parse Gemini response into PosterSelectionResult
 */
function parseSelectionResponse(text: string, posterCount: number): PosterSelectionResult {
  try {
    const parsed = parseJsonFromGeminiResponse<GeminiPosterSelectionResponse>(text);

    // Validate selectedIndex is within bounds
    const selectedIndex = typeof parsed.selectedIndex === 'number'
      ? Math.min(Math.max(0, parsed.selectedIndex), posterCount - 1)
      : 0;

    return {
      selectedIndex,
      reasoning: parsed.reasoning || 'Selected based on overall quality assessment.',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 70,
    };
  } catch (parseError) {
    console.error('Failed to parse Gemini poster selection response:', parseError);
    console.error('Raw response:', text);

    // Fallback to first poster
    return {
      selectedIndex: 0,
      reasoning: 'Selection parsing failed - defaulting to first option.',
      confidence: 50,
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<PosterSelectionResponse>> {
  try {
    const body: PosterSelectionRequest = await request.json();
    const { posterUrls, criteria } = body;

    // Validate required fields
    if (!posterUrls || posterUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No poster URLs provided' },
        { status: 400 }
      );
    }

    if (!criteria) {
      return NextResponse.json(
        { success: false, error: 'Missing selection criteria' },
        { status: 400 }
      );
    }

    // If only one poster, return it immediately
    if (posterUrls.length === 1) {
      return NextResponse.json({
        success: true,
        result: {
          selectedIndex: 0,
          reasoning: 'Only one poster available - selected by default.',
          confidence: 100,
        },
      });
    }

    // Get Gemini provider
    const gemini = getGeminiProvider();
    if (!gemini.isAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Gemini API not configured' },
        { status: 503 }
      );
    }

    // Fetch all poster images and convert to data URLs
    console.log(`[evaluate-poster] Fetching ${posterUrls.length} poster images...`);
    const imageDataUrls = await Promise.all(
      posterUrls.map(url => fetchImageAsDataUrl(url))
    );

    // Build the selection prompt
    const selectionPrompt = buildPosterSelectionPrompt(criteria);

    // Call Gemini Vision with all images
    // Note: Gemini Vision can compare multiple images in a single request
    const visionResponse = await gemini.analyzeMultipleImages({
      type: 'vision',
      imageDataUrls,
      prompt: selectionPrompt,
      systemInstruction: 'You are an expert art director evaluating poster concepts. Always respond with valid JSON only, no markdown or extra text.',
      temperature: 0.4,
      maxTokens: 1500,
      metadata: { feature: 'autoplay-poster-selection' },
    });

    // Parse response
    const result = parseSelectionResponse(visionResponse.text, posterUrls.length);

    console.log(`[evaluate-poster] Selected poster ${result.selectedIndex} with confidence ${result.confidence}`);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Poster evaluation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Rate limit')) {
      return NextResponse.json(
        { success: false, error: 'Rate limited - please wait and retry' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
