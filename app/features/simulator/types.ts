// ============================================================================
// SIMULATOR STATE MACHINE
// ============================================================================
//
// The simulator follows a state machine pattern where AI operations are valid
// only in certain states. This ensures consistent workflow and prevents
// calling actions with inconsistent state.
//
// STATE DIAGRAM:
//
//   ┌─────────────┐
//   │    EMPTY    │ ← Initial state, no project data
//   └──────┬──────┘
//          │ SmartBreakdown() OR DescribeImage()
//          ▼
//   ┌─────────────────┐
//   │ HAS_DIMENSIONS  │ ← Has base image + dimensions, ready to refine or generate
//   └────────┬────────┘
//          ╱ │ ╲
//         ╱  │  ╲ ← ElementToDimension(), LabelToDimension(), FeedbackToDimension()
//        ╲   │  ╱   (all loop back to HAS_DIMENSIONS)
//         ╲  │ ╱
//          ╲ │╱
//           ▼│ GenerateWithFeedback()
//   ┌─────────────────┐
//   │   HAS_PROMPTS   │ ← Has generated prompts, ready to iterate or refine
//   └────────┬────────┘
//            │ ╲
//            │  ╲ ← RefineFeedback() (loops back to HAS_PROMPTS)
//            │  ╱
//            │ ╱
//            ▼
//   (Can return to HAS_DIMENSIONS by clearing prompts and editing dimensions)
//
// VALID TRANSITIONS:
// - EMPTY → HAS_DIMENSIONS: via SmartBreakdown or DescribeImage
// - HAS_DIMENSIONS → HAS_DIMENSIONS: via dimension refinement operations
// - HAS_DIMENSIONS → HAS_PROMPTS: via GenerateWithFeedback
// - HAS_PROMPTS → HAS_PROMPTS: via RefineFeedback iteration
// - HAS_PROMPTS → HAS_DIMENSIONS: via clearing prompts (implicit)
//
// ============================================================================

/**
 * SimulatorState - The current state of the simulator workflow
 */
export type SimulatorState = 'empty' | 'has_dimensions' | 'has_prompts';

/**
 * SimulatorAction - All possible AI-driven actions in the simulator
 */
export type SimulatorAction =
  | 'smart_breakdown'        // Parse vision sentence → dimensions
  | 'describe_image'         // Analyze image → base description + dimensions
  | 'element_to_dimension'   // Convert locked elements → new dimensions
  | 'label_to_dimension'     // Refine dimensions based on accepted element
  | 'feedback_to_dimension'  // Apply preserve/change feedback → dimension updates
  | 'generate_with_feedback' // Generate prompts from dimensions + feedback
  | 'refine_feedback';       // Iterate on prompts with change feedback

/**
 * StateTransition - Defines valid state transitions for each action
 */
export interface StateTransition {
  action: SimulatorAction;
  fromStates: SimulatorState[];
  toState: SimulatorState;
  description: string;
}

/**
 * SIMULATOR_TRANSITIONS - The complete state machine definition
 * Documents all valid transitions and their effects
 */
export const SIMULATOR_TRANSITIONS: StateTransition[] = [
  {
    action: 'smart_breakdown',
    fromStates: ['empty', 'has_dimensions'], // Can re-parse from any non-prompt state
    toState: 'has_dimensions',
    description: 'Parse a vision sentence into structured dimensions',
  },
  {
    action: 'describe_image',
    fromStates: ['empty', 'has_dimensions'],
    toState: 'has_dimensions',
    description: 'Analyze an uploaded image to extract base description and suggest dimensions',
  },
  {
    action: 'element_to_dimension',
    fromStates: ['has_dimensions', 'has_prompts'],
    toState: 'has_dimensions',
    description: 'Convert locked prompt elements into reusable dimensions',
  },
  {
    action: 'label_to_dimension',
    fromStates: ['has_dimensions', 'has_prompts'],
    toState: 'has_dimensions',
    description: 'Gently refine dimensions based on an accepted element label',
  },
  {
    action: 'feedback_to_dimension',
    fromStates: ['has_dimensions'],
    toState: 'has_dimensions',
    description: 'Apply preserve/change feedback to update dimensions',
  },
  {
    action: 'generate_with_feedback',
    fromStates: ['has_dimensions'],
    toState: 'has_prompts',
    description: 'Generate prompts from current dimensions and feedback',
  },
  {
    action: 'refine_feedback',
    fromStates: ['has_prompts'],
    toState: 'has_prompts',
    description: 'Iterate on generated prompts with refinement feedback',
  },
];

/**
 * Check if an action is valid from the current state
 */
export function isValidTransition(currentState: SimulatorState, action: SimulatorAction): boolean {
  const transition = SIMULATOR_TRANSITIONS.find((t) => t.action === action);
  return transition ? transition.fromStates.includes(currentState) : false;
}

/**
 * Get the resulting state after an action (if valid)
 */
export function getNextState(currentState: SimulatorState, action: SimulatorAction): SimulatorState | null {
  if (!isValidTransition(currentState, action)) {
    return null;
  }
  const transition = SIMULATOR_TRANSITIONS.find((t) => t.action === action);
  return transition ? transition.toState : null;
}

/**
 * Get all valid actions from the current state
 */
export function getValidActions(currentState: SimulatorState): SimulatorAction[] {
  return SIMULATOR_TRANSITIONS
    .filter((t) => t.fromStates.includes(currentState))
    .map((t) => t.action);
}

/**
 * Determine the current state based on simulator data
 */
export function deriveSimulatorState(
  hasDimensions: boolean,
  hasPrompts: boolean
): SimulatorState {
  if (hasPrompts) return 'has_prompts';
  if (hasDimensions) return 'has_dimensions';
  return 'empty';
}

// ============================================================================
// SMART BREAKDOWN TYPES
// ============================================================================

/**
 * SmartBreakdownResult - AI response from parsing a vision sentence
 * Contains the structured breakdown of user's creative intent
 */
export interface SmartBreakdownResult {
  success: boolean;
  baseImage: {
    description: string;
    format: string;
    keyElements: string[];
  };
  dimensions: Array<{
    type: DimensionType;
    reference: string;
    confidence: number;
  }>;
  suggestedOutputMode: OutputMode;
  reasoning: string;
}

/**
 * SmartBreakdownPersisted - Subset of SmartBreakdownResult for database storage
 * Excludes fields that are already persisted separately (dimensions, outputMode)
 * and transient fields (success boolean)
 */
export interface SmartBreakdownPersisted {
  baseImage: {
    format: string;
    keyElements: string[];
  };
  reasoning: string;
}

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
   * Optional reference image for visual style matching
   * Stored as data URL (base64 encoded)
   */
  referenceImage?: string;

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

export type OutputMode = 'gameplay' | 'sketch' | 'trailer' | 'poster' | 'realistic';

export const OUTPUT_MODES: Record<OutputMode, { label: string; description: string }> = {
  gameplay: {
    label: 'Gameplay',
    description: 'Authentic game screenshot with HUD/UI elements',
  },
  sketch: {
    label: 'Sketch',
    description: 'Artistic hand-drawn concept sketch, rough linework',
  },
  trailer: {
    label: 'Trailer',
    description: 'Cinematic scene optimized for video/animation',
  },
  poster: {
    label: 'Poster',
    description: 'Key art / game cover poster composition',
  },
  realistic: {
    label: 'Realistic',
    description: 'Next-gen photorealistic game graphics (UE5 quality)',
  },
};

export type DesignVariant = 'immersive' | 'onion';

export interface SimulationFeedback {
  positive: string;
  negative: string;
}

// Panel image saved to side panel slot
export interface SavedPanelImage {
  id: string;
  url: string;
  videoUrl?: string;  // Generated video URL from Seedance
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
  handleDimensionReferenceImageChange?: (id: string, imageDataUrl: string | null) => void;
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
  handleSmartBreakdownApply: (
    visionSentence: string,
    baseImage: string,
    dimensions: Dimension[],
    outputMode: OutputMode,
    breakdown: { baseImage: { format: string; keyElements: string[] }; reasoning: string }
  ) => void;
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
  // Comparison props
  onOpenComparison?: () => void;
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

// ============================================
// Enhanced Feedback Learning Types (Phase 1-4)
// ============================================

/**
 * GenerationSession - Tracks a complete generation session for learning
 */
export interface GenerationSession {
  id: string;
  /** When the session started */
  startedAt: string;
  /** When user indicated satisfaction (rated positively or moved on) */
  satisfiedAt?: string;
  /** Number of generation iterations before satisfaction */
  iterationCount: number;
  /** Time from first generation to satisfaction (ms) */
  timeToSatisfaction?: number;
  /** Dimensions used in this session */
  dimensionsSnapshot: Array<{
    type: DimensionType;
    reference: string;
    weight: number;
    filterMode: DimensionFilterMode;
    transformMode: DimensionTransformMode;
  }>;
  /** Base image description */
  baseImageSnapshot: string;
  /** Output mode used */
  outputMode: OutputMode;
  /** Did the session end with a positive outcome? */
  successful: boolean;
  /** All prompt IDs generated in this session */
  promptIds: string[];
  /** Final feedback state */
  finalFeedback?: {
    positive: string;
    negative: string;
  };
}

/**
 * DimensionCombinationPattern - Learned pattern about dimension combinations
 */
export interface DimensionCombinationPattern {
  id: string;
  /** The combination of dimension types */
  dimensionTypes: DimensionType[];
  /** Example reference values that worked well */
  successfulReferences: string[];
  /** Success rate for this combination */
  successRate: number;
  /** Number of times this combination was used */
  usageCount: number;
  /** Average weight settings that worked */
  avgSuccessfulWeights: Record<DimensionType, number>;
  /** Last updated */
  updatedAt: string;
}

/**
 * StylePreference - Detailed artistic style preference
 */
export interface StylePreference {
  id: string;
  /** Style category (e.g., 'rendering', 'lighting', 'composition') */
  category: 'rendering' | 'lighting' | 'composition' | 'color' | 'texture' | 'detail';
  /** The preferred value (e.g., 'cinematic lighting', 'hand-painted') */
  value: string;
  /** Strength of preference (0-100) */
  strength: number;
  /** Number of positive associations */
  positiveAssociations: number;
  /** Number of negative associations */
  negativeAssociations: number;
  /** Source dimension types that led to this preference */
  sourceDimensions: DimensionType[];
  /** Last updated */
  updatedAt: string;
}

/**
 * SmartSuggestion - AI-powered suggestion for user
 */
export interface SmartSuggestion {
  id: string;
  /** Type of suggestion */
  type: 'dimension' | 'weight' | 'element_lock' | 'output_mode';
  /** What is being suggested */
  suggestion: string;
  /** Why this is being suggested */
  reason: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Data to apply if accepted */
  data: {
    dimensionType?: DimensionType;
    dimensionReference?: string;
    weight?: number;
    elementId?: string;
    outputMode?: OutputMode;
  };
  /** Was this suggestion shown to user? */
  shown: boolean;
  /** Was this suggestion accepted? */
  accepted?: boolean;
  /** When was this generated */
  createdAt: string;
}

/**
 * EnhancedLearnedContext - Extended context for adaptive generation
 */
export interface EnhancedLearnedContext extends LearnedContext {
  /** Recommended weights for dimensions */
  recommendedWeights: Record<DimensionType, number>;
  /** Elements that should be auto-locked */
  autoLockElements: string[];
  /** Confidence in these recommendations */
  confidence: number;
  /** Whether sufficient data exists for personalization */
  hasEnoughData: boolean;
  /** Dimension combinations that work well together */
  successfulCombinations: DimensionCombinationPattern[];
  /** Style preferences learned from history */
  stylePreferences: StylePreference[];
}

/**
 * FeedbackLearningConfig - Configuration for the learning system
 */
export interface FeedbackLearningConfig {
  /** Minimum feedback items before learning kicks in */
  minFeedbackForLearning: number;
  /** How quickly preferences decay (0-1, lower = slower decay) */
  preferenceDecayRate: number;
  /** Minimum confidence to show suggestions */
  minSuggestionConfidence: number;
  /** Maximum suggestions to show at once */
  maxSuggestionsToShow: number;
  /** Whether to track time-to-satisfaction */
  trackTimeMetrics: boolean;
}

// ============================================
// Autoplay Types
// ============================================

/**
 * AutoplayStatus - Current state of the autoplay state machine
 */
export type AutoplayStatus =
  | 'idle'           // Not running
  | 'generating'     // Waiting for image generation
  | 'evaluating'     // Sending image to Gemini for evaluation
  | 'polishing'      // Polishing near-approval images via Gemini
  | 'refining'       // Applying feedback, preparing next iteration
  | 'complete'       // Target met or max iterations reached
  | 'error'          // Error state
  | 'error';         // Failed state

/**
 * AutoplayConfig - Configuration for an autoplay session
 */
export interface AutoplayConfig {
  /** Target number of approved images to save (1-4) */
  targetSavedCount: number;
  /** Maximum iterations before stopping (hard cap: 3) */
  maxIterations: number;
}

/**
 * AutoplayIteration - Tracks a single iteration's results
 */
export interface AutoplayIteration {
  iterationNumber: number;
  /** Prompt IDs generated in this iteration */
  promptIds: string[];
  /** Evaluation results per prompt */
  evaluations: Array<{
    promptId: string;
    approved: boolean;
    feedback?: string;
    score?: number;
    improvements?: string[];
    strengths?: string[];
  }>;
  /** Count of images saved this iteration */
  savedCount: number;
  /** Timestamp when iteration started */
  startedAt: string;
  /** Timestamp when iteration completed */
  completedAt?: string;
  /** Polish candidates identified during evaluation (score 50-69) */
  polishCandidates?: Array<{
    promptId: string;
    imageUrl: string;
    originalScore: number;
    polishPrompt: string;
  }>;
  /** Results of polish operations */
  polishResults?: Array<{
    promptId: string;
    improved: boolean;
    newScore?: number;
    polishedUrl?: string;
  }>;
}

/**
 * AutoplayState - Complete state for autoplay state machine
 */
export interface AutoplayState {
  status: AutoplayStatus;
  config: AutoplayConfig;
  /** Current iteration number (1-indexed) */
  currentIteration: number;
  /** History of all iterations */
  iterations: AutoplayIteration[];
  /** Total images saved across all iterations */
  totalSaved: number;
  /** Error message if status is 'error' */
  error?: string;
  /** Whether abort was requested */
  abortRequested: boolean;
}

/**
 * AutoplayAction - Actions for autoplay reducer
 */
export type AutoplayAction =
  | { type: 'START'; config: AutoplayConfig }
  | { type: 'GENERATION_COMPLETE'; promptIds: string[] }
  | { type: 'EVALUATION_COMPLETE'; evaluations: AutoplayIteration['evaluations']; polishCandidates?: AutoplayIteration['polishCandidates'] }
  | { type: 'POLISH_COMPLETE'; results: NonNullable<AutoplayIteration['polishResults']> }
  | { type: 'IMAGES_SAVED'; count: number }
  | { type: 'REFINE_COMPLETE' }
  | { type: 'ITERATION_COMPLETE' }
  | { type: 'COMPLETE'; reason: 'target_met' | 'max_iterations' | 'aborted' }
  | { type: 'ERROR'; error: string }
  | { type: 'ABORT' }
  | { type: 'RESET' };

/**
 * ImageEvaluation - Result from Gemini evaluation of a generated image
 */
export interface ImageEvaluation {
  promptId: string;
  /** Whether the image meets quality/goal standards */
  approved: boolean;
  /** Score from 0-100 indicating quality */
  score: number;
  /** Feedback for refinement if not approved */
  feedback?: string;
  /** Specific aspects that need improvement */
  improvements?: string[];
  /** What worked well (for preserving in next iteration) */
  strengths?: string[];
  /** Granular score: technical quality (artifacts, blur, deformations) */
  technicalScore?: number;
  /** Granular score: how well image matches prompt/vision */
  goalFitScore?: number;
  /** Granular score: composition, lighting, color harmony */
  aestheticScore?: number;
  /** Whether image correctly includes/excludes UI based on mode */
  modeCompliance?: boolean;
}

// ============================================
// Gemini Polish Types
// ============================================

/**
 * PolishConfig - Configuration for Gemini polish optimization
 */
export interface PolishConfig {
  /** Enable rescue polish for near-approval images (50-69 range) */
  rescueEnabled: boolean;
  /** Minimum score to attempt rescue polish (below = reject outright) */
  rescueFloor: number;
  /** Enable excellence polish for approved images (70-89 range) */
  excellenceEnabled: boolean;
  /** Minimum score for excellence polish (must be >= approval threshold) */
  excellenceFloor: number;
  /** Maximum score for excellence polish (above = already excellent) */
  excellenceCeiling: number;
  /** Intensity of excellence polish: 'subtle' preserves more, 'creative' transforms more */
  excellenceIntensity: 'subtle' | 'creative';
  /** Maximum polish attempts per image (prevents infinite loops) */
  maxPolishAttempts: number;
  /** Timeout for polish operation in milliseconds */
  polishTimeoutMs: number;
  /** Minimum score improvement required to use polished result */
  minScoreImprovement: number;
}

/**
 * Default polish configuration
 */
export const DEFAULT_POLISH_CONFIG: PolishConfig = {
  rescueEnabled: true,
  rescueFloor: 50,
  excellenceEnabled: true,
  excellenceFloor: 70,
  excellenceCeiling: 90,
  excellenceIntensity: 'creative',
  maxPolishAttempts: 1,
  polishTimeoutMs: 30000,
  minScoreImprovement: 5,
};

/**
 * PolishDecision - Result of polish decision logic
 */
export interface PolishDecision {
  /** Action to take: save, polish, or reject */
  action: 'save' | 'polish' | 'reject';
  /** Human-readable reason for the decision */
  reason: string;
  /** Polish prompt (only if action === 'polish') */
  polishPrompt?: string;
  /** Type of polish: rescue (50-69) or excellence (70-89) */
  polishType?: 'rescue' | 'excellence';
}

/**
 * PolishResult - Result from a polish operation
 */
export interface PolishResult {
  /** Whether polish was successful */
  success: boolean;
  /** Polished image URL (base64 data URL) */
  polishedUrl?: string;
  /** Re-evaluation of polished image */
  reEvaluation?: ImageEvaluation;
  /** Whether polish improved the score */
  improved: boolean;
  /** Score change (positive = improvement) */
  scoreDelta?: number;
  /** Error message if polish failed */
  error?: string;
}

// ============================================
// Multi-Phase Autoplay Types
// ============================================

/**
 * ExtendedAutoplayConfig - Configuration for multi-phase autoplay
 */
export interface ExtendedAutoplayConfig {
  /** Number of sketch images to generate (1-4) */
  sketchCount: number;
  /** Number of gameplay images to generate (1-4) */
  gameplayCount: number;
  /** Whether to generate poster variations and auto-select best */
  posterEnabled: boolean;
  /** Whether to auto-generate HUD overlays for gameplay images */
  hudEnabled: boolean;
  /** Maximum iterations per image before moving to next (1-3) */
  maxIterationsPerImage: number;
  /** Optional starting prompt idea */
  promptIdea?: string;
  /** Optional Gemini polish configuration (uses defaults if not specified) */
  polish?: Partial<PolishConfig>;
}

/**
 * AutoplayPhase - Current phase of multi-phase autoplay
 */
export type AutoplayPhase =
  | 'idle'
  | 'sketch'
  | 'gameplay'
  | 'poster'
  | 'hud'
  | 'complete'
  | 'error';

/**
 * PhaseProgress - Progress tracking for a single phase
 */
export interface PhaseProgress {
  /** Number of images saved in this phase */
  saved: number;
  /** Target number of images for this phase */
  target: number;
}

/**
 * MultiPhaseAutoplayState - Complete state for multi-phase autoplay
 */
export interface MultiPhaseAutoplayState {
  /** Current phase of the multi-phase flow */
  phase: AutoplayPhase;
  /** Configuration for this autoplay session */
  config: ExtendedAutoplayConfig;
  /** Progress for sketch phase */
  sketchProgress: PhaseProgress;
  /** Progress for gameplay phase */
  gameplayProgress: PhaseProgress;
  /** Whether poster has been auto-selected */
  posterSelected: boolean;
  /** Number of HUD overlays generated */
  hudGenerated: number;
  /** Error message if phase is 'error' */
  error?: string;
}

/**
 * MultiPhaseAutoplayAction - Actions for multi-phase autoplay reducer
 */
export type MultiPhaseAutoplayAction =
  | { type: 'START'; config: ExtendedAutoplayConfig }
  | { type: 'PHASE_COMPLETE'; phase: AutoplayPhase }
  | { type: 'IMAGE_SAVED'; phase: 'sketch' | 'gameplay' }
  | { type: 'POSTER_SELECTED' }
  | { type: 'HUD_GENERATED' }
  | { type: 'ADVANCE_PHASE' }
  | { type: 'ERROR'; error: string }
  | { type: 'ABORT' }
  | { type: 'RESET' };

/**
 * PosterSelectionCriteria - Criteria for LLM poster selection
 */
export interface PosterSelectionCriteria {
  /** Project name for context */
  projectName: string;
  /** Vision/concept of the project */
  projectVision: string;
  /** Key themes/dimensions to consider */
  themes: string[];
}

/**
 * PosterSelectionResult - Result from LLM poster selection
 */
export interface PosterSelectionResult {
  /** Index of the selected poster (0-3) */
  selectedIndex: number;
  /** Reasoning for the selection */
  reasoning: string;
  /** Confidence score (0-100) */
  confidence: number;
}

/**
 * HudGenerationResult - Result from HUD overlay generation
 */
export interface HudGenerationResult {
  /** Original image URL */
  originalUrl: string;
  /** URL of image with HUD overlay */
  hudUrl?: string;
  /** Whether generation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// ============================================
// Autoplay Event Logging Types
// ============================================

/**
 * AutoplayEventType - Types of events that can occur during autoplay
 */
export type AutoplayEventType =
  | 'phase_started'
  | 'phase_completed'
  | 'prompt_generated'
  | 'dimension_adjusted'
  | 'image_generating'
  | 'image_complete'
  | 'image_failed'
  | 'image_approved'
  | 'image_rejected'
  | 'image_saved'
  | 'feedback_applied'
  | 'iteration_complete'
  | 'poster_generating'
  | 'poster_selected'
  | 'hud_generating'
  | 'hud_complete'
  | 'polish_started'
  | 'image_polished'
  | 'polish_no_improvement'
  | 'polish_error'
  | 'polish_skipped'
  | 'error'
  | 'timeout';

/**
 * AutoplayLogEntry - A single event in the autoplay activity log
 */
export interface AutoplayLogEntry {
  id: string;
  timestamp: Date;
  type: AutoplayEventType;
  /** Category determines which sidebar the event appears in */
  category: 'text' | 'image';
  message: string;
  details?: {
    phase?: AutoplayPhase;
    promptId?: string;
    imageUrl?: string;
    score?: number;
    approved?: boolean;
    feedback?: string;
    dimension?: {
      type: string;
      oldValue: string;
      newValue: string;
    };
  };
}
