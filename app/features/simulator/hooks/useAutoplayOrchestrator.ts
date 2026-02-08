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
  SmartBreakdownPersisted,
  AutoplayEventType,
  AutoplayLogEntry,
  AutoplayIteration,
  DEFAULT_POLISH_CONFIG,
} from '../types';
import {
  evaluateImages,
  extractRefinementFeedback,
  EvaluationCriteria,
} from '../subfeature_brain/lib/imageEvaluator';
import {
  decidePolishAction,
  polishImageWithTimeout,
  PolishRequest,
} from '../subfeature_brain/lib/imagePolisher';

export interface AutoplayOrchestratorDeps {
  // From useImageGeneration
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  generateImagesFromPrompts: (prompts: Array<{ id: string; prompt: string }>) => Promise<void>;
  saveImageToPanel: (promptId: string, promptText: string) => boolean;
  /** Update a generated image's URL in-memory (for polish: replace original with polished) */
  updateGeneratedImageUrl: (promptId: string, newUrl: string) => void;

  // From useBrain
  setFeedback: (feedback: { positive: string; negative: string }) => void;

  // From parent component state
  generatedPrompts: GeneratedPrompt[];
  outputMode: OutputMode;
  dimensions: Dimension[];
  baseImage: string;
  /** Vision sentence (core project identity) - used for evaluation if available */
  visionSentence: string | null;
  /** Smart Breakdown result for richer evaluation context */
  breakdown: SmartBreakdownPersisted | null;

  /**
   * Callback to trigger regeneration (re-runs the generate flow with current state)
   *
   * This should do what clicking "Generate" does:
   * 1. Regenerate prompts from current brain state (base image + dimensions + feedback)
   * 2. Call generateImagesFromPrompts with the new prompts
   *
   * The orchestrator will detect generation completion via isGeneratingImages flag.
   *
   * @param overrides - Optional overrides for feedback and onPromptsReady callback
   */
  onRegeneratePrompts: (overrides?: {
    baseImage?: string;
    feedback?: { positive: string; negative: string };
    iterationContext?: string;
    onPromptsReady?: (prompts: GeneratedPrompt[]) => void;
  }) => void;

  // Event logging callback (optional)
  onLogEvent?: (
    type: AutoplayEventType,
    message: string,
    details?: AutoplayLogEntry['details']
  ) => void;

  /** Max prompts to generate images for per iteration. undefined = all (default). Set to 1 for sequential mode. */
  maxPromptsPerIteration?: number;
}

export interface UseAutoplayOrchestratorReturn {
  // State from useAutoplay
  isRunning: boolean;
  canStart: boolean;
  canStartReason: string | null; // Why autoplay can't start (null if canStart is true)
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
    updateGeneratedImageUrl,
    setFeedback,
    generatedPrompts,
    outputMode,
    dimensions,
    baseImage,
    visionSentence,
    breakdown,
    onRegeneratePrompts,
    onLogEvent,
  } = deps;

  // Helper to log events (no-op if callback not provided)
  const logEvent = useCallback((
    type: AutoplayEventType,
    message: string,
    details?: AutoplayLogEntry['details']
  ) => {
    if (onLogEvent) {
      onLogEvent(type, message, details);
    }
  }, [onLogEvent]);

  // State machine
  const autoplay = useAutoplay();

  // Track if we've already triggered actions for current state (prevent double-firing)
  const processedStateRef = useRef<string>('');
  const currentIterationRef = useRef<number>(0);

  // Store feedback from refining phase to pass to next iteration
  // This avoids React state timing issues where setFeedback hasn't propagated yet
  const pendingFeedbackRef = useRef<{ positive: string; negative: string } | null>(null);

  // Track current prompts via ref to avoid stale closure issues
  const generatedPromptsRef = useRef(generatedPrompts);
  generatedPromptsRef.current = generatedPrompts;

  // Track generated images via ref for polish phase
  const generatedImagesRef = useRef(generatedImages);
  generatedImagesRef.current = generatedImages;

  // Flag: prompt regeneration in progress — prevents completion detector and backup trigger
  // from acting on stale images/prompts from a previous phase
  const regeneratingRef = useRef(false);

  // Track polish attempts per prompt (prevents re-polishing same image)
  const polishAttemptsRef = useRef<Map<string, number>>(new Map());

  // Store evaluation criteria for use in polish phase
  const evaluationCriteriaRef = useRef<EvaluationCriteria | null>(null);

  // Cumulative refinement brief — accumulates evaluation insights across iterations
  // so Claude gets progressively richer context instead of just single-iteration feedback
  const refinementBriefRef = useRef<string>('');

  // Evolved base image description — starts as the original baseImage and grows
  // with evaluation insights so prompt generation anchors on progressively refined context
  const evolvedBaseImageRef = useRef<string>('');

  // Track which prompt IDs belong to the current iteration — prevents completion detector
  // and evaluator from acting on stale images from a previous phase/session
  const activePromptIdsRef = useRef<Set<string>>(new Set());

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

            logEvent('image_generating', `Starting image generation (iteration ${autoplay.state.currentIteration})`);

            // Always regenerate prompts — ensures fresh prompts for each iteration
            // and each phase transition (multi-phase reuses orchestrator across phases,
            // so old prompts from the previous phase would be stale).
            logEvent('prompt_generated', 'Regenerating prompts with feedback');
            // Pass pending feedback directly to avoid React state timing issues
            const feedbackOverride = pendingFeedbackRef.current;
            pendingFeedbackRef.current = null; // Clear after using

            // Set flag to prevent completion detector / backup trigger from acting
            // on stale images while we regenerate prompts
            regeneratingRef.current = true;

            // Pass callback to receive prompts immediately after generation
            // iterationContext flows as a separate channel (not crammed into feedback.positive)
            onRegeneratePrompts({
              baseImage: evolvedBaseImageRef.current || undefined,
              feedback: feedbackOverride || undefined,
              iterationContext: refinementBriefRef.current || undefined,
              onPromptsReady: (newPrompts) => {
                regeneratingRef.current = false;
                // Apply maxPromptsPerIteration limit (sequential mode uses 1)
                const limit = deps.maxPromptsPerIteration;
                const promptsToUse = limit ? newPrompts.slice(0, limit) : newPrompts;
                // Track which prompt IDs belong to THIS iteration
                activePromptIdsRef.current = new Set(promptsToUse.map(p => p.id));
                console.log('[Autoplay] Prompts ready, triggering image generation for', promptsToUse.length, 'prompts (of', newPrompts.length, 'available)');
                generateImagesFromPrompts(promptsToUse.map(p => ({ id: p.id, prompt: p.prompt })));
              },
            });
          }
          break;
        }

        case 'evaluating': {
          // Get completed images for evaluation — scoped to current iteration's prompts
          const activeIds = activePromptIdsRef.current;
          const completedImages = generatedImages.filter(
            img => img.status === 'complete' && img.url && (activeIds.size === 0 || activeIds.has(img.promptId))
          );

          if (completedImages.length === 0) {
            // No images to evaluate at all - this is an error state
            logEvent('error', 'No images to evaluate');
            autoplay.setError('No images to evaluate');
            return;
          }

          logEvent('image_complete', `${completedImages.length} images generated, evaluating...`);

          // Build evaluation criteria from current state
          // Use vision sentence as the core project identity for evaluation, falling back to baseImage
          const criteria: EvaluationCriteria = {
            originalPrompt: visionSentence || baseImage,
            expectedAspects: dimensions
              .filter(d => d.reference.trim())
              .map(d => `${d.label}: ${d.reference}`),
            outputMode: outputMode,
            approvalThreshold: 70,
            // Include breakdown context if available (from Smart Breakdown)
            breakdown: breakdown ? {
              format: breakdown.baseImage.format,
              keyElements: breakdown.baseImage.keyElements,
            } : undefined,
          };

          // Store criteria for polish phase
          evaluationCriteriaRef.current = criteria;

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
            logEvent('error', `Evaluation failed: ${evalError instanceof Error ? evalError.message : 'Unknown error'}`);
            evaluations = completedImages.map(img => ({
              promptId: img.promptId,
              approved: false,
              score: 0,
              feedback: `Evaluation error: ${evalError instanceof Error ? evalError.message : 'Unknown error'}. Retry in next iteration.`,
              improvements: ['Retry evaluation'],
              strengths: [],
            }));
          }

          // Identify polish candidates: rescue (50-69) AND excellence (70-89)
          const polishCandidates: NonNullable<AutoplayIteration['polishCandidates']> = [];

          // Log individual evaluation results and identify polish candidates
          for (const evaluation of evaluations) {
            if (evaluation.approved) {
              logEvent('image_approved', `Image approved (score: ${evaluation.score})`, {
                promptId: evaluation.promptId,
                score: evaluation.score,
                approved: true,
              });

              // Check for excellence polish (approved images scoring 70-89)
              const polishAttempts = polishAttemptsRef.current.get(evaluation.promptId) || 0;
              if (polishAttempts < DEFAULT_POLISH_CONFIG.maxPolishAttempts) {
                const decision = decidePolishAction(
                  evaluation,
                  DEFAULT_POLISH_CONFIG,
                  outputMode,
                  70 // approval threshold
                );

                if (decision.action === 'polish' && decision.polishPrompt) {
                  const image = completedImages.find(img => img.promptId === evaluation.promptId);
                  if (image?.url) {
                    polishCandidates.push({
                      promptId: evaluation.promptId,
                      imageUrl: image.url,
                      originalScore: evaluation.score,
                      polishPrompt: decision.polishPrompt,
                    });
                    logEvent('polish_started', `Queued for excellence polish (score: ${evaluation.score})`, {
                      promptId: evaluation.promptId,
                      score: evaluation.score,
                    });
                  }
                }
              }
            } else {
              logEvent('image_rejected', `Image rejected (score: ${evaluation.score}): ${evaluation.feedback?.slice(0, 80) || 'No feedback'}`, {
                promptId: evaluation.promptId,
                score: evaluation.score,
                approved: false,
                feedback: evaluation.feedback,
              });

              // Check if this is a polish candidate
              const polishAttempts = polishAttemptsRef.current.get(evaluation.promptId) || 0;
              if (polishAttempts < DEFAULT_POLISH_CONFIG.maxPolishAttempts) {
                const decision = decidePolishAction(
                  evaluation,
                  DEFAULT_POLISH_CONFIG,
                  outputMode,
                  70 // approval threshold
                );

                if (decision.action === 'polish' && decision.polishPrompt) {
                  const image = completedImages.find(img => img.promptId === evaluation.promptId);
                  if (image?.url) {
                    polishCandidates.push({
                      promptId: evaluation.promptId,
                      imageUrl: image.url,
                      originalScore: evaluation.score,
                      polishPrompt: decision.polishPrompt,
                    });
                    logEvent('polish_started', `Queued for polish (score: ${evaluation.score})`, {
                      promptId: evaluation.promptId,
                      score: evaluation.score,
                    });
                  }
                }
              }
            }
          }

          // Signal evaluation complete with polish candidates
          autoplay.onEvaluationComplete(
            evaluations.map(e => ({
              promptId: e.promptId,
              approved: e.approved,
              feedback: e.feedback,
              score: e.score,
              improvements: e.improvements,
              strengths: e.strengths,
            })),
            polishCandidates.length > 0 ? polishCandidates : undefined
          );
          break;
        }

        case 'polishing': {
          // Get current iteration's polish candidates
          const currentIter = autoplay.currentIteration;
          if (!currentIter?.polishCandidates || currentIter.polishCandidates.length === 0) {
            // No candidates, skip to refining
            autoplay.onPolishComplete([]);
            return;
          }

          const criteria = evaluationCriteriaRef.current;
          if (!criteria) {
            logEvent('error', 'No evaluation criteria available for polish');
            autoplay.onPolishComplete([]);
            return;
          }

          logEvent('polish_started', `Starting polish for ${currentIter.polishCandidates.length} image(s)`);

          const polishResults: NonNullable<AutoplayIteration['polishResults']> = [];

          for (const candidate of currentIter.polishCandidates) {
            // Track polish attempt
            const currentAttempts = polishAttemptsRef.current.get(candidate.promptId) || 0;
            polishAttemptsRef.current.set(candidate.promptId, currentAttempts + 1);

            try {
              const request: PolishRequest = {
                imageUrl: candidate.imageUrl,
                promptId: candidate.promptId,
                polishPrompt: candidate.polishPrompt,
                criteria,
                aspectRatio: '16:9',
                polishType: candidate.originalScore >= 70 ? 'excellence' : 'rescue',
                minScoreImprovement: DEFAULT_POLISH_CONFIG.minScoreImprovement,
                originalScore: candidate.originalScore,
              };

              const result = await polishImageWithTimeout(
                request,
                DEFAULT_POLISH_CONFIG.polishTimeoutMs,
                autoplay.abortController?.signal
              );

              if (result.improved && result.polishedUrl && result.reEvaluation) {
                logEvent('image_polished', `Polish improved score: ${candidate.originalScore} → ${result.reEvaluation.score}`, {
                  promptId: candidate.promptId,
                  score: result.reEvaluation.score,
                  approved: result.reEvaluation.approved,
                });

                polishResults.push({
                  promptId: candidate.promptId,
                  improved: true,
                  newScore: result.reEvaluation.score,
                  polishedUrl: result.polishedUrl,
                });

                // Update the generated image URL with polished version
                // so saveImageToPanel (in refining phase) saves the polished image
                updateGeneratedImageUrl(candidate.promptId, result.polishedUrl);
              } else {
                logEvent('polish_no_improvement', `Polish did not improve (delta: ${result.scoreDelta ?? 0})`, {
                  promptId: candidate.promptId,
                  score: candidate.originalScore,
                });

                polishResults.push({
                  promptId: candidate.promptId,
                  improved: false,
                  newScore: result.reEvaluation?.score,
                });
              }
            } catch (error) {
              console.error('[Autoplay] Polish error for', candidate.promptId, error);
              logEvent('error', `Polish failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
                promptId: candidate.promptId,
              });

              polishResults.push({
                promptId: candidate.promptId,
                improved: false,
              });
            }
          }

          // Signal polish complete
          autoplay.onPolishComplete(polishResults);
          break;
        }

        case 'refining': {
          // Get current iteration's evaluations
          const currentIter = autoplay.currentIteration;
          if (!currentIter) return;

          const evaluations = currentIter.evaluations;

          // Save approved images - ranked by score, limited to remaining target
          const approvedEvals = evaluations.filter(e => e.approved);

          // Sort by score descending (best images first)
          const sortedApproved = [...approvedEvals].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

          // Limit to remaining target to prevent over-saving
          const remainingTarget = autoplay.state.config.targetSavedCount - autoplay.state.totalSaved;
          const toSave = sortedApproved.slice(0, Math.max(1, remainingTarget));

          let savedCount = 0;

          // Use ref to get current prompts (avoids stale closure issues)
          const currentPrompts = generatedPromptsRef.current;

          for (const eval_ of toSave) {
            // Find the prompt text for this promptId
            const prompt = currentPrompts.find(p => p.id === eval_.promptId);
            if (prompt) {
              const saved = saveImageToPanel(eval_.promptId, prompt.prompt);
              if (saved) {
                savedCount++;
              }
            }
          }

          // Signal images saved
          if (savedCount > 0) {
            autoplay.onImagesSaved(savedCount);
          }

          // Extract and apply refinement feedback from rejected images
          // Use stored improvements/strengths from evaluation phase
          const fullEvaluations: ImageEvaluation[] = evaluations.map(e => ({
            promptId: e.promptId,
            approved: e.approved,
            score: e.score ?? 0,
            feedback: e.feedback ?? '',
            improvements: e.improvements ?? [],
            strengths: e.strengths ?? [],
          }));

          const refinementFeedback = extractRefinementFeedback(fullEvaluations);

          // Build cumulative iteration context from evaluation insights
          // This gives Claude a growing history of what worked/failed across iterations
          const iterationNum = autoplay.state.currentIteration;
          const sortedByScore = [...fullEvaluations].sort((a, b) => b.score - a.score);
          const bestEval = sortedByScore[0];
          const insights: string[] = [];

          if (bestEval?.strengths?.length) {
            insights.push(`Strengths: ${bestEval.strengths.slice(0, 2).join(', ')}`);
          }
          if (bestEval?.score) {
            insights.push(`top score ${bestEval.score}/100`);
          }
          const rejectedInsights = fullEvaluations
            .filter(e => !e.approved && e.feedback)
            .map(e => e.feedback)
            .slice(0, 2);
          if (rejectedInsights.length) {
            insights.push(`Fix: ${rejectedInsights.join('; ').slice(0, 120)}`);
          }

          if (insights.length > 0) {
            const entry = `[Iter ${iterationNum}] ${insights.join('. ')}`;
            refinementBriefRef.current = refinementBriefRef.current
              ? `${refinementBriefRef.current}\n${entry}`
              : entry;
          }

          // Evolve baseImage text with evaluation insights so prompt generation
          // anchors on a progressively refined description instead of the static original
          const allStrengths = fullEvaluations.flatMap(e => e.strengths).filter(Boolean);
          const allImprovements = fullEvaluations
            .filter(e => !e.approved)
            .flatMap(e => e.improvements)
            .filter(Boolean);
          const uniqueStrengths = [...new Set(allStrengths)].slice(0, 3);
          const uniqueImprovements = [...new Set(allImprovements)].slice(0, 3);

          const directives: string[] = [];
          if (uniqueStrengths.length > 0) {
            directives.push(`emphasize ${uniqueStrengths.join(', ')}`);
          }
          if (uniqueImprovements.length > 0) {
            directives.push(`improve ${uniqueImprovements.join(', ')}`);
          }
          if (directives.length > 0) {
            // Cap evolution: keep original baseImage + only last 2 rounds of directives.
            // This prevents the string from becoming an unparseable mess after many iterations.
            const newDirective = directives.join('; ');
            const currentEvolved = evolvedBaseImageRef.current || '';
            const parts = currentEvolved.split(' — ').filter(Boolean);
            // parts[0] is original baseImage (or empty), rest are directive rounds
            const originalBase = parts.length > 0 ? parts[0] : baseImage;
            const existingDirectives = parts.slice(1);
            // Keep only last directive round + the new one (max 2 rounds)
            const keptDirectives = existingDirectives.length > 0
              ? [existingDirectives[existingDirectives.length - 1], newDirective]
              : [newDirective];
            evolvedBaseImageRef.current = `${originalBase} — ${keptDirectives.join(' — ')}`;
            logEvent('feedback_applied', `Base image evolved: ...${newDirective.slice(0, 60)}`);
          }

          // Keep feedback clean: PRESERVE = strengths, CHANGE = targeted issues
          // Iteration history goes through a separate iterationContext channel
          const cleanFeedback = {
            positive: refinementFeedback.positive,
            negative: refinementFeedback.negative,
          };

          // Store feedback in ref for next iteration (avoids React state timing issues)
          // Also apply to state for UI display, but the ref is what we'll actually use
          if (cleanFeedback.positive || cleanFeedback.negative) {
            pendingFeedbackRef.current = cleanFeedback;
            setFeedback(cleanFeedback);
            logEvent('feedback_applied', `Feedback: ${cleanFeedback.negative.slice(0, 80) || cleanFeedback.positive.slice(0, 80)}`, {
              feedback: cleanFeedback.negative || cleanFeedback.positive,
            });
          }

          autoplay.onRefineComplete();

          // Small delay before completing iteration (allows state to settle)
          await new Promise(resolve => setTimeout(resolve, 100));

          logEvent('iteration_complete', `Iteration ${autoplay.state.currentIteration} complete (${savedCount} saved)`);
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
    visionSentence,
    breakdown,
    dimensions,
    outputMode,
    saveImageToPanel,
    setFeedback,
    onRegeneratePrompts,
    logEvent,
  ]);

  /**
   * Effect: Backup trigger for image generation when prompts are ready during autoplay
   * Primary path is now the onPromptsReady callback in handleGenerate.
   * This effect serves as a safety net for edge cases (e.g., manual state changes).
   * Since useImageEffects is disabled during autoplay, the orchestrator must trigger generation
   * NOTE: generatedPrompts is in deps to re-run when fallback prompts are set after API error
   */
  useEffect(() => {
    if (autoplay.state.status !== 'generating') return;
    if (isGeneratingImages) return; // Already generating
    if (regeneratingRef.current) return; // Main path is regenerating prompts, don't interfere

    // Use ref to get current prompts (fresh, not from closure)
    const currentPrompts = generatedPromptsRef.current;
    if (currentPrompts.length === 0) return; // No prompts yet

    // Check if we have images for these prompts already (don't re-trigger)
    const promptIds = new Set(currentPrompts.map(p => p.id));
    const hasImagesForPrompts = generatedImages.some(img => promptIds.has(img.promptId));
    if (hasImagesForPrompts) return; // Already have images for these prompts

    // Apply maxPromptsPerIteration limit (sequential mode uses 1)
    const limit = deps.maxPromptsPerIteration;
    const promptsToUse = limit ? currentPrompts.slice(0, limit) : currentPrompts;
    // Track which prompt IDs belong to THIS iteration
    activePromptIdsRef.current = new Set(promptsToUse.map(p => p.id));
    console.log('[Autoplay] Backup trigger: generating images for', promptsToUse.length, 'prompts');

    // Trigger image generation
    generateImagesFromPrompts(
      promptsToUse.map(p => ({
        id: p.id,
        prompt: p.prompt,
      }))
    );
  }, [autoplay.state.status, isGeneratingImages, generatedImages, generateImagesFromPrompts, generatedPrompts]);

  /**
   * Effect: Watch for generation completion
   * Only transitions when ALL images are in a terminal state (complete or failed).
   */
  useEffect(() => {
    if (autoplay.state.status !== 'generating') return;
    if (isGeneratingImages) return; // Still generating
    if (regeneratingRef.current) return; // Prompts being regenerated, old images are stale

    // Only consider images belonging to the CURRENT iteration's prompts.
    // Without this filter, stale images from a previous phase (e.g. sketch)
    // would trigger completion immediately when a new phase (e.g. gameplay) starts.
    const activeIds = activePromptIdsRef.current;
    if (activeIds.size === 0) return; // No active prompts registered yet

    const relevantImages = generatedImages.filter(img => activeIds.has(img.promptId));
    if (relevantImages.length === 0) return; // No images for current prompts yet

    // Ensure ALL relevant images are in a terminal state before transitioning
    const pendingImages = relevantImages.filter(
      img => img.status === 'pending' || img.status === 'generating'
    );
    if (pendingImages.length > 0) return; // Some images still in progress

    // All current-iteration images done - check results
    const completedImages = relevantImages.filter(
      img => img.status === 'complete' && img.url
    );

    if (completedImages.length > 0) {
      const promptIds = completedImages.map(img => img.promptId);
      autoplay.onGenerationComplete(promptIds);
    } else {
      // All generations failed
      logEvent('image_failed', 'All image generations failed');
      autoplay.setError('All image generations failed');
    }
  }, [autoplay, isGeneratingImages, generatedImages, logEvent]);

  /**
   * Effect: Clear regenerating flag when we leave the generating status.
   * Safety net: if onPromptsReady never fires (API error, abort), this prevents
   * the orchestrator from getting stuck with regeneratingRef=true forever.
   */
  useEffect(() => {
    if (autoplay.state.status !== 'generating') {
      regeneratingRef.current = false;
    }
  }, [autoplay.state.status]);

  /**
   * Effect: Timeout safety net - abort if stuck in generating for too long
   *
   * IMPORTANT: Deps are intentionally status + iteration ONLY (no `autoplay` object).
   * The `autoplay` object is non-memoized and changes every render, which would cause
   * the timer to reset on every render. During Leonardo polling (2s intervals), 'pending'
   * responses don't call setGeneratedImages → no re-renders → timer would accumulate
   * 60-120s silently. With `autoplay` in deps, the timer accidentally depended on
   * re-render frequency instead of actual time-in-state.
   *
   * Uses refs for callbacks so they're always fresh without being in the deps array.
   */
  const setErrorRef = useRef(autoplay.setError);
  setErrorRef.current = autoplay.setError;
  const logEventRef = useRef(logEvent);
  logEventRef.current = logEvent;

  useEffect(() => {
    if (autoplay.state.status !== 'generating') return;

    // 240s covers: Claude API (30s) + Leonardo generation (120s) + evaluation/polish overhead
    const TIMEOUT_MS = 240000;
    const timeoutId = setTimeout(() => {
      console.error('[Autoplay] Timeout: stuck in generating state for', TIMEOUT_MS / 1000, 'seconds');
      logEventRef.current('timeout', `Generation timed out after ${TIMEOUT_MS / 1000} seconds`);
      setErrorRef.current('Generation timed out - please try again');
    }, TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [autoplay.state.status, autoplay.state.currentIteration]);

  /**
   * Start autoplay - validates prerequisites and kicks off the loop
   *
   * Prerequisites:
   * - Either generated prompts exist OR base image exists (prompts will be generated)
   * - Output mode is not 'poster' (poster mode not supported)
   */
  const startAutoplay = useCallback((config: AutoplayConfig) => {
    // Validate output mode (poster not supported)
    if (outputMode === 'poster') {
      console.error('Cannot start autoplay: poster mode not supported');
      return;
    }

    // Validate we have something to work with (base image for prompt generation)
    if (!baseImage && generatedPrompts.length === 0) {
      console.error('Cannot start autoplay: no base image or generated prompts');
      return;
    }

    // Reset ALL tracking refs for new session — critical when orchestrator
    // is reused across phases (e.g. sketch → gameplay in multi-phase)
    processedStateRef.current = '';
    currentIterationRef.current = 0;
    polishAttemptsRef.current = new Map();
    evaluationCriteriaRef.current = null;
    activePromptIdsRef.current = new Set();
    refinementBriefRef.current = '';
    evolvedBaseImageRef.current = '';

    // Set regenerating flag IMMEDIATELY (synchronously) to prevent the completion
    // detector effect from firing on stale images before the async runEffect sets it.
    // The main effect's async runEffect will call onRegeneratePrompts which clears it
    // in the onPromptsReady callback.
    regeneratingRef.current = true;

    autoplay.start(config);
  }, [autoplay, generatedPrompts, outputMode, baseImage]);

  // Compute why autoplay can't start (for UI feedback)
  const canStartReason = (() => {
    if (!autoplay.canStart) {
      // State machine says no (currently running or in a non-startable state)
      return 'Autoplay is currently running';
    }
    if (outputMode === 'poster') {
      return 'Autoplay not available in Poster mode';
    }
    if (!baseImage && generatedPrompts.length === 0) {
      return 'Add a base image to start autoplay';
    }
    return null; // Can start
  })();

  // Combine state machine canStart with orchestrator-level checks
  const effectiveCanStart = autoplay.canStart && outputMode !== 'poster' && (!!baseImage || generatedPrompts.length > 0);

  return {
    // State
    isRunning: autoplay.isRunning,
    canStart: effectiveCanStart,
    canStartReason,
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
