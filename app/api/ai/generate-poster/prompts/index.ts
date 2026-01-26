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
 * VARIANT 1: HEROIC PORTRAIT
 * Inspired by: Mass Effect, God of War, The Witcher 3
 */
export const HEROIC_PORTRAIT: PosterVariant = {
  id: 'heroic-portrait',
  name: 'Heroic Portrait',
  style: 'Character-focused dramatic portrait',
  buildPrompt: (context) => {
    const d = extractDimensions(context.dimensions);
    const title = context.projectName.toUpperCase();
    const chars = truncate(d.characters, 60);
    const env = truncate(d.environment, 50);

    return `Heroic character portrait, ${d.artStyle}, vertical 2:3 poster.

Central figure: ${chars} in powerful three-quarter pose, occupying 70% of frame. Detailed face, armor textures, signature equipment. Eyes convey determination.

Background: ${env} visible through atmospheric haze, framing the character.

Lighting: Strong rim light creating heroic halo, dramatic shadows, ${d.mood} atmosphere.

Composition: Rule of thirds, eyes at upper intersection. Lower third reserved for title.

Title: "${title}" in bold weathered metallic typography at bottom center, dimensional depth with scratches matching game aesthetic.

Quality: AAA game cover, photorealistic, 8K, professional key art.`;
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
 * VARIANT 4: CINEMATIC MOMENT
 * Inspired by: The Last of Us, Red Dead Redemption 2, Ghost of Tsushima
 */
export const CINEMATIC_MOMENT: PosterVariant = {
  id: 'cinematic-moment',
  name: 'Cinematic Moment',
  style: 'Atmospheric story moment',
  buildPrompt: (context) => {
    const d = extractDimensions(context.dimensions);
    const title = context.projectName.toUpperCase();
    const chars = truncate(d.characters, 50);
    const env = truncate(d.environment, 50);

    return `Cinematic story moment, ${d.artStyle} with film aesthetics, vertical 2:3 poster.

Scene: Pivotal quiet moment featuring ${chars} within ${env}. Contemplative beat suggesting deeper narrative, not action.

Storytelling: Environment rich with narrative detail - weathered belongings, signs of story.

Cinematography: Film frame composition, shallow depth of field, intimate documentary feel.

Lighting: Golden hour warmth or overcast diffusion, naturalistic motivation, ${d.mood} tone. Subtle lens flares acceptable.

Color grading: Cinematic palette - warm sepia, cold blue tension, or desaturated grit. Cohesive film appearance.

Emotion: Body language speaks volumes, glimpse of private moment.

Atmosphere: Dust motes in light beams, particles appropriate to environment.

Title: "${title}" in elegant understated typography at bottom, prestigious film credits style, subtle metallic effect.

Quality: Movie screenshot quality, emotionally evocative, GOTY edition marketing.`;
  },
};

/**
 * All poster variants for iteration
 */
export const POSTER_VARIANTS: PosterVariant[] = [
  HEROIC_PORTRAIT,
  EPIC_PANORAMA,
  ICONIC_SYMBOL,
  CINEMATIC_MOMENT,
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
