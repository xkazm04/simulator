/**
 * Prompt Evolution - Extracts success patterns and evolves prompts adaptively
 *
 * Purpose:
 * - Learn from approved vs rejected images
 * - Extract patterns that correlate with success
 * - Apply smart mutations to improve future prompts
 * - Build a "winning formula" over iterations
 *
 * How it works:
 * 1. After evaluation, analyze approved vs rejected images
 * 2. Extract common patterns from successful prompts
 * 3. Identify patterns correlated with failures
 * 4. Build a success formula with core/optional/avoid patterns
 * 5. Apply mutations to future prompts based on the formula
 */

import { ImageEvaluation, GeneratedPrompt } from '../../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A pattern extracted from prompts
 */
export interface PromptPattern {
  /** Unique identifier */
  id: string;
  /** Type of pattern */
  type: 'element' | 'modifier' | 'structure' | 'subject' | 'style' | 'composition';
  /** The actual pattern text */
  pattern: string;
  /** How many times this appeared in approved images */
  successCount: number;
  /** How many times this appeared in rejected images */
  failureCount: number;
  /** Confidence score: success / (success + failure) */
  confidence: number;
  /** Average score when this pattern was present */
  averageScore: number;
}

/**
 * The success formula built from patterns
 */
export interface SuccessFormula {
  /** High-confidence patterns to always include (confidence >= 0.7) */
  corePatterns: PromptPattern[];
  /** Medium-confidence patterns to sometimes include (0.5 <= confidence < 0.7) */
  optionalPatterns: PromptPattern[];
  /** Patterns that correlate with failure (confidence < 0.4) */
  avoidPatterns: string[];
  /** Overall confidence in the formula (based on sample size) */
  formulaConfidence: number;
  /** Number of samples used to build this formula */
  sampleSize: number;
}

/**
 * A mutation to apply to a prompt
 */
export interface PromptMutation {
  /** Type of mutation */
  type: 'emphasize' | 'de-emphasize' | 'add' | 'remove' | 'substitute';
  /** What to target in the prompt */
  target: string;
  /** Replacement text (for substitute) */
  replacement?: string;
  /** Reason for this mutation */
  reason: string;
  /** Confidence in this mutation */
  confidence: number;
}

/**
 * Evaluation context for pattern extraction
 */
export interface EvaluationContext {
  promptId: string;
  promptText: string;
  score: number;
  approved: boolean;
  feedback?: string;
  improvements?: string[];
  strengths?: string[];
}

/**
 * Evolution state tracked across iterations
 */
export interface EvolutionState {
  /** All patterns discovered so far */
  patterns: PromptPattern[];
  /** Current success formula */
  formula: SuccessFormula | null;
  /** History of mutations applied */
  mutationHistory: Array<{
    iteration: number;
    mutation: PromptMutation;
    result: 'success' | 'failure' | 'pending';
  }>;
  /** Total samples processed */
  totalSamples: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum samples needed to build a formula */
const MIN_SAMPLES_FOR_FORMULA = 2;

/** Confidence thresholds */
const CORE_PATTERN_THRESHOLD = 0.7;
const OPTIONAL_PATTERN_THRESHOLD = 0.5;
const AVOID_PATTERN_THRESHOLD = 0.4;

/** Common prompt elements to extract */
const ELEMENT_PATTERNS = [
  // Composition
  /\b(wide shot|close-?up|medium shot|portrait|establishing shot|aerial view)\b/gi,
  // Lighting
  /\b(dramatic lighting|rim lighting|backlit|golden hour|volumetric|ambient occlusion)\b/gi,
  // Style
  /\b(cinematic|photorealistic|stylized|painterly|cel-?shaded|hyper-?detailed)\b/gi,
  // Mood
  /\b(dramatic|peaceful|tense|mysterious|epic|intimate)\b/gi,
  // Technical
  /\b(high detail|8k|unreal engine|ray tracing|depth of field|bokeh)\b/gi,
  // Color
  /\b(warm tones|cool tones|vibrant colors|muted palette|high contrast)\b/gi,
];

/** Modifier patterns */
const MODIFIER_PATTERNS = [
  /\b(extremely|highly|very|ultra|incredibly)\s+\w+/gi,
  /\b(masterpiece|award-?winning|professional|stunning)\b/gi,
];

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Create an empty evolution state
 */
export function createEmptyEvolutionState(): EvolutionState {
  return {
    patterns: [],
    formula: null,
    mutationHistory: [],
    totalSamples: 0,
  };
}

// ============================================================================
// PATTERN EXTRACTION
// ============================================================================

/**
 * Extract patterns from a single prompt
 */
function extractPatternsFromPrompt(promptText: string): string[] {
  const patterns: string[] = [];

  // Extract element patterns
  for (const regex of ELEMENT_PATTERNS) {
    const matches = promptText.match(regex);
    if (matches) {
      patterns.push(...matches.map(m => m.toLowerCase()));
    }
  }

  // Extract modifier patterns
  for (const regex of MODIFIER_PATTERNS) {
    const matches = promptText.match(regex);
    if (matches) {
      patterns.push(...matches.map(m => m.toLowerCase()));
    }
  }

  // Deduplicate
  return [...new Set(patterns)];
}

/**
 * Extract success patterns from evaluation results
 */
export function extractSuccessPatterns(
  contexts: EvaluationContext[]
): PromptPattern[] {
  // Track pattern occurrences
  const patternStats: Map<string, {
    successCount: number;
    failureCount: number;
    totalScore: number;
    type: PromptPattern['type'];
  }> = new Map();

  for (const context of contexts) {
    const patterns = extractPatternsFromPrompt(context.promptText);

    for (const pattern of patterns) {
      const existing = patternStats.get(pattern) || {
        successCount: 0,
        failureCount: 0,
        totalScore: 0,
        type: categorizePattern(pattern),
      };

      if (context.approved) {
        existing.successCount++;
      } else {
        existing.failureCount++;
      }
      existing.totalScore += context.score;

      patternStats.set(pattern, existing);
    }

    // Also extract patterns from strengths (these are explicitly good)
    if (context.strengths) {
      for (const strength of context.strengths) {
        const strengthLower = strength.toLowerCase();
        const existing = patternStats.get(strengthLower) || {
          successCount: 0,
          failureCount: 0,
          totalScore: 0,
          type: 'element',
        };
        existing.successCount += 2; // Weight strengths more heavily
        existing.totalScore += context.score;
        patternStats.set(strengthLower, existing);
      }
    }
  }

  // Convert to PromptPattern array
  const patterns: PromptPattern[] = [];
  let id = 0;

  Array.from(patternStats.entries()).forEach(([pattern, stats]) => {
    const total = stats.successCount + stats.failureCount;
    if (total > 0) {
      patterns.push({
        id: `pattern-${id++}`,
        type: stats.type,
        pattern,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        confidence: stats.successCount / total,
        averageScore: stats.totalScore / total,
      });
    }
  });

  // Sort by confidence (descending)
  return patterns.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Categorize a pattern by type
 */
function categorizePattern(pattern: string): PromptPattern['type'] {
  const lowerPattern = pattern.toLowerCase();

  if (/shot|view|angle|perspective|frame/i.test(lowerPattern)) {
    return 'composition';
  }
  if (/lighting|lit|shadow|glow|ray/i.test(lowerPattern)) {
    return 'style';
  }
  if (/character|warrior|hero|figure|person/i.test(lowerPattern)) {
    return 'subject';
  }
  if (/dramatic|peaceful|epic|tense|mood/i.test(lowerPattern)) {
    return 'style';
  }
  if (/extremely|highly|very|ultra/i.test(lowerPattern)) {
    return 'modifier';
  }

  return 'element';
}

// ============================================================================
// SUCCESS FORMULA
// ============================================================================

/**
 * Build a success formula from extracted patterns
 */
export function buildSuccessFormula(
  patterns: PromptPattern[],
  minConfidence: number = OPTIONAL_PATTERN_THRESHOLD
): SuccessFormula {
  const corePatterns: PromptPattern[] = [];
  const optionalPatterns: PromptPattern[] = [];
  const avoidPatterns: string[] = [];

  for (const pattern of patterns) {
    if (pattern.confidence >= CORE_PATTERN_THRESHOLD) {
      corePatterns.push(pattern);
    } else if (pattern.confidence >= OPTIONAL_PATTERN_THRESHOLD) {
      optionalPatterns.push(pattern);
    } else if (pattern.confidence < AVOID_PATTERN_THRESHOLD && pattern.failureCount >= 2) {
      avoidPatterns.push(pattern.pattern);
    }
  }

  // Calculate formula confidence based on sample size
  const totalSamples = patterns.reduce((sum, p) => sum + p.successCount + p.failureCount, 0);
  const formulaConfidence = Math.min(1, totalSamples / 10); // Max confidence at 10 samples

  return {
    corePatterns: corePatterns.slice(0, 5), // Limit to top 5
    optionalPatterns: optionalPatterns.slice(0, 5),
    avoidPatterns: avoidPatterns.slice(0, 5),
    formulaConfidence,
    sampleSize: totalSamples,
  };
}

/**
 * Update evolution state with new evaluation results
 */
export function updateEvolutionState(
  state: EvolutionState,
  contexts: EvaluationContext[],
  iterationNumber: number
): EvolutionState {
  // Extract new patterns
  const newPatterns = extractSuccessPatterns(contexts);

  // Merge with existing patterns
  const mergedPatterns = mergePatterns(state.patterns, newPatterns);

  // Build updated formula (only if we have enough samples)
  const totalSamples = state.totalSamples + contexts.length;
  const formula = totalSamples >= MIN_SAMPLES_FOR_FORMULA
    ? buildSuccessFormula(mergedPatterns)
    : null;

  // Update mutation history results
  const updatedHistory = state.mutationHistory.map(entry => {
    if (entry.result === 'pending') {
      // Check if any approved image used this mutation's target
      const wasUsed = contexts.some(c =>
        c.promptText.toLowerCase().includes(entry.mutation.target.toLowerCase())
      );
      const wasSuccessful = contexts.some(c =>
        c.approved && c.promptText.toLowerCase().includes(entry.mutation.target.toLowerCase())
      );

      if (wasUsed) {
        return {
          ...entry,
          result: wasSuccessful ? 'success' as const : 'failure' as const,
        };
      }
    }
    return entry;
  });

  return {
    patterns: mergedPatterns,
    formula,
    mutationHistory: updatedHistory,
    totalSamples,
  };
}

/**
 * Merge existing patterns with new patterns
 */
function mergePatterns(
  existing: PromptPattern[],
  newPatterns: PromptPattern[]
): PromptPattern[] {
  const merged: Map<string, PromptPattern> = new Map();

  // Add existing patterns
  for (const pattern of existing) {
    merged.set(pattern.pattern, pattern);
  }

  // Merge new patterns
  for (const newPattern of newPatterns) {
    const existing = merged.get(newPattern.pattern);
    if (existing) {
      // Combine statistics
      const combinedSuccess = existing.successCount + newPattern.successCount;
      const combinedFailure = existing.failureCount + newPattern.failureCount;
      const total = combinedSuccess + combinedFailure;

      merged.set(newPattern.pattern, {
        ...existing,
        successCount: combinedSuccess,
        failureCount: combinedFailure,
        confidence: combinedSuccess / total,
        averageScore: (existing.averageScore * (existing.successCount + existing.failureCount) +
          newPattern.averageScore * (newPattern.successCount + newPattern.failureCount)) / total,
      });
    } else {
      merged.set(newPattern.pattern, newPattern);
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// PROMPT MUTATIONS
// ============================================================================

/**
 * Generate mutations for a prompt based on success formula
 */
export function generatePromptMutations(
  promptText: string,
  formula: SuccessFormula,
  mutationHistory: EvolutionState['mutationHistory']
): PromptMutation[] {
  const mutations: PromptMutation[] = [];
  const promptLower = promptText.toLowerCase();

  // Check what core patterns are missing
  for (const pattern of formula.corePatterns) {
    if (!promptLower.includes(pattern.pattern.toLowerCase())) {
      // Check if we've tried adding this before and it failed
      const previousAttempt = mutationHistory.find(
        h => h.mutation.target === pattern.pattern && h.result === 'failure'
      );

      if (!previousAttempt) {
        mutations.push({
          type: 'add',
          target: pattern.pattern,
          reason: `Core pattern (${Math.round(pattern.confidence * 100)}% success rate)`,
          confidence: pattern.confidence,
        });
      }
    }
  }

  // Check for avoid patterns to remove
  for (const avoidPattern of formula.avoidPatterns) {
    if (promptLower.includes(avoidPattern.toLowerCase())) {
      mutations.push({
        type: 'remove',
        target: avoidPattern,
        reason: 'Correlated with failures',
        confidence: 0.6,
      });
    }
  }

  // Emphasize patterns that are present and successful
  for (const pattern of formula.corePatterns) {
    if (promptLower.includes(pattern.pattern.toLowerCase())) {
      // Already has this pattern - could emphasize it
      if (pattern.confidence > 0.8 && Math.random() > 0.5) {
        mutations.push({
          type: 'emphasize',
          target: pattern.pattern,
          replacement: `highly detailed ${pattern.pattern}`,
          reason: `High success rate (${Math.round(pattern.confidence * 100)}%)`,
          confidence: pattern.confidence,
        });
      }
    }
  }

  // Limit mutations per generation
  return mutations.slice(0, 3);
}

/**
 * Apply mutations to a prompt
 */
export function applyPromptMutations(
  promptText: string,
  mutations: PromptMutation[]
): string {
  let result = promptText;

  for (const mutation of mutations) {
    switch (mutation.type) {
      case 'add':
        // Add at the beginning or end based on pattern type
        if (mutation.target.match(/shot|angle|view/i)) {
          result = `${mutation.target}, ${result}`;
        } else {
          result = `${result}, ${mutation.target}`;
        }
        break;

      case 'remove':
        // Remove the pattern (case-insensitive)
        const removeRegex = new RegExp(`\\b${escapeRegex(mutation.target)}\\b,?\\s*`, 'gi');
        result = result.replace(removeRegex, '');
        break;

      case 'emphasize':
        if (mutation.replacement) {
          const emphRegex = new RegExp(`\\b${escapeRegex(mutation.target)}\\b`, 'gi');
          result = result.replace(emphRegex, mutation.replacement);
        }
        break;

      case 'substitute':
        if (mutation.replacement) {
          const subRegex = new RegExp(`\\b${escapeRegex(mutation.target)}\\b`, 'gi');
          result = result.replace(subRegex, mutation.replacement);
        }
        break;

      case 'de-emphasize':
        // Remove intensifiers before the target
        const deEmpRegex = new RegExp(`(extremely|highly|very|ultra)\\s+${escapeRegex(mutation.target)}`, 'gi');
        result = result.replace(deEmpRegex, mutation.target);
        break;
    }
  }

  // Clean up extra commas and spaces
  result = result.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
  result = result.replace(/^,\s*/, '').replace(/,\s*$/, '');

  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// FEEDBACK ENHANCEMENT
// ============================================================================

/**
 * Enhance feedback with evolution insights
 */
export function enhanceFeedbackWithEvolution(
  feedback: { positive: string; negative: string },
  formula: SuccessFormula | null
): { positive: string; negative: string } {
  if (!formula || formula.formulaConfidence < 0.3) {
    // Not enough data yet
    return feedback;
  }

  let positive = feedback.positive;
  let negative = feedback.negative;

  // Add core patterns to positive feedback
  if (formula.corePatterns.length > 0) {
    const coreHints = formula.corePatterns
      .slice(0, 2)
      .map(p => p.pattern)
      .join(', ');
    positive = positive
      ? `${positive}. Emphasize: ${coreHints}`
      : `Emphasize: ${coreHints}`;
  }

  // Add avoid patterns to negative feedback
  if (formula.avoidPatterns.length > 0) {
    const avoidHints = formula.avoidPatterns.slice(0, 2).join(', ');
    negative = negative
      ? `${negative}. Avoid: ${avoidHints}`
      : `Avoid: ${avoidHints}`;
  }

  return { positive, negative };
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Get a summary of the evolution state for logging
 */
export function getEvolutionSummary(state: EvolutionState): string {
  const { patterns, formula, totalSamples } = state;

  if (totalSamples === 0) {
    return 'No samples processed yet';
  }

  const parts = [`${totalSamples} samples, ${patterns.length} patterns`];

  if (formula) {
    parts.push(`${formula.corePatterns.length} core, ${formula.avoidPatterns.length} avoid`);
    parts.push(`${Math.round(formula.formulaConfidence * 100)}% confidence`);
  }

  return parts.join(', ');
}

/**
 * Check if evolution should be applied
 */
export function shouldApplyEvolution(state: EvolutionState): boolean {
  return state.totalSamples >= MIN_SAMPLES_FOR_FORMULA && state.formula !== null;
}
