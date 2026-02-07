/**
 * /api/ai/polish-image - Gemini-based image polish endpoint
 *
 * POST: Polish a generated image using Gemini's image generation
 * - Takes image URL and polish prompt (built from evaluation feedback)
 * - Generates polished version via Gemini
 * - Re-evaluates the polished result
 * - Returns polished URL only if score improved
 *
 * This endpoint combines:
 * 1. Gemini image generation (transform mode)
 * 2. Gemini Vision evaluation
 * 3. Score comparison logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getGeminiProvider, parseJsonFromGeminiResponse } from '@/app/lib/ai';
import { ImageEvaluation, PolishResult } from '@/app/features/simulator/types';
import { buildEvaluationPrompt, EvaluationCriteria } from '@/app/features/simulator/subfeature_brain/lib/imageEvaluator';

// Gemini 2.5 Flash has native image generation capability
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

/**
 * Request payload for polish-image endpoint
 */
interface PolishRequest {
  /** URL of the image to polish */
  imageUrl: string;
  /** Prompt ID for tracking */
  promptId: string;
  /** Polish prompt built from evaluation feedback */
  polishPrompt: string;
  /** Original evaluation criteria (for re-evaluation) */
  criteria: EvaluationCriteria;
  /** Aspect ratio to maintain */
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  /** Type of polish operation */
  polishType: 'rescue' | 'excellence';
  /** Minimum score improvement required to accept polish (default: 5) */
  minScoreImprovement?: number;
  /** Original score before polish (for comparison) */
  originalScore?: number;
}

/**
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return { mimeType: contentType, data: base64 };
}

/**
 * Generate polished image using Gemini
 */
async function generatePolishedImage(
  sourceImageData: { mimeType: string; data: string },
  polishPrompt: string,
  aspectRatio: string,
  apiKey: string
): Promise<string> {
  const client = new GoogleGenAI({ apiKey });

  // Build the polish modification prompt
  const modificationPrompt = `Polish and improve this image with the following targeted refinements:

${polishPrompt}

IMPORTANT GUIDELINES:
- Keep the core composition, subject matter, and overall layout intact
- Apply subtle but impactful improvements that elevate quality
- Fix specific issues mentioned while preserving what works well
- Do NOT fundamentally change the scene or add new major elements
- The result should be a refined version of the same image, not a new image

Generate a high-quality, polished version that addresses the improvements.`;

  const response = await client.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: sourceImageData.mimeType,
              data: sourceImageData.data,
            },
          },
          {
            text: modificationPrompt,
          },
        ],
      },
    ],
    // Note: imageGenerationConfig may not be in SDK types yet, use type assertion
    config: {
      responseModalities: ['image', 'text'],
      imageGenerationConfig: {
        aspectRatio: aspectRatio,
      },
    } as Record<string, unknown>,
  });

  // Extract the generated image from response
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('No response from Gemini image generation');
  }

  const parts = candidates[0].content?.parts || [];
  let generatedImageUrl: string | null = null;

  for (const part of parts) {
    // Check for inline data (base64 image)
    if ('inlineData' in part && part.inlineData) {
      const { mimeType, data } = part.inlineData;
      generatedImageUrl = `data:${mimeType};base64,${data}`;
      break;
    }
    // Check for file data (URI reference)
    if ('fileData' in part && part.fileData) {
      generatedImageUrl = part.fileData.fileUri || null;
      break;
    }
  }

  if (!generatedImageUrl) {
    const textPart = parts.find((p) => 'text' in p && p.text);
    const errorText = textPart && 'text' in textPart ? textPart.text : 'No image generated';
    throw new Error(`Polish generation failed: ${errorText}`);
  }

  return generatedImageUrl;
}

/**
 * Evaluate a polished image using Gemini Vision
 */
async function evaluatePolishedImage(
  imageDataUrl: string,
  promptId: string,
  criteria: EvaluationCriteria
): Promise<ImageEvaluation> {
  const gemini = getGeminiProvider();
  if (!gemini.isAvailable()) {
    throw new Error('Gemini Vision API not available for evaluation');
  }

  const evaluationPrompt = buildEvaluationPrompt(criteria);

  const visionResponse = await gemini.analyzeImage({
    type: 'vision',
    imageDataUrl,
    prompt: evaluationPrompt,
    systemInstruction: 'You are an expert image quality evaluator. Always respond with valid JSON only, no markdown or extra text. Keep feedback concise (under 100 words).',
    temperature: 0.3,
    maxTokens: 2048, // Increased from 1024 to prevent truncation
    metadata: { feature: 'polish-evaluation' },
  });

  try {
    // Use robust JSON parser that handles truncation and markdown
    interface EvalResponse {
      score?: number;
      technicalScore?: number;
      goalFitScore?: number;
      aestheticScore?: number;
      modeCompliance?: boolean;
      feedback?: string;
      improvements?: string[];
      strengths?: string[];
    }
    const parsed = parseJsonFromGeminiResponse<EvalResponse>(visionResponse.text);
    const score = typeof parsed.score === 'number' ? parsed.score : 50;
    const threshold = criteria.approvalThreshold ?? 70;

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
      technicalScore: parsed.technicalScore,
      goalFitScore: parsed.goalFitScore,
      aestheticScore: parsed.aestheticScore,
      modeCompliance: parsed.modeCompliance,
    };
  } catch (parseError) {
    console.error('Failed to parse polish evaluation response:', parseError);
    return {
      promptId,
      approved: false,
      score: 40,
      feedback: 'Unable to evaluate polished image',
      improvements: ['Retry evaluation'],
      strengths: [],
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<PolishResult>> {
  const startTime = Date.now();

  try {
    const body: PolishRequest = await request.json();
    const {
      imageUrl,
      promptId,
      polishPrompt,
      criteria,
      aspectRatio = '16:9',
      polishType,
      minScoreImprovement = 5,
      originalScore,
    } = body;

    // Validate required fields
    if (!imageUrl || !promptId || !polishPrompt || !criteria) {
      return NextResponse.json({
        success: false,
        improved: false,
        error: 'Missing required fields: imageUrl, promptId, polishPrompt, criteria',
      }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        improved: false,
        error: 'GOOGLE_AI_API_KEY not configured',
      }, { status: 503 });
    }

    console.log(`[Polish] Starting ${polishType} polish for prompt ${promptId}`);

    // Step 1: Fetch source image
    let sourceImageData: { mimeType: string; data: string };
    try {
      sourceImageData = await fetchImageAsBase64(imageUrl);
    } catch (error) {
      console.error('[Polish] Failed to fetch source image:', error);
      return NextResponse.json({
        success: false,
        improved: false,
        error: 'Failed to fetch source image',
      }, { status: 400 });
    }

    // Step 2: Generate polished image
    let polishedImageUrl: string;
    try {
      polishedImageUrl = await generatePolishedImage(
        sourceImageData,
        polishPrompt,
        aspectRatio,
        apiKey
      );
      console.log(`[Polish] Generated polished image in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('[Polish] Image generation failed:', error);
      return NextResponse.json({
        success: false,
        improved: false,
        error: `Polish generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Step 3: Re-evaluate polished image
    let reEvaluation: ImageEvaluation;
    try {
      reEvaluation = await evaluatePolishedImage(polishedImageUrl, promptId, criteria);
      console.log(`[Polish] Re-evaluation complete: score ${reEvaluation.score} (original: ${originalScore ?? 'unknown'})`);
    } catch (error) {
      console.error('[Polish] Re-evaluation failed:', error);
      // If evaluation fails, we can't determine if polish improved - return failure
      return NextResponse.json({
        success: false,
        improved: false,
        error: `Re-evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Step 4: Compare scores and decide
    const scoreDelta = originalScore !== undefined
      ? reEvaluation.score - originalScore
      : 0;

    const improved = originalScore !== undefined
      ? scoreDelta >= minScoreImprovement
      : reEvaluation.approved; // If no original score, just check if approved

    const totalTime = Date.now() - startTime;
    console.log(`[Polish] Complete in ${totalTime}ms: improved=${improved}, scoreDelta=${scoreDelta}`);

    if (improved) {
      return NextResponse.json({
        success: true,
        polishedUrl: polishedImageUrl,
        reEvaluation,
        improved: true,
        scoreDelta,
      });
    } else {
      // Polish didn't improve enough - return without polished URL
      return NextResponse.json({
        success: true,
        improved: false,
        reEvaluation,
        scoreDelta,
      });
    }
  } catch (error) {
    console.error('[Polish] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      improved: false,
      error: error instanceof Error ? error.message : 'Unknown error during polish',
    }, { status: 500 });
  }
}
