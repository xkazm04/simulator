/**
 * /api/ai/evaluate-image - Image evaluation endpoint using Gemini Vision
 *
 * POST: Evaluate a generated image against criteria
 * - Fetches image from URL (Leonardo CDN)
 * - Converts to base64 data URL
 * - Sends to Gemini Vision with evaluation prompt
 * - Parses structured JSON response
 * - Returns ImageEvaluation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGeminiProvider } from '@/app/lib/ai/providers/gemini';
import { ImageEvaluation } from '@/app/features/simulator/types';
import { buildEvaluationPrompt, EvaluationRequest, EvaluationResponse, EvaluationCriteria } from '@/app/features/simulator/subfeature_brain/lib/imageEvaluator';

/**
 * Fetch image from URL and convert to base64 data URL
 */
async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return `data:${contentType};base64,${base64}`;
}

/**
 * Parse Gemini response into ImageEvaluation
 */
function parseEvaluationResponse(
  text: string,
  promptId: string,
  criteria: EvaluationCriteria
): ImageEvaluation {
  // Try to extract JSON from the response
  // Gemini sometimes wraps in markdown code blocks despite instructions
  let jsonStr = text.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate and map to ImageEvaluation
    const score = typeof parsed.score === 'number' ? parsed.score : 50;
    const threshold = criteria.approvalThreshold ?? 70;

    // Enforce approval logic even if Gemini got it wrong
    const approved = score >= threshold &&
      parsed.modeCompliance !== false &&
      (parsed.technicalScore ?? 100) >= 50;

    return {
      promptId,
      approved,
      score,
      feedback: parsed.feedback || undefined,
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : undefined,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : undefined,
    };
  } catch (parseError) {
    // If JSON parsing fails, return a conservative evaluation
    console.error('Failed to parse Gemini evaluation response:', parseError);
    console.error('Raw response:', text);

    return {
      promptId,
      approved: false,
      score: 40,
      feedback: 'Unable to evaluate - response parsing failed. Please regenerate.',
      improvements: ['Retry evaluation'],
      strengths: [],
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<EvaluationResponse>> {
  try {
    const body: EvaluationRequest = await request.json();
    const { imageUrl, promptId, criteria } = body;

    // Validate required fields
    if (!imageUrl || !promptId || !criteria) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: imageUrl, promptId, criteria' },
        { status: 400 }
      );
    }

    if (!criteria.originalPrompt) {
      return NextResponse.json(
        { success: false, error: 'Missing criteria.originalPrompt' },
        { status: 400 }
      );
    }

    // Get Gemini provider instance from factory function
    // getGeminiProvider() returns a GeminiProvider instance
    const gemini = getGeminiProvider();
    if (!gemini.isAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Gemini API not configured' },
        { status: 503 }
      );
    }

    // Fetch image and convert to data URL
    const imageDataUrl = await fetchImageAsDataUrl(imageUrl);

    // Build evaluation prompt
    const evaluationPrompt = buildEvaluationPrompt(criteria);

    // Call Gemini Vision
    const visionResponse = await gemini.analyzeImage({
      type: 'vision',
      imageDataUrl,
      prompt: evaluationPrompt,
      systemInstruction: 'You are an expert image quality evaluator. Always respond with valid JSON only, no markdown or extra text.',
      temperature: 0.3, // Lower temperature for more consistent evaluations
      maxTokens: 1024,
      metadata: { feature: 'autoplay-evaluation' },
    });

    // Parse response into ImageEvaluation
    const evaluation = parseEvaluationResponse(visionResponse.text, promptId, criteria);

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (error) {
    console.error('Image evaluation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
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
