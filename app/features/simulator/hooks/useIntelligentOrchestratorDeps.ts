/**
 * useIntelligentOrchestratorDeps - Wraps orchestrator deps with intelligent features
 *
 * This hook wraps the AutoplayOrchestratorDeps to inject:
 * 1. Diversity Director - Enhanced feedback based on visual inventory
 * 2. Prompt Evolution - Learning from success patterns
 *
 * Usage:
 * Instead of passing deps directly to useAutoplayOrchestrator,
 * wrap them with this hook first to add intelligent features.
 */

'use client';

import { useCallback, useRef, useEffect, useMemo } from 'react';
import {
  OutputMode,
  GeneratedPrompt,
  GeneratedImage,
  ImageEvaluation,
  AutoplayEventType,
  AutoplayLogEntry,
} from '../types';
import { AutoplayOrchestratorDeps } from './useAutoplayOrchestrator';
import { useIntelligentAutoplay } from './useIntelligentAutoplay';

// ============================================================================
// TYPES
// ============================================================================

export interface IntelligentOrchestratorConfig {
  /** Enable diversity tracking (default: true) */
  diversityEnabled?: boolean;
  /** Enable prompt evolution (default: true) */
  evolutionEnabled?: boolean;
  /** Target images to generate */
  targetCount: number;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Create intelligent orchestrator deps by wrapping base deps
 */
export function useIntelligentOrchestratorDeps(
  baseDeps: AutoplayOrchestratorDeps,
  config: IntelligentOrchestratorConfig
): AutoplayOrchestratorDeps {
  const {
    generatedImages,
    isGeneratingImages,
    generateImagesFromPrompts,
    saveImageToPanel,
    setFeedback,
    generatedPrompts,
    outputMode,
    dimensions,
    baseImage,
    visionSentence,
    breakdown,
    onRegeneratePrompts,
    onLogEvent,
  } = baseDeps;

  // Initialize intelligent autoplay
  const intelligent = useIntelligentAutoplay(onLogEvent);

  // Track if we've initialized for this session
  const initializedRef = useRef(false);
  const lastEvaluationsRef = useRef<ImageEvaluation[]>([]);
  const lastApprovedRef = useRef<Array<{ url: string; promptId: string }>>([]);

  // Initialize when config changes (new autoplay session)
  useEffect(() => {
    if (config.targetCount > 0 && !initializedRef.current) {
      intelligent.initialize({
        diversityEnabled: config.diversityEnabled,
        evolutionEnabled: config.evolutionEnabled,
        targetCount: config.targetCount,
        outputMode,
      });
      initializedRef.current = true;
    }
  }, [config, outputMode, intelligent]);

  // Reset when autoplay ends (no longer generating)
  useEffect(() => {
    if (!isGeneratingImages && initializedRef.current) {
      // Check if we should process any pending approvals
      // This happens after each evaluation completes
    }
  }, [isGeneratingImages]);

  /**
   * Enhanced saveImageToPanel that also tracks for diversity
   */
  const enhancedSaveImageToPanel = useCallback((promptId: string, promptText: string): boolean => {
    // Call original save
    const saved = saveImageToPanel(promptId, promptText);

    // Track the saved image for diversity analysis (only if actually saved)
    if (saved) {
      const image = generatedImages.find(img => img.promptId === promptId);
      if (image?.url) {
        lastApprovedRef.current.push({ url: image.url, promptId });
      }
    }

    return saved;
  }, [saveImageToPanel, generatedImages]);

  /**
   * Enhanced setFeedback that applies intelligent enhancements
   */
  const enhancedSetFeedback = useCallback((feedback: { positive: string; negative: string }) => {
    // Apply intelligent enhancements
    const enhanced = intelligent.enhanceFeedback(feedback);

    // Call original setFeedback with enhanced version
    setFeedback(enhanced);
  }, [setFeedback, intelligent]);

  /**
   * Enhanced onRegeneratePrompts that:
   * 1. Processes any pending approved images for diversity/evolution
   * 2. Enhances feedback before regeneration
   */
  const enhancedOnRegeneratePrompts = useCallback((overrides?: {
    feedback?: { positive: string; negative: string };
    onPromptsReady?: (prompts: GeneratedPrompt[]) => void;
  }) => {
    // Process any pending approved images before regeneration
    const pendingApproved = lastApprovedRef.current;
    const pendingEvaluations = lastEvaluationsRef.current;

    if (pendingApproved.length > 0 && pendingEvaluations.length > 0) {
      // Process in background (non-blocking)
      intelligent.processApprovedImages(
        pendingApproved,
        pendingEvaluations,
        generatedPrompts
      ).catch(err => {
        console.error('[IntelligentDeps] Failed to process approved images:', err);
      });

      // Clear pending
      lastApprovedRef.current = [];
      lastEvaluationsRef.current = [];
    }

    // Enhance feedback if provided
    let enhancedOverrides = overrides;
    if (overrides?.feedback) {
      enhancedOverrides = {
        ...overrides,
        feedback: intelligent.enhanceFeedback(overrides.feedback),
      };
    }

    // If no feedback provided, we might still want to inject evolution insights
    // for subsequent iterations
    if (!enhancedOverrides?.feedback) {
      const defaultEnhanced = intelligent.enhanceFeedback({ positive: '', negative: '' });
      if (defaultEnhanced.positive || defaultEnhanced.negative) {
        enhancedOverrides = {
          ...enhancedOverrides,
          feedback: defaultEnhanced,
        };
      }
    }

    // Wrap onPromptsReady to apply prompt evolution
    const originalOnPromptsReady = enhancedOverrides?.onPromptsReady;
    const wrappedOnPromptsReady = originalOnPromptsReady
      ? (prompts: GeneratedPrompt[]) => {
          // Apply prompt evolution to each prompt
          const evolvedPrompts = prompts.map(p => ({
            ...p,
            prompt: intelligent.evolvePrompt(p.prompt),
          }));
          originalOnPromptsReady(evolvedPrompts);
        }
      : undefined;

    // Call original with enhanced overrides
    onRegeneratePrompts({
      ...enhancedOverrides,
      onPromptsReady: wrappedOnPromptsReady,
    });
  }, [onRegeneratePrompts, intelligent, generatedPrompts]);

  /**
   * Enhanced log event that also tracks evaluations
   */
  const enhancedOnLogEvent = useCallback((
    type: AutoplayEventType,
    message: string,
    details?: AutoplayLogEntry['details']
  ) => {
    // Track evaluations for evolution processing
    if (type === 'image_approved' || type === 'image_rejected') {
      if (details?.promptId && details?.score !== undefined) {
        lastEvaluationsRef.current.push({
          promptId: details.promptId,
          approved: type === 'image_approved',
          score: details.score,
          feedback: details.feedback,
          improvements: [],
          strengths: [],
        });
      }
    }

    // Pass through to original
    if (onLogEvent) {
      onLogEvent(type, message, details);
    }
  }, [onLogEvent]);

  // Return memoized enhanced deps to prevent unnecessary re-renders in orchestrator
  return useMemo(() => ({
    ...baseDeps,
    saveImageToPanel: enhancedSaveImageToPanel,
    setFeedback: enhancedSetFeedback,
    onRegeneratePrompts: enhancedOnRegeneratePrompts,
    onLogEvent: enhancedOnLogEvent,
  }), [
    baseDeps,
    enhancedSaveImageToPanel,
    enhancedSetFeedback,
    enhancedOnRegeneratePrompts,
    enhancedOnLogEvent,
  ]);
}

/**
 * Utility: Reset intelligent state when starting a new autoplay session
 */
export function createIntelligentConfig(
  targetCount: number,
  options?: {
    diversityEnabled?: boolean;
    evolutionEnabled?: boolean;
  }
): IntelligentOrchestratorConfig {
  return {
    targetCount,
    diversityEnabled: options?.diversityEnabled ?? true,
    evolutionEnabled: options?.evolutionEnabled ?? true,
  };
}
