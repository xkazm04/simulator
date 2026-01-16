
export type DimensionType =
  | 'environment'
  | 'characters'
  | 'artStyle'
  | 'mood'
  | 'action'
  | 'technology'
  | 'camera'
  | 'creatures'
  | 'gameUI'
  | 'era'
  | 'genre'
  | 'custom';

/**
 * Transformation type for example simulations
 * - universe_swap: Same visual format, different fictional universe
 * - medium_change: Same content, different rendering medium (anime → CGI)
 */
export type TransformationType = 'universe_swap' | 'medium_change';

/**
 * Game UI genre for preset selection
 */
export type GameUIGenre =
  | 'none'
  | 'crpg'
  | 'fps'
  | 'mmo'
  | 'actionRpg'
  | 'fighting'
  | 'rts'
  | 'survival'
  | 'racing'
  | 'platformer'
  | 'moba'
  | 'simulation'
  | 'custom';

/**
 * DimensionFilterMode - Defines what content to PRESERVE from the base image
 * The filter selects what aspects should remain unchanged
 */
export type DimensionFilterMode =
  | 'preserve_structure'    // Keep spatial layout, composition, camera angle
  | 'preserve_subject'      // Keep main subjects/characters but allow style changes
  | 'preserve_mood'         // Keep emotional tone but allow visual changes
  | 'preserve_color_palette' // Keep color relationships but swap content
  | 'none';                 // No preservation - full transformation

/**
 * DimensionTransformMode - Defines HOW to transform the content
 * The transform defines the nature of the swap operation
 */
export type DimensionTransformMode =
  | 'replace'        // Complete replacement with reference content
  | 'blend'          // Blend original and reference (uses weight for ratio)
  | 'style_transfer' // Apply reference style to original content
  | 'semantic_swap'  // Swap semantic meaning while preserving structure
  | 'additive';      // Add reference elements without removing original

/**
 * Dimension - A LENS for viewing and transforming the base image
 *
 * Conceptually, a Dimension is not just a label but a transformation lens:
 * 1. FILTER: What to preserve from the base image
 * 2. TRANSFORM: How to apply the reference content
 * 3. WEIGHT: How strongly to apply (0-100, enables graduated transformations)
 *
 * This enables composable transformations like "50% Star Wars, 50% Ghibli"
 */
export interface Dimension {
  id: string;
  type: DimensionType;
  label: string;
  icon: any; // Lucide icon
  placeholder: string;
  reference: string;

  /**
   * Filter mode - what to preserve from the base image for this dimension
   * Default: 'preserve_structure'
   */
  filterMode: DimensionFilterMode;

  /**
   * Transform mode - how to apply the reference content
   * Default: 'replace'
   */
  transformMode: DimensionTransformMode;

  /**
   * Weight/intensity (0-100) - how strongly to apply this dimension
   * 0 = no effect (preserve original), 100 = full transformation
   * Enables graduated blending like "50% Star Wars style"
   * Default: 100
   */
  weight: number;
}

/**
 * Helper to create a Dimension with default lens settings
 */
export function createDimensionWithDefaults(
  base: Omit<Dimension, 'filterMode' | 'transformMode' | 'weight'>
): Dimension {
  return {
    ...base,
    filterMode: 'preserve_structure',
    transformMode: 'replace',
    weight: 100,
  };
}

export interface DimensionPreset {
  type: DimensionType;
  label: string;
  icon: any;
  placeholder: string;
}

export interface PromptElement {
  id: string;
  text: string;
  category: string;
  locked: boolean;
}

/**
 * Unified Concept Type - The Mathematical Dual of Dimension and PromptElement
 *
 * A Concept represents a creative idea that can exist in two forms:
 * - As INPUT (Dimension): A constraint that guides generation
 * - As OUTPUT (PromptElement): A generated element from a prompt
 *
 * The duality: Dimension generates from constraints → PromptElement
 *              PromptElement constrains to create new → Dimension
 *
 * This enables bidirectional creative flow where any generated element
 * can become an input constraint for future generations.
 */
export type ConceptRole = 'input' | 'output';

export interface Concept {
  id: string;
  /** The semantic content - the "what" of the concept */
  value: string;
  /** Category/type classification */
  category: string;
  /** Whether this concept is locked/preserved across generations */
  locked: boolean;
  /** The role determines how this concept is used */
  role: ConceptRole;
  /** Original source - tracks lineage for undo/history */
  source?: {
    type: 'dimension' | 'element' | 'user' | 'ai';
    originalId?: string;
  };
}

/**
 * Convert a PromptElement (output) to a Concept
 */
export function elementToConcept(element: PromptElement): Concept {
  return {
    id: element.id,
    value: element.text,
    category: element.category,
    locked: element.locked,
    role: 'output',
    source: { type: 'element', originalId: element.id },
  };
}

/**
 * Convert a Dimension (input) to a Concept
 */
export function dimensionToConcept(dimension: Dimension): Concept {
  return {
    id: dimension.id,
    value: dimension.reference,
    category: dimension.type,
    locked: false, // Dimensions don't have locked state
    role: 'input',
    source: { type: 'dimension', originalId: dimension.id },
  };
}

/**
 * Convert a Concept to a PromptElement (for output display)
 */
export function conceptToElement(concept: Concept): PromptElement {
  return {
    id: concept.id,
    text: concept.value,
    category: concept.category,
    locked: concept.locked,
  };
}

/**
 * Convert a Concept to a partial Dimension update
 * Returns the reference value to be applied to a dimension of matching type
 */
export function conceptToDimensionUpdate(concept: Concept): { type: string; reference: string } {
  return {
    type: concept.category,
    reference: concept.value,
  };
}

/**
 * Map element category to dimension type for bidirectional flow
 * Some categories map directly, others need semantic mapping
 */
export function categoryToDimensionType(category: string): DimensionType | null {
  const mapping: Record<string, DimensionType> = {
    // Direct mappings
    'environment': 'environment',
    'characters': 'characters',
    'mood': 'mood',
    'style': 'artStyle',
    'setting': 'environment',
    // Semantic mappings
    'composition': 'camera',
    'lighting': 'mood',
    'subject': 'characters',
    'quality': 'artStyle',
  };
  return mapping[category.toLowerCase()] || null;
}

/**
 * Check if a concept can be applied to a specific dimension
 */
export function canApplyConceptToDimension(concept: Concept, dimension: Dimension): boolean {
  const targetType = categoryToDimensionType(concept.category);
  return targetType === dimension.type || dimension.type === 'custom';
}

export interface GeneratedPrompt {
  id: string;
  sceneNumber: number;
  sceneType: string;
  prompt: string;
  /** Negative prompt for elements to avoid in generation */
  negativePrompt?: string;
  copied: boolean;
  rating: 'up' | 'down' | null;
  locked: boolean;
  elements: PromptElement[];
}

// String union type for element categories
export type ElementCategoryType =
  | 'composition'
  | 'lighting'
  | 'style'
  | 'mood'
  | 'subject'
  | 'setting'
  | 'quality';

// Interface for category configuration (renamed to avoid conflict)
export interface ElementCategoryConfig {
  id: string;
  label: string;
  color: string;
}

export const SCENE_TYPES = [
  'Cinematic Wide Shot',
  'Hero Portrait',
  'Action Sequence',
  'Environmental Storytelling',
  'Dramatic Close-Up',
  'Group Composition',
  'Atmospheric Moment',
  'Key Art Poster',
];

export type OutputMode = 'gameplay' | 'concept' | 'poster';

export const OUTPUT_MODES: Record<OutputMode, { label: string; description: string }> = {
  gameplay: {
    label: 'gameplay',
    description: 'Output includes game UI/HUD elements for authenticity',
  },
  concept: {
    label: 'concept',
    description: 'Clean concept art without any UI overlays',
  },
  poster: {
    label: 'poster',
    description: 'Generate key art / game cover poster',
  },
};

export type DesignVariant = 'immersive' | 'onion';

export interface SimulationFeedback {
  positive: string;
  negative: string;
}

// ============================================
// Negative Prompt Types
// ============================================

/**
 * NegativePromptItem - A single negative prompt entry
 */
export interface NegativePromptItem {
  id: string;
  /** The negative prompt text */
  text: string;
  /** Whether this negative applies globally or per-prompt */
  scope: 'global' | 'prompt';
  /** Reference to specific prompt ID if scope is 'prompt' */
  promptId?: string;
  /** Whether this was auto-suggested based on dimensions */
  isAutoSuggested?: boolean;
}

/**
 * NegativePromptSuggestion - Auto-suggested negative based on dimension choices
 */
export interface NegativePromptSuggestion {
  text: string;
  reason: string;
  dimensionType: DimensionType;
}

/**
 * Common negative prompts organized by category
 * Used for auto-suggestions and quick-add functionality
 */
export const COMMON_NEGATIVES: Record<string, string[]> = {
  quality: [
    'blurry',
    'low quality',
    'pixelated',
    'jpeg artifacts',
    'noise',
    'grainy',
    'oversaturated',
    'overexposed',
    'underexposed',
  ],
  anatomy: [
    'deformed',
    'disfigured',
    'bad anatomy',
    'extra limbs',
    'missing limbs',
    'mutated hands',
    'extra fingers',
    'fused fingers',
  ],
  composition: [
    'cropped',
    'out of frame',
    'poorly framed',
    'bad composition',
    'cluttered',
    'watermark',
    'signature',
    'text',
    'logo',
  ],
  style: [
    'ugly',
    'amateur',
    'poorly drawn',
    'bad proportions',
    'cartoon',
    'anime',
    'unrealistic',
  ],
  ui: [
    'no game UI',
    'no HUD',
    'no interface elements',
    'no health bars',
    'no menus',
  ],
};

/**
 * Dimension-based negative suggestions
 * Maps dimension types to relevant negative prompts to auto-suggest
 */
export const DIMENSION_NEGATIVE_SUGGESTIONS: Partial<Record<DimensionType, NegativePromptSuggestion[]>> = {
  artStyle: [
    { text: 'photorealistic', reason: 'When using artistic styles', dimensionType: 'artStyle' },
    { text: '3D render', reason: 'When using 2D art styles', dimensionType: 'artStyle' },
  ],
  characters: [
    { text: 'bad anatomy', reason: 'Character-focused scenes', dimensionType: 'characters' },
    { text: 'deformed face', reason: 'Character-focused scenes', dimensionType: 'characters' },
    { text: 'extra limbs', reason: 'Character-focused scenes', dimensionType: 'characters' },
  ],
  environment: [
    { text: 'indoor', reason: 'When outdoor environment specified', dimensionType: 'environment' },
    { text: 'outdoor', reason: 'When indoor environment specified', dimensionType: 'environment' },
  ],
  gameUI: [
    { text: 'clean image', reason: 'When game UI is desired', dimensionType: 'gameUI' },
  ],
  mood: [
    { text: 'happy', reason: 'When dark mood specified', dimensionType: 'mood' },
    { text: 'dark', reason: 'When bright mood specified', dimensionType: 'mood' },
  ],
};

// Panel image saved to side panel slot
export interface SavedPanelImage {
  id: string;
  url: string;
  prompt: string;
  promptId?: string;  // Reference to the original generated prompt
  side: 'left' | 'right';
  slotIndex: number;
  createdAt: string;
}

// Generated image from Leonardo API
export interface GeneratedImage {
  id: string;
  promptId: string;  // Links to GeneratedPrompt
  url: string | null;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  error?: string;
  generationId?: string;  // Leonardo generation ID for polling
}

// Panel slot state
export interface PanelSlot {
  index: number;
  image: SavedPanelImage | null;
}

// Project poster for key art
export interface ProjectPoster {
  id: string;
  projectId: string;
  imageUrl: string;
  prompt: string;
  dimensionsJson: string;
  createdAt: string;
}

// ============================================
// Interactive Prototype Types
// ============================================

/**
 * InteractiveMode - The type of interactive experience to generate
 * - webgl: Playable WebGL demo for gameplay scenes
 * - clickable: Clickable Figma-like prototype for UI concepts
 * - trailer: 15-second animated trailer for movie posters
 * - static: Traditional static image (default)
 */
export type InteractiveMode = 'static' | 'webgl' | 'clickable' | 'trailer';

export const INTERACTIVE_MODES: Record<InteractiveMode, { label: string; description: string; icon: string }> = {
  static: {
    label: 'Static Image',
    description: 'Traditional static image output',
    icon: 'Image',
  },
  webgl: {
    label: 'WebGL Demo',
    description: 'Playable interactive 3D demo',
    icon: 'Gamepad2',
  },
  clickable: {
    label: 'Clickable Prototype',
    description: 'Interactive UI mockup with click regions',
    icon: 'MousePointer2',
  },
  trailer: {
    label: 'Animated Trailer',
    description: '15-second motion preview',
    icon: 'Film',
  },
};

/**
 * InteractiveRegion - A clickable/interactive region in a prototype
 */
export interface InteractiveRegion {
  id: string;
  /** Normalized coordinates (0-1) for position */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Type of interaction */
  type: 'button' | 'link' | 'hover' | 'drag';
  /** Action to perform on interaction */
  action: {
    type: 'navigate' | 'toggle' | 'animate' | 'callback';
    target?: string;
    params?: Record<string, unknown>;
  };
  /** Visual feedback on interaction */
  feedback?: {
    hover?: string; // CSS class or animation name
    active?: string;
  };
  /** Tooltip/label */
  label?: string;
}

/**
 * WebGLSceneConfig - Configuration for WebGL demo generation
 */
export interface WebGLSceneConfig {
  /** Camera settings */
  camera: {
    type: 'perspective' | 'orthographic';
    position: [number, number, number];
    target: [number, number, number];
    fov?: number;
  };
  /** Lighting setup */
  lighting: {
    ambient: number;
    directional?: {
      intensity: number;
      position: [number, number, number];
      color?: string;
    };
  };
  /** Controls configuration */
  controls: {
    type: 'orbit' | 'fly' | 'pointer-lock' | 'none';
    enabled: boolean;
    autoRotate?: boolean;
    dampingFactor?: number;
  };
  /** Environment/skybox */
  environment?: {
    type: 'color' | 'gradient' | 'hdri';
    value: string | [string, string];
  };
  /** Post-processing effects */
  effects?: Array<'bloom' | 'vignette' | 'chromatic-aberration' | 'film-grain'>;
}

/**
 * TrailerConfig - Configuration for animated trailer generation
 */
export interface TrailerConfig {
  /** Duration in seconds (default 15) */
  duration: number;
  /** Frames per second */
  fps: number;
  /** Camera motion path */
  cameraPath: Array<{
    time: number; // 0-1 normalized time
    position: [number, number, number];
    target: [number, number, number];
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  }>;
  /** Visual effects timeline */
  effects: Array<{
    type: 'fade' | 'zoom' | 'pan' | 'parallax' | 'title-card';
    startTime: number;
    endTime: number;
    params?: Record<string, unknown>;
  }>;
  /** Audio configuration */
  audio?: {
    type: 'generated' | 'ambient' | 'none';
    mood?: string;
  };
}

/**
 * InteractivePrototype - The main interactive prototype entity
 */
export interface InteractivePrototype {
  id: string;
  /** Reference to the source generated prompt */
  promptId: string;
  /** Reference to the source generated image */
  imageId?: string;
  /** The mode of interactivity */
  mode: InteractiveMode;
  /** Status of generation */
  status: 'pending' | 'generating' | 'ready' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Mode-specific configuration */
  config: WebGLSceneConfig | TrailerConfig | { regions: InteractiveRegion[] } | null;
  /** Generated assets */
  assets?: {
    /** Primary preview/thumbnail */
    thumbnail?: string;
    /** WebGL scene data (for webgl mode) */
    sceneData?: string;
    /** Video URL (for trailer mode) */
    videoUrl?: string;
    /** Interactive regions (for clickable mode) */
    regions?: InteractiveRegion[];
  };
}

/**
 * InteractiveGenerationRequest - Request to generate interactive prototype
 */
export interface InteractiveGenerationRequest {
  promptId: string;
  imageUrl?: string;
  prompt: string;
  mode: InteractiveMode;
  sceneType: string;
  dimensions: Array<{ type: DimensionType; reference: string }>;
}

/**
 * InteractiveGenerationResponse - Response from interactive generation
 */
export interface InteractiveGenerationResponse {
  success: boolean;
  prototype?: InteractivePrototype;
  error?: string;
}

// Unified generation API types
export interface DimensionAdjustment {
  type: DimensionType;
  originalValue: string;
  newValue: string;
  wasModified: boolean;
  changeReason: string;
}

export interface GenerateWithFeedbackRequest {
  baseImage: string;
  dimensions: Array<{ type: DimensionType; label: string; reference: string }>;
  feedback: SimulationFeedback;
  outputMode: OutputMode;
  lockedElements: PromptElement[];
}

export interface GenerateWithFeedbackResponse {
  success: boolean;
  adjustedDimensions: DimensionAdjustment[];
  prompts: Array<{
    id: string;
    sceneNumber: number;
    sceneType: string;
    prompt: string;
    elements: PromptElement[];
  }>;
  reasoning: string;
  error?: string;
}

// ============================================
// Comparison View Types
// ============================================

/**
 * ComparisonItem - A single item in a side-by-side comparison
 */
export interface ComparisonItem {
  prompt: GeneratedPrompt;
  image?: GeneratedImage;
  index: number;
}

/**
 * ElementDiff - Result of comparing elements between two prompts
 */
export interface ElementDiff {
  /** Elements only in the first prompt */
  onlyInFirst: PromptElement[];
  /** Elements only in the second prompt */
  onlyInSecond: PromptElement[];
  /** Elements common to both prompts */
  common: PromptElement[];
}

/**
 * ComparisonViewOptions - Options for controlling comparison display
 */
export interface ComparisonViewOptions {
  showDimensions: boolean;
  showElements: boolean;
  showImages: boolean;
  highlightDifferences: boolean;
}

/**
 * ComparisonModalProps - Props for the comparison modal
 */
export interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** All generated prompts available for comparison */
  allPrompts: GeneratedPrompt[];
  /** All generated images for finding matching images */
  allImages: GeneratedImage[];
  /** Initially selected prompt IDs for comparison */
  initialSelectedIds?: string[];
  /** Dimensions used in generation (for context) */
  dimensions: Dimension[];
}

// ============================================
// Feedback Learning Types
// ============================================

/**
 * PromptFeedback - Detailed feedback for a single prompt
 */
export interface PromptFeedback {
  id: string;
  promptId: string;
  /** Thumbs up/down rating */
  rating: 'up' | 'down' | null;
  /** Optional text feedback explaining the rating */
  textFeedback?: string;
  /** Which elements the user liked (if any) */
  likedElements?: string[];
  /** Which elements the user disliked (if any) */
  dislikedElements?: string[];
  /** Timestamp of feedback */
  createdAt: string;
  /** Session ID for grouping */
  sessionId?: string;
}

/**
 * PromptPattern - A learned pattern from successful prompts
 */
export interface PromptPattern {
  id: string;
  /** The pattern type */
  type: 'element_combination' | 'dimension_value' | 'style_preference' | 'scene_type';
  /** The pattern value or combination */
  value: string;
  /** How often this pattern appears in positively-rated prompts */
  successCount: number;
  /** How often this pattern appears in negatively-rated prompts */
  failureCount: number;
  /** Confidence score (0-1) based on sample size */
  confidence: number;
  /** Associated dimension types */
  dimensionTypes?: DimensionType[];
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * UserPreference - A learned user preference
 */
export interface UserPreference {
  id: string;
  /** Category of preference */
  category: 'style' | 'mood' | 'composition' | 'subject' | 'setting' | 'quality' | 'avoid';
  /** The preference value */
  value: string;
  /** Strength of preference (0-100) */
  strength: number;
  /** Number of times this preference was reinforced */
  reinforcements: number;
  /** Source of the preference (explicit or inferred) */
  source: 'explicit' | 'inferred';
  /** Timestamp when learned */
  createdAt: string;
  /** Last reinforced timestamp */
  updatedAt: string;
}

/**
 * PreferenceProfile - Complete user preference profile
 */
export interface PreferenceProfile {
  /** Unique profile ID */
  id: string;
  /** User or session identifier */
  userId?: string;
  /** List of learned preferences */
  preferences: UserPreference[];
  /** Successful patterns */
  patterns: PromptPattern[];
  /** Total feedback count */
  totalFeedbackCount: number;
  /** Positive rating count */
  positiveCount: number;
  /** Negative rating count */
  negativeCount: number;
  /** Profile creation date */
  createdAt: string;
  /** Last update date */
  updatedAt: string;
}

/**
 * RefinementSuggestion - AI-powered suggestion for prompt improvement
 */
export interface RefinementSuggestion {
  id: string;
  /** Type of suggestion */
  type: 'add' | 'remove' | 'modify' | 'emphasize' | 'deemphasize';
  /** Target element or dimension */
  target: string;
  /** The suggested change */
  suggestion: string;
  /** Reason for the suggestion */
  reason: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Source: pattern-based or AI-inferred */
  source: 'pattern' | 'ai' | 'feedback_history';
}

/**
 * PromptExplanation - Explanation of why specific prompt choices were made
 */
export interface PromptExplanation {
  promptId: string;
  /** Overall explanation */
  summary: string;
  /** Per-element explanations */
  elementExplanations: Array<{
    elementId: string;
    text: string;
    reason: string;
    /** Was this influenced by user preferences? */
    influencedByPreference: boolean;
    /** Which pattern(s) influenced this? */
    relatedPatterns?: string[];
  }>;
  /** Which preferences influenced this prompt */
  appliedPreferences: Array<{
    preferenceId: string;
    value: string;
    impact: 'high' | 'medium' | 'low';
  }>;
}

/**
 * FeedbackSession - A collection of feedback from a single generation session
 */
export interface FeedbackSession {
  id: string;
  /** Timestamp when session started */
  startedAt: string;
  /** All feedback collected in this session */
  feedbackItems: PromptFeedback[];
  /** Dimensions used in this session */
  dimensionsSnapshot: Array<{ type: DimensionType; reference: string }>;
  /** Base image description used */
  baseImageSnapshot: string;
  /** Output mode used */
  outputModeSnapshot: OutputMode;
}

/**
 * ABVariant - A/B test variant for prompts
 */
export interface ABVariant {
  id: string;
  /** Variant name (A, B, etc.) */
  variantName: string;
  /** The prompt text */
  prompt: string;
  /** Elements in this variant */
  elements: PromptElement[];
  /** Number of positive ratings */
  positiveRatings: number;
  /** Number of negative ratings */
  negativeRatings: number;
  /** Number of times shown */
  impressions: number;
  /** Conversion rate (positive / impressions) */
  conversionRate: number;
}

/**
 * FeedbackAnalytics - Analytics data for feedback dashboard
 */
export interface FeedbackAnalytics {
  /** Total prompts generated */
  totalPromptsGenerated: number;
  /** Total feedback collected */
  totalFeedbackCollected: number;
  /** Overall positive rate */
  positiveRate: number;
  /** Top performing patterns */
  topPatterns: PromptPattern[];
  /** Most common preferences */
  topPreferences: UserPreference[];
  /** Elements to avoid based on negative feedback */
  elementsToAvoid: Array<{ text: string; count: number }>;
  /** Trend over time (last 7 days) */
  dailyTrend: Array<{
    date: string;
    positive: number;
    negative: number;
    total: number;
  }>;
  /** Breakdown by scene type */
  sceneTypePerformance: Array<{
    sceneType: string;
    positiveRate: number;
    totalCount: number;
  }>;
  /** Dimension effectiveness */
  dimensionEffectiveness: Array<{
    dimensionType: DimensionType;
    averageRating: number;
    sampleSize: number;
  }>;
}

/**
 * LearnedContext - Context injected into prompt generation based on learning
 */
export interface LearnedContext {
  /** Preferences to apply */
  preferences: UserPreference[];
  /** Patterns to follow */
  patterns: PromptPattern[];
  /** Elements to avoid */
  avoidElements: string[];
  /** Elements to emphasize */
  emphasizeElements: string[];
  /** Suggested dimension adjustments */
  dimensionAdjustments: Array<{
    type: DimensionType;
    adjustment: string;
    reason: string;
  }>;
}

export interface SimulatorLayoutProps {
  baseImage: string;
  setBaseImage: (val: string) => void;
  baseImageFile: string | null;
  setBaseImageFile: (val: string | null) => void;
  handleImageParse: (imageDataUrl: string) => void;
  isParsingImage: boolean;
  imageParseError: string | null;
  dimensions: Dimension[];
  handleDimensionChange: (id: string, reference: string) => void;
  handleDimensionWeightChange: (id: string, weight: number) => void;
  handleDimensionFilterModeChange: (id: string, filterMode: DimensionFilterMode) => void;
  handleDimensionTransformModeChange: (id: string, transformMode: DimensionTransformMode) => void;
  handleDimensionRemove: (id: string) => void;
  handleDimensionAdd: (preset: DimensionPreset) => void;
  handleDimensionReorder: (reorderedDimensions: Dimension[]) => void;
  generatedPrompts: GeneratedPrompt[];
  handlePromptRate: (id: string, rating: 'up' | 'down' | null) => void;
  handlePromptLock: (id: string) => void;
  handleElementLock: (promptId: string, elementId: string) => void;
  handleCopy: (id: string) => void;
  handleAcceptElement: (element: PromptElement) => void;
  acceptingElementId: string | null;
  // Concept-based bidirectional flow
  handleDropElementOnDimension?: (element: PromptElement, dimensionId: string) => void;
  feedback: { positive: string; negative: string };
  setFeedback: (val: { positive: string; negative: string }) => void;
  isGenerating: boolean;
  handleGenerate: () => void;
  canGenerate: boolean;
  outputMode: OutputMode;
  setOutputMode: (mode: OutputMode) => void;
  handleSmartBreakdownApply: (baseImage: string, dimensions: Dimension[], outputMode: OutputMode) => void;
  pendingDimensionChange: any;
  handleUndoDimensionChange: () => void;
  onConvertElementsToDimensions: (dimensions: Dimension[]) => void;
  onViewPrompt: (prompt: GeneratedPrompt) => void;
  // Side panel props
  leftPanelSlots: PanelSlot[];
  rightPanelSlots: PanelSlot[];
  onRemovePanelImage?: (imageId: string) => void;
  onViewPanelImage?: (image: SavedPanelImage) => void;
  // Image generation props
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  onStartImage?: (promptId: string) => void;  // Save generated image to panel
  savedPromptIds?: Set<string>;  // Track which prompts have been saved to panel
  // Poster props
  projectPoster?: ProjectPoster | null;
  showPosterOverlay?: boolean;
  onTogglePosterOverlay?: () => void;
  isGeneratingPoster?: boolean;
  // Delete generations
  onDeleteGenerations?: () => Promise<void>;
  // Interactive prototype props
  interactiveMode?: InteractiveMode;
  availableInteractiveModes?: InteractiveMode[];
  onInteractiveModeChange?: (mode: InteractiveMode) => void;
  interactivePrototypes?: Map<string, InteractivePrototype>;
  isGeneratingPrototype?: boolean;
  onGeneratePrototype?: (promptId: string) => void;
  onViewInteractivePrototype?: (promptId: string) => void;
  // Comparison props
  onOpenComparison?: () => void;
  // Negative prompt props
  negativePrompts?: NegativePromptItem[];
  onNegativePromptsChange?: (negatives: NegativePromptItem[]) => void;
  // Prompt history props
  promptHistory?: {
    canUndo: boolean;
    canRedo: boolean;
    historyLength: number;
    positionLabel: string;
  };
  onPromptUndo?: () => void;
  onPromptRedo?: () => void;
}
