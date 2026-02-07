/**
 * useIntelligentAutoplay - Intelligent autoplay wrapper with diversity and evolution
 *
 * This hook wraps the autoplay orchestrator and adds:
 * 1. Diversity Director - Tracks visual inventory, prevents repetition
 * 2. Prompt Evolution - Learns from success patterns, improves prompts
 *
 * It intercepts the regeneration flow to inject intelligent guidance.
 */

'use client';

import { useCallback, useRef } from 'react';
import { OutputMode, GeneratedPrompt, ImageEvaluation, AutoplayEventType, AutoplayLogEntry } from '../types';
import {
  DiversityInventory,
  DiversityGuidance,
  createEmptyInventory,
  updateInventory,
  extractFingerprints,
  generateDiversityGuidance,
  applyDiversityToFeedback,
  getDiversitySummary,
  needsDiversityGuidance,
} from '../subfeature_brain/lib/diversityDirector';
import {
  EvolutionState,
  createEmptyEvolutionState,
  updateEvolutionState,
  generatePromptMutations,
  applyPromptMutations,
  enhanceFeedbackWithEvolution,
  getEvolutionSummary,
  shouldApplyEvolution,
  EvaluationContext,
} from '../subfeature_brain/lib/promptEvolution';

// ============================================================================
// TYPES
// ============================================================================

export interface IntelligentAutoplayConfig {
  /** Enable diversity director (default: true) */
  diversityEnabled?: boolean;
  /** Enable prompt evolution (default: true) */
  evolutionEnabled?: boolean;
  /** Target count for diversity calculation */
  targetCount: number;
  /** Output mode for context */
  outputMode: OutputMode;
}

export interface IntelligentAutoplayState {
  /** Current diversity inventory */
  diversityInventory: DiversityInventory;
  /** Current evolution state */
  evolutionState: EvolutionState;
  /** Last diversity guidance applied */
  lastDiversityGuidance: DiversityGuidance | null;
  /** Total images processed */
  processedCount: number;
}

export interface UseIntelligentAutoplayReturn {
  /** Current state */
  state: IntelligentAutoplayState;

  /** Initialize for a new autoplay session */
  initialize: (config: IntelligentAutoplayConfig) => void;

  /** Reset all state */
  reset: () => void;

  /**
   * Process approved images after evaluation
   * - Extracts fingerprints for diversity
   * - Updates evolution patterns
   */
  processApprovedImages: (
    approvedImages: Array<{ url: string; promptId: string }>,
    allEvaluations: ImageEvaluation[],
    prompts: GeneratedPrompt[]
  ) => Promise<void>;

  /**
   * Enhance feedback before regeneration
   * - Applies diversity guidance
   * - Applies evolution insights
   */
  enhanceFeedback: (feedback: { positive: string; negative: string }) => { positive: string; negative: string };

  /**
   * Modify a prompt with evolution mutations
   */
  evolvePrompt: (prompt: string) => string;

  /** Get summary for logging */
  getSummary: () => string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useIntelligentAutoplay(
  onLogEvent?: (type: AutoplayEventType, message: string, details?: AutoplayLogEntry['details']) => void
): UseIntelligentAutoplayReturn {
  // State refs (using refs to avoid re-renders during autoplay)
  const diversityInventoryRef = useRef<DiversityInventory>(createEmptyInventory());
  const evolutionStateRef = useRef<EvolutionState>(createEmptyEvolutionState());
  const configRef = useRef<IntelligentAutoplayConfig | null>(null);
  const lastGuidanceRef = useRef<DiversityGuidance | null>(null);
  const processedCountRef = useRef(0);

  // Helper to log events
  const log = useCallback((type: AutoplayEventType, message: string, details?: AutoplayLogEntry['details']) => {
    if (onLogEvent) {
      onLogEvent(type, message, details);
    }
    console.log(`[IntelligentAutoplay] ${message}`);
  }, [onLogEvent]);

  /**
   * Initialize for a new autoplay session
   */
  const initialize = useCallback((config: IntelligentAutoplayConfig) => {
    configRef.current = config;
    diversityInventoryRef.current = createEmptyInventory();
    evolutionStateRef.current = createEmptyEvolutionState();
    lastGuidanceRef.current = null;
    processedCountRef.current = 0;

    log('phase_started', 'Intelligent autoplay initialized', {
      phase: 'sketch', // Will be updated by actual phase
    });
  }, [log]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    diversityInventoryRef.current = createEmptyInventory();
    evolutionStateRef.current = createEmptyEvolutionState();
    lastGuidanceRef.current = null;
    processedCountRef.current = 0;
    configRef.current = null;
  }, []);

  /**
   * Process approved images after evaluation
   */
  const processApprovedImages = useCallback(async (
    approvedImages: Array<{ url: string; promptId: string }>,
    allEvaluations: ImageEvaluation[],
    prompts: GeneratedPrompt[]
  ) => {
    const config = configRef.current;
    if (!config) return;

    // 1. Extract fingerprints for diversity tracking (if enabled)
    if (config.diversityEnabled !== false && approvedImages.length > 0) {
      try {
        log('image_complete', `Analyzing ${approvedImages.length} images for diversity`);

        const fingerprints = await extractFingerprints(approvedImages);

        for (const fingerprint of fingerprints) {
          diversityInventoryRef.current = updateInventory(
            diversityInventoryRef.current,
            fingerprint
          );
        }

        const summary = getDiversitySummary(diversityInventoryRef.current);
        log('feedback_applied', `Diversity updated: ${summary}`);

      } catch (error) {
        console.error('[IntelligentAutoplay] Fingerprint extraction failed:', error);
        // Non-critical - continue without diversity data
      }
    }

    // 2. Update evolution state with evaluation results (if enabled)
    if (config.evolutionEnabled !== false) {
      // Build evaluation contexts
      const contexts: EvaluationContext[] = allEvaluations.map(eval_ => {
        const prompt = prompts.find(p => p.id === eval_.promptId);
        return {
          promptId: eval_.promptId,
          promptText: prompt?.prompt || '',
          score: eval_.score,
          approved: eval_.approved,
          feedback: eval_.feedback,
          improvements: eval_.improvements,
          strengths: eval_.strengths,
        };
      });

      const iterationNumber = Math.floor(processedCountRef.current / 4) + 1;
      evolutionStateRef.current = updateEvolutionState(
        evolutionStateRef.current,
        contexts,
        iterationNumber
      );

      const evolutionSummary = getEvolutionSummary(evolutionStateRef.current);
      log('feedback_applied', `Evolution updated: ${evolutionSummary}`);
    }

    processedCountRef.current += approvedImages.length;
  }, [log]);

  /**
   * Enhance feedback before regeneration
   */
  const enhanceFeedback = useCallback((
    feedback: { positive: string; negative: string }
  ): { positive: string; negative: string } => {
    const config = configRef.current;
    if (!config) return feedback;

    let enhanced = { ...feedback };

    // 1. Apply diversity guidance
    if (config.diversityEnabled !== false && needsDiversityGuidance(diversityInventoryRef.current)) {
      const guidance = generateDiversityGuidance(
        diversityInventoryRef.current,
        config.targetCount,
        config.outputMode
      );
      lastGuidanceRef.current = guidance;

      enhanced = applyDiversityToFeedback(enhanced, guidance);

      if (guidance.emphasize.length > 0) {
        log('dimension_adjusted', `Diversity: emphasize ${guidance.emphasize.slice(0, 2).join(', ')}`);
      }
    }

    // 2. Apply evolution insights
    if (config.evolutionEnabled !== false && shouldApplyEvolution(evolutionStateRef.current)) {
      enhanced = enhanceFeedbackWithEvolution(
        enhanced,
        evolutionStateRef.current.formula
      );

      log('feedback_applied', 'Evolution insights applied to feedback');
    }

    return enhanced;
  }, [log]);

  /**
   * Modify a prompt with evolution mutations
   */
  const evolvePrompt = useCallback((prompt: string): string => {
    const config = configRef.current;
    if (!config || config.evolutionEnabled === false) return prompt;

    const state = evolutionStateRef.current;
    if (!shouldApplyEvolution(state) || !state.formula) return prompt;

    // Generate mutations
    const mutations = generatePromptMutations(
      prompt,
      state.formula,
      state.mutationHistory
    );

    if (mutations.length === 0) return prompt;

    // Apply mutations
    const evolved = applyPromptMutations(prompt, mutations);

    // Log mutations
    for (const mutation of mutations) {
      log('dimension_adjusted', `Mutation: ${mutation.type} "${mutation.target}" - ${mutation.reason}`);
    }

    return evolved;
  }, [log]);

  /**
   * Get summary for logging
   */
  const getSummary = useCallback((): string => {
    const parts: string[] = [];

    const diversitySummary = getDiversitySummary(diversityInventoryRef.current);
    if (diversitySummary !== 'No images analyzed yet') {
      parts.push(`Diversity: ${diversitySummary}`);
    }

    const evolutionSummary = getEvolutionSummary(evolutionStateRef.current);
    if (evolutionSummary !== 'No samples processed yet') {
      parts.push(`Evolution: ${evolutionSummary}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'Initializing...';
  }, []);

  return {
    state: {
      diversityInventory: diversityInventoryRef.current,
      evolutionState: evolutionStateRef.current,
      lastDiversityGuidance: lastGuidanceRef.current,
      processedCount: processedCountRef.current,
    },
    initialize,
    reset,
    processApprovedImages,
    enhanceFeedback,
    evolvePrompt,
    getSummary,
  };
}
