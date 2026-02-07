/**
 * /api/ai/analyze-diversity - Gemini Vision endpoint for diversity fingerprinting
 *
 * POST: Analyze an image and extract visual characteristics for diversity tracking
 * - Takes an image URL
 * - Uses Gemini Vision to extract visual fingerprint
 * - Returns structured features for diversity inventory
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGeminiProvider, parseJsonFromGeminiResponse } from '@/app/lib/ai';

/**
 * Request payload
 */
interface AnalyzeDiversityRequest {
  imageUrl: string;
}

/**
 * Visual fingerprint features
 */
interface VisualFeatures {
  colorTone: string;
  composition: 'wide' | 'medium' | 'close-up' | 'portrait' | 'action' | 'environmental';
  subjectFocus: 'character' | 'environment' | 'action' | 'object' | 'group';
  mood: 'dramatic' | 'peaceful' | 'tense' | 'mysterious' | 'energetic' | 'melancholic';
  lighting: 'day' | 'night' | 'golden-hour' | 'dawn' | 'artificial' | 'dramatic';
  cameraAngle: 'eye-level' | 'low-angle' | 'high-angle' | 'aerial' | 'dutch' | 'over-shoulder';
  activity: 'static' | 'subtle' | 'dynamic' | 'intense';
}

/**
 * Response payload
 */
interface AnalyzeDiversityResponse {
  success: boolean;
  fingerprint?: VisualFeatures;
  error?: string;
}

/**
 * Build the analysis prompt for Gemini Vision
 */
function buildAnalysisPrompt(): string {
  return `Analyze this image and classify its visual characteristics.

You MUST respond with valid JSON only (no markdown, no explanation).
Choose EXACTLY ONE option from each category.

{
  "colorTone": "warm golden" | "cool blue" | "dark moody" | "vibrant" | "muted" | "monochromatic",
  "composition": "wide" | "medium" | "close-up" | "portrait" | "action" | "environmental",
  "subjectFocus": "character" | "environment" | "action" | "object" | "group",
  "mood": "dramatic" | "peaceful" | "tense" | "mysterious" | "energetic" | "melancholic",
  "lighting": "day" | "night" | "golden-hour" | "dawn" | "artificial" | "dramatic",
  "cameraAngle": "eye-level" | "low-angle" | "high-angle" | "aerial" | "dutch" | "over-shoulder",
  "activity": "static" | "subtle" | "dynamic" | "intense"
}

DEFINITIONS:
- colorTone: Dominant color temperature/feeling
- composition: Shot framing and scope
- subjectFocus: What the image primarily shows
- mood: Emotional atmosphere conveyed
- lighting: Light source and time of day
- cameraAngle: Virtual camera position
- activity: Level of motion/action in the scene`;
}

/**
 * Validate and normalize the fingerprint response
 */
function validateFingerprint(data: unknown): VisualFeatures | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;

  // Valid options for each field
  const validOptions = {
    composition: ['wide', 'medium', 'close-up', 'portrait', 'action', 'environmental'],
    subjectFocus: ['character', 'environment', 'action', 'object', 'group'],
    mood: ['dramatic', 'peaceful', 'tense', 'mysterious', 'energetic', 'melancholic'],
    lighting: ['day', 'night', 'golden-hour', 'dawn', 'artificial', 'dramatic'],
    cameraAngle: ['eye-level', 'low-angle', 'high-angle', 'aerial', 'dutch', 'over-shoulder'],
    activity: ['static', 'subtle', 'dynamic', 'intense'],
  };

  // Normalize composition (handle variations)
  let composition = d.composition as string;
  if (composition === 'close up' || composition === 'closeup') composition = 'close-up';
  if (!validOptions.composition.includes(composition)) composition = 'medium';

  // Normalize subject focus
  let subjectFocus = d.subjectFocus as string;
  if (!validOptions.subjectFocus.includes(subjectFocus)) subjectFocus = 'environment';

  // Normalize mood
  let mood = d.mood as string;
  if (!validOptions.mood.includes(mood)) mood = 'dramatic';

  // Normalize lighting (handle variations)
  let lighting = d.lighting as string;
  if (lighting === 'golden hour' || lighting === 'sunset') lighting = 'golden-hour';
  if (!validOptions.lighting.includes(lighting)) lighting = 'day';

  // Normalize camera angle (handle variations)
  let cameraAngle = d.cameraAngle as string;
  if (cameraAngle === 'eye level') cameraAngle = 'eye-level';
  if (cameraAngle === 'low angle') cameraAngle = 'low-angle';
  if (cameraAngle === 'high angle') cameraAngle = 'high-angle';
  if (cameraAngle === 'over shoulder') cameraAngle = 'over-shoulder';
  if (!validOptions.cameraAngle.includes(cameraAngle)) cameraAngle = 'eye-level';

  // Normalize activity
  let activity = d.activity as string;
  if (!validOptions.activity.includes(activity)) activity = 'subtle';

  // Color tone is free-form but should be a string
  const colorTone = typeof d.colorTone === 'string' ? d.colorTone : 'neutral';

  return {
    colorTone,
    composition: composition as VisualFeatures['composition'],
    subjectFocus: subjectFocus as VisualFeatures['subjectFocus'],
    mood: mood as VisualFeatures['mood'],
    lighting: lighting as VisualFeatures['lighting'],
    cameraAngle: cameraAngle as VisualFeatures['cameraAngle'],
    activity: activity as VisualFeatures['activity'],
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalyzeDiversityResponse>> {
  try {
    const body: AnalyzeDiversityRequest = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: imageUrl',
      }, { status: 400 });
    }

    const gemini = getGeminiProvider();
    if (!gemini.isAvailable()) {
      return NextResponse.json({
        success: false,
        error: 'Gemini Vision API not available',
      }, { status: 503 });
    }

    // Analyze the image
    const analysisPrompt = buildAnalysisPrompt();

    const response = await gemini.analyzeImage({
      type: 'vision',
      imageDataUrl: imageUrl,
      prompt: analysisPrompt,
      systemInstruction: 'You are a precise image classifier. Respond ONLY with valid JSON, no markdown or extra text.',
      temperature: 0.2, // Low temperature for consistent classification
      maxTokens: 512,
      metadata: { feature: 'diversity-analysis' },
    });

    // Parse the response
    const parsed = parseJsonFromGeminiResponse<Record<string, unknown>>(response.text);
    const fingerprint = validateFingerprint(parsed);

    if (!fingerprint) {
      console.error('[Diversity] Failed to parse fingerprint:', response.text);
      return NextResponse.json({
        success: false,
        error: 'Failed to parse visual features',
      });
    }

    return NextResponse.json({
      success: true,
      fingerprint,
    });

  } catch (error) {
    console.error('[Diversity] Analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during analysis',
    }, { status: 500 });
  }
}
