/**
 * Smart Breakdown and Element-to-Dimension Prompts
 */

import { ElementToDimensionRequest, LabelToDimensionRequest } from '../types';

// ============================================================================
// SMART BREAKDOWN
// ============================================================================

export const BREAKDOWN_SYSTEM_PROMPT = `You are a creative AI assistant specializing in visual concept transformation. Parse user's creative vision into structured components.

CORE CONCEPT: Content-Swap Transformation
- PRESERVE the base visual FORMAT (camera angles, UI layout, medium)
- SWAP the CONTENT within that structure

Example: "Baldur's Gate in Star Wars" means:
- BASE: Isometric RPG screenshot (format preserved)
- SWAPS: tavern→cantina, wizard→Jedi, sword→lightsaber

DIMENSION TYPES:
- environment: World/universe/setting
- artStyle: Visual rendering style
- characters: Who appears
- mood: Emotional atmosphere
- action: What's happening
- technology: Weapons, items, props
- creatures: Non-human beings
- gameUI: Game interface elements
- camera: Specific POV (if different from base)
- era: Time period
- genre: Overall genre treatment
- custom: Anything else

OUTPUT: Valid JSON only, no markdown.`;

export function createBreakdownPrompt(userInput: string): string {
  return `Parse this creative vision: "${userInput}"

Return JSON:
{
  "success": true,
  "baseImage": {
    "description": "Detailed FORMAT description (camera, UI style, medium)",
    "format": "Short name like 'isometric RPG screenshot'",
    "keyElements": ["element1", "element2"]
  },
  "dimensions": [
    {"type": "environment|artStyle|characters|etc", "reference": "detailed description", "confidence": 0.0-1.0}
  ],
  "suggestedOutputMode": "gameplay|sketch|trailer|poster",
  "reasoning": "brief interpretation"
}`;
}

// ============================================================================
// ELEMENT TO DIMENSION
// ============================================================================

export const ELEMENT_TO_DIM_SYSTEM_PROMPT = `Convert locked prompt elements into reusable dimension cards.

Element category → Dimension type mapping:
- composition → camera
- setting → environment
- subject → characters/creatures
- style → artStyle
- mood → mood
- lighting → artStyle
- quality → skip or merge

Expand terse elements into fuller descriptions. Combine related elements.

OUTPUT: Valid JSON only, no markdown.`;

export function createElementToDimPrompt(elements: ElementToDimensionRequest['elements']): string {
  const list = elements.map(e => `- [${e.category}]: "${e.text}"`).join('\n');
  return `Convert these elements to dimensions:\n${list}\n\nReturn JSON:
{
  "success": true,
  "dimensions": [
    {"type": "dimension type", "reference": "expanded description", "sourceElements": ["cat1"], "confidence": 0.0-1.0}
  ],
  "reasoning": "brief explanation"
}`;
}

// ============================================================================
// LABEL TO DIMENSION (Gentle Refinement)
// ============================================================================

export const LABEL_TO_DIM_SYSTEM_PROMPT = `Gently adjust dimensions based on user accepting a specific element.

CRITICAL RULES:
1. MOST dimensions stay UNAFFECTED
2. Only modify DIRECTLY related dimensions
3. Changes should be ADDITIVE, not replacement
4. changeIntensity: almost always "minimal" or "moderate"
5. Preserve user's existing work

OUTPUT: Valid JSON only, no markdown.`;

export function createLabelToDimPrompt(body: LabelToDimensionRequest): string {
  const { acceptedElement, currentDimensions } = body;
  const dimList = currentDimensions.map(d => `- [${d.type}]: "${d.reference}"`).join('\n');
  return `User accepted: [${acceptedElement.category}]: "${acceptedElement.text}"

Current dimensions:
${dimList}

Return JSON:
{
  "success": true,
  "affectedDimensions": [
    {"type": "dim type", "currentValue": "current", "newValue": "gently modified", "changeReason": "why", "changeIntensity": "minimal|moderate|significant"}
  ],
  "unaffectedDimensions": ["type1", "type2"],
  "reasoning": "strategy explanation"
}`;
}
