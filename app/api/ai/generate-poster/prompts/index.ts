/**
 * Poster Generation Prompts
 *
 * Four distinct poster styles inspired by video game cover art patterns.
 * Each prompt is kept under 1200 chars to leave room for dynamic content
 * while staying under Leonardo's 1500 char limit.
 */

export interface PosterPromptContext {
  projectName: string;
  basePrompt: string;
  dimensions: {
    type: string;
    reference: string;
  }[];
}

export interface PosterVariant {
  id: string;
  name: string;
  style: string;
  buildPrompt: (context: PosterPromptContext) => string;
}

/**
 * Extract dimension values with fallbacks
 */
function extractDimensions(dimensions: PosterPromptContext['dimensions']) {
  const get = (type: string, fallback: string) =>
    dimensions.find(d => d.type === type)?.reference || fallback;

  return {
    environment: get('environment', 'mysterious world'),
    characters: get('characters', 'enigmatic figure'),
    mood: get('mood', 'epic and dramatic'),
    artStyle: get('artStyle', 'cinematic digital art'),
  };
}

/**
 * Truncate text to max length, preserving word boundaries
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

/**
 * VARIANT 1: FREESTYLE
 * Inspired by: Artistic freedom and LLM creativity
 * Gives the AI maximum creative latitude based on game description
 */
export const FREESTYLE: PosterVariant = {
  id: 'freestyle',
  name: 'Freestyle',
  style: 'AI-driven creative interpretation',
  buildPrompt: (context) => {
    const d = extractDimensions(context.dimensions);
    const title = context.projectName.toUpperCase();

    return `Create a striking video game poster, vertical 2:3 format.

Game essence: ${context.basePrompt}

World: ${d.environment}
Characters: ${d.characters}
Art direction: ${d.artStyle}
Tone: ${d.mood}

Creative freedom: Interpret this game concept in your most compelling visual style. Choose any composition, perspective, or artistic approach that best captures the soul of this game. You may focus on character, environment, abstract symbolism, action, emotion, or any combination. Surprise with an unexpected angle or concept that still feels true to the game's identity.

Only requirements:
- Title "${title}" integrated naturally into the composition
- Professional game marketing quality
- Evocative and memorable imagery

Quality: AAA game key art, portfolio-worthy, 8K detail.`;
  },
};

/**
 * VARIANT 2: EPIC PANORAMA
 * Inspired by: Horizon Zero Dawn, Elden Ring, Skyrim
 */
export const EPIC_PANORAMA: PosterVariant = {
  id: 'epic-panorama',
  name: 'Epic Panorama',
  style: 'Sweeping environmental vista',
  buildPrompt: (context) => {
    const d = extractDimensions(context.dimensions);
    const title = context.projectName.toUpperCase();
    const chars = truncate(d.characters, 50);
    const env = truncate(d.environment, 60);

    return `Epic panoramic vista, ${d.artStyle}, vertical 2:3 poster.

Environment: Breathtaking ${env} stretching to horizon. Layered depth with foreground details, massive scale through towering structures.

Figure: ${chars} as smaller silhouette (15-20% height) in lower third, facing the vast landscape.

Sky: Dramatic cloudscape in upper 40%, volumetric god rays, ${d.mood} atmosphere.

Particles: Dust, embers, or motes catching light. Warm foreground to cool distant gradient.

Composition: Strong horizontal layers, golden ratio placement, leading lines through scene.

Title: "${title}" carved into landscape at bottom, styled as ancient stonework casting shadows.

Quality: Matte painting excellence, cinematic scope, collector's edition quality.`;
  },
};

/**
 * VARIANT 3: ICONIC SYMBOL
 * Inspired by: Dark Souls, Destiny, Journey, Hollow Knight
 */
export const ICONIC_SYMBOL: PosterVariant = {
  id: 'iconic-symbol',
  name: 'Iconic Symbol',
  style: 'Minimalist symbolic design',
  buildPrompt: (context) => {
    const d = extractDimensions(context.dimensions);
    const title = context.projectName.toUpperCase();
    const chars = truncate(d.characters, 40);
    const env = truncate(d.environment, 40);

    return `Iconic symbolic poster, ${d.artStyle} with minimalist graphic design, vertical 2:3.

Central symbol: Abstract stylized representation of ${chars} and ${env}. Could be weapon silhouette, character in iconic pose reduced to essential shapes, or geometric abstraction. Occupies center 50% with perfect balance.

Negative space: Generous empty space, gradient or subtle texture background. Limited to 2-3 hues creating ${d.mood}.

Silhouette: Powerful profile with key details in negative space cutouts. Every edge deliberate and iconic.

Lighting: Single strong light source, stark shadows, ethereal rim light on symbol.

Contrast: Deep blacks against luminous highlights, saturated purposeful accent color.

Title: "${title}" as integral design element at bottom third, custom geometric typography matching symbol's visual language.

Quality: Gallery-worthy graphic design, iconic brand identity, merchandise-ready.`;
  },
};

/**
 * VARIANT 4: CINEMATIC ACTION
 * Inspired by: Uncharted, Devil May Cry, Bayonetta, Metal Gear Rising
 */
export const CINEMATIC_ACTION: PosterVariant = {
  id: 'cinematic-action',
  name: 'Cinematic Action',
  style: 'Dynamic action spectacle',
  buildPrompt: (context) => {
    const d = extractDimensions(context.dimensions);
    const title = context.projectName.toUpperCase();
    const chars = truncate(d.characters, 50);
    const env = truncate(d.environment, 50);

    return `Explosive cinematic action, ${d.artStyle} with blockbuster energy, vertical 2:3 poster.

Scene: ${chars} in peak action within ${env}. Capture the most intense, gravity-defying, or impossible moment. Mid-leap, mid-strike, mid-explosion - frozen at maximum drama.

Motion: Dynamic pose with extreme foreshortening or dramatic angle. Cape/hair/debris in motion blur. Speed lines or impact effects where appropriate.

Chaos: Environment reacting - crumbling structures, flying sparks, shattered glass, energy discharges, or elemental effects swirling around the action.

Cinematography: Dutch angle or extreme perspective. Wide-angle distortion for impact. ${d.mood} atmosphere amplified to eleven.

Lighting: Multiple dramatic light sources - explosions, magic, muzzle flashes, environmental destruction casting dynamic shadows and rim lights.

Color: High contrast, saturated accent colors against darker backgrounds. Visual hierarchy through color temperature.

Title: "${title}" bold and integrated with the action, possibly angled or impacted by the scene's energy.

Quality: Summer blockbuster keyart, maximum visual impact, collector's edition worthy.`;
  },
};

/**
 * All poster variants for iteration
 */
export const POSTER_VARIANTS: PosterVariant[] = [
  FREESTYLE,
  EPIC_PANORAMA,
  ICONIC_SYMBOL,
  CINEMATIC_ACTION,
];

/**
 * System prompt for Claude to enhance/customize the base prompts
 */
export const POSTER_SYSTEM_PROMPT = `You are a senior art director specializing in game key art. Enhance poster prompts with specific creative details while keeping the output UNDER 1400 characters total. Be concise but vivid. Return only the enhanced prompt, no explanations.`;

/**
 * Build all 4 poster prompts for a project
 */
export function buildPosterPrompts(context: PosterPromptContext): string[] {
  return POSTER_VARIANTS.map(variant => variant.buildPrompt(context));
}

/**
 * Get a specific variant's prompt
 */
export function buildVariantPrompt(
  variantId: string,
  context: PosterPromptContext
): string | null {
  const variant = POSTER_VARIANTS.find(v => v.id === variantId);
  return variant ? variant.buildPrompt(context) : null;
}
