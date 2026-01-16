import { GameUIGenre } from '../types';

/**
 * Game UI Preset Definition
 * Describes the visual elements that make a screenshot look like actual gameplay
 */
export interface GameUIPreset {
  genre: GameUIGenre;
  label: string;
  description: string;
  /** Detailed UI element descriptions for prompt generation */
  elements: {
    /** Where UI typically appears */
    layout: string;
    /** Health, mana, stamina, etc. */
    statusBars?: string;
    /** Action bar, abilities, weapons */
    actionUI?: string;
    /** Minimap, compass, objectives */
    navigation?: string;
    /** Resources, score, timer */
    resourceDisplay?: string;
    /** Character info, inventory hints */
    characterUI?: string;
    /** Any other distinctive elements */
    special?: string;
  };
  /** Short prompt snippet for this UI style */
  promptSnippet: string;
  /** Example games for reference */
  exampleGames: string[];
}

/**
 * Comprehensive library of Game UI presets by genre
 */
export const GAME_UI_PRESETS: Record<GameUIGenre, GameUIPreset> = {
  none: {
    genre: 'none',
    label: 'No UI (Concept Art)',
    description: 'Clean image without game interface - pure concept art or cinematic mode',
    elements: {
      layout: 'No UI elements, clean unobstructed view',
    },
    promptSnippet: 'no game UI, clean concept art, cinematic shot without HUD',
    exampleGames: ['Concept art', 'Photo mode screenshots'],
  },

  crpg: {
    genre: 'crpg',
    label: 'Classic RPG (Isometric)',
    description: 'Baldur\'s Gate, Divinity, Pillars of Eternity style interface',
    elements: {
      layout: 'UI frame around gameplay area, bottom panel dominant',
      statusBars: 'Character portraits on left with health/mana bars, party lined up horizontally',
      actionUI: 'Action bar at bottom with spell icons, quick slots, and ability buttons',
      navigation: 'Minimap in corner, quest log button',
      resourceDisplay: 'Gold counter, inventory button',
      characterUI: 'Selected character highlighted, equipment slots visible on hover',
      special: 'Dialogue box area, combat log panel, pause indicator',
    },
    promptSnippet: 'classic CRPG interface with character portraits on left, action bar at bottom, party health bars, inventory slots, spell quickbar, isometric game UI overlay',
    exampleGames: ['Baldur\'s Gate', 'Divinity Original Sin', 'Pillars of Eternity', 'Pathfinder'],
  },

  fps: {
    genre: 'fps',
    label: 'First-Person Shooter',
    description: 'Call of Duty, Far Cry, Doom style HUD',
    elements: {
      layout: 'Minimal HUD, corners used, center kept clear except crosshair',
      statusBars: 'Health bar bottom left, armor/shield indicator',
      actionUI: 'Weapon info bottom right (ammo count, reserve), weapon icon',
      navigation: 'Minimap top corner with objective markers, compass at top center',
      resourceDisplay: 'Ammo counter, grenade count, equipment indicators',
      characterUI: 'Weapon viewmodel visible (hands holding gun)',
      special: 'Crosshair/reticle center screen, hit markers, damage direction indicators',
    },
    promptSnippet: 'FPS game HUD with crosshair center screen, ammo counter bottom right, health bar bottom left, minimap corner, weapon hands visible in first-person view',
    exampleGames: ['Call of Duty', 'Far Cry', 'Doom', 'Battlefield', 'Halo'],
  },

  mmo: {
    genre: 'mmo',
    label: 'MMO RPG',
    description: 'World of Warcraft, Final Fantasy XIV style interface',
    elements: {
      layout: 'Multiple UI panels, customizable hotbars, dense information',
      statusBars: 'Player frame top-left (portrait, health, mana, buffs), target frame nearby',
      actionUI: 'Multiple action bars at bottom (1-2 rows of abilities), cooldown indicators',
      navigation: 'Large minimap corner, zone name, coordinates',
      resourceDisplay: 'Currency display, bag slots indicator, experience bar',
      characterUI: 'Character level, class icon, guild tag',
      special: 'Chat box bottom-left, party/raid frames on side, quest tracker right side, buff/debuff icons',
    },
    promptSnippet: 'MMO game interface with multiple hotbars at bottom, player and target frames, minimap, chat window, quest tracker, party frames, buff icons, dense UI layout',
    exampleGames: ['World of Warcraft', 'Final Fantasy XIV', 'Guild Wars 2', 'Elder Scrolls Online'],
  },

  actionRpg: {
    genre: 'actionRpg',
    label: 'Action RPG (ARPG)',
    description: 'Diablo, Path of Exile, Lost Ark style interface',
    elements: {
      layout: 'Health/mana orbs corners, skill bar bottom center',
      statusBars: 'Health globe/orb left, mana/energy globe right, both stylized',
      actionUI: 'Skill bar bottom center with 6-8 ability slots, potion slots',
      navigation: 'Overlay minimap top corner',
      resourceDisplay: 'Gold/currency, inventory space indicator',
      characterUI: 'Experience bar at bottom, level indicator',
      special: 'Loot labels on ground, damage numbers floating, buff bar',
    },
    promptSnippet: 'ARPG interface with health and mana orbs in corners, skill bar bottom center, floating damage numbers, loot labels, isometric action RPG HUD style',
    exampleGames: ['Diablo', 'Path of Exile', 'Lost Ark', 'Grim Dawn', 'Torchlight'],
  },

  fighting: {
    genre: 'fighting',
    label: 'Fighting Game',
    description: 'Street Fighter, Tekken, Mortal Kombat style interface',
    elements: {
      layout: 'Top-heavy UI, minimal bottom clutter',
      statusBars: 'Large health bars at top (P1 left, P2 right), super/special meter below health',
      actionUI: 'Super meter/combo gauge filling up',
      navigation: 'None typically',
      resourceDisplay: 'Round indicators (dots or numbers), timer center top',
      characterUI: 'Character portraits at ends of health bars, character names',
      special: 'Combo counter on hit, "K.O." or "PERFECT" text ready to appear, round number',
    },
    promptSnippet: 'fighting game HUD with large health bars at top, super meter, round timer center, character portraits, combo counter, versus screen layout',
    exampleGames: ['Street Fighter', 'Tekken', 'Mortal Kombat', 'Guilty Gear'],
  },

  rts: {
    genre: 'rts',
    label: 'Real-Time Strategy',
    description: 'StarCraft, Age of Empires, Command & Conquer style interface',
    elements: {
      layout: 'Command panel bottom, minimap corner, resources top',
      statusBars: 'Selected unit health bars above units',
      actionUI: 'Command card/panel bottom right with unit abilities, build options',
      navigation: 'Minimap bottom-left corner showing entire map, fog of war',
      resourceDisplay: 'Resource counters top (minerals/gold, gas/wood, supply/population)',
      characterUI: 'Unit portrait when selected, unit stats panel',
      special: 'Selection box, multiple unit selection display, control groups',
    },
    promptSnippet: 'RTS game interface with resource counters at top, minimap bottom-left, command panel bottom-right, unit selection wireframe, strategic overhead view HUD',
    exampleGames: ['StarCraft', 'Age of Empires', 'Command & Conquer', 'Warcraft'],
  },

  survival: {
    genre: 'survival',
    label: 'Survival Game',
    description: 'Rust, Ark, The Forest, DayZ style interface',
    elements: {
      layout: 'Corner indicators, inventory-focused, minimal persistent HUD',
      statusBars: 'Health, hunger, thirst, stamina bars (often bottom or corner)',
      actionUI: 'Hotbar for tools/weapons, crafting shortcut',
      navigation: 'Compass top center, no minimap typically',
      resourceDisplay: 'Inventory weight/capacity, temperature indicator',
      characterUI: 'Status effect icons, condition warnings',
      special: 'Crafting menu overlay, building preview ghost, interaction prompts ("Press E")',
    },
    promptSnippet: 'survival game HUD with health/hunger/thirst bars, hotbar at bottom, compass, temperature indicator, interaction prompts, crafting-ready interface',
    exampleGames: ['Rust', 'Ark', 'The Forest', 'DayZ', 'Valheim', 'Subnautica'],
  },

  racing: {
    genre: 'racing',
    label: 'Racing Game',
    description: 'Forza, Need for Speed, Gran Turismo style interface',
    elements: {
      layout: 'Bottom corners for speed, top for position, minimap track',
      statusBars: 'Nitro/boost meter',
      actionUI: 'Gear indicator, RPM tachometer',
      navigation: 'Track minimap showing position, racing line',
      resourceDisplay: 'Lap counter, best lap time, current time, position (1st, 2nd...)',
      characterUI: 'Car damage indicator (optional)',
      special: 'Speedometer (digital or analog), rear-view mirror, split times, checkpoints',
    },
    promptSnippet: 'racing game HUD with speedometer, tachometer, position indicator, lap counter, track minimap, nitro boost meter, racing cockpit or chase view',
    exampleGames: ['Forza', 'Need for Speed', 'Gran Turismo', 'Mario Kart'],
  },

  platformer: {
    genre: 'platformer',
    label: 'Platformer / Metroidvania',
    description: 'Mario, Hollow Knight, Celeste style interface',
    elements: {
      layout: 'Minimal, corners only, gameplay unobstructed',
      statusBars: 'Health (hearts, mask icons, or simple bar) top-left',
      actionUI: 'Special ability/soul meter',
      navigation: 'Area name on room transition',
      resourceDisplay: 'Coin/gem counter, collectible counter',
      characterUI: 'Lives remaining',
      special: 'Boss health bar (when fighting), item collection popup',
    },
    promptSnippet: 'platformer game HUD with health hearts or masks top-left, coin counter, minimal clean interface, 2D side-view gameplay UI',
    exampleGames: ['Hollow Knight', 'Celeste', 'Super Mario', 'Ori', 'Metroid'],
  },

  moba: {
    genre: 'moba',
    label: 'MOBA',
    description: 'League of Legends, Dota 2 style interface',
    elements: {
      layout: 'Dense bottom panel, team info sides, minimap critical',
      statusBars: 'Health/mana bars above all characters, player bar larger at bottom',
      actionUI: 'Ability icons bottom center (QWER or 4-6 abilities), item slots',
      navigation: 'Large minimap bottom-right corner, crucial for gameplay',
      resourceDisplay: 'Gold counter, CS (creep score), KDA display',
      characterUI: 'Champion portrait, level, summoner spells',
      special: 'Team scoreboard top, ability cooldowns, shop button, surrender vote',
    },
    promptSnippet: 'MOBA game interface with ability bar bottom center, large minimap, team portraits on sides, kill score top, gold counter, top-down isometric view HUD',
    exampleGames: ['League of Legends', 'Dota 2', 'Smite', 'Heroes of the Storm'],
  },

  simulation: {
    genre: 'simulation',
    label: 'Simulation / Builder',
    description: 'Cities Skylines, Sims, Planet Coaster style interface',
    elements: {
      layout: 'Toolbar bottom or side, info panels on demand',
      statusBars: 'City/park happiness meters, budget indicator',
      actionUI: 'Build menu, tool palette, zoning options',
      navigation: 'Free camera controls hint, zoom level',
      resourceDisplay: 'Money/budget prominently displayed, population, time/speed controls',
      characterUI: 'Selected building/person info panel',
      special: 'Overlay toggles (traffic, power, water), timeline slider, notification icons',
    },
    promptSnippet: 'simulation game interface with build toolbar, budget display, population counter, time controls, info overlays, management game HUD style',
    exampleGames: ['Cities Skylines', 'The Sims', 'Planet Coaster', 'Two Point Hospital'],
  },

  custom: {
    genre: 'custom',
    label: 'Custom UI Description',
    description: 'Describe your own game UI style',
    elements: {
      layout: 'User-defined',
    },
    promptSnippet: '',
    exampleGames: [],
  },
};

/**
 * Get UI preset by genre
 */
export function getUIPreset(genre: GameUIGenre): GameUIPreset {
  return GAME_UI_PRESETS[genre] || GAME_UI_PRESETS.none;
}

/**
 * Generate prompt snippet for UI
 * Returns empty string if no UI (concept art mode)
 */
export function generateUIPromptSnippet(genre: GameUIGenre, customDescription?: string): string {
  if (genre === 'none') {
    return GAME_UI_PRESETS.none.promptSnippet;
  }
  if (genre === 'custom' && customDescription) {
    return `game UI showing ${customDescription}`;
  }
  return GAME_UI_PRESETS[genre]?.promptSnippet || '';
}

/**
 * Get all UI preset options for dropdown/selection
 */
export function getUIPresetOptions(): Array<{ value: GameUIGenre; label: string; description: string }> {
  return Object.values(GAME_UI_PRESETS).map((preset) => ({
    value: preset.genre,
    label: preset.label,
    description: preset.description,
  }));
}
