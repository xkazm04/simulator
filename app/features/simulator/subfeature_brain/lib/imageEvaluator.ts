/**
 * imageEvaluator - Service for evaluating generated images via Gemini Vision
 *
 * Used by autoplay to determine:
 * 1. Should this image be saved (approved)?
 * 2. What feedback should guide the next iteration?
 *
 * The evaluation considers:
 * - Technical quality (no artifacts, proper rendering)
 * - Goal fit (matches the intended prompt/concept)
 * - Aesthetic appeal (composition, lighting, style)
 */

import { ImageEvaluation } from '../../types';

/**
 * Evaluation criteria passed to the API
 */
export interface EvaluationCriteria {
  /** The original prompt used to generate the image */
  originalPrompt: string;
  /** Key aspects that should be present (from dimensions) */
  expectedAspects: string[];
  /** Output mode affects evaluation (gameplay should have UI, concept should be clean) */
  outputMode: 'gameplay' | 'concept';
  /** Minimum score threshold for approval (0-100) */
  approvalThreshold?: number;
}

/**
 * Request payload for evaluation endpoint
 */
export interface EvaluationRequest {
  /** URL of the image to evaluate (Leonardo CDN URL) */
  imageUrl: string;
  /** Prompt ID for tracking */
  promptId: string;
  /** Evaluation criteria */
  criteria: EvaluationCriteria;
}

/**
 * Response from evaluation endpoint
 */
export interface EvaluationResponse {
  success: boolean;
  evaluation?: ImageEvaluation;
  error?: string;
}

/**
 * Build the evaluation prompt for Gemini Vision
 *
 * This prompt instructs Gemini to evaluate the image systematically
 * and return structured JSON for parsing.
 */
export function buildEvaluationPrompt(criteria: EvaluationCriteria): string {
  const modeContext = criteria.outputMode === 'gameplay'
    ? 'This is a GAMEPLAY screenshot - it should include game UI elements like HUD, health bars, or interface elements appropriate to the genre.'
    : 'This is CONCEPT ART - it should be clean without game UI overlays, focusing on artistic quality and scene composition.';

  const aspectsList = criteria.expectedAspects.length > 0
    ? `Expected aspects: ${criteria.expectedAspects.join(', ')}`
    : 'Evaluate based on general quality and coherence.';

  return `You are an expert image quality evaluator for AI-generated game visuals.

Evaluate this generated image against the following criteria:

ORIGINAL PROMPT:
"${criteria.originalPrompt}"

MODE CONTEXT:
${modeContext}

${aspectsList}

EVALUATION CRITERIA:
1. TECHNICAL QUALITY (0-100): Check for artifacts, blur, deformations, anatomical issues, rendering problems
2. GOAL FIT (0-100): How well does the image match the prompt and expected aspects?
3. AESTHETIC APPEAL (0-100): Composition, lighting, color harmony, visual interest
4. MODE COMPLIANCE: Does it correctly include/exclude UI elements based on the mode?

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks):
{
  "approved": true/false,
  "score": <overall score 0-100>,
  "technicalScore": <0-100>,
  "goalFitScore": <0-100>,
  "aestheticScore": <0-100>,
  "modeCompliance": true/false,
  "feedback": "<specific feedback for improvement if not approved>",
  "improvements": ["<specific aspect to improve>", "<another aspect>"],
  "strengths": ["<what worked well>", "<another strength>"]
}

APPROVAL LOGIC:
- Approve if overall score >= ${criteria.approvalThreshold ?? 70}
- Do NOT approve if modeCompliance is false
- Do NOT approve if technicalScore < 50 (major quality issues)

Be constructive in feedback - focus on actionable improvements for the next iteration.`;
}

/**
 * Evaluate a single generated image
 *
 * @param imageUrl - URL of the generated image (Leonardo CDN)
 * @param promptId - ID of the prompt that generated this image
 * @param criteria - Evaluation criteria
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise<ImageEvaluation>
 */
export async function evaluateImage(
  imageUrl: string,
  promptId: string,
  criteria: EvaluationCriteria,
  signal?: AbortSignal
): Promise<ImageEvaluation> {
  const response = await fetch('/api/ai/evaluate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl,
      promptId,
      criteria,
    } satisfies EvaluationRequest),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Evaluation failed: ${response.status}`);
  }

  const data: EvaluationResponse = await response.json();

  if (!data.success || !data.evaluation) {
    throw new Error(data.error || 'Evaluation returned no result');
  }

  return data.evaluation;
}

/**
 * Evaluate multiple images in parallel
 *
 * @param images - Array of {imageUrl, promptId} pairs
 * @param criteria - Shared evaluation criteria
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise<ImageEvaluation[]>
 */
export async function evaluateImages(
  images: Array<{ imageUrl: string; promptId: string }>,
  criteria: EvaluationCriteria,
  signal?: AbortSignal
): Promise<ImageEvaluation[]> {
  const evaluations = await Promise.all(
    images.map(({ imageUrl, promptId }) =>
      evaluateImage(imageUrl, promptId, criteria, signal).catch((error) => ({
        promptId,
        approved: false,
        score: 0,
        feedback: `Evaluation error: ${error.message}`,
        improvements: ['Unable to evaluate - retry recommended'],
        strengths: [],
      } satisfies ImageEvaluation))
    )
  );

  return evaluations;
}

/**
 * Extract refinement feedback from evaluation results
 *
 * Aggregates feedback from rejected images into actionable refinement
 * that can be applied to the feedback system for the next iteration.
 */
export function extractRefinementFeedback(evaluations: ImageEvaluation[]): {
  positive: string;
  negative: string;
} {
  const rejected = evaluations.filter(e => !e.approved);
  const approved = evaluations.filter(e => e.approved);

  // Gather all improvements needed
  const allImprovements = rejected.flatMap(e => e.improvements || []);
  const uniqueImprovements = [...new Set(allImprovements)];

  // Gather strengths to preserve
  const allStrengths = [...approved, ...rejected]
    .flatMap(e => e.strengths || []);
  const uniqueStrengths = [...new Set(allStrengths)];

  // Build feedback strings
  const negative = uniqueImprovements.length > 0
    ? `Avoid: ${uniqueImprovements.slice(0, 3).join(', ')}`
    : '';

  const positive = uniqueStrengths.length > 0
    ? `Keep: ${uniqueStrengths.slice(0, 3).join(', ')}`
    : '';

  return { positive, negative };
}
