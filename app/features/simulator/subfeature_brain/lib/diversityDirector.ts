/**
 * Diversity Director - Tracks visual inventory and guides diverse generation
 *
 * Purpose:
 * - Prevent repetitive content across autoplay iterations
 * - Track what visual characteristics have been generated
 * - Guide generation toward underrepresented aspects
 * - Ensure a diverse portfolio of images
 *
 * How it works:
 * 1. After each image is approved, extract its visual fingerprint via Gemini
 * 2. Update the diversity inventory with counts of various aspects
 * 3. Before generating new images, analyze what's missing
 * 4. Inject diversity guidance into the prompt generation
 */

import { OutputMode } from '../../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Visual fingerprint extracted from an image
 */
export interface VisualFingerprint {
  /** Prompt ID this fingerprint belongs to */
  promptId: string;
  /** URL of the analyzed image */
  imageUrl: string;
  /** Extracted visual features */
  features: {
    /** Main color tones (e.g., "warm golden", "cool blue", "dark moody") */
    colorTone: string;
    /** Shot composition type */
    composition: 'wide' | 'medium' | 'close-up' | 'portrait' | 'action' | 'environmental';
    /** Primary subject type */
    subjectFocus: 'character' | 'environment' | 'action' | 'object' | 'group';
    /** Emotional mood */
    mood: 'dramatic' | 'peaceful' | 'tense' | 'mysterious' | 'energetic' | 'melancholic';
    /** Time/lighting condition */
    lighting: 'day' | 'night' | 'golden-hour' | 'dawn' | 'artificial' | 'dramatic';
    /** Camera angle */
    cameraAngle: 'eye-level' | 'low-angle' | 'high-angle' | 'aerial' | 'dutch' | 'over-shoulder';
    /** Activity level in the scene */
    activity: 'static' | 'subtle' | 'dynamic' | 'intense';
  };
  /** When this fingerprint was created */
  timestamp: Date;
}

/**
 * Inventory tracking diversity across generated images
 */
export interface DiversityInventory {
  /** All extracted fingerprints */
  fingerprints: VisualFingerprint[];

  /** Counts by feature category */
  counts: {
    composition: Record<string, number>;
    subjectFocus: Record<string, number>;
    mood: Record<string, number>;
    lighting: Record<string, number>;
    cameraAngle: Record<string, number>;
    activity: Record<string, number>;
  };

  /** Features that are underrepresented */
  gaps: string[];

  /** Features that are overrepresented */
  saturated: string[];
}

/**
 * Guidance for generating diverse content
 */
export interface DiversityGuidance {
  /** Prompt prefix to encourage diversity */
  promptPrefix: string;
  /** Specific aspects to emphasize (underrepresented) */
  emphasize: string[];
  /** Aspects to avoid (already have enough) */
  avoid: string[];
  /** Suggested shot characteristics */
  suggestedShot: {
    composition?: string;
    mood?: string;
    lighting?: string;
    activity?: string;
  };
}

/**
 * Response from diversity analysis API
 */
export interface DiversityAnalysisResponse {
  success: boolean;
  fingerprint?: VisualFingerprint['features'];
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** All possible values for each feature category */
const FEATURE_OPTIONS = {
  composition: ['wide', 'medium', 'close-up', 'portrait', 'action', 'environmental'] as const,
  subjectFocus: ['character', 'environment', 'action', 'object', 'group'] as const,
  mood: ['dramatic', 'peaceful', 'tense', 'mysterious', 'energetic', 'melancholic'] as const,
  lighting: ['day', 'night', 'golden-hour', 'dawn', 'artificial', 'dramatic'] as const,
  cameraAngle: ['eye-level', 'low-angle', 'high-angle', 'aerial', 'dutch', 'over-shoulder'] as const,
  activity: ['static', 'subtle', 'dynamic', 'intense'] as const,
};

/** Threshold for considering a feature "saturated" */
const SATURATION_THRESHOLD = 0.4; // 40% of total images

// ============================================================================
// INVENTORY MANAGEMENT
// ============================================================================

/**
 * Create an empty diversity inventory
 */
export function createEmptyInventory(): DiversityInventory {
  return {
    fingerprints: [],
    counts: {
      composition: {},
      subjectFocus: {},
      mood: {},
      lighting: {},
      cameraAngle: {},
      activity: {},
    },
    gaps: [],
    saturated: [],
  };
}

/**
 * Add a fingerprint to the inventory and update counts
 */
export function updateInventory(
  inventory: DiversityInventory,
  fingerprint: VisualFingerprint
): DiversityInventory {
  const newInventory = {
    ...inventory,
    fingerprints: [...inventory.fingerprints, fingerprint],
    counts: { ...inventory.counts },
    gaps: [] as string[],
    saturated: [] as string[],
  };

  // Update counts for each feature
  const features = fingerprint.features;

  // Composition
  newInventory.counts.composition = { ...newInventory.counts.composition };
  newInventory.counts.composition[features.composition] =
    (newInventory.counts.composition[features.composition] || 0) + 1;

  // Subject focus
  newInventory.counts.subjectFocus = { ...newInventory.counts.subjectFocus };
  newInventory.counts.subjectFocus[features.subjectFocus] =
    (newInventory.counts.subjectFocus[features.subjectFocus] || 0) + 1;

  // Mood
  newInventory.counts.mood = { ...newInventory.counts.mood };
  newInventory.counts.mood[features.mood] =
    (newInventory.counts.mood[features.mood] || 0) + 1;

  // Lighting
  newInventory.counts.lighting = { ...newInventory.counts.lighting };
  newInventory.counts.lighting[features.lighting] =
    (newInventory.counts.lighting[features.lighting] || 0) + 1;

  // Camera angle
  newInventory.counts.cameraAngle = { ...newInventory.counts.cameraAngle };
  newInventory.counts.cameraAngle[features.cameraAngle] =
    (newInventory.counts.cameraAngle[features.cameraAngle] || 0) + 1;

  // Activity
  newInventory.counts.activity = { ...newInventory.counts.activity };
  newInventory.counts.activity[features.activity] =
    (newInventory.counts.activity[features.activity] || 0) + 1;

  // Recalculate gaps and saturated
  const totalImages = newInventory.fingerprints.length;
  analyzeInventoryBalance(newInventory, totalImages);

  return newInventory;
}

/**
 * Analyze inventory to identify gaps and saturated features
 */
function analyzeInventoryBalance(inventory: DiversityInventory, totalImages: number): void {
  const gaps: string[] = [];
  const saturated: string[] = [];

  const saturationThreshold = Math.max(1, totalImages * SATURATION_THRESHOLD);

  // Check each feature category
  for (const [category, options] of Object.entries(FEATURE_OPTIONS)) {
    const counts = inventory.counts[category as keyof typeof FEATURE_OPTIONS];

    for (const option of options) {
      const count = counts[option] || 0;

      if (count === 0) {
        gaps.push(`${category}:${option}`);
      } else if (count >= saturationThreshold && totalImages > 1) {
        saturated.push(`${category}:${option}`);
      }
    }
  }

  inventory.gaps = gaps;
  inventory.saturated = saturated;
}

// ============================================================================
// FINGERPRINTING
// ============================================================================

/**
 * Extract visual fingerprint from an image via API
 */
export async function extractFingerprint(
  imageUrl: string,
  promptId: string,
  signal?: AbortSignal
): Promise<VisualFingerprint> {
  const response = await fetch('/api/ai/analyze-diversity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Diversity analysis failed: ${response.status}`);
  }

  const data: DiversityAnalysisResponse = await response.json();

  if (!data.success || !data.fingerprint) {
    throw new Error(data.error || 'Failed to extract fingerprint');
  }

  return {
    promptId,
    imageUrl,
    features: data.fingerprint,
    timestamp: new Date(),
  };
}

/**
 * Extract fingerprints for multiple images in parallel
 */
export async function extractFingerprints(
  images: Array<{ url: string; promptId: string }>,
  signal?: AbortSignal
): Promise<VisualFingerprint[]> {
  const results = await Promise.allSettled(
    images.map(({ url, promptId }) => extractFingerprint(url, promptId, signal))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<VisualFingerprint> => r.status === 'fulfilled')
    .map(r => r.value);
}

// ============================================================================
// DIVERSITY GUIDANCE
// ============================================================================

/**
 * Generate diversity guidance based on current inventory
 */
export function generateDiversityGuidance(
  inventory: DiversityInventory,
  targetCount: number,
  outputMode: OutputMode
): DiversityGuidance {
  const { gaps, saturated, fingerprints } = inventory;
  const remaining = targetCount - fingerprints.length;

  // Build emphasize list from gaps (most impactful categories first)
  const emphasize: string[] = [];
  const priorityCategories = ['composition', 'mood', 'lighting'];

  for (const category of priorityCategories) {
    const categoryGaps = gaps
      .filter(g => g.startsWith(`${category}:`))
      .map(g => g.split(':')[1]);

    if (categoryGaps.length > 0) {
      // Pick one random gap from this category
      const randomGap = categoryGaps[Math.floor(Math.random() * categoryGaps.length)];
      emphasize.push(`${category}: ${formatFeatureForPrompt(randomGap)}`);
    }
  }

  // Build avoid list from saturated features
  const avoid: string[] = saturated.map(s => {
    const [category, feature] = s.split(':');
    return `${category}: ${formatFeatureForPrompt(feature)}`;
  });

  // Build suggested shot characteristics
  const suggestedShot: DiversityGuidance['suggestedShot'] = {};

  // Pick from gaps if available
  const compositionGaps = gaps.filter(g => g.startsWith('composition:'));
  if (compositionGaps.length > 0) {
    suggestedShot.composition = compositionGaps[0].split(':')[1];
  }

  const moodGaps = gaps.filter(g => g.startsWith('mood:'));
  if (moodGaps.length > 0) {
    suggestedShot.mood = moodGaps[0].split(':')[1];
  }

  const lightingGaps = gaps.filter(g => g.startsWith('lighting:'));
  if (lightingGaps.length > 0) {
    suggestedShot.lighting = lightingGaps[0].split(':')[1];
  }

  // Build prompt prefix
  const promptPrefix = buildDiversityPromptPrefix(emphasize, avoid, remaining, outputMode);

  return {
    promptPrefix,
    emphasize,
    avoid,
    suggestedShot,
  };
}

/**
 * Format a feature value for inclusion in a prompt
 */
function formatFeatureForPrompt(feature: string): string {
  // Convert kebab-case to readable format
  return feature.replace(/-/g, ' ');
}

/**
 * Build a prompt prefix that encourages diversity
 */
function buildDiversityPromptPrefix(
  emphasize: string[],
  avoid: string[],
  remaining: number,
  outputMode: OutputMode
): string {
  const parts: string[] = [];

  if (remaining > 1) {
    parts.push(`Generate ${remaining} DISTINCTLY DIFFERENT scenes.`);
  }

  if (emphasize.length > 0) {
    parts.push(`Explore these underrepresented aspects: ${emphasize.slice(0, 3).join(', ')}.`);
  }

  if (avoid.length > 0) {
    parts.push(`Avoid overused elements: ${avoid.slice(0, 2).join(', ')}.`);
  }

  // Mode-specific diversity hints
  if (outputMode === 'sketch') {
    parts.push('Vary the sketch style: some loose, some detailed, different perspectives.');
  } else if (outputMode === 'gameplay') {
    parts.push('Vary gameplay situations: exploration, combat, dialogue, inventory management.');
  }

  return parts.join(' ');
}

// ============================================================================
// PROMPT MODIFICATION
// ============================================================================

/**
 * Apply diversity guidance to a prompt
 */
export function applyDiversityToPrompt(
  originalPrompt: string,
  guidance: DiversityGuidance
): string {
  // If no significant guidance, return original
  if (!guidance.promptPrefix && guidance.emphasize.length === 0) {
    return originalPrompt;
  }

  // Build diversity instruction block
  const diversityBlock: string[] = [];

  if (guidance.suggestedShot.composition) {
    diversityBlock.push(`${guidance.suggestedShot.composition} shot`);
  }
  if (guidance.suggestedShot.mood) {
    diversityBlock.push(`${guidance.suggestedShot.mood} mood`);
  }
  if (guidance.suggestedShot.lighting) {
    diversityBlock.push(`${guidance.suggestedShot.lighting} lighting`);
  }

  // Prepend diversity guidance to prompt
  const diversityPrefix = diversityBlock.length > 0
    ? `[DIVERSITY: ${diversityBlock.join(', ')}] `
    : '';

  return `${diversityPrefix}${originalPrompt}`;
}

/**
 * Apply diversity guidance to feedback
 * This modifies the feedback used for prompt regeneration
 */
export function applyDiversityToFeedback(
  feedback: { positive: string; negative: string },
  guidance: DiversityGuidance
): { positive: string; negative: string } {
  let positive = feedback.positive;
  let negative = feedback.negative;

  // Add diversity encouragement to positive feedback
  if (guidance.emphasize.length > 0) {
    const emphasisText = `Explore: ${guidance.emphasize.slice(0, 2).join(', ')}`;
    positive = positive
      ? `${positive}. ${emphasisText}`
      : emphasisText;
  }

  // Add saturation warnings to negative feedback
  if (guidance.avoid.length > 0) {
    const avoidText = `Avoid repeating: ${guidance.avoid.slice(0, 2).join(', ')}`;
    negative = negative
      ? `${negative}. ${avoidText}`
      : avoidText;
  }

  return { positive, negative };
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Check if the inventory needs diversity guidance
 */
export function needsDiversityGuidance(inventory: DiversityInventory): boolean {
  return inventory.fingerprints.length >= 1 && (
    inventory.gaps.length > 0 ||
    inventory.saturated.length > 0
  );
}

/**
 * Get a summary of the current diversity state for logging
 */
export function getDiversitySummary(inventory: DiversityInventory): string {
  const { fingerprints, gaps, saturated } = inventory;

  if (fingerprints.length === 0) {
    return 'No images analyzed yet';
  }

  const parts = [`${fingerprints.length} images analyzed`];

  if (gaps.length > 0) {
    parts.push(`${gaps.length} unexplored aspects`);
  }

  if (saturated.length > 0) {
    parts.push(`${saturated.length} overrepresented aspects`);
  }

  return parts.join(', ');
}
