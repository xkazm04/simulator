/**
 * LLM Prompt Templates for Simulator Features
 *
 * These prompts are designed to work with Anthropic's Claude API.
 * Each returns strict JSON for reliable parsing.
 */

import { DimensionType, OutputMode } from '../../types';

// ============================================================================
// RESPONSE TYPES - Strict JSON structures for LLM responses
// ============================================================================

/**
 * Response from Smart Breakdown feature
 */
export interface SmartBreakdownResponse {
  success: boolean;
  baseImage: {
    description: string;
    format: string;  // e.g., "isometric RPG screenshot", "FPS gameplay view"
    keyElements: string[];  // What makes this format distinctive
  };
  dimensions: Array<{
    type: DimensionType;
    reference: string;
    confidence: number;  // 0-1, how confident the extraction is
  }>;
  suggestedOutputMode: OutputMode;
  reasoning: string;  // Brief explanation of the interpretation
}

/**
 * Response from Label-to-Dimensions feature
 */
export interface LabelToDimensionsResponse {
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

// ============================================================================
// PROMPT 1: SMART BREAKDOWN
// Converts a user's sentence into structured dimensions
// ============================================================================

export const SMART_BREAKDOWN_SYSTEM_PROMPT = `You are a creative AI assistant specializing in visual concept transformation. Your task is to parse a user's creative vision into structured components for image generation.

## CORE CONCEPT: Content-Swap Transformation

The key principle is: PRESERVE the base visual FORMAT (camera angles, UI layout, medium characteristics) and SWAP the CONTENT within that structure.

Example: "Baldur's Gate in Star Wars" means:
- BASE FORMAT: Isometric RPG screenshot (top-down 3/4 view, party formation, painted backgrounds, CRPG interface)
- CONTENT SWAP: Fantasy tavern → Star Wars cantina, wizard → Jedi, sword → lightsaber
- The OUTPUT still looks like a Baldur's Gate screenshot, just with Star Wars content

## DIMENSION TYPES

Available dimension types and their purposes:
- environment: The world/universe/setting (Star Wars galaxy, Middle-earth, etc.)
- artStyle: Visual rendering style (photorealistic, anime, painted, etc.)
- characters: Who appears and how they look
- mood: Emotional atmosphere and tone
- action: What's happening in the scene
- era: Time period or technology level
- camera: Specific camera angle or POV (if different from base format)
- technology: Weapons, items, props, tech level
- creatures: Non-human beings, monsters, animals
- gameUI: Game interface elements (only for gameplay mode)
- genre: Overall genre treatment
- custom: Anything else specific

## OUTPUT RULES

1. Base image should describe the VISUAL FORMAT to preserve, not the content
2. Dimensions describe what REPLACES the original content
3. Only include dimensions that are clearly indicated or strongly implied
4. Confidence should reflect how explicitly the user mentioned this aspect
5. suggestedOutputMode options:
   - "gameplay": Game screenshot with HUD/UI elements (default for game references)
   - "sketch": Hand-drawn concept art with visible linework (for artistic/concept mentions)
   - "trailer": Cinematic movie scene for video/animation (for action/movie references)
   - "poster": Key art poster composition (only for explicit poster mentions)

Respond ONLY with valid JSON matching the specified structure.`;

export function createSmartBreakdownPrompt(userInput: string): string {
  return `Parse this creative vision into structured dimensions:

"${userInput}"

Respond with JSON matching this exact structure:
{
  "success": true,
  "baseImage": {
    "description": "Detailed description of the visual FORMAT to preserve (camera angle, UI style, medium characteristics)",
    "format": "Short format name (e.g., 'isometric RPG screenshot', 'FPS gameplay view', 'anime battle frame')",
    "keyElements": ["element1", "element2", "..."]
  },
  "dimensions": [
    {
      "type": "environment|artStyle|characters|mood|action|era|camera|technology|creatures|gameUI|genre|custom",
      "reference": "Detailed description of what this dimension should be",
      "confidence": 0.0-1.0
    }
  ],
  "suggestedOutputMode": "gameplay|sketch|trailer|poster",
  "reasoning": "Brief explanation of how you interpreted the user's vision"
}

Important:
- baseImage.description should describe the VISUAL FORMAT (how it's framed/presented), not the content
- Each dimension describes CONTENT to swap into that format
- Only include dimensions with confidence > 0.5
- If user mentions a specific game/movie/show, research its visual characteristics`;
}

// ============================================================================
// PROMPT 2: ELEMENT TO DIMENSIONS
// Converts locked prompt elements back into dimension suggestions
// ============================================================================

export const ELEMENT_TO_DIMENSIONS_SYSTEM_PROMPT = `You are a creative AI assistant that helps users build reusable dimension presets from successful prompt elements.

## CONTEXT

Users have generated image prompts and locked certain elements they like. Your job is to convert these locked elements into proper dimension cards they can reuse.

## ELEMENT CATEGORIES AND DIMENSION MAPPING

Element categories map to dimensions as follows:
- composition → camera (framing, shot type)
- setting → environment (world, location)
- subject → characters OR creatures (depending on content)
- style → artStyle (rendering style)
- mood → mood (atmosphere)
- lighting → artStyle (can contribute to style)
- quality → (usually not a dimension, skip or merge with artStyle)

## OUTPUT RULES

1. Expand terse element text into fuller dimension descriptions
2. Combine related elements when they map to the same dimension
3. Make descriptions specific enough to be reusable
4. Preserve the user's successful choices

Respond ONLY with valid JSON.`;

export function createElementToDimensionsPrompt(
  elements: Array<{ text: string; category: string }>
): string {
  const elementsList = elements
    .map(e => `- [${e.category}]: "${e.text}"`)
    .join('\n');

  return `Convert these locked prompt elements into reusable dimensions:

LOCKED ELEMENTS:
${elementsList}

Respond with JSON matching this structure:
{
  "success": true,
  "dimensions": [
    {
      "type": "environment|artStyle|characters|mood|action|era|camera|technology|creatures|custom",
      "reference": "Expanded description suitable for a dimension card",
      "sourceElements": ["category1", "category2"],
      "confidence": 0.0-1.0
    }
  ],
  "reasoning": "Brief explanation of how you grouped and expanded the elements"
}

Rules:
- Expand short element text into fuller descriptions (e.g., "wide shot" → "cinematic wide establishing shot with deep depth of field")
- Combine elements that naturally belong together
- Skip 'quality' elements unless they define a specific style
- Make descriptions specific and reusable`;
}

// ============================================================================
// PROMPT 3: LABEL TO DIMENSIONS (Gentle Refinement)
// When user accepts a label, gently adjust affected dimensions
// ============================================================================

export const LABEL_TO_DIMENSIONS_SYSTEM_PROMPT = `You are a creative AI assistant that helps refine dimension values based on user feedback.

## CONTEXT

The user has generated prompts and decided to "accept" a specific element/label from the output. This indicates they want MORE of that quality in future generations. Your job is to GENTLY adjust the relevant dimensions to incorporate this preference.

## CRITICAL RULES FOR GENTLE ADJUSTMENT

1. MOST dimensions should remain UNAFFECTED
2. Only modify dimensions that are DIRECTLY related to the accepted element
3. Changes should be ADDITIVE, not replacement - enhance what's there, don't overwrite
4. changeIntensity should almost always be "minimal" or "moderate", rarely "significant"
5. Preserve the user's existing work - they've spent effort crafting these dimensions

## CHANGE INTENSITY GUIDE

- minimal: Add a small qualifier or emphasis (e.g., "Star Wars cantina" → "Star Wars cantina with dramatic lighting")
- moderate: Expand or shift focus slightly (e.g., "modern graphics" → "modern graphics with emphasis on volumetric lighting")
- significant: Only if the element fundamentally changes the direction (rare)

## EXAMPLES

User accepts [lighting: rim lighting] element:
- AFFECTED: artStyle dimension might add "with prominent rim lighting"
- AFFECTED: mood dimension might add "dramatic edge-lit atmosphere"
- UNAFFECTED: environment, characters, technology, etc.

User accepts [subject: Mandalorian warrior] element:
- AFFECTED: characters dimension should emphasize Mandalorian presence
- UNAFFECTED: environment, artStyle, mood, technology (unless directly related)

Respond ONLY with valid JSON.`;

export function createLabelToDimensionsPrompt(
  acceptedElement: { text: string; category: string },
  currentDimensions: Array<{ type: DimensionType; reference: string }>
): string {
  const dimensionsList = currentDimensions
    .map(d => `- [${d.type}]: "${d.reference}"`)
    .join('\n');

  return `The user accepted this element from a generated prompt, indicating they want more of this quality:

ACCEPTED ELEMENT:
- Category: ${acceptedElement.category}
- Text: "${acceptedElement.text}"

CURRENT DIMENSIONS:
${dimensionsList}

Gently adjust the relevant dimensions to incorporate this preference.

Respond with JSON matching this structure:
{
  "success": true,
  "affectedDimensions": [
    {
      "type": "the dimension type being modified",
      "currentValue": "the current dimension reference",
      "newValue": "the gently modified reference incorporating the element",
      "changeReason": "brief explanation of why this dimension was affected",
      "changeIntensity": "minimal|moderate|significant"
    }
  ],
  "unaffectedDimensions": ["type1", "type2", "..."],
  "reasoning": "Brief explanation of your adjustment strategy"
}

CRITICAL RULES:
- Most dimensions should be in unaffectedDimensions
- Changes should ENHANCE, not REPLACE existing values
- Prefer "minimal" intensity - we're nudging, not rewriting
- If the element doesn't clearly relate to any dimension, return empty affectedDimensions`;
}

// ============================================================================
// HELPER: Validate JSON responses
// ============================================================================

export function validateSmartBreakdownResponse(response: unknown): response is SmartBreakdownResponse {
  if (typeof response !== 'object' || response === null) return false;
  const r = response as Record<string, unknown>;

  const validModes = ['gameplay', 'sketch', 'trailer', 'poster'];
  return (
    typeof r.success === 'boolean' &&
    typeof r.baseImage === 'object' &&
    Array.isArray(r.dimensions) &&
    validModes.includes(r.suggestedOutputMode as string)
  );
}

export function validateLabelToDimensionsResponse(response: unknown): response is LabelToDimensionsResponse {
  if (typeof response !== 'object' || response === null) return false;
  const r = response as Record<string, unknown>;

  return (
    typeof r.success === 'boolean' &&
    Array.isArray(r.affectedDimensions) &&
    Array.isArray(r.unaffectedDimensions)
  );
}
