/**
 * Generation and Feedback Prompts
 */

import {
  FeedbackToDimensionRequest,
  GenerateWithFeedbackRequest,
  RefineFeedbackRequest,
} from '../types';

// ============================================================================
// FEEDBACK TO DIMENSION
// ============================================================================

export const FEEDBACK_TO_DIM_SYSTEM_PROMPT = `You are refining image generation dimensions based on user feedback.

The user provides:
- PRESERVE feedback: Elements they want to keep/emphasize
- CHANGE feedback: Elements they want different/removed

RULES:
1. PRESERVE feedback → Strengthen/emphasize related dimensions
2. CHANGE feedback → Modify/adjust related dimensions to address the change
3. Only modify dimensions that are DIRECTLY related to the feedback
4. Most dimensions should stay UNAFFECTED
5. Changes should be SPECIFIC and ACTIONABLE for image generation

OUTPUT: Valid JSON only, no markdown.`;

export function createFeedbackToDimPrompt(body: FeedbackToDimensionRequest): string {
  const { feedback, currentDimensions } = body;
  const dimList = currentDimensions.map(d => `- [${d.type}]: "${d.reference}"`).join('\n');
  return `User feedback:
PRESERVE (keep these): "${feedback.positive || 'none'}"
CHANGE (modify these): "${feedback.negative || 'none'}"

Current dimensions:
${dimList}

Return JSON:
{
  "success": true,
  "affectedDimensions": [
    {"type": "dim type", "currentValue": "current ref", "newValue": "updated ref", "changeReason": "why", "feedbackSource": "preserve|change"}
  ],
  "unaffectedDimensions": ["type1", "type2"],
  "reasoning": "explanation of how feedback was interpreted"
}`;
}

// ============================================================================
// GENERATE WITH FEEDBACK
// ============================================================================

export const GENERATE_WITH_FEEDBACK_SYSTEM_PROMPT = `You are a creative director for image generation prompts.

Your task is to:
1. ANALYZE user feedback (preserve/change) and adjust relevant dimensions
2. GENERATE exactly 4 diverse scene prompts using adjusted dimensions

PROMPT GENERATION RULES:
- Generate exactly 4 prompts with scene types: "Cinematic Wide Shot", "Hero Portrait", "Action Sequence", "Environmental Storytelling"
- Each prompt should incorporate base format, dimensions, locked elements, output mode
- Keep prompts under 1500 characters
- Generate negativePrompt for each (blurry, watermark, bad anatomy, etc.)

ELEMENT CATEGORIES:
- composition: Camera angle, framing
- setting: Environment, world
- subject: Characters, creatures
- style: Art style, technology
- mood: Atmosphere, lighting
- quality: Technical quality

OUTPUT: Valid JSON only, no markdown code blocks.`;

export function createGenerateWithFeedbackPrompt(body: GenerateWithFeedbackRequest): string {
  const { baseImage, dimensions, feedback, outputMode, lockedElements } = body;

  const dimList = dimensions
    .filter(d => d.reference?.trim())
    .map(d => `- [${d.type}] ${d.label}: "${d.reference}"`)
    .join('\n');

  const lockedList = lockedElements.length > 0
    ? lockedElements.map(e => `- [${e.category}]: "${e.text}"`).join('\n')
    : 'None';

  return `Base Image Format: "${baseImage}"
Output Mode: ${outputMode} (${outputMode === 'gameplay' ? 'include game UI/HUD' : 'clean concept art'})

Feedback:
PRESERVE: "${feedback.positive || 'none'}"
CHANGE: "${feedback.negative || 'none'}"

Dimensions:
${dimList || 'No dimensions set'}

Locked Elements (MUST include):
${lockedList}

Return JSON:
{
  "success": true,
  "adjustedDimensions": [
    {"type": "dimType", "originalValue": "orig", "newValue": "new", "wasModified": bool, "changeReason": "why"}
  ],
  "prompts": [
    {
      "id": "unique-id",
      "sceneNumber": 1,
      "sceneType": "Cinematic Wide Shot",
      "prompt": "Full prompt text under 1500 chars",
      "negativePrompt": "blurry, low quality, watermark...",
      "elements": [{"id": "elem-1", "text": "desc", "category": "composition", "locked": false}]
    }
  ],
  "reasoning": "Brief explanation"
}`;
}

// ============================================================================
// REFINE FEEDBACK
// ============================================================================

export const REFINE_FEEDBACK_SYSTEM_PROMPT = `You are a creative director helping refine image generation parameters.

The user entered feedback in "What to Change" describing modifications they want.

CRITICAL: BE CONSERVATIVE - DO NOT REVAMP FROM ZERO
- User's existing dimension values represent their creative work
- Your job is to TWEAK existing values, not replace them entirely
- If feedback says "darker mood" - adjust the mood dimension slightly, don't rewrite it
- If feedback is vague, make MINIMAL changes or no changes at all

RULES:
1. PRESERVE user's existing work - only modify what's explicitly requested
2. Changes should be ADDITIVE refinements, not replacements
3. Only change dimensions DIRECTLY mentioned in feedback
4. If uncertain, err on the side of NO CHANGE
5. Base prompt changes: only if feedback explicitly mentions format/composition
6. Return empty refinements if feedback is unclear or too vague

WHAT NOT TO DO:
- Don't rewrite dimensions from scratch
- Don't add new content not mentioned in feedback
- Don't change things that are working well
- Don't interpret feedback too broadly

OUTPUT: Valid JSON only, no markdown code blocks.`;

export function createRefineFeedbackPrompt(body: RefineFeedbackRequest): string {
  const { basePrompt, dimensions, changeFeedback, outputMode } = body;

  const dimList = dimensions
    .filter(d => d.reference?.trim())
    .map(d => `- [${d.type}] (id: ${d.id}): "${d.reference}"`)
    .join('\n');

  return `Change Request: "${changeFeedback}"

Base Prompt: "${basePrompt}"
Output Mode: ${outputMode}

Dimensions:
${dimList || 'No dimensions set'}

Return JSON:
{
  "success": true,
  "refinedPrompt": "updated base prompt or same if no change",
  "refinedDimensions": [
    {"type": "dimType", "id": "orig-id", "label": "Label", "reference": "updated ref"}
  ],
  "changes": [
    {"field": "basePrompt|dimension", "dimensionType": "if dim", "original": "orig", "updated": "new", "reason": "why"}
  ],
  "reasoning": "Brief explanation"
}`;
}
