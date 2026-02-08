/**
 * Types for Simulator AI API
 *
 * All dimension-transforming functions implement DimensionTransformation<TInput, TOutput>:
 * - smartBreakdown: text → dimensions
 * - elementToDimension: elements → dimensions
 * - labelToDimension: element + dimensions → refined dimensions
 * - feedbackToDimension: feedback + dimensions → adjusted dimensions
 * - generateWithFeedback: dimensions + context → prompts
 * - refineFeedback: prompt + feedback → refined prompt
 */

// ============================================================================
// DIMENSION TRANSFORMATION PATTERN
// ============================================================================

/**
 * DimensionTransformation - Contract for all functions that transform input into dimension updates
 *
 * Every transformer:
 * 1. Validates input (returns early error response if invalid)
 * 2. Calls Claude with system + user prompts
 * 3. Parses JSON response
 * 4. Returns structured output
 *
 * @example
 * ```typescript
 * const breakdown: DimensionTransformation<SmartBreakdownRequest, SmartBreakdownResponse> = {
 *   action: 'breakdown',
 *   validate: (input) => input.userInput?.trim().length >= 5,
 *   systemPrompt: BREAKDOWN_SYSTEM_PROMPT,
 *   createUserPrompt: (input) => createBreakdownPrompt(input.userInput),
 *   maxTokens: 2000,
 * };
 * ```
 */
export interface DimensionTransformation<TInput, TOutput> {
  /** Action identifier for routing */
  action: SimulatorAction;
  /** Validate input before processing - return error message or null if valid */
  validate: (input: TInput) => string | null;
  /** System prompt for Claude */
  systemPrompt: string;
  /** Create user prompt from input */
  createUserPrompt: (input: TInput) => string;
  /** Optional post-processing of parsed response */
  postProcess?: (parsed: unknown, input: TInput) => TOutput;
  /** Max tokens for Claude response (default: 2000) */
  maxTokens?: number;
  /** Feature name for metrics */
  featureName: string;
}

/**
 * Execute a dimension transformation
 * Unified execution path for all transformers
 */
export type TransformationExecutor = <TInput, TOutput>(
  transformation: DimensionTransformation<TInput, TOutput>,
  input: TInput
) => Promise<TOutput>;

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface SmartBreakdownRequest {
  userInput: string;
}

export interface ElementToDimensionRequest {
  elements: Array<{ text: string; category: string }>;
}

export interface LabelToDimensionRequest {
  acceptedElement: { text: string; category: string };
  currentDimensions: Array<{ type: string; reference: string }>;
}

export interface FeedbackToDimensionRequest {
  feedback: { positive: string; negative: string };
  currentDimensions: Array<{ type: string; reference: string }>;
}

export interface GenerateWithFeedbackRequest {
  baseImage: string;
  dimensions: Array<{ type: string; label: string; reference: string }>;
  feedback: { positive: string; negative: string };
  outputMode: 'gameplay' | 'sketch' | 'trailer' | 'poster' | 'realistic';
  lockedElements: Array<{ id: string; text: string; category: string; locked: boolean }>;
  /** Cumulative iteration history from autoplay (score trends, persistent issues) */
  iterationContext?: string;
}

export interface RefineFeedbackRequest {
  basePrompt: string;
  dimensions: Array<{ type: string; label: string; reference: string; id: string }>;
  changeFeedback: string;
  outputMode: 'gameplay' | 'sketch' | 'trailer' | 'poster' | 'realistic';
}

export type SimulatorAction =
  | 'breakdown'
  | 'element-to-dimension'
  | 'label-to-dimension'
  | 'feedback-to-dimension'
  | 'generate-with-feedback'
  | 'refine-feedback';
