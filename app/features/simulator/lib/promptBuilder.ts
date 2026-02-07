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
import { Dimension, DimensionFilterMode, DimensionTransformMode, PromptElement, OutputMode, LearnedContext, UserPreference } from '../types';

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
 * Truncate prompt to fit within Leonardo's character limit.
 * Uses weighted section removal — drops low-priority sections first
 * (variety modifiers) before core content (base description, quality tags).
 */
function truncatePrompt(prompt: string, maxLength: number = MAX_PROMPT_LENGTH): string {
  if (prompt.length <= maxLength) return prompt;

  // Split into sections by comma
  const sections = prompt.split(',').map(s => s.trim()).filter(Boolean);

  // Low-priority keywords that can be dropped first (variety modifiers, atmosphere)
  const lowPriorityPatterns = [
    /^(fog|dust|rain|snow|heat haze|smoke|clear|stormy)$/i,
    /^(golden hour|blue hour|midday|overcast|dawn|night|morning mist|neon night)$/i,
    /^(rule of thirds|centered|leading lines|layered depth)$/i,
    /^(low angle|bird's eye|eye-level|dutch angle|wide shot|medium shot|close-up|panoramic)$/i,
  ];

  // Try removing low-priority sections first
  let result = prompt;
  for (const pattern of lowPriorityPatterns) {
    if (result.length <= maxLength) break;
    const filtered = sections
      .filter(s => !pattern.test(s))
      .join(', ');
    if (filtered.length < result.length) {
      result = filtered;
    }
  }

  if (result.length <= maxLength) return result;

  // Fallback: find last comma before limit
  const truncated = result.substring(0, maxLength);
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
 * Build mode-specific phrases for prompt differentiation
 * Each mode generates vastly different visual styles:
 * - Gameplay: HUD, UI overlays, authentic screenshot feel
 * - Sketch: Hand-drawn concept art, rough linework, artistic
 * - Trailer: Cinematic composition for video/animation
 * - Poster: Key art composition (handled separately)
 */
function buildModeSection(outputMode: OutputMode, gameUIDim?: Dimension): string[] {
  if (outputMode === 'gameplay') {
    const phrases = [
      'authentic gameplay screenshot',
      'visible game HUD elements',
      'in-game UI overlays',
    ];
    if (gameUIDim?.reference) {
      const clause = buildWeightedClause(gameUIDim, 50);
      if (clause) phrases.push(clause);
    } else {
      phrases.push('health bars and status indicators');
    }
    return phrases;
  }

  if (outputMode === 'sketch') {
    return [
      'concept art sketch',
      'hand-drawn illustration style',
      'visible pencil strokes and linework',
      'rough artistic rendering',
      'sketch pad texture',
      'traditional art medium feel',
      'loose expressive lines',
      'no game UI or HUD elements',
    ];
  }

  if (outputMode === 'trailer') {
    return [
      'cinematic film still',
      'dramatic movie scene composition',
      'professional cinematography',
      'dynamic action framing',
      'high contrast dramatic lighting',
      'motion blur suggesting movement',
      'widescreen 21:9 aspect ratio feel',
      'blockbuster trailer moment',
      'no game UI or HUD elements',
    ];
  }

  // Poster mode - no mode section (handled by poster-specific logic)
  return [];
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

  // Output mode element - describes the visual style approach
  const modeLabels: Record<OutputMode, string> = {
    gameplay: 'gameplay: HUD and UI elements',
    sketch: 'sketch: hand-drawn concept art',
    trailer: 'trailer: cinematic scene',
    poster: 'poster: key art composition',
    realistic: 'realistic: next-gen photorealistic game graphics',
  };
  elements.push({
    id: uuidv4(),
    text: modeLabels[outputMode],
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
  const variation = SCENE_VARIATIONS[sceneType] || SCENE_VARIATIONS['Cinematic Wide Shot'];
  const variety = getVarietyModifiers(index);

  const styleDim = filledDimensions.find((d) => d.type === 'artStyle');
  const moodDim = filledDimensions.find((d) => d.type === 'mood');
  const cameraDim = filledDimensions.find((d) => d.type === 'camera');
  const gameUIDim = filledDimensions.find((d) => d.type === 'gameUI');

  // Build prompt parts - prioritized by importance
  const promptParts: string[] = [];

  // 1. Camera angle (respects weight if camera dim exists)
  const cameraClause = cameraDim ? buildWeightedClause(cameraDim, 30) : null;
  promptParts.push(cameraClause || variety.camera);

  // 2. Base description (truncate if too long)
  const baseDesc = baseImage.length > 200 ? baseImage.substring(0, 200) : baseImage;
  promptParts.push(baseDesc);

  // 3. Filter preservation hints (based on active filter modes)
  const filterHints = buildFilterHints(filledDimensions);
  if (filterHints.length > 0) {
    promptParts.push(filterHints.join(' and '));
  }

  // 4. Scene type
  promptParts.push(variation.moment);

  // 5. Content swaps with weights (most important for variety)
  const swaps = buildContentSwaps(filledDimensions);
  if (swaps.length > 0) {
    promptParts.push(swaps.join(', '));
  }

  // 6. Style and mood (with weight consideration)
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

  // 8. Output mode - multi-phrase mode section
  const modeSection = buildModeSection(outputMode, gameUIDim);
  if (modeSection.length > 0) {
    promptParts.push(...modeSection);
  }

  // 9. Quality
  promptParts.push(variation.focus);
  promptParts.push('detailed');

  // Apply learned context - enhance with preferences and filter avoid elements
  let enhancedParts = applyLearnedContext(promptParts, learnedContext);
  if (learnedContext?.avoidElements) {
    enhancedParts = filterAvoidElements(enhancedParts, learnedContext.avoidElements);
  }

  // Join and truncate to ensure we're under the limit
  const rawPrompt = enhancedParts.filter(p => p).join(', ');
  const finalPrompt = truncatePrompt(rawPrompt);

  // Build elements for UI
  const elements = buildElements(baseImage, filledDimensions, outputMode, 'detailed', lockedElements);

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
      const { getPreferenceProfile, buildLearnedContext } = await import('./preferenceEngine');
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

// ============================================================================
// PROMPT DEDUPLICATION
// ============================================================================

/**
 * Compute Jaccard similarity between two prompts based on word sets.
 * Returns 0-1 where 1 is identical.
 */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Deduplicate prompts by checking pairwise similarity.
 * If any pair exceeds the threshold, regenerate the duplicate with a rotated variety modifier.
 */
export function deduplicatePrompts(
  prompts: Array<{ prompt: string; elements: PromptElement[] }>,
  baseImage: string,
  filledDimensions: Dimension[],
  lockedElements: PromptElement[],
  outputMode: OutputMode,
  threshold: number = 0.7
): Array<{ prompt: string; elements: PromptElement[] }> {
  const sceneTypes = Object.keys(SCENE_VARIATIONS);
  const result = [...prompts];

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const similarity = jaccardSimilarity(result[i].prompt, result[j].prompt);
      if (similarity > threshold) {
        // Regenerate the later prompt with a different variety offset
        const altIndex = j + result.length; // Force different variety modifiers
        const altSceneType = sceneTypes[(j + 2) % sceneTypes.length];
        result[j] = buildMockPromptWithElements(
          baseImage,
          filledDimensions,
          altSceneType,
          altIndex,
          lockedElements,
          outputMode
        );
      }
    }
  }

  return result;
}
