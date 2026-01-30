/**
 * posterEvaluator - Service for LLM-based poster selection
 *
 * Uses Gemini Vision to compare poster variations and select the best one.
 * Considers visual composition, theme adherence, and aesthetic appeal.
 */

import { PosterSelectionCriteria, PosterSelectionResult } from '../../types';

/**
 * Request payload for poster selection endpoint
 */
export interface PosterSelectionRequest {
  /** URLs of the poster images to compare (typically 4) */
  posterUrls: string[];
  /** Selection criteria */
  criteria: PosterSelectionCriteria;
}

/**
 * Response from poster selection endpoint
 */
export interface PosterSelectionResponse {
  success: boolean;
  result?: PosterSelectionResult;
  error?: string;
}

/**
 * Build the evaluation prompt for Gemini Vision poster selection
 */
export function buildPosterSelectionPrompt(criteria: PosterSelectionCriteria): string {
  const themesSection = criteria.themes.length > 0
    ? `KEY THEMES TO CONSIDER:
${criteria.themes.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : '';

  return `You are an expert art director evaluating poster concepts for a creative project.

PROJECT CONTEXT:
- Project: "${criteria.projectName}"
- Vision: "${criteria.projectVision}"
${themesSection}

You are shown ${criteria.themes.length > 0 ? 'multiple' : 'several'} poster variations (labeled 1, 2, 3, 4 from left to right or top to bottom).

EVALUATION CRITERIA:
1. VISUAL IMPACT (0-100): Does the poster immediately grab attention? Strong composition?
2. THEME ADHERENCE (0-100): How well does it capture the project's vision and themes?
3. TECHNICAL QUALITY (0-100): Rendering quality, no artifacts, proper composition
4. MARKETABILITY (0-100): Would this work as a key art piece? Does it sell the concept?

For each poster, score it on these criteria then calculate an overall score.

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks):
{
  "selectedIndex": <0-3>,
  "reasoning": "<2-3 sentences explaining why this poster is the best choice>",
  "confidence": <0-100>,
  "posterScores": [
    {"index": 0, "visual": <score>, "theme": <score>, "technical": <score>, "market": <score>, "overall": <score>},
    {"index": 1, "visual": <score>, "theme": <score>, "technical": <score>, "market": <score>, "overall": <score>},
    {"index": 2, "visual": <score>, "theme": <score>, "technical": <score>, "market": <score>, "overall": <score>},
    {"index": 3, "visual": <score>, "theme": <score>, "technical": <score>, "market": <score>, "overall": <score>}
  ]
}

SELECTION LOGIC:
- Select the poster with the highest overall score
- If scores are close (within 5 points), prefer the one with higher theme adherence
- Confidence reflects how clear the winner is (close scores = lower confidence)

Be decisive - there can only be one winner.`;
}

/**
 * Select the best poster from a set of variations using Gemini Vision
 *
 * @param posterUrls - Array of poster image URLs to compare
 * @param criteria - Selection criteria including project context
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise<PosterSelectionResult>
 */
export async function selectBestPoster(
  posterUrls: string[],
  criteria: PosterSelectionCriteria,
  signal?: AbortSignal
): Promise<PosterSelectionResult> {
  if (posterUrls.length === 0) {
    throw new Error('No poster URLs provided for selection');
  }

  // If only one poster, return it immediately
  if (posterUrls.length === 1) {
    return {
      selectedIndex: 0,
      reasoning: 'Only one poster available - selected by default.',
      confidence: 100,
    };
  }

  const response = await fetch('/api/ai/evaluate-poster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      posterUrls,
      criteria,
    } satisfies PosterSelectionRequest),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Poster selection failed: ${response.status}`);
  }

  const data: PosterSelectionResponse = await response.json();

  if (!data.success || !data.result) {
    throw new Error(data.error || 'Poster selection returned no result');
  }

  return data.result;
}

/**
 * Fallback poster selection when API fails
 * Selects the first poster as a reasonable default
 */
export function fallbackPosterSelection(posterUrls: string[]): PosterSelectionResult {
  return {
    selectedIndex: 0,
    reasoning: 'Automatic selection (evaluation unavailable) - first variation selected.',
    confidence: 50,
  };
}
