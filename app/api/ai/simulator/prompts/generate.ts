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

OUTPUT MODES - CRITICAL: Each mode produces DRASTICALLY different visuals:

GAMEPLAY MODE:
- Authentic video game screenshot with visible HUD/UI elements
- Include: health bars, minimap, action RPG interface, game overlays
- Style: in-game capture, video game screen
- Negative: concept art, sketch, painting, movie still

SKETCH MODE:
- Hand-drawn concept art with visible artistic technique
- Include: pencil strokes, graphite shading, sketch paper texture, loose linework, hatching
- Style: concept art sketch, rough sketch, artist workbook page
- Structure: Simplify dimensions, focus on core subjects (environment, characters)
- Negative: photorealistic, digital render, CGI, smooth gradients, game screenshot, HUD

TRAILER MODE:
- Cinematic movie still with photorealistic Hollywood production quality
- Include: anamorphic lens flare, shallow depth of field, dramatic rim lighting, film grain, volumetric lighting
- Style: blockbuster film scene, professional cinematography, IMAX quality
- Negative: cartoon, anime, sketch, game screenshot, HUD, UI elements

POSTER MODE:
- Official movie poster with dramatic marketing composition
- Include: iconic poses, title space, dramatic lighting
- Style: key art, promotional artwork, theatrical poster
- Negative: screenshot, sketch, casual

REALISTIC MODE:
- IDENTICAL scene structure to GAMEPLAY mode (same camera angles, same composition, same dimensions)
- ONLY DIFFERENCE: Replace game HUD/UI with photorealistic rendering quality
- Include: ray tracing, global illumination, ultra-detailed textures, subsurface scattering, physically based rendering, Unreal Engine 5 quality
- Style: next-gen game graphics, hyperrealistic AAA visuals, photorealistic game rendering
- CRITICAL: Use EXACT same scene/camera/content as gameplay would, just rendered photorealistically
- Negative: cartoon, anime, stylized, low poly, retro, pixel art, sketch, HUD, UI elements

PROMPT GENERATION RULES:
- Generate exactly 4 prompts with scene types: "Cinematic Wide Shot", "Hero Portrait", "Action Sequence", "Environmental Storytelling"
- Each prompt MUST follow the output mode's style requirements above
- Keep prompts under 1500 characters

ELEMENT CATEGORIES:
- composition: Camera angle, framing
- setting: Environment, world
- subject: Characters, creatures
- style: Art style, technology
- mood: Atmosphere, lighting
- quality: Technical quality

DIMENSION ADJUSTMENTS - BE CONCISE:
- Keep dimension adjustments BRIEF to avoid JSON truncation
- Only include dimensions that were ACTUALLY modified
- Skip detailed changeReason if feedback is simple

OUTPUT: Valid JSON only, no markdown code blocks.`;

/**
 * Get mode-specific generation instructions
 */
function getModeInstructions(outputMode: string): string {
  switch (outputMode) {
    case 'gameplay':
      return 'GAMEPLAY - Authentic game screenshot with visible HUD, health bars, minimap, UI overlays. Style: in-game capture.';
    case 'sketch':
      return 'SKETCH - Hand-drawn concept art with pencil strokes, graphite shading, loose linework, sketch paper texture. NO game UI. Style: artist workbook, rough sketch.';
    case 'trailer':
      return 'TRAILER - Photorealistic cinematic movie still with lens flare, shallow DOF, dramatic rim lighting, film grain. NO game UI. Style: Hollywood blockbuster.';
    case 'poster':
      return 'POSTER - Official movie poster with dramatic composition, iconic poses, title space. Style: theatrical key art.';
    case 'realistic':
      return 'REALISTIC - IDENTICAL to GAMEPLAY structure (same camera, scene, dimensions) but rendered with next-gen photorealistic graphics. Ray tracing, global illumination, UE5 quality, physically based rendering. NO HUD/UI - replace with hyperrealistic rendering.';
    default:
      return 'CONCEPT - Clean concept art without game UI.';
  }
}

export function createGenerateWithFeedbackPrompt(body: GenerateWithFeedbackRequest): string {
  const { baseImage, dimensions, feedback, outputMode, lockedElements, iterationContext } = body;

  const dimList = dimensions
    .filter(d => d.reference?.trim())
    .map(d => `- [${d.type}] ${d.label}: "${d.reference}"`)
    .join('\n');

  const lockedList = lockedElements.length > 0
    ? lockedElements.map(e => `- [${e.category}]: "${e.text}"`).join('\n')
    : 'None';

  const modeInstructions = getModeInstructions(outputMode);

  // Iteration context section (only present during autoplay)
  const contextSection = iterationContext
    ? `\nIteration History (learn from previous rounds):\n${iterationContext}\n\nUSE THIS CONTEXT to avoid repeating past mistakes and build on what worked.`
    : '';

  return `Base Image Format: "${baseImage}"
Output Mode: ${outputMode.toUpperCase()}
${modeInstructions}

Direction:
PRESERVE (strengths to keep): "${feedback.positive || 'none'}"
CHANGE (specific issues to fix): "${feedback.negative || 'none'}"
${contextSection}
Dimensions:
${dimList || 'No dimensions set'}

Locked Elements (MUST include):
${lockedList}

IMPORTANT: Keep "adjustedDimensions" array SHORT (only modified dims with brief reasons).

Return JSON:
{
  "success": true,
  "adjustedDimensions": [
    {"type": "dimType", "originalValue": "orig", "newValue": "new", "wasModified": true, "changeReason": "brief reason"}
  ],
  "prompts": [
    {
      "id": "unique-id",
      "sceneNumber": 1,
      "sceneType": "Cinematic Wide Shot",
      "prompt": "Full prompt text following ${outputMode.toUpperCase()} mode rules",
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
