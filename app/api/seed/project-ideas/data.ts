/**
 * Project Ideas Data
 * Curated mashup ideas for seeding the database.
 */

export interface ProjectIdea {
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

export const PROJECT_IDEAS: ProjectIdea[] = [
  {
    id: 'witcher-japan',
    title: 'Witcher × Japanese Mythology',
    category: 'Universe Swap',
    basePrompt: 'The Witcher dark fantasy reimagined in feudal Japan - Geralt as a wandering ronin monster hunter facing yokai instead of drowners',
    dimensions: [
      { type: 'environment', label: 'Universe / World', reference: 'Edo-period Japan - bamboo forests, torii gates, misty mountains' },
      { type: 'characters', label: 'Characters', reference: 'Samurai Geralt with katana and wakizashi, geisha sorceresses' },
      { type: 'creatures', label: 'Creatures / Beings', reference: 'Kappa, oni, tengu, yurei replacing drowners and leshens' },
      { type: 'technology', label: 'Tech / Props', reference: 'Ofuda talismans, shuriken bombs, enchanted katanas' },
    ],
  },
  {
    id: 'mass-effect-70s',
    title: 'Mass Effect as 1970s Sci-Fi Film',
    category: 'Era/Style Transfer',
    basePrompt: 'Mass Effect reimagined with retro-futuristic aesthetics of 1970s science fiction cinema',
    dimensions: [
      { type: 'artStyle', label: 'Visual Style', reference: 'Practical effects aesthetic, CRT monitors, analog technology' },
      { type: 'technology', label: 'Tech / Props', reference: 'Analog switches, tape reels, bulky communicators' },
      { type: 'environment', label: 'Universe / World', reference: 'Industrial Nostromo-style ship interiors, orange jumpsuits' },
      { type: 'camera', label: 'Camera / POV', reference: 'Grainy 35mm film quality, vintage color grading' },
    ],
  },
  {
    id: 'animal-crossing-horror',
    title: 'Animal Crossing × Survival Horror',
    category: 'Tone Shift',
    basePrompt: 'The villagers have turned sinister. Same cute isometric view, but something deeply wrong',
    dimensions: [
      { type: 'mood', label: 'Atmosphere', reference: 'Dread, isolation, uncanny valley cuteness' },
      { type: 'characters', label: 'Characters', reference: 'Same villagers with unsettling expressions, hollow eyes' },
      { type: 'environment', label: 'Universe / World', reference: 'Overgrown island, foggy paths, abandoned houses' },
      { type: 'action', label: 'Scene Action', reference: 'Fleeing from friendly neighbors who insist you stay' },
    ],
  },
  {
    id: 'rdr-westworld',
    title: 'Red Dead Redemption × Westworld',
    category: 'Universe Mashup',
    basePrompt: 'What if the Old West was a theme park? Red Dead meets android hosts',
    dimensions: [
      { type: 'technology', label: 'Tech / Props', reference: 'Hidden control rooms beneath saloons, host repair facilities' },
      { type: 'characters', label: 'Characters', reference: 'Cowboys who glitch mid-conversation, hosts achieving consciousness' },
      { type: 'environment', label: 'Universe / World', reference: 'Western vistas with subtle modern elements at the edges' },
      { type: 'action', label: 'Scene Action', reference: 'A host achieving consciousness during a bank heist' },
    ],
  },
  {
    id: 'hollow-knight-baroque',
    title: 'Hollow Knight as Baroque Oil Painting',
    category: 'Medium Change',
    basePrompt: 'The insect kingdom rendered in dramatic Caravaggio and Rembrandt style',
    dimensions: [
      { type: 'artStyle', label: 'Visual Style', reference: '17th century Dutch/Italian oil painting, dramatic chiaroscuro' },
      { type: 'characters', label: 'Characters', reference: 'The Knight as detailed painted figure with realistic insect anatomy' },
      { type: 'environment', label: 'Universe / World', reference: 'Baroque architectural grandeur, cathedral-like caverns' },
      { type: 'mood', label: 'Atmosphere', reference: 'Solemn, sacred, museum-quality gravitas' },
    ],
  },
  {
    id: 'civ-apocalypse',
    title: 'Civilization VI × Post-Apocalypse',
    category: 'Era Swap',
    basePrompt: 'Familiar hex-grid strategy in a world rebuilding after collapse',
    dimensions: [
      { type: 'environment', label: 'Universe / World', reference: 'Reclaimed ruins, overgrown highways, nature reclaiming cities' },
      { type: 'technology', label: 'Tech / Props', reference: 'Scavenged tech progression, solar farms on old parking lots' },
      { type: 'characters', label: 'Characters', reference: 'Leaders are faction survivors - warlords, scientists, builders' },
      { type: 'era', label: 'Era / Time', reference: 'Near-future rebuilding, 2150 AD aesthetic' },
    ],
  },
  {
    id: 'death-stranding-ghibli',
    title: 'Death Stranding × Studio Ghibli',
    category: 'Style Transfer',
    basePrompt: 'Lonely delivery gameplay with Miyazaki gentle, hopeful visual language',
    dimensions: [
      { type: 'artStyle', label: 'Visual Style', reference: 'Hand-painted Ghibli backgrounds, soft watercolor skies' },
      { type: 'creatures', label: 'Creatures / Beings', reference: 'BTs as spirits like in Spirited Away - strange but curious' },
      { type: 'mood', label: 'Atmosphere', reference: 'Melancholy but hopeful, wonder alongside isolation' },
      { type: 'environment', label: 'Universe / World', reference: 'Lush post-apocalyptic greenery, magical realism' },
    ],
  },
  {
    id: 'fifa-anime',
    title: 'FIFA Street × Anime Tournament Arc',
    category: 'Style/Genre Transfer',
    basePrompt: 'Street football with intensity of sports anime like Haikyuu or Blue Lock',
    dimensions: [
      { type: 'artStyle', label: 'Visual Style', reference: 'Anime dynamic angles, speed lines, dramatic close-ups' },
      { type: 'characters', label: 'Characters', reference: 'Players with distinctive anime designs, signature moves' },
      { type: 'action', label: 'Scene Action', reference: 'Skill moves get inner monologue, time stops for kicks' },
      { type: 'camera', label: 'Camera / POV', reference: 'Manga panel compositions, dramatic freeze frames' },
    ],
  },
  {
    id: 'stardew-bladerunner',
    title: 'Stardew Valley × Blade Runner',
    category: 'Universe Swap',
    basePrompt: 'Cozy farming in rain-soaked neon dystopia. Grow synthetic crops, romance androids',
    dimensions: [
      { type: 'environment', label: 'Universe / World', reference: 'Rooftop hydroponic farm in mega-city, neon-lit greenhouse' },
      { type: 'technology', label: 'Tech / Props', reference: 'Watering drones, holographic scarecrows, protein vats' },
      { type: 'characters', label: 'Characters', reference: 'Corporate refugees, off-world colonist romance options' },
      { type: 'mood', label: 'Atmosphere', reference: 'Cozy cyberpunk - finding peace in harsh neon future' },
    ],
  },
  {
    id: 'hades-artdeco',
    title: 'Hades × Art Deco Jazz Age',
    category: 'Era/Style Transfer',
    basePrompt: 'Greek underworld reimagined as 1920s speakeasy realm of sin and style',
    dimensions: [
      { type: 'artStyle', label: 'Visual Style', reference: 'Art Deco geometry, Mucha-style portraits, gold and black' },
      { type: 'environment', label: 'Universe / World', reference: 'Gatsby-era underworld nightclub, jazz club Tartarus' },
      { type: 'characters', label: 'Characters', reference: 'Olympians as jazz age celebrities, Aphrodite as flapper' },
      { type: 'technology', label: 'Tech / Props', reference: 'Boons as cocktails, Art Deco weapons, gramophone music' },
    ],
  },
];
