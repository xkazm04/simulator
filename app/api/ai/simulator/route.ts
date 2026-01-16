import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, HTTP_STATUS } from '@/app/utils/apiErrorHandling';

/**
 * Simulator AI API - Handles LLM calls for simulator features
 *
 * Endpoints:
 * - POST /api/ai/simulator?action=breakdown - Smart Breakdown
 * - POST /api/ai/simulator?action=element-to-dimension - Element to Dimension
 * - POST /api/ai/simulator?action=label-to-dimension - Label to Dimension refinement
 * - POST /api/ai/simulator?action=feedback-to-dimension - Apply Preserve/Change feedback to dimensions
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const USE_REAL_API = process.env.NEXT_PUBLIC_USE_REAL_SIMULATOR_AI === 'true';

// ============================================================================
// TYPES
// ============================================================================

interface SmartBreakdownRequest {
  userInput: string;
}

interface ElementToDimensionRequest {
  elements: Array<{ text: string; category: string }>;
}

interface LabelToDimensionRequest {
  acceptedElement: { text: string; category: string };
  currentDimensions: Array<{ type: string; reference: string }>;
}

interface FeedbackToDimensionRequest {
  feedback: { positive: string; negative: string };
  currentDimensions: Array<{ type: string; reference: string }>;
}

interface GenerateWithFeedbackRequest {
  baseImage: string;
  dimensions: Array<{ type: string; label: string; reference: string }>;
  feedback: { positive: string; negative: string };
  outputMode: 'gameplay' | 'concept' | 'poster';
  lockedElements: Array<{ id: string; text: string; category: string; locked: boolean }>;
}

// ============================================================================
// ANTHROPIC API CALL
// ============================================================================

async function callAnthropicAPI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ============================================================================
// SMART BREAKDOWN
// ============================================================================

const BREAKDOWN_SYSTEM_PROMPT = `You are a creative AI assistant specializing in visual concept transformation. Parse user's creative vision into structured components.

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

function createBreakdownPrompt(userInput: string): string {
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
  "suggestedOutputMode": "gameplay|concept",
  "reasoning": "brief interpretation"
}`;
}

async function handleSmartBreakdown(body: SmartBreakdownRequest) {
  const { userInput } = body;

  if (!userInput || userInput.trim().length < 5) {
    return createErrorResponse('Input too short', HTTP_STATUS.BAD_REQUEST);
  }

  if (USE_REAL_API && ANTHROPIC_API_KEY) {
    // Real API call
    try {
      const response = await callAnthropicAPI(
        BREAKDOWN_SYSTEM_PROMPT,
        createBreakdownPrompt(userInput)
      );

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json(parsed);
      }
      throw new Error('Could not parse JSON from response');
    } catch (error) {
      console.error('Anthropic API error:', error);
      // Fall through to mock
    }
  }

  // Mock implementation
  const mockResponse = generateMockBreakdown(userInput);
  return NextResponse.json(mockResponse);
}

function generateMockBreakdown(userInput: string) {
  const input = userInput.toLowerCase();

  // Detect base format
  let baseFormat = 'game screenshot';
  let baseDescription = 'Video game screenshot with standard composition';
  const keyElements: string[] = [];

  if (input.includes('baldur') || input.includes('isometric') || input.includes('rpg')) {
    baseFormat = 'isometric RPG screenshot';
    baseDescription = 'Baldur\'s Gate style isometric RPG screenshot - top-down 3/4 view, party of characters in formation, painted 2D backgrounds, classic CRPG interface';
    keyElements.push('isometric camera', 'party formation', 'painted backgrounds', 'CRPG interface');
  } else if (input.includes('fps') || input.includes('far cry') || input.includes('first person') || input.includes('shooter')) {
    baseFormat = 'FPS gameplay screenshot';
    baseDescription = 'First-person shooter gameplay screenshot - weapon held in lower right, crosshair center screen, HUD elements, open world ahead';
    keyElements.push('first-person view', 'weapon viewmodel', 'crosshair', 'HUD overlay');
  } else if (input.includes('pokemon') || input.includes('anime')) {
    baseFormat = 'anime battle frame';
    baseDescription = 'Anime style battle frame - dynamic composition, character in foreground, action lines, vibrant colors';
    keyElements.push('dynamic composition', 'action lines', 'vibrant colors', 'anime proportions');
  }

  // Extract dimensions
  const dimensions: Array<{ type: string; reference: string; confidence: number }> = [];

  // Environment detection
  if (input.includes('star wars')) {
    dimensions.push({ type: 'environment', reference: 'Star Wars universe - cantinas, Star Destroyers, alien planets, Jedi temples', confidence: 0.9 });
  } else if (input.includes('stargate')) {
    dimensions.push({ type: 'environment', reference: 'Stargate SG-1 universe - alien worlds, Goa\'uld architecture, Ancient ruins, gate network', confidence: 0.9 });
  } else if (input.includes('cyberpunk')) {
    dimensions.push({ type: 'environment', reference: 'Cyberpunk dystopia - neon-lit streets, megacorporations, rain-slicked surfaces', confidence: 0.9 });
  }

  // Style detection
  if (input.includes('modern') || input.includes('realistic') || input.includes('photorealistic')) {
    dimensions.push({ type: 'artStyle', reference: 'Modern photorealistic graphics - UE5 quality, volumetric lighting, detailed PBR materials', confidence: 0.85 });
  } else if (input.includes('anime') || input.includes('cel')) {
    dimensions.push({ type: 'artStyle', reference: 'Anime/cel-shaded style - clean lines, vibrant colors, expressive features', confidence: 0.85 });
  }

  // Characters detection
  if (input.includes('jedi') || input.includes('sith')) {
    dimensions.push({ type: 'characters', reference: 'Force users - Jedi or Sith with lightsabers, robes, Force powers', confidence: 0.8 });
  } else if (input.includes('mandalorian')) {
    dimensions.push({ type: 'characters', reference: 'Mandalorian warriors - beskar armor, jetpacks, various weapons', confidence: 0.8 });
  } else if (input.includes('sg-1') || input.includes('sg1')) {
    dimensions.push({ type: 'characters', reference: 'SG-1 team - military operators with P90s, tactical gear, mixed team', confidence: 0.8 });
  }

  // Technology
  if (input.includes('lightsaber')) {
    dimensions.push({ type: 'technology', reference: 'Lightsabers, blasters, holocrons, droids, hyperspace technology', confidence: 0.85 });
  } else if (input.includes('staff weapon') || input.includes('zat')) {
    dimensions.push({ type: 'technology', reference: 'Stargate tech - staff weapons, zat\'nik\'tels, Ancient devices, ring transporters', confidence: 0.85 });
  }

  // Output mode
  const suggestedOutputMode = input.includes('concept') || input.includes('art') || input.includes('cinematic')
    ? 'concept'
    : 'gameplay';

  return {
    success: true,
    baseImage: {
      description: baseDescription,
      format: baseFormat,
      keyElements,
    },
    dimensions,
    suggestedOutputMode,
    reasoning: `Interpreted as ${baseFormat} with content swaps based on detected references`,
  };
}

// ============================================================================
// ELEMENT TO DIMENSION
// ============================================================================

const ELEMENT_TO_DIM_SYSTEM_PROMPT = `Convert locked prompt elements into reusable dimension cards.

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

function createElementToDimPrompt(elements: Array<{ text: string; category: string }>): string {
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

async function handleElementToDimension(body: ElementToDimensionRequest) {
  const { elements } = body;

  if (!elements || elements.length === 0) {
    return createErrorResponse('No elements provided', HTTP_STATUS.BAD_REQUEST);
  }

  if (USE_REAL_API && ANTHROPIC_API_KEY) {
    try {
      const response = await callAnthropicAPI(
        ELEMENT_TO_DIM_SYSTEM_PROMPT,
        createElementToDimPrompt(elements)
      );
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
    } catch (error) {
      console.error('Anthropic API error:', error);
    }
  }

  // Mock implementation
  const categoryToDimension: Record<string, string> = {
    composition: 'camera',
    setting: 'environment',
    subject: 'characters',
    style: 'artStyle',
    mood: 'mood',
    lighting: 'artStyle',
  };

  const dimensions = elements
    .filter(e => e.category !== 'quality')
    .map(e => ({
      type: categoryToDimension[e.category] || 'custom',
      reference: `${e.text} - expanded for reuse`,
      sourceElements: [e.category],
      confidence: 0.8,
    }));

  return NextResponse.json({
    success: true,
    dimensions,
    reasoning: 'Mapped element categories to dimension types',
  });
}

// ============================================================================
// LABEL TO DIMENSION (Gentle Refinement)
// ============================================================================

const LABEL_TO_DIM_SYSTEM_PROMPT = `Gently adjust dimensions based on user accepting a specific element.

CRITICAL RULES:
1. MOST dimensions stay UNAFFECTED
2. Only modify DIRECTLY related dimensions
3. Changes should be ADDITIVE, not replacement
4. changeIntensity: almost always "minimal" or "moderate"
5. Preserve user's existing work

OUTPUT: Valid JSON only, no markdown.`;

function createLabelToDimPrompt(
  element: { text: string; category: string },
  dimensions: Array<{ type: string; reference: string }>
): string {
  const dimList = dimensions.map(d => `- [${d.type}]: "${d.reference}"`).join('\n');
  return `User accepted: [${element.category}]: "${element.text}"

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

async function handleLabelToDimension(body: LabelToDimensionRequest) {
  const { acceptedElement, currentDimensions } = body;

  if (!acceptedElement || !currentDimensions) {
    return createErrorResponse('Missing required fields', HTTP_STATUS.BAD_REQUEST);
  }

  if (USE_REAL_API && ANTHROPIC_API_KEY) {
    try {
      const response = await callAnthropicAPI(
        LABEL_TO_DIM_SYSTEM_PROMPT,
        createLabelToDimPrompt(acceptedElement, currentDimensions)
      );
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
    } catch (error) {
      console.error('Anthropic API error:', error);
    }
  }

  // Mock implementation - minimal change to one related dimension
  const categoryToDimension: Record<string, string> = {
    composition: 'camera',
    setting: 'environment',
    subject: 'characters',
    style: 'artStyle',
    mood: 'mood',
    lighting: 'artStyle',
  };

  const targetType = categoryToDimension[acceptedElement.category];
  const targetDim = currentDimensions.find(d => d.type === targetType);

  const affectedDimensions = targetDim
    ? [{
        type: targetType,
        currentValue: targetDim.reference,
        newValue: `${targetDim.reference}, with emphasis on ${acceptedElement.text}`,
        changeReason: `User liked "${acceptedElement.text}", adding emphasis`,
        changeIntensity: 'minimal' as const,
      }]
    : [];

  const unaffectedDimensions = currentDimensions
    .filter(d => d.type !== targetType)
    .map(d => d.type);

  return NextResponse.json({
    success: true,
    affectedDimensions,
    unaffectedDimensions,
    reasoning: `Gently enhanced ${targetType || 'no'} dimension based on accepted element`,
  });
}

// ============================================================================
// FEEDBACK TO DIMENSION (Apply Preserve/Change feedback)
// ============================================================================

const FEEDBACK_TO_DIM_SYSTEM_PROMPT = `You are refining image generation dimensions based on user feedback.

The user provides:
- PRESERVE feedback: Elements they want to keep/emphasize
- CHANGE feedback: Elements they want different/removed

Your job: Interpret this feedback and update the relevant dimensions.

RULES:
1. PRESERVE feedback → Strengthen/emphasize related dimensions
2. CHANGE feedback → Modify/adjust related dimensions to address the change
3. Only modify dimensions that are DIRECTLY related to the feedback
4. Most dimensions should stay UNAFFECTED
5. Changes should be SPECIFIC and ACTIONABLE for image generation

OUTPUT: Valid JSON only, no markdown.`;

function createFeedbackToDimPrompt(
  feedback: { positive: string; negative: string },
  dimensions: Array<{ type: string; reference: string }>
): string {
  const dimList = dimensions.map(d => `- [${d.type}]: "${d.reference}"`).join('\n');
  return `User feedback:
PRESERVE (keep these): "${feedback.positive || 'none'}"
CHANGE (modify these): "${feedback.negative || 'none'}"

Current dimensions:
${dimList}

Analyze the feedback and determine which dimensions need adjustment.

Return JSON:
{
  "success": true,
  "affectedDimensions": [
    {"type": "dim type", "currentValue": "current ref", "newValue": "updated ref incorporating feedback", "changeReason": "why this change", "feedbackSource": "preserve|change"}
  ],
  "unaffectedDimensions": ["type1", "type2"],
  "reasoning": "explanation of how feedback was interpreted"
}`;
}

async function handleFeedbackToDimension(body: FeedbackToDimensionRequest) {
  const { feedback, currentDimensions } = body;

  if (!feedback || !currentDimensions) {
    return createErrorResponse('Missing required fields', HTTP_STATUS.BAD_REQUEST);
  }

  // If no feedback provided, return no changes
  if (!feedback.positive?.trim() && !feedback.negative?.trim()) {
    return NextResponse.json({
      success: true,
      affectedDimensions: [],
      unaffectedDimensions: currentDimensions.map(d => d.type),
      reasoning: 'No feedback provided',
    });
  }

  if (USE_REAL_API && ANTHROPIC_API_KEY) {
    try {
      const response = await callAnthropicAPI(
        FEEDBACK_TO_DIM_SYSTEM_PROMPT,
        createFeedbackToDimPrompt(feedback, currentDimensions)
      );
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
    } catch (error) {
      console.error('Anthropic API error:', error);
    }
  }

  // Mock implementation - simple keyword matching
  const affectedDimensions: Array<{
    type: string;
    currentValue: string;
    newValue: string;
    changeReason: string;
    feedbackSource: 'preserve' | 'change';
  }> = [];

  const positiveKeywords = feedback.positive?.toLowerCase() || '';
  const negativeKeywords = feedback.negative?.toLowerCase() || '';

  // Map feedback keywords to dimension types
  const keywordMapping: Record<string, string[]> = {
    environment: ['world', 'setting', 'place', 'location', 'environment', 'background'],
    characters: ['character', 'hero', 'protagonist', 'people', 'person'],
    mood: ['mood', 'atmosphere', 'feeling', 'tone', 'vibe', 'dark', 'light', 'bright'],
    artStyle: ['style', 'render', 'quality', 'detail', 'color', 'aesthetic'],
    technology: ['weapon', 'item', 'tech', 'gear', 'equipment'],
    action: ['action', 'doing', 'movement', 'pose', 'activity'],
  };

  currentDimensions.forEach(dim => {
    const keywords = keywordMapping[dim.type] || [];

    // Check preserve feedback
    if (keywords.some(k => positiveKeywords.includes(k))) {
      affectedDimensions.push({
        type: dim.type,
        currentValue: dim.reference,
        newValue: `${dim.reference}, emphasized and prominent`,
        changeReason: `User wants to preserve ${dim.type} aspects`,
        feedbackSource: 'preserve',
      });
    }
    // Check change feedback
    else if (keywords.some(k => negativeKeywords.includes(k))) {
      affectedDimensions.push({
        type: dim.type,
        currentValue: dim.reference,
        newValue: `${dim.reference}, with variations addressing: ${feedback.negative}`,
        changeReason: `User wants changes to ${dim.type}`,
        feedbackSource: 'change',
      });
    }
  });

  const unaffectedDimensions = currentDimensions
    .filter(d => !affectedDimensions.some(a => a.type === d.type))
    .map(d => d.type);

  return NextResponse.json({
    success: true,
    affectedDimensions,
    unaffectedDimensions,
    reasoning: 'Applied feedback based on keyword matching',
  });
}

// ============================================================================
// GENERATE WITH FEEDBACK (Unified: Feedback + Prompts in one call)
// ============================================================================

const GENERATE_WITH_FEEDBACK_SYSTEM_PROMPT = `You are a creative director for image generation prompts.

Your task is to:
1. ANALYZE user feedback (preserve/change) and adjust relevant dimensions
2. GENERATE exactly 4 diverse scene prompts using adjusted dimensions

DIMENSION ADJUSTMENT RULES:
- Only modify dimensions directly affected by feedback
- Preserve feedback: Strengthen/emphasize the related dimension
- Change feedback: Modify/adjust to address the requested change
- Most dimensions should remain unchanged (wasModified: false)

PROMPT GENERATION RULES:
- Generate exactly 4 prompts with scene types: "Cinematic Wide Shot", "Hero Portrait", "Action Sequence", "Environmental Storytelling"
- Each prompt should incorporate:
  - The base image format (camera angle, composition style)
  - Adjusted dimension values
  - Locked elements from previous iterations (MUST include)
  - Output mode: gameplay = include game UI/HUD, concept = clean art
  - Variety modifiers (different lighting, atmosphere per prompt)
- Keep prompts under 1500 characters

ELEMENT CATEGORIES for output:
- composition: Camera angle, framing, format
- setting: Environment, world, location
- subject: Characters, creatures
- style: Art style, technology, genre
- mood: Atmosphere, lighting, tone
- quality: Technical quality descriptors

OUTPUT: Valid JSON only, no markdown code blocks.`;

function createGenerateWithFeedbackPrompt(body: GenerateWithFeedbackRequest): string {
  const { baseImage, dimensions, feedback, outputMode, lockedElements } = body;

  const dimList = dimensions
    .filter(d => d.reference?.trim())
    .map(d => `- [${d.type}] ${d.label}: "${d.reference}"`)
    .join('\n');

  const lockedList = lockedElements.length > 0
    ? lockedElements.map(e => `- [${e.category}]: "${e.text}"`).join('\n')
    : 'None';

  return `Base Image Format: "${baseImage}"
Output Mode: ${outputMode} (${outputMode === 'gameplay' ? 'include game UI/HUD elements' : 'clean concept art, no UI'})

User Feedback:
PRESERVE (keep/emphasize): "${feedback.positive || 'none'}"
CHANGE (modify/remove): "${feedback.negative || 'none'}"

Current Dimensions:
${dimList || 'No dimensions set'}

Locked Elements (MUST include in all prompts):
${lockedList}

Generate the response with adjusted dimensions and 4 diverse prompts.

Return JSON:
{
  "success": true,
  "adjustedDimensions": [
    {"type": "dimensionType", "originalValue": "original ref", "newValue": "adjusted ref (or same if unchanged)", "wasModified": true/false, "changeReason": "why changed or 'unchanged'"}
  ],
  "prompts": [
    {
      "id": "unique-id-1",
      "sceneNumber": 1,
      "sceneType": "Cinematic Wide Shot",
      "prompt": "Full detailed prompt text under 1500 chars incorporating base format, dimensions, locked elements, and output mode",
      "elements": [
        {"id": "elem-1", "text": "element description", "category": "composition|setting|subject|style|mood|quality", "locked": false}
      ]
    }
  ],
  "reasoning": "Brief explanation of how feedback was applied and prompt strategy"
}`;
}

async function handleGenerateWithFeedback(body: GenerateWithFeedbackRequest) {
  const { baseImage, dimensions, feedback, outputMode, lockedElements } = body;

  if (!baseImage?.trim()) {
    return createErrorResponse('Base image description is required', HTTP_STATUS.BAD_REQUEST);
  }

  // Try real API first
  if (USE_REAL_API && ANTHROPIC_API_KEY) {
    try {
      const response = await callAnthropicAPI(
        GENERATE_WITH_FEEDBACK_SYSTEM_PROMPT,
        createGenerateWithFeedbackPrompt(body)
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Ensure all IDs are present
        if (parsed.prompts) {
          parsed.prompts = parsed.prompts.map((p: any, idx: number) => ({
            ...p,
            id: p.id || `prompt-${Date.now()}-${idx}`,
            elements: (p.elements || []).map((e: any, eIdx: number) => ({
              ...e,
              id: e.id || `elem-${Date.now()}-${idx}-${eIdx}`,
            })),
          }));
        }
        return NextResponse.json(parsed);
      }
      throw new Error('Could not parse JSON from response');
    } catch (error) {
      console.error('Anthropic API error, falling back to mock:', error);
    }
  }

  // Mock implementation
  return handleGenerateWithFeedbackMock(body);
}

function handleGenerateWithFeedbackMock(body: GenerateWithFeedbackRequest) {
  const { baseImage, dimensions, feedback, outputMode, lockedElements } = body;

  // Mock dimension adjustments - simple keyword matching
  const adjustedDimensions = dimensions.map(dim => {
    const positiveKeywords = feedback.positive?.toLowerCase() || '';
    const negativeKeywords = feedback.negative?.toLowerCase() || '';

    const keywords: Record<string, string[]> = {
      environment: ['world', 'setting', 'place', 'location', 'environment'],
      characters: ['character', 'hero', 'protagonist', 'people'],
      mood: ['mood', 'atmosphere', 'feeling', 'tone', 'dark', 'light'],
      artStyle: ['style', 'render', 'quality', 'detail', 'color'],
      technology: ['weapon', 'item', 'tech', 'gear'],
      action: ['action', 'doing', 'movement', 'pose'],
    };

    const dimKeywords = keywords[dim.type] || [];
    let wasModified = false;
    let newValue = dim.reference;
    let changeReason = 'unchanged';

    if (dimKeywords.some(k => positiveKeywords.includes(k))) {
      wasModified = true;
      newValue = `${dim.reference}, emphasized and prominent`;
      changeReason = `User wants to preserve ${dim.type} aspects`;
    } else if (dimKeywords.some(k => negativeKeywords.includes(k))) {
      wasModified = true;
      newValue = `${dim.reference}, with adjustments based on feedback`;
      changeReason = `User wants changes to ${dim.type}`;
    }

    return {
      type: dim.type,
      originalValue: dim.reference,
      newValue,
      wasModified,
      changeReason,
    };
  });

  // Generate mock prompts
  const sceneTypes = ['Cinematic Wide Shot', 'Hero Portrait', 'Action Sequence', 'Environmental Storytelling'];
  const timeVariants = ['golden hour', 'blue hour twilight', 'dramatic storm', 'serene daylight'];
  const atmosphereVariants = ['mysterious fog', 'clear and sharp', 'dusty particles', 'rain effects'];

  const filledDims = dimensions.filter(d => d.reference?.trim());
  const lockedText = lockedElements.map(e => e.text).join(', ');

  const prompts = sceneTypes.map((sceneType, index) => {
    // Build prompt from dimensions
    const parts: string[] = [];

    // Camera/composition
    parts.push(`${sceneType} framing`);

    // Base format
    if (baseImage) {
      parts.push(baseImage.substring(0, 200));
    }

    // Add dimensions
    filledDims.forEach(dim => {
      const adjusted = adjustedDimensions.find(a => a.type === dim.type);
      const value = adjusted?.wasModified ? adjusted.newValue : dim.reference;
      if (value) {
        parts.push(value);
      }
    });

    // Add locked elements
    if (lockedText) {
      parts.push(lockedText);
    }

    // Add variety
    parts.push(timeVariants[index]);
    parts.push(atmosphereVariants[index]);

    // Output mode
    if (outputMode === 'gameplay') {
      parts.push('game screenshot with UI overlay, HUD elements, health bars');
    } else {
      parts.push('clean concept art, no UI, cinematic composition');
    }

    // Quality
    parts.push('highly detailed, professional quality, 8K render');

    const prompt = parts.join(', ').substring(0, 1500);

    // Generate elements from the prompt
    const elements = [
      { id: `elem-${Date.now()}-${index}-0`, text: sceneType, category: 'composition', locked: false },
      { id: `elem-${Date.now()}-${index}-1`, text: baseImage?.substring(0, 50) || 'base format', category: 'composition', locked: false },
    ];

    filledDims.slice(0, 3).forEach((dim, dIdx) => {
      elements.push({
        id: `elem-${Date.now()}-${index}-${dIdx + 2}`,
        text: dim.reference.substring(0, 50),
        category: dim.type === 'environment' ? 'setting' : dim.type === 'characters' ? 'subject' : 'style',
        locked: false,
      });
    });

    return {
      id: `prompt-${Date.now()}-${index}`,
      sceneNumber: index + 1,
      sceneType,
      prompt,
      elements,
    };
  });

  return NextResponse.json({
    success: true,
    adjustedDimensions,
    prompts,
    reasoning: 'Mock generation - applied keyword-based feedback and generated 4 diverse scene prompts',
  });
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    switch (action) {
      case 'breakdown':
        return handleSmartBreakdown(body);
      case 'element-to-dimension':
        return handleElementToDimension(body);
      case 'label-to-dimension':
        return handleLabelToDimension(body);
      case 'feedback-to-dimension':
        return handleFeedbackToDimension(body);
      case 'generate-with-feedback':
        return handleGenerateWithFeedback(body);
      default:
        return createErrorResponse(`Unknown action: ${action}`, HTTP_STATUS.BAD_REQUEST);
    }
  } catch (error) {
    console.error('Simulator AI error:', error);
    return createErrorResponse(
      'Failed to process simulator AI request',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
