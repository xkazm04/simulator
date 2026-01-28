/**
 * useAutoplayOrchestrator - Orchestration layer for autoplay
 *
 * This hook COORDINATES the autoplay loop by:
 * 1. Listening to state machine state changes
 * 2. Triggering appropriate actions at each step
 * 3. Wiring together: useAutoplay + useImageGeneration + useBrain + evaluator
 *
 * The state machine (useAutoplay) manages STATE
 * This orchestrator manages EFFECTS (API calls, side effects)
 *
 * Flow:
 * START -> generateImagesFromPrompts()
 * GENERATION_COMPLETE -> evaluateImages()
 * EVALUATION_COMPLETE -> saveImageToPanel() for approved, apply feedback
 * IMAGES_SAVED + REFINE_COMPLETE -> check if more iterations needed
 * ITERATION_COMPLETE -> loop or finish
 *
 * ERROR HANDLING:
 * - evaluateImages errors: Continue iteration with all images marked unapproved
 * - Generation errors: Detected via all images failed, transition to error state
 * - Only truly unrecoverable errors (no images at all) cause error state
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAutoplay } from './useAutoplay';
import {
  AutoplayConfig,
  GeneratedPrompt,
  GeneratedImage,
  OutputMode,
  Dimension,
  ImageEvaluation,
} from '../types';
import {
  evaluateImages,
  extractRefinementFeedback,
  EvaluationCriteria,
} from '../subfeature_brain/lib/imageEvaluator';

export interface AutoplayOrchestratorDeps {
  // From useImageGeneration
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  generateImagesFromPrompts: (prompts: Array<{ id: string; prompt: string; negativePrompt?: string }>) => Promise<void>;
  saveImageToPanel: (promptId: string, promptText: string) => void;

  // From useBrain
  setFeedback: (feedback: { positive: string; negative: string }) => void;

  // From parent component state
  generatedPrompts: GeneratedPrompt[];
  outputMode: OutputMode;
  dimensions: Dimension[];
  baseImage: string;

  /**
   * Callback to trigger regeneration (re-runs the generate flow with current state)
   *
   * This should do what clicking "Generate" does:
   * 1. Regenerate prompts from current brain state (base image + dimensions + feedback)
   * 2. Call generateImagesFromPrompts with the new prompts
   *
   * The orchestrator will detect generation completion via isGeneratingImages flag.
   */
  onRegeneratePrompts: () => void;
}

export interface UseAutoplayOrchestratorReturn {
  // State from useAutoplay
  isRunning: boolean;
  canStart: boolean;
  status: string;
  currentIteration: number;
  maxIterations: number;
  totalSaved: number;
  targetSaved: number;
  completionReason: string | null;
  error: string | undefined;

  // Actions
  startAutoplay: (config: AutoplayConfig) => void;
  abortAutoplay: () => void;
  resetAutoplay: () => void;
}

export function useAutoplayOrchestrator(
  deps: AutoplayOrchestratorDeps
): UseAutoplayOrchestratorReturn {
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
    onRegeneratePrompts,
  } = deps;

  // State machine
  const autoplay = useAutoplay();

  // Track if we've already triggered actions for current state (prevent double-firing)
  const processedStateRef = useRef<string>('');
  const currentIterationRef = useRef<number>(0);

  // Create state key for deduplication
  const stateKey = `${autoplay.state.status}-${autoplay.state.currentIteration}-${autoplay.state.totalSaved}`;

  /**
   * Effect: Handle state transitions and trigger appropriate actions
   */
  useEffect(() => {
    // Skip if we've already processed this state
    if (processedStateRef.current === stateKey) return;
    processedStateRef.current = stateKey;

    const runEffect = async () => {
      const { status, abortRequested } = autoplay.state;

      // Check for abort at any point
      if (abortRequested && status !== 'complete' && status !== 'idle') {
        autoplay.onIterationComplete(); // Will transition to complete due to abortRequested
        return;
      }

      switch (status) {
        case 'generating': {
          // Generation is triggered externally via onRegeneratePrompts
          // We watch for completion via isGeneratingImages
          if (currentIterationRef.current !== autoplay.state.currentIteration) {
            // New iteration started - trigger generation
            currentIterationRef.current = autoplay.state.currentIteration;

            // For iteration > 1, we need to regenerate prompts
            // For iteration 1, prompts should already exist from user's Generate action
            if (autoplay.state.currentIteration > 1) {
              onRegeneratePrompts();
            }
          }
          break;
        }

        case 'evaluating': {
          // Get completed images for evaluation
          const completedImages = generatedImages.filter(
            img => img.status === 'complete' && img.url
          );

          if (completedImages.length === 0) {
            // No images to evaluate at all - this is an error state
            autoplay.setError('No images to evaluate');
            return;
          }

          // Build evaluation criteria from current state
          const criteria: EvaluationCriteria = {
            originalPrompt: baseImage,
            expectedAspects: dimensions
              .filter(d => d.reference.trim())
              .map(d => `${d.label}: ${d.reference}`),
            outputMode: outputMode as 'gameplay' | 'concept',
            approvalThreshold: 70,
          };

          // Evaluate all completed images with error handling
          // If evaluation fails, continue with all images marked unapproved
          let evaluations: ImageEvaluation[];
          try {
            evaluations = await evaluateImages(
              completedImages.map(img => ({
                imageUrl: img.url!,
                promptId: img.promptId,
              })),
              criteria,
              autoplay.abortController?.signal
            );
          } catch (evalError) {
            // Evaluation API failed - mark all images as unapproved and continue
            console.error('Evaluation failed, continuing with unapproved results:', evalError);
            evaluations = completedImages.map(img => ({
              promptId: img.promptId,
              approved: false,
              score: 0,
              feedback: `Evaluation error: ${evalError instanceof Error ? evalError.message : 'Unknown error'}. Retry in next iteration.`,
              improvements: ['Retry evaluation'],
              strengths: [],
            }));
          }

          // Signal evaluation complete (even if all failed, we continue the loop)
          autoplay.onEvaluationComplete(
            evaluations.map(e => ({
              promptId: e.promptId,
              approved: e.approved,
              feedback: e.feedback,
              score: e.score,
            }))
          );
          break;
        }

        case 'refining': {
          // Get current iteration's evaluations
          const currentIter = autoplay.currentIteration;
          if (!currentIter) return;

          const evaluations = currentIter.evaluations;

          // Save approved images
          const approvedEvals = evaluations.filter(e => e.approved);
          let savedCount = 0;

          for (const eval_ of approvedEvals) {
            // Find the prompt text for this promptId
            const prompt = generatedPrompts.find(p => p.id === eval_.promptId);
            if (prompt) {
              saveImageToPanel(eval_.promptId, prompt.prompt);
              savedCount++;
            }
          }

          // Signal images saved
          if (savedCount > 0) {
            autoplay.onImagesSaved(savedCount);
          }

          // Extract and apply refinement feedback from rejected images
          const fullEvaluations: ImageEvaluation[] = evaluations.map(e => ({
            promptId: e.promptId,
            approved: e.approved,
            score: e.score ?? 0,
            feedback: e.feedback,
            improvements: [], // Not stored in iteration
            strengths: [],
          }));

          const refinementFeedback = extractRefinementFeedback(fullEvaluations);

          // Apply feedback to brain for next iteration
          if (refinementFeedback.positive || refinementFeedback.negative) {
            setFeedback(refinementFeedback);
          }

          autoplay.onRefineComplete();

          // Small delay before completing iteration (allows state to settle)
          await new Promise(resolve => setTimeout(resolve, 100));
          autoplay.onIterationComplete();
          break;
        }
      }
    };

    runEffect().catch(error => {
      console.error('Autoplay orchestrator error:', error);
      autoplay.setError(error instanceof Error ? error.message : 'Unknown error');
    });
  }, [
    stateKey,
    autoplay,
    generatedImages,
    generatedPrompts,
    baseImage,
    dimensions,
    outputMode,
    saveImageToPanel,
    setFeedback,
    onRegeneratePrompts,
  ]);

  /**
   * Effect: Watch for generation completion
   */
  useEffect(() => {
    if (autoplay.state.status !== 'generating') return;
    if (isGeneratingImages) return; // Still generating

    // Generation finished - check if we have completed images
    const completedImages = generatedImages.filter(
      img => img.status === 'complete' && img.url
    );

    if (completedImages.length > 0) {
      const promptIds = completedImages.map(img => img.promptId);
      autoplay.onGenerationComplete(promptIds);
    } else if (generatedImages.length > 0 && generatedImages.every(img => img.status === 'failed')) {
      // All generations failed
      autoplay.setError('All image generations failed');
    }
  }, [autoplay, isGeneratingImages, generatedImages]);

  /**
   * Start autoplay - validates prerequisites and kicks off the loop
   */
  const startAutoplay = useCallback((config: AutoplayConfig) => {
    // Validate we have prompts to work with
    if (generatedPrompts.length === 0) {
      console.error('Cannot start autoplay: no generated prompts');
      return;
    }

    // Validate output mode (poster not supported)
    if (outputMode === 'poster') {
      console.error('Cannot start autoplay: poster mode not supported');
      return;
    }

    autoplay.start(config);
  }, [autoplay, generatedPrompts, outputMode]);

  return {
    // State
    isRunning: autoplay.isRunning,
    canStart: autoplay.canStart,
    status: autoplay.state.status,
    currentIteration: autoplay.state.currentIteration,
    maxIterations: autoplay.state.config.maxIterations,
    totalSaved: autoplay.state.totalSaved,
    targetSaved: autoplay.state.config.targetSavedCount,
    completionReason: autoplay.completionReason,
    error: autoplay.state.error,

    // Actions
    startAutoplay,
    abortAutoplay: autoplay.abort,
    resetAutoplay: autoplay.reset,
  };
}
