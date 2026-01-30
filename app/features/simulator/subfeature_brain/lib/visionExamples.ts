/**
 * Vision Examples - Example sentences for SmartBreakdown
 *
 * These examples demonstrate the vision sentence format and help
 * users understand how to describe their creative mashup ideas.
 *
 * Categories covered:
 * - Game mashups (franchise crossovers)
 * - Style transfers (art style changes)
 * - Era swaps (time period changes)
 * - Medium changes (photography, animation)
 * - Tone shifts (mood/atmosphere changes)
 */

export interface VisionExample {
  /** The example sentence text */
  text: string;
  /** Short description of what type of mashup this represents */
  category: 'game-mashup' | 'style-transfer' | 'era-swap' | 'medium-change' | 'tone-shift';
}

/**
 * Curated vision examples covering diverse scenarios
 */
export const VISION_EXAMPLES: VisionExample[] = [
  // Game mashups
  {
    text: "Baldur's Gate but in the Star Wars universe",
    category: 'game-mashup',
  },
  {
    text: "Pokemon but photorealistic like a nature documentary",
    category: 'medium-change',
  },
  {
    text: "The Last of Us reimagined as a Studio Ghibli film",
    category: 'style-transfer',
  },
  {
    text: "Minecraft world rendered in Unreal Engine 5 hyperrealism",
    category: 'style-transfer',
  },
  {
    text: "Zelda: Breath of the Wild in cyberpunk Tokyo setting",
    category: 'era-swap',
  },
  {
    text: "Dark Souls but in a cute Animal Crossing style",
    category: 'tone-shift',
  },
  {
    text: "GTA San Andreas as a 1920s noir detective story",
    category: 'era-swap',
  },
  {
    text: "Horizon Zero Dawn machines in a medieval fantasy world",
    category: 'game-mashup',
  },
  {
    text: "Stardew Valley but in the Warhammer 40K universe",
    category: 'game-mashup',
  },
  {
    text: "Elden Ring reimagined as a watercolor painting",
    category: 'medium-change',
  },
  {
    text: "Resident Evil mansion in cozy cottage core aesthetic",
    category: 'tone-shift',
  },
  {
    text: "Mario Kart tracks as realistic Formula 1 circuits",
    category: 'medium-change',
  },
];

/**
 * Get a shuffled subset of examples
 * Uses Fisher-Yates shuffle for unbiased randomization
 */
export function getShuffledExamples(count: number = 3): VisionExample[] {
  const shuffled = [...VISION_EXAMPLES];

  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get examples from different categories for variety
 * Tries to return one example from each category up to the count
 */
export function getDiverseExamples(count: number = 3): VisionExample[] {
  const categories = new Set<VisionExample['category']>();
  const result: VisionExample[] = [];
  const shuffled = getShuffledExamples(VISION_EXAMPLES.length);

  // First pass: get one from each category
  for (const example of shuffled) {
    if (!categories.has(example.category) && result.length < count) {
      categories.add(example.category);
      result.push(example);
    }
  }

  // Second pass: fill remaining slots if needed
  for (const example of shuffled) {
    if (result.length >= count) break;
    if (!result.includes(example)) {
      result.push(example);
    }
  }

  return result;
}
