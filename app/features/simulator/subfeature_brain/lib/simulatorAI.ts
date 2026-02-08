/**
 * Simulator AI Client Service
 *
 * Provides client-side functions to call the simulator AI API.
 */

import { DimensionType, SmartBreakdownResult, OutputMode } from '../../types';

// Re-export SmartBreakdownResult for consumers that import from this module
export type { SmartBreakdownResult } from '../../types';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ElementToDimensionResult {
  success: boolean;
  dimensions: Array<{
    type: DimensionType;
    reference: string;
    sourceElements: string[];
    confidence: number;
  }>;
  reasoning: string;
}

export interface LabelToDimensionResult {
  success: boolean;
  affectedDimensions: Array<{
    type: DimensionType;
    currentValue: string;
    newValue: string;
    changeReason: string;
    changeIntensity: 'minimal' | 'moderate' | 'significant';
  }>;
  unaffectedDimensions: DimensionType[];
  reasoning: string;
}

export interface FeedbackToDimensionResult {
  success: boolean;
  affectedDimensions: Array<{
    type: DimensionType;
    currentValue: string;
    newValue: string;
    changeReason: string;
    feedbackSource: 'preserve' | 'change';
  }>;
  unaffectedDimensions: DimensionType[];
  reasoning: string;
}

export interface GenerateWithFeedbackResult {
  success: boolean;
  adjustedDimensions: Array<{
    type: DimensionType;
    originalValue: string;
    newValue: string;
    wasModified: boolean;
    changeReason: string;
  }>;
  prompts: Array<{
    id: string;
    sceneNumber: number;
    sceneType: string;
    prompt: string;
    elements: Array<{
      id: string;
      text: string;
      category: string;
      locked: boolean;
    }>;
  }>;
  reasoning: string;
  error?: string;
}

export interface ImageDescriptionResult {
  success: boolean;
  error?: string;
  description?: {
    summary: string;
    format: {
      type: string;
      camera: string;
      composition: string;
      medium: string;
      aspectFeel: string;
    };
    preserveElements: string[];
    swappableContent: {
      environment: string;
      characters: string;
      technology: string;
      mood: string;
      style: string;
    };
    suggestedBaseDescription: string;
    suggestedOutputMode: OutputMode;
    detectedReferences: string[];
  };
}

// ============================================================================
// API CALLS
// ============================================================================

const API_BASE = '/api/ai/simulator';

/**
 * Smart Breakdown - Parse user sentence into structured dimensions
 */
export async function smartBreakdown(userInput: string): Promise<SmartBreakdownResult> {
  const response = await fetch(`${API_BASE}?action=breakdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userInput }),
  });

  if (!response.ok) {
    throw new Error(`Smart breakdown failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Element to Dimension - Convert locked elements into reusable dimensions
 */
export async function elementToDimension(
  elements: Array<{ text: string; category: string }>
): Promise<ElementToDimensionResult> {
  const response = await fetch(`${API_BASE}?action=element-to-dimension`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ elements }),
  });

  if (!response.ok) {
    throw new Error(`Element to dimension failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Label to Dimension - Gently refine dimensions based on accepted element
 */
export async function labelToDimension(
  acceptedElement: { text: string; category: string },
  currentDimensions: Array<{ type: DimensionType; reference: string }>
): Promise<LabelToDimensionResult> {
  const response = await fetch(`${API_BASE}?action=label-to-dimension`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acceptedElement, currentDimensions }),
  });

  if (!response.ok) {
    throw new Error(`Label to dimension failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Feedback to Dimension - Apply Preserve/Change feedback to dimensions
 */
export async function feedbackToDimension(
  feedback: { positive: string; negative: string },
  currentDimensions: Array<{ type: DimensionType; reference: string }>
): Promise<FeedbackToDimensionResult> {
  const response = await fetch(`${API_BASE}?action=feedback-to-dimension`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback, currentDimensions }),
  });

  if (!response.ok) {
    throw new Error(`Feedback to dimension failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Describe Image - Analyze uploaded image using Gemini Vision
 * Extracts structured description suitable for base image format
 */
export async function describeImage(imageDataUrl: string): Promise<ImageDescriptionResult> {
  const response = await fetch('/api/ai/image-describe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl }),
  });

  if (!response.ok) {
    throw new Error(`Image description failed: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// REFINE FEEDBACK TYPES
// ============================================================================

export interface RefineFeedbackInput {
  basePrompt: string;
  dimensions: Array<{ type: DimensionType; label: string; reference: string; id: string }>;
  changeFeedback: string;
  outputMode: OutputMode;
}

export interface RefineFeedbackResult {
  success: boolean;
  refinedPrompt?: string;
  refinedDimensions?: Array<{ type: DimensionType; label: string; reference: string; id: string }>;
  changes?: Array<{
    field: 'basePrompt' | 'dimension';
    dimensionType?: DimensionType;
    original: string;
    updated: string;
    reason: string;
  }>;
  reasoning?: string;
  error?: string;
}

/**
 * Refine Feedback - Apply "Change" feedback to base prompt and dimensions via LLM
 * Called before generation to update the setup based on user's refinement request
 */
export async function refineFeedback(input: RefineFeedbackInput): Promise<RefineFeedbackResult> {
  const response = await fetch(`${API_BASE}?action=refine-feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    // Return graceful failure - don't block generation
    console.error(`Refine feedback failed: ${response.status}`);
    return { success: false, error: `API error: ${response.status}` };
  }

  return response.json();
}

/**
 * Generate With Feedback - Unified API for feedback→dimension→prompt generation
 * Applies Director Control feedback to dimensions and generates prompts in one atomic call
 */
export async function generateWithFeedback(
  baseImage: string,
  dimensions: Array<{ type: DimensionType; label: string; reference: string }>,
  feedback: { positive: string; negative: string },
  outputMode: OutputMode,
  lockedElements: Array<{ id: string; text: string; category: string; locked: boolean }>,
  iterationContext?: string
): Promise<GenerateWithFeedbackResult> {
  const response = await fetch(`${API_BASE}?action=generate-with-feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseImage, dimensions, feedback, outputMode, lockedElements, iterationContext }),
  });

  if (!response.ok) {
    throw new Error(`Generate with feedback failed: ${response.status}`);
  }

  return response.json();
}
