/**
 * useMultiPhaseAutoplay - Multi-phase autoplay orchestration
 *
 * Manages the complete autoplay flow across multiple phases:
 * 1. Concept Phase: Generate concept art images
 * 2. Gameplay Phase: Generate gameplay screenshots
 * 3. Poster Phase: (Optional) Generate and auto-select poster
 * 4. HUD Phase: (Optional) Apply HUD overlays to gameplay images
 *
 * This hook coordinates the existing single-mode autoplay orchestrator
 * across multiple phases with different output modes.
 */

'use client';

import { useReducer, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ExtendedAutoplayConfig,
  AutoplayPhase,
  MultiPhaseAutoplayState,
  MultiPhaseAutoplayAction,
  PhaseProgress,
  OutputMode,
  Dimension,
  GeneratedPrompt,
  GeneratedImage,
  PosterSelectionCriteria,
  SmartBreakdownPersisted,
  AutoplayEventType,
  AutoplayLogEntry,
} from '../types';
import { useAutoplayOrchestrator, AutoplayOrchestratorDeps } from './useAutoplayOrchestrator';
import { useAutoHudGeneration } from './useAutoHudGeneration';
import { selectBestPoster, fallbackPosterSelection } from '../subfeature_brain/lib/posterEvaluator';
import { PosterGeneration } from './usePoster';
import { useIntelligentOrchestratorDeps, createIntelligentConfig } from './useIntelligentOrchestratorDeps';

// Default configuration
const DEFAULT_CONFIG: ExtendedAutoplayConfig = {
  sketchCount: 2,
  gameplayCount: 2,
  posterEnabled: false,
  hudEnabled: false,
  maxIterationsPerImage: 2,
};

// Initial state factory
function createInitialState(): MultiPhaseAutoplayState {
  return {
    phase: 'idle',
    config: DEFAULT_CONFIG,
    sketchProgress: { saved: 0, target: 0 },
    gameplayProgress: { saved: 0, target: 0 },
    posterSelected: false,
    hudGenerated: 0,
  };
}

/**
 * Multi-phase autoplay reducer
 */
function multiPhaseReducer(
  state: MultiPhaseAutoplayState,
  action: MultiPhaseAutoplayAction
): MultiPhaseAutoplayState {
  switch (action.type) {
    case 'START': {
      return {
        ...createInitialState(),
        phase: action.config.sketchCount > 0 ? 'sketch' : 'gameplay',
        config: action.config,
        sketchProgress: { saved: 0, target: action.config.sketchCount },
        gameplayProgress: { saved: 0, target: action.config.gameplayCount },
      };
    }

    case 'IMAGE_SAVED': {
      if (action.phase === 'sketch') {
        const newProgress = {
          ...state.sketchProgress,
          saved: state.sketchProgress.saved + 1,
        };
        return { ...state, sketchProgress: newProgress };
      } else {
        const newProgress = {
          ...state.gameplayProgress,
          saved: state.gameplayProgress.saved + 1,
        };
        return { ...state, gameplayProgress: newProgress };
      }
    }

    case 'PHASE_COMPLETE': {
      // Phase completed, but don't advance yet - ADVANCE_PHASE does that
      return state;
    }

    case 'ADVANCE_PHASE': {
      const { phase, config, sketchProgress, gameplayProgress } = state;

      // Determine next phase based on current phase and config
      if (phase === 'sketch') {
        // Move to gameplay if there are gameplay images to generate
        if (config.gameplayCount > 0) {
          return { ...state, phase: 'gameplay' };
        }
        // Skip to poster if enabled
        if (config.posterEnabled) {
          return { ...state, phase: 'poster' };
        }
        // Complete
        return { ...state, phase: 'complete' };
      }

      if (phase === 'gameplay') {
        // Move to poster if enabled
        if (config.posterEnabled) {
          return { ...state, phase: 'poster' };
        }
        // Move to HUD if enabled and we have gameplay images
        if (config.hudEnabled && gameplayProgress.saved > 0) {
          return { ...state, phase: 'hud' };
        }
        // Complete
        return { ...state, phase: 'complete' };
      }

      if (phase === 'poster') {
        // Move to HUD if enabled and we have gameplay images
        if (config.hudEnabled && gameplayProgress.saved > 0) {
          return { ...state, phase: 'hud' };
        }
        // Complete
        return { ...state, phase: 'complete' };
      }

      if (phase === 'hud') {
        return { ...state, phase: 'complete' };
      }

      return state;
    }

    case 'POSTER_SELECTED': {
      return { ...state, posterSelected: true };
    }

    case 'HUD_GENERATED': {
      return { ...state, hudGenerated: state.hudGenerated + 1 };
    }

    case 'ERROR': {
      return { ...state, phase: 'error', error: action.error, errorPhase: action.phase || state.phase };
    }

    case 'ABORT': {
      return { ...state, phase: 'complete' };
    }

    case 'RETRY': {
      // Retry from the phase that errored, preserving all progress
      const retryPhase = state.errorPhase || 'gameplay';
      return { ...state, phase: retryPhase, error: undefined, errorPhase: undefined };
    }

    case 'RESET': {
      return createInitialState();
    }

    default:
      return state;
  }
}

export interface MultiPhaseAutoplayDeps {
  // From useImageGeneration
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  generateImagesFromPrompts: (prompts: Array<{ id: string; prompt: string }>) => Promise<void>;
  saveImageToPanel: (promptId: string, promptText: string) => boolean;
  /** Update a generated image's URL in-memory (for polish: replace original with polished) */
  updateGeneratedImageUrl: (promptId: string, newUrl: string) => void;
  leftPanelSlots: Array<{ image: { url: string } | null }>;
  rightPanelSlots: Array<{ image: { url: string } | null }>;
  /** Rebuild save tracking refs from actual slot state — call before new sessions */
  resetSaveTracking: () => void;

  // From useBrain
  setFeedback: (feedback: { positive: string; negative: string }) => void;
  setOutputMode: (mode: OutputMode) => void;
  baseImage: string;
  visionSentence: string | null;
  breakdown: SmartBreakdownPersisted | null;

  // From prompts/dimensions
  generatedPrompts: GeneratedPrompt[];
  dimensions: Dimension[];
  outputMode: OutputMode;

  // From usePoster
  generatePosters: (projectId: string, projectName: string, dimensions: Dimension[], basePrompt: string) => Promise<void>;
  posterGenerations: PosterGeneration[];
  selectPoster: (index: number) => void;
  savePoster: () => Promise<void>;
  isGeneratingPoster: boolean;
  /** Existing saved poster from DB — skip generation if already present */
  existingPoster: { id: string; imageUrl: string } | null;

  // Project context
  currentProjectId: string | null;
  currentProjectName: string;

  // Generation trigger
  onRegeneratePrompts: (overrides?: { baseImage?: string; feedback?: { positive: string; negative: string } }) => void;

  // Clear prompt history on autoplay start (optional)
  clearHistory?: () => void;

  // Event logging callback (optional)
  onLogEvent?: (
    type: AutoplayEventType,
    message: string,
    details?: AutoplayLogEntry['details']
  ) => void;
}

export interface UseMultiPhaseAutoplayReturn {
  // State
  phase: AutoplayPhase;
  isRunning: boolean;
  canStart: boolean;
  canStartReason: string | null;
  /** Whether we have content ready (baseImage or prompts) - used by modal for validation */
  hasContent: boolean;
  sketchProgress: PhaseProgress;
  gameplayProgress: PhaseProgress;
  posterSelected: boolean;
  hudGenerated: number;
  error?: string;

  // For compatibility with AutoplayControls
  status: string;
  currentIteration: number;
  maxIterations: number;
  totalSaved: number;
  targetSaved: number;
  completionReason: string | null;

  /** Phase that errored (for retry) */
  errorPhase?: AutoplayPhase;

  // Step-level tracking (for sequential UI)
  /** Which image number within the current phase (1-indexed) */
  currentImageInPhase?: number;
  /** Total target for current phase */
  phaseTarget?: number;
  /** Single-phase orchestrator status (generating/evaluating/polishing/refining) */
  singlePhaseStatus?: string;

  // Actions
  startMultiPhase: (config: ExtendedAutoplayConfig) => void;
  abort: () => void;
  reset: () => void;
  /** Retry from the phase that errored, preserving all progress */
  retry: () => void;
}

export function useMultiPhaseAutoplay(
  deps: MultiPhaseAutoplayDeps
): UseMultiPhaseAutoplayReturn {
  const {
    generatedImages,
    isGeneratingImages,
    generateImagesFromPrompts,
    saveImageToPanel,
    updateGeneratedImageUrl,
    leftPanelSlots,
    rightPanelSlots,
    resetSaveTracking,
    setFeedback,
    setOutputMode,
    baseImage,
    visionSentence,
    breakdown,
    generatedPrompts,
    dimensions,
    outputMode,
    generatePosters,
    posterGenerations,
    selectPoster,
    savePoster,
    isGeneratingPoster,
    existingPoster,
    currentProjectId,
    currentProjectName,
    onRegeneratePrompts,
    clearHistory,
    onLogEvent,
  } = deps;

  const [state, dispatch] = useReducer(multiPhaseReducer, undefined, createInitialState);

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

  // Track phase-specific state
  const phaseOrchestratorActiveRef = useRef(false);
  const currentPhaseRef = useRef<AutoplayPhase>('idle');
  const savedImagesThisPhaseRef = useRef(0);

  // Get game UI dimension for HUD generation
  const gameUIDimension = dimensions.find(d => d.type === 'gameUI')?.reference;
  const hudGenerator = useAutoHudGeneration({ gameUIDimension });

  // Create base orchestrator deps that change based on current phase
  const baseOrchestratorDeps: AutoplayOrchestratorDeps = useMemo(() => ({
    generatedImages,
    isGeneratingImages,
    generateImagesFromPrompts,
    saveImageToPanel: (promptId: string, promptText: string): boolean => {
      const saved = saveImageToPanel(promptId, promptText);
      if (!saved) {
        console.log('[MultiPhase] saveImageToPanel returned false, skipping count increment for', promptId);
        return false;
      }
      // Track save for current phase — only when actually saved
      const currentPhase = currentPhaseRef.current;
      if (currentPhase === 'sketch' || currentPhase === 'gameplay') {
        savedImagesThisPhaseRef.current++;
        dispatch({ type: 'IMAGE_SAVED', phase: currentPhase });
        // Find the image URL from generatedImages for the completion gallery
        const savedImage = generatedImages.find(img => img.promptId === promptId);
        // Log the save event with URL and prompt for CompletionSummary gallery
        logEvent('image_saved', `Image saved (${currentPhase})`, {
          phase: currentPhase,
          promptId,
          imageUrl: savedImage?.url || undefined,
          promptText: promptText || undefined,
        });
      }
      return true;
    },
    updateGeneratedImageUrl,
    setFeedback,
    generatedPrompts,
    outputMode,
    dimensions,
    baseImage,
    visionSentence,
    breakdown,
    onRegeneratePrompts,
    onLogEvent: logEvent,
  }), [
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
    logEvent,
  ]);

  // Calculate target count for intelligent features
  const targetCount = state.config.sketchCount + state.config.gameplayCount;

  // Wrap deps with intelligent features (diversity director + prompt evolution)
  const intelligentConfig = useMemo(() => createIntelligentConfig(
    targetCount,
    { diversityEnabled: true, evolutionEnabled: true }
  ), [targetCount]);

  const intelligentDeps = useIntelligentOrchestratorDeps(baseOrchestratorDeps, intelligentConfig);

  // ACTUALLY USE the orchestrator for image generation (with intelligent enhancements)
  const singlePhaseOrchestrator = useAutoplayOrchestrator(intelligentDeps);

  // Derived state
  const isRunning = state.phase !== 'idle' && state.phase !== 'complete' && state.phase !== 'error';
  const canStart = state.phase === 'idle' || state.phase === 'complete' || state.phase === 'error';

  // Compute canStartReason - only require project, modal handles content validation
  const canStartReason = useMemo(() => {
    if (!canStart) return 'Multi-phase autoplay is currently running';
    if (!currentProjectId) return 'Create a project first';
    return null;
  }, [canStart, currentProjectId]);

  // Separate flag for whether we have content ready (used by modal for validation)
  const hasContent = Boolean(baseImage || generatedPrompts.length > 0);

  // Total images saved across all phases
  const totalSaved = state.sketchProgress.saved + state.gameplayProgress.saved;
  const targetSaved = state.config.sketchCount + state.config.gameplayCount;

  // Completion reason for compatibility
  const completionReason = useMemo(() => {
    if (state.phase !== 'complete') return null;
    if (state.error) return 'error';
    if (totalSaved >= targetSaved) return 'target_met';
    return 'max_iterations';
  }, [state.phase, state.error, totalSaved, targetSaved]);

  /**
   * Start multi-phase autoplay
   * If promptIdea is provided and no baseImage exists, the modal should have
   * already triggered SmartBreakdown before calling this
   */
  const startMultiPhase = useCallback((config: ExtendedAutoplayConfig) => {
    if (!canStart) {
      console.error('[MultiPhase] Cannot start: already running');
      return;
    }

    // At this point we expect either baseImage exists OR the modal has populated it via SmartBreakdown
    if (!baseImage && generatedPrompts.length === 0 && !config.promptIdea) {
      console.error('[MultiPhase] Cannot start: no base image or prompt idea');
      return;
    }

    console.log('[MultiPhase] Starting with config:', config);

    // Clear prompt history so undo starts fresh for this autoplay run
    clearHistory?.();

    // Reset save tracking to clear stale entries from previous sessions
    resetSaveTracking();

    // Set output mode based on first phase
    const firstPhase = config.sketchCount > 0 ? 'sketch' : 'gameplay';
    setOutputMode(firstPhase === 'sketch' ? 'sketch' : 'gameplay');

    // Log start event
    logEvent('phase_started', `Starting autoplay: ${firstPhase} phase`, {
      phase: firstPhase,
    });

    dispatch({ type: 'START', config });
  }, [canStart, baseImage, generatedPrompts, setOutputMode, resetSaveTracking]);

  /**
   * Abort autoplay
   */
  const abort = useCallback(() => {
    // Stop single-phase orchestrator first to prevent background generation
    singlePhaseOrchestrator.abortAutoplay();
    hudGenerator.abort();
    dispatch({ type: 'ABORT' });
  }, [singlePhaseOrchestrator, hudGenerator]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    hudGenerator.reset();
    dispatch({ type: 'RESET' });
  }, [hudGenerator]);

  /**
   * Retry from the errored phase, preserving progress
   */
  const retry = useCallback(() => {
    if (state.phase !== 'error') return;
    logEvent('phase_started', `Retrying from ${state.errorPhase || 'last'} phase`);
    dispatch({ type: 'RETRY' });
  }, [state.phase, state.errorPhase, logEvent]);

  /**
   * Effect: Handle phase transitions
   */
  useEffect(() => {
    const { phase, config, sketchProgress, gameplayProgress } = state;

    // Skip if not running
    if (phase === 'idle' || phase === 'complete' || phase === 'error') {
      currentPhaseRef.current = phase;
      return;
    }

    // Detect phase change
    if (currentPhaseRef.current !== phase) {
      const previousPhase = currentPhaseRef.current;
      console.log('[MultiPhase] Phase changed:', previousPhase, '->', phase);

      // Log phase completion for previous phase
      if (previousPhase !== 'idle') {
        logEvent('phase_completed', `${previousPhase} phase completed`, {
          phase: previousPhase,
        });
      }

      // Log new phase start
      logEvent('phase_started', `Starting ${phase} phase`, {
        phase: phase,
      });

      currentPhaseRef.current = phase;
      savedImagesThisPhaseRef.current = 0;

      // Set appropriate output mode for the new phase
      if (phase === 'sketch') {
        setOutputMode('sketch');
      } else if (phase === 'gameplay') {
        setOutputMode('gameplay');
      }
    }

    // Phase advancement is handled exclusively by the completion detection effect
    // (single-phase orchestrator completes -> check progress -> ADVANCE_PHASE)
  }, [state, setOutputMode, logEvent]);

  /**
   * Effect: Delegate image generation phases to single-phase orchestrator
   * When multi-phase enters 'sketch' or 'gameplay', start the single-phase orchestrator
   * which handles the actual generate -> evaluate -> refine loop
   *
   * This effect re-runs when:
   * - Phase changes (new phase started)
   * - Progress updates (images saved)
   * - Orchestrator state changes (after reset, it becomes startable again)
   */
  useEffect(() => {
    const { phase, config, sketchProgress, gameplayProgress } = state;

    // Only delegate for image generation phases
    if (phase !== 'sketch' && phase !== 'gameplay') {
      return;
    }

    // Calculate remaining target for current phase
    const saved = phase === 'sketch' ? sketchProgress.saved : gameplayProgress.saved;
    const target = phase === 'sketch' ? config.sketchCount : config.gameplayCount;
    const remaining = target - saved;

    // If we've already met the target, don't start orchestrator
    // (the phase transition effect will handle advancing)
    if (remaining <= 0) {
      console.log(`[MultiPhase] ${phase} phase target already met (${saved}/${target})`);
      return;
    }

    // Only start if orchestrator is ready (not running, can start)
    if (!singlePhaseOrchestrator.isRunning && singlePhaseOrchestrator.canStart) {
      console.log(`[MultiPhase] Starting ${phase} phase generation (${saved}/${target}, need ${remaining} more)`);
      logEvent('phase_started', `Generating ${remaining} ${phase} image(s)`, { phase });

      singlePhaseOrchestrator.startAutoplay({
        targetSavedCount: remaining,
        maxIterations: config.maxIterationsPerImage,
      });
    }
  }, [state.phase, state.config, state.sketchProgress, state.gameplayProgress, singlePhaseOrchestrator, logEvent]);

  /**
   * Effect: Detect single-phase completion and handle appropriately
   *
   * Key logic:
   * - Only advance phase when target is MET (saved >= target)
   * - If max_iterations reached but target not met, restart orchestrator
   * - This ensures we keep trying until we have enough saved images
   */
  useEffect(() => {
    const { phase, config, sketchProgress, gameplayProgress } = state;

    if (phase !== 'sketch' && phase !== 'gameplay') {
      return;
    }

    // When single-phase orchestrator completes, check if we should advance or retry
    if (!singlePhaseOrchestrator.isRunning && singlePhaseOrchestrator.completionReason) {
      const completionReason = singlePhaseOrchestrator.completionReason;
      console.log(`[MultiPhase] Single-phase completed: ${completionReason}`);

      // Reset orchestrator first (so it can be reused)
      singlePhaseOrchestrator.resetAutoplay();

      // Check progress against target
      const progress = phase === 'sketch' ? sketchProgress : gameplayProgress;
      const target = phase === 'sketch' ? config.sketchCount : config.gameplayCount;

      if (progress.saved >= target) {
        // Target met - advance to next phase
        console.log(`[MultiPhase] Phase ${phase} target met (${progress.saved}/${target}), advancing`);
        dispatch({ type: 'ADVANCE_PHASE' });
      } else if (completionReason === 'error' || completionReason === 'aborted') {
        // Error or abort - stop the whole flow
        console.log(`[MultiPhase] Phase ${phase} ${completionReason}, stopping`);
        if (completionReason === 'error') {
          dispatch({ type: 'ERROR', error: singlePhaseOrchestrator.error || 'Single-phase error', phase });
        } else {
          dispatch({ type: 'ABORT' });
        }
      } else {
        // max_iterations reached but target not met - keep going
        // The next effect cycle will restart the orchestrator with remaining target
        console.log(`[MultiPhase] Phase ${phase} needs more images (${progress.saved}/${target}), will retry`);
        logEvent('iteration_complete', `Iteration complete, need ${target - progress.saved} more ${phase} images`);
      }
    }
  }, [state, singlePhaseOrchestrator.isRunning, singlePhaseOrchestrator.completionReason, singlePhaseOrchestrator.error, singlePhaseOrchestrator.resetAutoplay, logEvent]);

  /**
   * Effect: Handle poster phase
   */
  useEffect(() => {
    if (state.phase !== 'poster') return;
    if (state.posterSelected) {
      // Already selected, advance
      dispatch({ type: 'ADVANCE_PHASE' });
      return;
    }

    // Skip generation if a poster already exists in the database
    if (existingPoster?.imageUrl) {
      console.log('[MultiPhase] Poster already exists in DB, skipping generation');
      logEvent('poster_selected', 'Existing poster preserved (skipped generation)');
      dispatch({ type: 'POSTER_SELECTED' });
      return;
    }

    // Check if we have completed poster generations
    const completedPosters = posterGenerations.filter(p => p.status === 'complete' && p.imageUrl);
    const failedPosters = posterGenerations.filter(p => p.status === 'failed');

    if (isGeneratingPoster) {
      // Still generating, wait
      return;
    }

    if (completedPosters.length === 0 && posterGenerations.length === 0) {
      // No posters yet, start generation
      if (currentProjectId) {
        console.log('[MultiPhase] Starting poster generation');
        logEvent('poster_generating', 'Generating poster variations');
        generatePosters(currentProjectId, currentProjectName, dimensions, baseImage);
      } else {
        // No project ID - cannot generate posters, skip this phase
        console.error('[MultiPhase] No project ID for poster generation, skipping');
        dispatch({ type: 'ADVANCE_PHASE' });
      }
      return;
    }

    // Check if all poster generations failed
    if (posterGenerations.length > 0 && failedPosters.length === posterGenerations.length) {
      console.error('[MultiPhase] All poster generations failed, skipping poster phase');
      // Skip poster phase rather than error - posters are optional
      dispatch({ type: 'ADVANCE_PHASE' });
      return;
    }

    if (completedPosters.length > 0) {
      // Have completed posters, select best one
      const posterUrls = completedPosters.map(p => p.imageUrl!);

      console.log('[MultiPhase] Selecting best poster from', posterUrls.length, 'options');

      const criteria: PosterSelectionCriteria = {
        projectName: currentProjectName,
        projectVision: visionSentence || baseImage,
        themes: dimensions.filter(d => d.reference).map(d => `${d.label}: ${d.reference}`),
      };

      selectBestPoster(posterUrls, criteria)
        .then(result => {
          console.log('[MultiPhase] Poster selected:', result.selectedIndex, result.reasoning);
          logEvent('poster_selected', `Poster #${result.selectedIndex + 1} selected: ${result.reasoning.slice(0, 100)}`, {
            phase: 'poster',
            score: result.confidence,
          });
          selectPoster(result.selectedIndex);
          savePoster();
          dispatch({ type: 'POSTER_SELECTED' });
        })
        .catch(error => {
          console.error('[MultiPhase] Poster selection failed, using fallback:', error);
          logEvent('error', `Poster selection failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
          const fallback = fallbackPosterSelection(posterUrls);
          selectPoster(fallback.selectedIndex);
          savePoster();
          dispatch({ type: 'POSTER_SELECTED' });
        });
    }
  }, [
    state.phase,
    state.posterSelected,
    posterGenerations,
    isGeneratingPoster,
    existingPoster,
    currentProjectId,
    currentProjectName,
    dimensions,
    baseImage,
    visionSentence,
    generatePosters,
    selectPoster,
    savePoster,
    logEvent,
  ]);

  /**
   * Effect: Handle HUD phase
   */
  useEffect(() => {
    if (state.phase !== 'hud') return;
    if (hudGenerator.isGenerating) return;

    // Get saved gameplay images from panel
    const savedGameplayUrls: string[] = [];
    [...leftPanelSlots, ...rightPanelSlots].forEach(slot => {
      if (slot.image?.url) {
        savedGameplayUrls.push(slot.image.url);
      }
    });

    if (savedGameplayUrls.length === 0) {
      console.log('[MultiPhase] No gameplay images for HUD generation');
      dispatch({ type: 'ADVANCE_PHASE' });
      return;
    }

    if (hudGenerator.results.length === 0) {
      console.log('[MultiPhase] Starting HUD generation for', savedGameplayUrls.length, 'images');
      logEvent('hud_generating', `Generating HUD overlays for ${savedGameplayUrls.length} images`);
      hudGenerator.generateHudForImages(savedGameplayUrls)
        .then(results => {
          const successCount = results.filter(r => r.success).length;
          console.log('[MultiPhase] HUD generation complete:', successCount, '/', results.length, 'succeeded');
          logEvent('hud_complete', `HUD generation complete: ${successCount}/${results.length} succeeded`);
          for (let i = 0; i < successCount; i++) {
            dispatch({ type: 'HUD_GENERATED' });
          }
          dispatch({ type: 'ADVANCE_PHASE' });
        })
        .catch(error => {
          console.error('[MultiPhase] HUD generation failed:', error);
          logEvent('error', `HUD generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // HUD is optional, skip rather than error
          dispatch({ type: 'ADVANCE_PHASE' });
        });
    }
  }, [state.phase, hudGenerator, leftPanelSlots, rightPanelSlots, logEvent]);

  /**
   * Effect: Phase timeout safety - prevent getting stuck in any phase
   */
  useEffect(() => {
    const { phase } = state;

    // Only apply timeout to active phases, not idle/complete/error
    if (phase === 'idle' || phase === 'complete' || phase === 'error') {
      return;
    }

    // Phase timeout scales with target count (sequential mode: ~75s per image)
    // This is a safety net, not the normal exit path
    const { config } = state;
    const phaseTarget = phase === 'sketch' ? config.sketchCount
      : phase === 'gameplay' ? config.gameplayCount : 1;
    const PHASE_TIMEOUT_MS = Math.max(120000, 75000 * phaseTarget);
    const timeoutId = setTimeout(() => {
      console.error(`[MultiPhase] Phase '${phase}' timed out after ${PHASE_TIMEOUT_MS / 1000}s`);
      logEvent('timeout', `Phase '${phase}' timed out after ${Math.round(PHASE_TIMEOUT_MS / 1000)}s`, { phase });
      dispatch({ type: 'ERROR', error: `Phase '${phase}' timed out - please try again`, phase });
    }, PHASE_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [state.phase, state.config, logEvent]);

  return {
    // State
    phase: state.phase,
    isRunning,
    canStart: canStart && !canStartReason,
    canStartReason,
    hasContent,
    sketchProgress: state.sketchProgress,
    gameplayProgress: state.gameplayProgress,
    posterSelected: state.posterSelected,
    hudGenerated: state.hudGenerated,
    error: state.error,
    errorPhase: state.errorPhase,

    // For AutoplayControls compatibility
    status: state.phase,
    currentIteration: 1, // Multi-phase doesn't have iterations in the same way
    maxIterations: state.config.maxIterationsPerImage,
    totalSaved,
    targetSaved,
    completionReason,

    // Step-level tracking (sequential mode)
    currentImageInPhase: (state.phase === 'sketch' || state.phase === 'gameplay')
      ? (state.phase === 'sketch' ? state.sketchProgress.saved : state.gameplayProgress.saved) + 1
      : undefined,
    phaseTarget: state.phase === 'sketch'
      ? state.config.sketchCount
      : state.phase === 'gameplay' ? state.config.gameplayCount : undefined,
    singlePhaseStatus: singlePhaseOrchestrator.status,

    // Actions
    startMultiPhase,
    abort,
    reset,
    retry,
  };
}
