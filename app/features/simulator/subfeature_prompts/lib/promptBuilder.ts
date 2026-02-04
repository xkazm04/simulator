/**
 * Prompt Builder - Generates diverse prompts using the lens-based content-swap approach
 *
 * The lens-based content-swap approach:
 * 1. Start with the BASE FORMAT (visual structure to preserve)
 * 2. Apply LENS transformations from dimensions:
 *    - FILTER: What to preserve from the base
 *    - TRANSFORM: How to apply the reference content
 *    - WEIGHT: How strongly to apply (0-100, enables graduated blending)
 * 3. Add VARIETY through different angles, times, atmospheres
 *
 * Weight enables graduated transformations like "50% Star Wars, 50% Ghibli"
 *
 * IMPORTANT: Prompts must stay under 1500 characters for Leonardo API
 */

import { v4 as uuidv4 } from 'uuid';
import { Dimension, DimensionFilterMode, DimensionTransformMode, PromptElement, OutputMode, LearnedContext } from '../../types';

// Maximum prompt length for Leonardo API
const MAX_PROMPT_LENGTH = 1500;

/**
 * Variety modifiers - kept SHORT for prompt length efficiency
 */
const CAMERA_ANGLES = [
  'low angle',
  'bird\'s eye view',
  'eye-level shot',
  'dutch angle',
  'wide shot',
  'medium shot',
  'close-up',
  'panoramic',
];

const TIME_OF_DAY = [
  'golden hour',
  'blue hour',
  'midday light',
  'overcast',
  'dawn',
  'night',
  'morning mist',
  'neon night',
];

const ATMOSPHERIC_CONDITIONS = [
  'fog',
  'dust particles',
  'rain',
  'snow',
  'heat haze',
  'smoke',
  'clear',
  'stormy',
];

const COMPOSITION_STYLES = [
  'rule of thirds',
  'centered',
  'leading lines',
  'layered depth',
];

/**
 * Scene variation descriptions - SHORT for prompt efficiency
 */
export const SCENE_VARIATIONS: Record<string, {
  moment: string;
  focus: string;
}> = {
  'Cinematic Wide Shot': {
    moment: 'establishing shot',
    focus: 'epic scale',
  },
  'Hero Portrait': {
    moment: 'character portrait',
    focus: 'heroic pose',
  },
  'Action Sequence': {
    moment: 'action scene',
    focus: 'dynamic motion',
  },
  'Environmental Storytelling': {
    moment: 'environment detail',
    focus: 'world-building',
  },
};

// ============================================================================
// OUTPUT MODE CONFIGURATIONS - Drastically different prompt structures
// ============================================================================

/**
 * Mode-specific prompt configurations
 * Each mode produces fundamentally different visual outputs
 */
interface ModeConfig {
  /** Primary style keywords that define the visual approach */
  styleKeywords: string[];
  /** Technical/quality keywords specific to this mode */
  technicalKeywords: string[];
  /** What to exclude for this mode */
  negativeKeywords: string[];
  /** Whether to heavily use dimension content or simplify */
  dimensionUsage: 'full' | 'simplified' | 'minimal';
  /** Scene variation override (optional) */
  sceneOverride?: Record<string, { moment: string; focus: string }>;
}

const MODE_CONFIGS: Record<OutputMode, ModeConfig> = {
  gameplay: {
    styleKeywords: [
      'authentic gameplay screenshot',
      'in-game capture',
      'video game screen',
    ],
    technicalKeywords: [
      'HUD elements visible',
      'game UI overlay',
      'health bars',
      'minimap corner',
      'action RPG interface',
    ],
    negativeKeywords: [
      'concept art',
      'sketch',
      'painting',
      'drawing',
      'illustration',
      'movie still',
    ],
    dimensionUsage: 'full',
  },

  sketch: {
    styleKeywords: [
      'concept art sketch',
      'hand-drawn illustration',
      'pencil drawing',
      'rough sketch',
      'traditional art',
    ],
    technicalKeywords: [
      'visible pencil strokes',
      'graphite shading',
      'sketch paper texture',
      'loose linework',
      'artistic hatching',
      'charcoal accents',
      'construction lines visible',
      'artist workbook page',
    ],
    negativeKeywords: [
      'photorealistic',
      'photograph',
      'digital render',
      '3D rendering',
      'smooth gradients',
      'polished finish',
      'game screenshot',
      'HUD',
      'UI elements',
      'video game',
      'CGI',
      'hyperrealistic',
    ],
    dimensionUsage: 'simplified', // Focus on core concept, not all dimensions
    sceneOverride: {
      'Cinematic Wide Shot': { moment: 'composition study', focus: 'perspective sketch' },
      'Hero Portrait': { moment: 'character study', focus: 'figure drawing' },
      'Action Sequence': { moment: 'gesture drawing', focus: 'dynamic poses' },
      'Environmental Storytelling': { moment: 'environment sketch', focus: 'architectural study' },
    },
  },

  trailer: {
    styleKeywords: [
      'cinematic movie still',
      'blockbuster film scene',
      'Hollywood production',
      'photorealistic',
      'professional cinematography',
    ],
    technicalKeywords: [
      'anamorphic lens flare',
      'shallow depth of field',
      'dramatic rim lighting',
      'cinematic color grading',
      'film grain',
      'ultra high resolution',
      'IMAX quality',
      'theatrical release',
      'motion picture',
    ],
    negativeKeywords: [
      'cartoon',
      'anime',
      'illustration',
      'sketch',
      'drawing',
      'game screenshot',
      'HUD',
      'UI elements',
      'video game interface',
      'low budget',
      'amateur',
      'flat lighting',
    ],
    dimensionUsage: 'full',
    sceneOverride: {
      'Cinematic Wide Shot': { moment: 'epic establishing shot', focus: 'sweeping vista' },
      'Hero Portrait': { moment: 'dramatic close-up', focus: 'emotional intensity' },
      'Action Sequence': { moment: 'high-octane action', focus: 'explosive moment' },
      'Environmental Storytelling': { moment: 'atmospheric wide', focus: 'immersive world' },
    },
  },

  poster: {
    styleKeywords: [
      'official movie poster',
      'key art',
      'promotional artwork',
      'theatrical poster',
    ],
    technicalKeywords: [
      'poster composition',
      'dramatic lighting',
      'iconic pose',
      'title space',
      'marketing quality',
    ],
    negativeKeywords: [
      'screenshot',
      'sketch',
      'behind the scenes',
      'casual',
    ],
    dimensionUsage: 'full',
  },

  realistic: {
    styleKeywords: [
      'next-gen game engine',
      'photorealistic game graphics',
      'Unreal Engine 5 quality',
      'AAA game visuals',
      'hyperrealistic rendering',
    ],
    technicalKeywords: [
      'ray tracing',
      'global illumination',
      'ultra-detailed textures',
      'subsurface scattering',
      'realistic materials',
      'physically based rendering',
      '8K resolution',
      'nanite geometry',
    ],
    negativeKeywords: [
      'cartoon',
      'anime',
      'stylized',
      'low poly',
      'retro graphics',
      'pixel art',
      'hand-drawn',
      'sketch',
      'painting',
      'HUD',
      'UI elements',
    ],
    dimensionUsage: 'full',
    // Use same scene structure as gameplay, just with realistic rendering
  },
};

/**
 * Build mode-specific prompt section
 * Returns an array of prompt parts specific to the selected output mode
 */
function buildModePromptParts(
  outputMode: OutputMode,
  sceneType: string,
  gameUIDim?: Dimension
): { styleParts: string[]; sceneOverride?: { moment: string; focus: string } } {
  const config = MODE_CONFIGS[outputMode];
  const styleParts: string[] = [];

  // Add primary style keywords (pick 2-3 for variety)
  styleParts.push(...config.styleKeywords.slice(0, 3));

  // Add technical keywords (pick 2-3 based on scene type)
  const techKeywords = config.technicalKeywords;
  if (sceneType.includes('Portrait') || sceneType.includes('Hero')) {
    styleParts.push(techKeywords[0], techKeywords[2]);
  } else if (sceneType.includes('Action')) {
    styleParts.push(techKeywords[1], techKeywords[3]);
  } else {
    styleParts.push(techKeywords[0], techKeywords[1]);
  }

  // For gameplay mode, add game UI dimension if available
  if (outputMode === 'gameplay' && gameUIDim?.reference) {
    styleParts.push(`${gameUIDim.reference} style UI`);
  }

  return {
    styleParts,
    sceneOverride: config.sceneOverride?.[sceneType],
  };
}

/**
 * Check if dimension should be used for this mode
 * Sketch mode simplifies by focusing on fewer dimensions
 */
function shouldUseDimension(
  outputMode: OutputMode,
  dimensionType: string,
  dimensionIndex: number
): boolean {
  const config = MODE_CONFIGS[outputMode];

  if (config.dimensionUsage === 'full') return true;
  if (config.dimensionUsage === 'minimal') return dimensionIndex === 0;

  // 'simplified' mode - focus on core dimensions
  if (config.dimensionUsage === 'simplified') {
    // For sketch, prioritize: environment, characters (core subjects)
    // Skip: gameUI, technology, creatures (too detailed for sketches)
    const priorityDimensions = ['environment', 'characters', 'artStyle', 'mood'];
    return priorityDimensions.includes(dimensionType);
  }

  return true;
}

/**
 * Get variety modifiers for a specific prompt index (0-3)
 */
function getVarietyModifiers(index: number): {
  camera: string;
  time: string;
  atmosphere: string;
  composition: string;
} {
  return {
    camera: CAMERA_ANGLES[index % CAMERA_ANGLES.length],
    time: TIME_OF_DAY[(index * 2) % TIME_OF_DAY.length],
    atmosphere: ATMOSPHERIC_CONDITIONS[(index * 3) % ATMOSPHERIC_CONDITIONS.length],
    composition: COMPOSITION_STYLES[index % COMPOSITION_STYLES.length],
  };
}

/**
 * Truncate prompt to fit within Leonardo's character limit
 */
function truncatePrompt(prompt: string, maxLength: number = MAX_PROMPT_LENGTH): string {
  if (prompt.length <= maxLength) return prompt;

  // Find the last comma before the limit to avoid cutting mid-phrase
  const truncated = prompt.substring(0, maxLength);
  const lastComma = truncated.lastIndexOf(',');

  if (lastComma > maxLength * 0.7) {
    return truncated.substring(0, lastComma);
  }

  return truncated;
}

/**
 * Get weight phrase for graduated transformations
 * Returns intensity modifier based on weight (0-100)
 */
function getWeightPhrase(weight: number): string {
  if (weight >= 90) return ''; // Full transformation, no modifier needed
  if (weight >= 70) return 'strong influence of';
  if (weight >= 50) return 'balanced blend of';
  if (weight >= 30) return 'subtle hints of';
  if (weight >= 10) return 'traces of';
  return ''; // 0 weight means no transformation
}

/**
 * Get filter mode hint for preserving base image aspects
 */
function getFilterModeHint(filterMode: DimensionFilterMode): string {
  switch (filterMode) {
    case 'preserve_structure': return 'maintaining composition and layout';
    case 'preserve_subject': return 'keeping main subjects';
    case 'preserve_mood': return 'preserving emotional tone';
    case 'preserve_color_palette': return 'keeping color palette';
    case 'none': return '';
    default: return '';
  }
}

/**
 * Get transform mode instruction
 */
function getTransformModeInstruction(transformMode: DimensionTransformMode): string {
  switch (transformMode) {
    case 'replace': return ''; // Default behavior
    case 'blend': return 'blended with';
    case 'style_transfer': return 'style of';
    case 'semantic_swap': return 'semantic essence of';
    case 'additive': return 'layered with';
    default: return '';
  }
}

/**
 * Build a weighted dimension clause that incorporates the lens model
 * Optionally includes a visual reference indicator when a reference image is attached
 */
function buildWeightedClause(dim: Dimension, maxLength: number = 60): string | null {
  if (!dim.reference?.trim()) return null;

  const weight = dim.weight ?? 100;
  if (weight === 0) return null; // Skip dimensions with 0 weight

  const ref = dim.reference.length > maxLength ? dim.reference.substring(0, maxLength) : dim.reference;
  const weightPhrase = getWeightPhrase(weight);
  const transformInstruction = getTransformModeInstruction(dim.transformMode ?? 'replace');

  // Build the base clause based on weight and transform mode
  let clause: string;
  if (weightPhrase && transformInstruction) {
    clause = `${weightPhrase} ${transformInstruction} ${ref}`;
  } else if (weightPhrase) {
    clause = `${weightPhrase} ${ref}`;
  } else if (transformInstruction) {
    clause = `${transformInstruction} ${ref}`;
  } else {
    clause = ref;
  }

  // Add visual reference indicator if reference image is attached
  if (dim.referenceImage) {
    clause = `(visual reference) ${clause}`;
  }

  return clause;
}

/**
 * Get dimensions that have reference images attached
 * Useful for API calls that support image-to-image or style reference
 */
export function getDimensionsWithReferenceImages(dimensions: Dimension[]): Array<{
  type: string;
  label: string;
  referenceImage: string;
}> {
  return dimensions
    .filter((d) => d.referenceImage)
    .map((d) => ({
      type: d.type,
      label: d.label,
      referenceImage: d.referenceImage!,
    }));
}

/**
 * Build content swap clauses from dimensions - uses lens model for graduated transformations
 */
function buildContentSwaps(filledDimensions: Dimension[]): string[] {
  const swaps: string[] = [];

  // Core content dimensions
  const coreDims = ['environment', 'characters', 'creatures', 'technology', 'action'];
  coreDims.forEach(type => {
    const dim = filledDimensions.find(d => d.type === type);
    if (dim) {
      const clause = buildWeightedClause(dim, 60);
      if (clause) swaps.push(clause);
    }
  });

  // Era dimension - important for time period
  const eraDim = filledDimensions.find(d => d.type === 'era');
  if (eraDim) {
    const clause = buildWeightedClause(eraDim, 40);
    if (clause) swaps.push(`${clause} era`);
  }

  // Genre dimension - affects overall visual style
  const genreDim = filledDimensions.find(d => d.type === 'genre');
  if (genreDim) {
    const clause = buildWeightedClause(genreDim, 40);
    if (clause) swaps.push(`${clause} genre`);
  }

  // Custom dimension - user-defined additions
  const customDim = filledDimensions.find(d => d.type === 'custom');
  if (customDim) {
    const clause = buildWeightedClause(customDim, 50);
    if (clause) swaps.push(clause);
  }

  return swaps;
}

/**
 * Build filter preservation hints for the prompt based on active filter modes
 */
function buildFilterHints(filledDimensions: Dimension[]): string[] {
  const hints: string[] = [];
  const seenModes = new Set<DimensionFilterMode>();

  filledDimensions.forEach(dim => {
    const filterMode = dim.filterMode ?? 'preserve_structure';
    if (filterMode !== 'none' && !seenModes.has(filterMode)) {
      const hint = getFilterModeHint(filterMode);
      if (hint) hints.push(hint);
      seenModes.add(filterMode);
    }
  });

  return hints;
}

/**
 * Build elements array for UI feedback system
 */
function buildElements(
  baseImage: string,
  filledDimensions: Dimension[],
  outputMode: OutputMode,
  qualityTag: string,
  lockedElements: PromptElement[]
): PromptElement[] {
  const elements: PromptElement[] = [];

  // Format element (from base)
  const formatShort = baseImage.split(' - ')[0] || baseImage.slice(0, 35);
  elements.push({ id: uuidv4(), text: formatShort, category: 'composition', locked: false });

  // Content swap elements
  const environmentDim = filledDimensions.find((d) => d.type === 'environment');
  const charactersDim = filledDimensions.find((d) => d.type === 'characters');
  const creaturesDim = filledDimensions.find((d) => d.type === 'creatures');
  const techDim = filledDimensions.find((d) => d.type === 'technology');
  const styleDim = filledDimensions.find((d) => d.type === 'artStyle');
  const moodDim = filledDimensions.find((d) => d.type === 'mood');

  if (environmentDim?.reference) {
    const envShort = environmentDim.reference.split(' - ')[0] || environmentDim.reference.slice(0, 30);
    elements.push({ id: uuidv4(), text: envShort, category: 'setting', locked: false });
  }

  if (charactersDim?.reference || creaturesDim?.reference) {
    const subject = charactersDim?.reference || creaturesDim?.reference || '';
    const subjectShort = subject.split(' - ')[0] || subject.slice(0, 30);
    elements.push({ id: uuidv4(), text: subjectShort, category: 'subject', locked: false });
  }

  if (techDim?.reference) {
    const techShort = techDim.reference.split(' - ')[0] || techDim.reference.slice(0, 30);
    elements.push({ id: uuidv4(), text: techShort, category: 'style', locked: false });
  }

  if (styleDim?.reference) {
    const styleShort = styleDim.reference.split(' - ')[0] || styleDim.reference.slice(0, 30);
    elements.push({ id: uuidv4(), text: styleShort, category: 'lighting', locked: false });
  }

  if (moodDim?.reference) {
    const moodShort = moodDim.reference.split(' - ')[0] || moodDim.reference.slice(0, 25);
    elements.push({ id: uuidv4(), text: moodShort, category: 'mood', locked: false });
  }

  // Era dimension
  const eraDim = filledDimensions.find((d) => d.type === 'era');
  if (eraDim?.reference) {
    const eraShort = eraDim.reference.split(' - ')[0] || eraDim.reference.slice(0, 25);
    elements.push({ id: uuidv4(), text: eraShort, category: 'setting', locked: false });
  }

  // Genre dimension
  const genreDim = filledDimensions.find((d) => d.type === 'genre');
  if (genreDim?.reference) {
    const genreShort = genreDim.reference.split(' - ')[0] || genreDim.reference.slice(0, 25);
    elements.push({ id: uuidv4(), text: genreShort, category: 'style', locked: false });
  }

  // Custom dimension
  const customDim = filledDimensions.find((d) => d.type === 'custom');
  if (customDim?.reference) {
    const customShort = customDim.reference.split(' - ')[0] || customDim.reference.slice(0, 30);
    elements.push({ id: uuidv4(), text: customShort, category: 'style', locked: false });
  }

  // Output mode element - different text for each mode
  const modeElementText = (() => {
    switch (outputMode) {
      case 'gameplay': return 'game UI visible';
      case 'sketch': return 'hand-drawn sketch';
      case 'trailer': return 'cinematic film still';
      case 'poster': return 'poster composition';
      case 'realistic': return 'photorealistic';
      default: return 'concept art';
    }
  })();
  elements.push({
    id: uuidv4(),
    text: modeElementText,
    category: 'composition',
    locked: false,
  });

  // Quality tag
  elements.push({ id: uuidv4(), text: qualityTag, category: 'quality', locked: false });

  // Apply locked elements from previous iterations
  lockedElements.forEach((el) => {
    const existingIndex = elements.findIndex((e) => e.category === el.category);
    if (existingIndex >= 0) {
      elements[existingIndex] = { ...el, id: uuidv4(), locked: true };
    } else {
      elements.push({ ...el, id: uuidv4(), locked: true });
    }
  });

  return elements;
}

/**
 * Apply learned context to enhance prompt parts
 * Injects user preferences and avoids learned negatives
 */
function applyLearnedContext(
  promptParts: string[],
  learnedContext?: LearnedContext
): string[] {
  if (!learnedContext) return promptParts;

  const enhancedParts = [...promptParts];

  // Add emphasized elements (user preferences) near the beginning for higher weight
  if (learnedContext.emphasizeElements.length > 0) {
    const emphasisPhrase = learnedContext.emphasizeElements
      .slice(0, 3) // Limit to avoid prompt bloat
      .join(', ');
    // Insert after base description (index 1 typically)
    enhancedParts.splice(2, 0, `with emphasis on ${emphasisPhrase}`);
  }

  // Apply dimension adjustments from preferences
  learnedContext.dimensionAdjustments.forEach((adjustment) => {
    // Find if we already have content for this dimension and enhance it
    const existingIndex = enhancedParts.findIndex(
      (part) => part.toLowerCase().includes(adjustment.type.toLowerCase())
    );
    if (existingIndex === -1) {
      // Add as new content
      enhancedParts.push(adjustment.adjustment);
    }
  });

  return enhancedParts;
}

/**
 * Filter elements to avoid based on learned negatives
 * Removes or modifies prompt parts that match avoid patterns
 */
function filterAvoidElements(
  promptParts: string[],
  avoidElements: string[]
): string[] {
  if (avoidElements.length === 0) return promptParts;

  return promptParts.filter((part) => {
    const lowerPart = part.toLowerCase();
    // Check if any avoid element is in this part
    return !avoidElements.some((avoid) =>
      lowerPart.includes(avoid.toLowerCase())
    );
  });
}

/**
 * Build a prompt with elements - optimized for 1500 char limit
 * Uses the lens model for graduated transformations based on weight
 * Now enhanced with learned context from user feedback
 *
 * OUTPUT MODES produce drastically different prompts:
 * - gameplay: Authentic game screenshot with HUD/UI elements visible
 * - sketch: Hand-drawn concept art with pencil strokes and loose linework
 * - trailer: Cinematic movie still with photorealistic Hollywood production quality
 * - poster: Official movie poster with dramatic composition
 */
export function buildMockPromptWithElements(
  baseImage: string,
  filledDimensions: Dimension[],
  sceneType: string,
  index: number,
  lockedElements: PromptElement[],
  outputMode: OutputMode,
  learnedContext?: LearnedContext
): { prompt: string; elements: PromptElement[] } {
  const modeConfig = MODE_CONFIGS[outputMode];
  const variety = getVarietyModifiers(index);

  // Get mode-specific scene variation (or default)
  const defaultVariation = SCENE_VARIATIONS[sceneType] || SCENE_VARIATIONS['Cinematic Wide Shot'];
  const variation = modeConfig.sceneOverride?.[sceneType] || defaultVariation;

  const styleDim = filledDimensions.find((d) => d.type === 'artStyle');
  const moodDim = filledDimensions.find((d) => d.type === 'mood');
  const cameraDim = filledDimensions.find((d) => d.type === 'camera');
  const gameUIDim = filledDimensions.find((d) => d.type === 'gameUI');

  // Filter dimensions based on mode's dimensionUsage setting
  const activeDimensions = filledDimensions.filter((dim, idx) =>
    shouldUseDimension(outputMode, dim.type, idx)
  );

  // Build prompt parts - structure varies dramatically by mode
  const promptParts: string[] = [];

  // ====================================================================
  // MODE-SPECIFIC PROMPT STRUCTURE
  // ====================================================================

  if (outputMode === 'sketch') {
    // SKETCH MODE: Lead with artistic medium, minimize technical game details
    // Structure: [artistic style] + [subject from base] + [simplified dimensions] + [artistic technique]

    // 1. Primary artistic style (this is the MOST important for sketch mode)
    promptParts.push(...modeConfig.styleKeywords.slice(0, 2));
    promptParts.push(...modeConfig.technicalKeywords.slice(0, 3));

    // 2. Subject extracted from base (simplified, no game-specific UI language)
    const baseSubject = baseImage.length > 120 ? baseImage.substring(0, 120) : baseImage;
    promptParts.push(`of ${baseSubject}`);

    // 3. Scene context (use artistic terminology)
    promptParts.push(variation.moment);
    promptParts.push(variation.focus);

    // 4. Simplified dimensions (only core subjects, not game UI or tech details)
    const sketchSwaps = buildContentSwaps(activeDimensions);
    if (sketchSwaps.length > 0) {
      promptParts.push(sketchSwaps.slice(0, 2).join(', ')); // Limit to avoid over-detailing
    }

    // 5. Mood if present (sketches can convey mood through stroke weight)
    if (moodDim?.reference) {
      promptParts.push(`${moodDim.reference} atmosphere`);
    }

    // 6. Additional artistic technique
    promptParts.push('artist workbook page');
    promptParts.push('raw and expressive');

  } else if (outputMode === 'trailer') {
    // TRAILER MODE: Lead with cinematic production quality
    // Structure: [cinematic style] + [film techniques] + [dramatic scene] + [full dimensions]

    // 1. Cinematic production keywords (CRITICAL for photorealistic output)
    promptParts.push(...modeConfig.styleKeywords);

    // 2. Camera work (cinematic angle)
    const cameraClause = cameraDim ? buildWeightedClause(cameraDim, 30) : null;
    promptParts.push(cameraClause || 'sweeping cinematic shot');

    // 3. Scene from base with dramatic framing
    const baseDesc = baseImage.length > 180 ? baseImage.substring(0, 180) : baseImage;
    promptParts.push(baseDesc);

    // 4. Cinematic moment (use trailer-specific scene descriptions)
    promptParts.push(variation.moment);
    promptParts.push(variation.focus);

    // 5. Full dimension content (trailer mode uses all dimensions)
    const trailerSwaps = buildContentSwaps(activeDimensions);
    if (trailerSwaps.length > 0) {
      promptParts.push(trailerSwaps.join(', '));
    }

    // 6. Art style and mood for visual coherence
    if (styleDim?.reference) {
      const styleClause = buildWeightedClause(styleDim, 50);
      if (styleClause) promptParts.push(styleClause);
    }
    if (moodDim?.reference) {
      promptParts.push(`${moodDim.reference} mood`);
    }

    // 7. Technical film quality keywords (CRITICAL for photorealism)
    promptParts.push(...modeConfig.technicalKeywords.slice(0, 4));

    // 8. Lighting (cinematic lighting is essential)
    promptParts.push(variety.time);
    promptParts.push('dramatic volumetric lighting');

  } else if (outputMode === 'poster') {
    // POSTER MODE: Marketing composition with dramatic character focus
    promptParts.push(...modeConfig.styleKeywords);

    const baseDesc = baseImage.length > 150 ? baseImage.substring(0, 150) : baseImage;
    promptParts.push(baseDesc);

    promptParts.push(variation.moment);

    const posterSwaps = buildContentSwaps(activeDimensions);
    if (posterSwaps.length > 0) {
      promptParts.push(posterSwaps.join(', '));
    }

    if (styleDim?.reference) {
      promptParts.push(styleDim.reference);
    }

    promptParts.push(...modeConfig.technicalKeywords.slice(0, 3));
    promptParts.push(variation.focus);

  } else if (outputMode === 'realistic') {
    // REALISTIC MODE: Same structure as GAMEPLAY but with photorealistic rendering
    // Uses EXACT same scene/camera/dimensions as gameplay, just different rendering style
    // Structure: [camera] + [base] + [scene] + [dimensions] + [style] + [REALISTIC RENDERING] + [quality]

    // 1. Camera angle (SAME as gameplay)
    const cameraClause = cameraDim ? buildWeightedClause(cameraDim, 30) : null;
    promptParts.push(cameraClause || variety.camera);

    // 2. Base description (SAME as gameplay)
    const baseDesc = baseImage.length > 200 ? baseImage.substring(0, 200) : baseImage;
    promptParts.push(baseDesc);

    // 3. Filter preservation hints (SAME as gameplay)
    const filterHints = buildFilterHints(activeDimensions);
    if (filterHints.length > 0) {
      promptParts.push(filterHints.join(' and '));
    }

    // 4. Scene type (SAME as gameplay - uses defaultVariation, not mode override)
    promptParts.push(defaultVariation.moment);

    // 5. Content swaps (SAME as gameplay)
    const swaps = buildContentSwaps(activeDimensions);
    if (swaps.length > 0) {
      promptParts.push(swaps.join(', '));
    }

    // 6. Style and mood (SAME as gameplay)
    if (styleDim?.reference) {
      const styleClause = buildWeightedClause(styleDim, 50);
      if (styleClause) promptParts.push(styleClause);
    }
    if (moodDim?.reference) {
      const moodClause = buildWeightedClause(moodDim, 30);
      if (moodClause) promptParts.push(moodClause);
    }

    // 7. Variety modifiers (SAME as gameplay)
    promptParts.push(variety.time);
    promptParts.push(variety.atmosphere);

    // 8. REALISTIC RENDERING (INSTEAD of game UI - this is the ONLY difference from gameplay)
    promptParts.push(...modeConfig.styleKeywords.slice(0, 2));
    promptParts.push(...modeConfig.technicalKeywords.slice(0, 4));

    // 9. Quality (SAME as gameplay)
    promptParts.push(defaultVariation.focus);
    promptParts.push('detailed');

  } else {
    // GAMEPLAY MODE (default): Authentic game screenshot with visible UI
    // Structure: [camera] + [base] + [scene] + [dimensions] + [style] + [game UI] + [quality]

    // 1. Camera angle
    const cameraClause = cameraDim ? buildWeightedClause(cameraDim, 30) : null;
    promptParts.push(cameraClause || variety.camera);

    // 2. Base description
    const baseDesc = baseImage.length > 200 ? baseImage.substring(0, 200) : baseImage;
    promptParts.push(baseDesc);

    // 3. Filter preservation hints
    const filterHints = buildFilterHints(activeDimensions);
    if (filterHints.length > 0) {
      promptParts.push(filterHints.join(' and '));
    }

    // 4. Scene type
    promptParts.push(defaultVariation.moment);

    // 5. Content swaps
    const swaps = buildContentSwaps(activeDimensions);
    if (swaps.length > 0) {
      promptParts.push(swaps.join(', '));
    }

    // 6. Style and mood
    if (styleDim?.reference) {
      const styleClause = buildWeightedClause(styleDim, 50);
      if (styleClause) promptParts.push(styleClause);
    }
    if (moodDim?.reference) {
      const moodClause = buildWeightedClause(moodDim, 30);
      if (moodClause) promptParts.push(moodClause);
    }

    // 7. Variety modifiers
    promptParts.push(variety.time);
    promptParts.push(variety.atmosphere);

    // 8. Game UI (CRITICAL for gameplay mode)
    const gameUIClause = gameUIDim ? buildWeightedClause(gameUIDim, 50) : null;
    promptParts.push(...modeConfig.styleKeywords.slice(0, 2));
    promptParts.push(gameUIClause || 'game UI overlay');
    promptParts.push(...modeConfig.technicalKeywords.slice(0, 3));

    // 9. Quality
    promptParts.push(defaultVariation.focus);
    promptParts.push('detailed');
  }

  // Apply learned context - enhance with preferences and filter avoid elements
  let enhancedParts = applyLearnedContext(promptParts, learnedContext);
  if (learnedContext?.avoidElements) {
    enhancedParts = filterAvoidElements(enhancedParts, learnedContext.avoidElements);
  }

  // Join and truncate to ensure we're under the limit
  const rawPrompt = enhancedParts.filter(p => p).join(', ');
  const finalPrompt = truncatePrompt(rawPrompt);

  // Build elements for UI
  const elements = buildElements(baseImage, activeDimensions, outputMode, 'detailed', lockedElements);

  return { prompt: finalPrompt, elements };
}

/**
 * Build a prompt with learned context integration
 * This is the main entry point that fetches learned context and applies it
 */
export async function buildPromptWithLearning(
  baseImage: string,
  filledDimensions: Dimension[],
  sceneType: string,
  index: number,
  lockedElements: PromptElement[],
  outputMode: OutputMode
): Promise<{ prompt: string; elements: PromptElement[] }> {
  // Dynamically import to avoid circular dependencies and keep server-side safe
  let learnedContext: LearnedContext | undefined;

  try {
    // Only load learning context on client side
    if (typeof window !== 'undefined') {
      const { getPreferenceProfile, buildLearnedContext } = await import('../../lib/preferenceEngine');
      const profile = await getPreferenceProfile();
      learnedContext = buildLearnedContext(profile);
    }
  } catch (error) {
    console.warn('Failed to load learned context:', error);
  }

  return buildMockPromptWithElements(
    baseImage,
    filledDimensions,
    sceneType,
    index,
    lockedElements,
    outputMode,
    learnedContext
  );
}
