import { DimensionPreset, TransformationType } from '../types';

/**
 * Default dimension presets for the Simulator.
 * Each dimension remixes one aspect of the base image using cultural references.
 */
export const DEFAULT_DIMENSIONS: DimensionPreset[] = [
  {
    type: 'environment',
    label: 'Universe / World',
    icon: '🌍',
    placeholder: 'e.g., "Star Wars galaxy", "Middle-earth", "Cyberpunk 2077 Night City"',
  },
  {
    type: 'artStyle',
    label: 'Visual Style',
    icon: '🎨',
    placeholder: 'e.g., "Photorealistic CGI", "Studio Ghibli painted", "Unreal Engine 5"',
  },
  {
    type: 'characters',
    label: 'Characters',
    icon: '👤',
    placeholder: 'e.g., "SG-1 military team", "Fantasy adventurers", "Anime protagonists"',
  },
  {
    type: 'mood',
    label: 'Atmosphere',
    icon: '🎭',
    placeholder: 'e.g., "Tense thriller", "Epic adventure", "Dark and gritty"',
  },
  {
    type: 'action',
    label: 'Scene Action',
    icon: '⚔️',
    placeholder: 'e.g., "Tactical combat", "Dramatic confrontation", "Exploration"',
  },
];

/**
 * Additional dimension presets that users can add for deeper customization
 */
export const EXTRA_DIMENSIONS: DimensionPreset[] = [
  {
    type: 'gameUI',
    label: 'Game UI / HUD',
    icon: '🎮',
    placeholder: 'e.g., "CRPG interface with character portraits", "FPS HUD with crosshair and ammo", "No UI (concept art)"',
  },
  {
    type: 'era',
    label: 'Era / Time',
    icon: '⏳',
    placeholder: 'e.g., "Ancient alien civilization", "Near-future", "1990s aesthetic"',
  },
  {
    type: 'camera',
    label: 'Camera / POV',
    icon: '📷',
    placeholder: 'e.g., "First-person view", "Cinematic drone shot", "Over-the-shoulder"',
  },
  {
    type: 'technology',
    label: 'Tech / Props',
    icon: '⚙️',
    placeholder: 'e.g., "Ancient alien devices", "Lightsabers", "Magic-tech hybrid"',
  },
  {
    type: 'creatures',
    label: 'Creatures / Beings',
    icon: '🐉',
    placeholder: 'e.g., "Realistic Pokemon", "Alien species", "Mythical beasts"',
  },
  {
    type: 'genre',
    label: 'Genre Treatment',
    icon: '🎬',
    placeholder: 'e.g., "Blockbuster action film", "Survival horror game", "Epic RPG"',
  },
  {
    type: 'custom',
    label: 'Custom Dimension',
    icon: '✨',
    placeholder: 'Define your own remix aspect...',
  },
];

/**
 * Example simulation type with transformation metadata
 *
 * KEY CONCEPT: Preserve the BASE visual structure (camera angles, UI, format, medium)
 * and SWAP the content within that structure. Like putting a winter hat on Pacman -
 * it's still a Pacman screenshot, just with winter content.
 */
export interface ExampleSimulation {
  id: string;
  title: string;
  subtitle: string;
  transformationType: TransformationType;
  /** The visual FORMAT to preserve - camera angles, UI layout, medium characteristics */
  baseImage: string;
  /** What makes this format visually distinctive */
  baseImageDescription: string;
  dimensions: Array<{
    type: DimensionPreset['type'];
    reference: string;
  }>;
  /** What the output should look like - still recognizable as the base format */
  expectedOutcome: string;
}

/**
 * Three deep example simulations demonstrating content-swap transformation.
 * The base FORMAT is preserved, content is swapped within that structure.
 */
export const EXAMPLE_SIMULATIONS: ExampleSimulation[] = [
  // Example 1: Baldur's Gate format → Star Wars content
  // Output should still LOOK like a Baldur's Gate screenshot with authentic CRPG UI
  {
    id: 'bg-starwars',
    title: 'BG × Star Wars',
    subtitle: 'Isometric RPG format with sci-fi content',
    transformationType: 'universe_swap',
    baseImage: 'Baldur\'s Gate 1-2 isometric RPG screenshot - top-down 3/4 view, party of 4-6 characters in formation, painted 2D backgrounds',
    baseImageDescription: 'The distinctive isometric camera angle, pre-rendered backgrounds with hand-painted aesthetic, character sprites in tactical positions, medieval fantasy RPG visual language',
    dimensions: [
      {
        type: 'environment',
        reference: 'Star Wars cantina interior replacing fantasy tavern - same isometric layout but with alien patrons, holographic displays, droid servers, booth seating with smugglers',
      },
      {
        type: 'characters',
        reference: 'RPG party as Star Wars archetypes in isometric sprite style - Mandalorian warrior (fighter), robed Jedi (mage), Twi\'lek smuggler (rogue), protocol droid (cleric), Wookiee (barbarian)',
      },
      {
        type: 'technology',
        reference: 'Fantasy items replaced: lightsabers in weapon slots, blaster pistols instead of crossbows, holocrons as spell scrolls, thermal detonators as potions, credits instead of gold',
      },
      {
        type: 'artStyle',
        reference: 'Enhanced pre-rendered style - maintain painted background aesthetic but with sci-fi details, keep the nostalgic 1998 CRPG look but swap medieval for space opera elements',
      },
      {
        type: 'gameUI',
        reference: 'Classic CRPG interface: character portraits on left showing alien species faces, action bar at bottom with Force power icons instead of spells, inventory showing lightsaber and blaster slots, credits counter instead of gold, dialogue box with alien language options',
      },
    ],
    expectedOutcome: 'Looks like authentic Baldur\'s Gate screenshot with CRPG UI frame - but showing a Mos Eisley cantina, party of Star Wars characters, and sci-fi interface elements',
  },

  // Example 2: Pokemon anime frame → Realistic render
  // This one doesn't have game UI - it's anime frame format
  {
    id: 'pokemon-realistic',
    title: 'Pokemon Realistic',
    subtitle: 'Anime frame composition with CGI creatures',
    transformationType: 'medium_change',
    baseImage: 'Pokemon anime battle frame - dynamic anime composition with trainer in foreground giving commands, Pokemon mid-attack with action lines, opponent across the field, bright saturated colors, clean cel-shaded look',
    baseImageDescription: 'Characteristic anime framing: dramatic angles, speed lines, intense expressions, dynamic poses, the visual language of Pokemon anime battles with its distinctive composition rules',
    dimensions: [
      {
        type: 'creatures',
        reference: 'Same Pokemon but photorealistic - Pikachu with detailed fur texture and realistic rodent proportions, electric sparks rendered as real lightning, same iconic poses but believable anatomy',
      },
      {
        type: 'characters',
        reference: 'Trainer in same dramatic pose but as real person - young adult in Pokemon-style clothing rendered realistically, determined expression, same commanding gesture as anime',
      },
      {
        type: 'artStyle',
        reference: 'Maintain anime COMPOSITION but render photorealistically - keep the dramatic camera angle, action lines become motion blur, cel-shading becomes realistic lighting, same frame layout',
      },
      {
        type: 'environment',
        reference: 'Pokemon gym arena rendered as real location - same architectural layout as anime but with realistic materials, worn floor from battles, dramatic stadium lighting',
      },
      {
        type: 'gameUI',
        reference: 'No game UI - this is anime frame style, not gameplay. Clean cinematic image like a movie still from a Pokemon live-action film',
      },
    ],
    expectedOutcome: 'Still framed exactly like a Pokemon anime battle scene - same composition, poses, drama - but Pikachu has real fur, the trainer is a real person, the gym looks like a real building. No game HUD.',
  },

  // Example 3: Far Cry FPS view → Stargate universe
  // Output should still LOOK like a Far Cry screenshot with FPS HUD
  {
    id: 'farcry-stargate',
    title: 'Far Cry × Stargate',
    subtitle: 'FPS format with alien gate network',
    transformationType: 'universe_swap',
    baseImage: 'Far Cry 6 first-person gameplay screenshot - weapon held in lower right, crosshair center screen, lush open world environment ahead, enemy outpost visible in distance',
    baseImageDescription: 'Classic FPS visual format: gun viewmodel, centered aim point, HUD overlay, first-person immersion, the distinct Far Cry open-world shooter aesthetic',
    dimensions: [
      {
        type: 'environment',
        reference: 'Tropical jungle replaced with alien world - same open vista composition but with Stargate DHD in foreground, Goa\'uld pyramid in distance instead of outpost, alien vegetation, twin suns in sky',
      },
      {
        type: 'technology',
        reference: 'FPS weapon viewmodel swapped - hands holding P90 or staff weapon instead of assault rifle, same grip position, zat\'nik\'tel visible on weapon wheel indicator',
      },
      {
        type: 'characters',
        reference: 'Player arms in SG team tactical gear - olive drab sleeves with mission patches visible, same first-person hand positioning but military expedition equipment',
      },
      {
        type: 'action',
        reference: 'Same FPS moment but Stargate content - Jaffa patrol visible instead of guerrillas, active Stargate glowing in midground, approaching alien temple for infiltration',
      },
      {
        type: 'gameUI',
        reference: 'FPS HUD with Stargate theme: crosshair center screen, ammo counter showing staff weapon charges, health bar with Ancient-style design, minimap showing Goa\'uld territory markers, compass with gate symbol indicators, "Press E to dial" interaction prompt near DHD',
      },
    ],
    expectedOutcome: 'Looks like a Far Cry screenshot - same FPS format, weapon hands visible, HUD elements - but the HUD shows Stargate-themed elements, you\'re holding a P90, and Jaffa guard the pyramid ahead',
  },
];

/**
 * Get dimension preset by type
 */
export function getDimensionPreset(type: DimensionPreset['type']): DimensionPreset | undefined {
  return [...DEFAULT_DIMENSIONS, ...EXTRA_DIMENSIONS].find((d) => d.type === type);
}

/**
 * Get all available dimension presets
 */
export function getAllDimensionPresets(): DimensionPreset[] {
  return [...DEFAULT_DIMENSIONS, ...EXTRA_DIMENSIONS];
}
