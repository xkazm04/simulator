/**
 * Seed API - Inject project ideas into database
 *
 * POST /api/seed/project-ideas - Create sample projects from curated ideas
 * GET /api/seed/project-ideas - List available project ideas
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface ProjectIdea {
  id: string;
  title: string;
  category: string;
  basePrompt: string;
  dimensions: Array<{
    type: string;
    label: string;
    reference: string;
  }>;
}

/**
 * Curated project ideas from PROJECT_IDEAS.md
 */
const PROJECT_IDEAS: ProjectIdea[] = [
  {
    id: 'witcher-japan',
    title: 'Witcher × Japanese Mythology',
    category: 'Universe Swap',
    basePrompt: 'The Witcher dark fantasy reimagined in feudal Japan - Geralt as a wandering ronin monster hunter facing yokai instead of drowners, Signs as ninja-style Shinto magic hand seals',
    dimensions: [
      { type: 'environment', label: 'Universe / World', reference: 'Edo-period Japan - bamboo forests, torii gates, misty mountains, traditional villages' },
      { type: 'characters', label: 'Characters', reference: 'Samurai Geralt with katana and wakizashi, geisha sorceresses, ronin companions' },
      { type: 'creatures', label: 'Creatures / Beings', reference: 'Kappa, oni, tengu, yurei replacing drowners, griffins, leshens - Japanese yokai mythology' },
      { type: 'technology', label: 'Tech / Props', reference: 'Ofuda talismans instead of potions, shuriken bombs, enchanted katanas' },
    ],
  },
  {
    id: 'mass-effect-70s',
    title: 'Mass Effect as 1970s Sci-Fi Film',
    category: 'Era/Style Transfer',
    basePrompt: 'Mass Effect reimagined with retro-futuristic aesthetics of 1970s science fiction cinema like Alien, Space: 1999, and 2001: A Space Odyssey',
    dimensions: [
      { type: 'artStyle', label: 'Visual Style', reference: 'Practical effects aesthetic, CRT monitors, chunky space suits, analog technology' },
      { type: 'technology', label: 'Tech / Props', reference: 'Analog switches, tape reels, bulky communicators, physical buttons and dials' },
      { type: 'environment', label: 'Universe / World', reference: 'Industrial Nostromo-style ship interiors, orange jumpsuits, retro space stations' },
      { type: 'camera', label: 'Camera / POV', reference: 'Grainy 35mm film quality, vintage color grading, cinematic wide shots' },
    ],
  },
  {
    id: 'animal-crossing-horror',
    title: 'Animal Crossing × Survival Horror',
    category: 'Tone Shift',
    basePrompt: 'The villagers have turned sinister. Tom Nook\'s debt system becomes genuinely threatening. The same cute isometric view, but at night, with something deeply wrong in the village',
    dimensions: [
      { type: 'mood', label: 'Atmosphere', reference: 'Dread, isolation, uncanny valley cuteness, something watching from the trees' },
      { type: 'characters', label: 'Characters', reference: 'Same villagers but with unsettling expressions, hollow eyes, too-wide smiles' },
      { type: 'environment', label: 'Universe / World', reference: 'Overgrown island, foggy paths, flickering lights, abandoned houses' },
      { type: 'action', label: 'Scene Action', reference: 'Fleeing from "friendly" neighbors who insist you stay forever' },
    ],
  },
  {
    id: 'rdr-westworld',
    title: 'Red Dead Redemption × Westworld',
    category: 'Universe Mashup',
    basePrompt: 'What if the Old West was a theme park? Red Dead\'s authentic frontier blended with Westworld\'s android hosts and corporate intrigue',
    dimensions: [
      { type: 'technology', label: 'Tech / Props', reference: 'Hidden control rooms beneath saloons, host repair facilities, futuristic tech disguised as period items' },
      { type: 'characters', label: 'Characters', reference: 'Cowboys who glitch mid-conversation, guests in period costume, hosts achieving consciousness' },
      { type: 'environment', label: 'Universe / World', reference: 'Same Western vistas with subtle modern elements visible at the edges' },
      { type: 'action', label: 'Scene Action', reference: 'A host achieving consciousness during a bank heist, reality breaking through' },
    ],
  },
  {
    id: 'hollow-knight-baroque',
    title: 'Hollow Knight as Baroque Oil Painting',
    category: 'Medium Change',
    basePrompt: 'The intricate insect kingdom rendered in the dramatic style of Caravaggio and Rembrandt - deep shadows, golden highlights, theatrical lighting',
    dimensions: [
      { type: 'artStyle', label: 'Visual Style', reference: '17th century Dutch/Italian oil painting techniques, dramatic chiaroscuro, rich textures' },
      { type: 'characters', label: 'Characters', reference: 'The Knight as a detailed painted figure with realistic insect anatomy, museum portrait quality' },
      { type: 'environment', label: 'Universe / World', reference: 'Baroque architectural grandeur, cathedral-like caverns, ornate decorative elements' },
      { type: 'mood', label: 'Atmosphere', reference: 'Solemn, sacred, museum-quality gravitas, religious painting atmosphere' },
    ],
  },
  {
    id: 'civ-apocalypse',
    title: 'Civilization VI × Post-Apocalypse',
    category: 'Era Swap',
    basePrompt: 'The familiar hex-grid strategy but in a world rebuilding after collapse. Same city-building mechanics, new context of survival and recovery',
    dimensions: [
      { type: 'environment', label: 'Universe / World', reference: 'Reclaimed ruins, overgrown highways as roads, crater lakes, nature reclaiming cities' },
      { type: 'technology', label: 'Tech / Props', reference: 'Scavenged tech progression, solar farms on old parking lots, repurposed machinery' },
      { type: 'characters', label: 'Characters', reference: 'Leaders are faction survivors, not historical figures - warlords, scientists, community builders' },
      { type: 'era', label: 'Era / Time', reference: 'Near-future rebuilding, 2150 AD aesthetic, hope emerging from destruction' },
    ],
  },
  {
    id: 'death-stranding-ghibli',
    title: 'Death Stranding × Studio Ghibli',
    category: 'Style Transfer',
    basePrompt: 'The lonely delivery gameplay transformed into Miyazaki\'s gentle, hopeful visual language. Keep the isolation but add warmth and wonder',
    dimensions: [
      { type: 'artStyle', label: 'Visual Style', reference: 'Hand-painted Ghibli backgrounds, soft watercolor skies, gentle color palette' },
      { type: 'creatures', label: 'Creatures / Beings', reference: 'BTs as spirits like in Spirited Away - strange but not purely hostile, curious entities' },
      { type: 'mood', label: 'Atmosphere', reference: 'Melancholy but hopeful, wonder alongside isolation, beauty in desolation' },
      { type: 'environment', label: 'Universe / World', reference: 'Lush post-apocalyptic greenery, nature reclaiming ruins beautifully, magical realism' },
    ],
  },
  {
    id: 'fifa-anime',
    title: 'FIFA Street × Anime Tournament Arc',
    category: 'Style/Genre Transfer',
    basePrompt: 'Street football with the intensity and visual language of sports anime like Haikyuu or Blue Lock - dramatic moments, inner monologues, special moves',
    dimensions: [
      { type: 'artStyle', label: 'Visual Style', reference: 'Anime dynamic angles, speed lines, dramatic close-ups, emotional intensity' },
      { type: 'characters', label: 'Characters', reference: 'Players with distinctive anime designs, intense eyes, signature moves with names' },
      { type: 'action', label: 'Scene Action', reference: 'Skill moves get inner monologue narration, time stops for dramatic kicks' },
      { type: 'camera', label: 'Camera / POV', reference: 'Manga panel compositions during key moments, dramatic freeze frames' },
    ],
  },
  {
    id: 'stardew-bladerunner',
    title: 'Stardew Valley × Blade Runner',
    category: 'Universe Swap',
    basePrompt: 'The same cozy farming gameplay loop but in a rain-soaked neon dystopia. Grow synthetic crops, befriend replicants, romance androids',
    dimensions: [
      { type: 'environment', label: 'Universe / World', reference: 'Rooftop hydroponic farm in mega-city, neon-lit greenhouse, rain-slicked platforms' },
      { type: 'technology', label: 'Tech / Props', reference: 'Automated watering drones, holographic scarecrows, synthetic seeds, protein vats' },
      { type: 'characters', label: 'Characters', reference: 'Corporate refugees, off-world colonist romance options, android farmhands' },
      { type: 'mood', label: 'Atmosphere', reference: 'Cozy cyberpunk - finding peace and community in a harsh neon future' },
    ],
  },
  {
    id: 'hades-artdeco',
    title: 'Hades × Art Deco Jazz Age',
    category: 'Era/Style Transfer',
    basePrompt: 'The Greek underworld reimagined as a 1920s speakeasy realm. Zagreus escapes from his father\'s underground empire of sin and style',
    dimensions: [
      { type: 'artStyle', label: 'Visual Style', reference: 'Art Deco geometry, Mucha-style character portraits, gold and black elegance' },
      { type: 'environment', label: 'Universe / World', reference: 'Gatsby-era underworld nightclub chambers, jazz club Tartarus, speakeasy Elysium' },
      { type: 'characters', label: 'Characters', reference: 'Olympians as jazz age celebrities, Aphrodite as flapper goddess, Dionysus as club owner' },
      { type: 'technology', label: 'Tech / Props', reference: 'Boons as cocktails, weapons as Art Deco sculptures, gramophone music' },
    ],
  },
];

/**
 * GET - List available project ideas
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    count: PROJECT_IDEAS.length,
    ideas: PROJECT_IDEAS.map(idea => ({
      id: idea.id,
      title: idea.title,
      category: idea.category,
      dimensionCount: idea.dimensions.length,
    })),
  });
}

/**
 * POST - Seed project ideas into database
 *
 * Body options:
 * - { all: true } - Create all project ideas
 * - { ids: ['witcher-japan', 'mass-effect-70s'] } - Create specific ideas
 * - { id: 'witcher-japan' } - Create single idea
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();

    let ideasToCreate: ProjectIdea[] = [];

    if (body.all) {
      ideasToCreate = PROJECT_IDEAS;
    } else if (body.ids && Array.isArray(body.ids)) {
      ideasToCreate = PROJECT_IDEAS.filter(idea => body.ids.includes(idea.id));
    } else if (body.id) {
      const idea = PROJECT_IDEAS.find(i => i.id === body.id);
      if (idea) ideasToCreate = [idea];
    }

    if (ideasToCreate.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid project ideas specified. Use { all: true } or { ids: [...] } or { id: "..." }' },
        { status: 400 }
      );
    }

    const createdProjects: Array<{ id: string; name: string; ideaId: string }> = [];

    for (const idea of ideasToCreate) {
      const projectId = uuidv4();
      const now = new Date().toISOString();

      // Create project
      db.prepare(`
        INSERT INTO projects (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(projectId, idea.title, now, now);

      // Create state with base prompt and dimensions
      const dimensionsWithIds = idea.dimensions.map((dim, index) => ({
        id: `dim-${index}`,
        ...dim,
        weight: 100,
      }));

      db.prepare(`
        INSERT INTO project_state (project_id, base_prompt, output_mode, dimensions_json, feedback_json, updated_at)
        VALUES (?, ?, 'gameplay', ?, '{"positive":"","negative":""}', ?)
      `).run(projectId, idea.basePrompt, JSON.stringify(dimensionsWithIds), now);

      createdProjects.push({
        id: projectId,
        name: idea.title,
        ideaId: idea.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdProjects.length} project(s)`,
      projects: createdProjects,
    });
  } catch (error) {
    console.error('Seed projects error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed projects' },
      { status: 500 }
    );
  }
}
