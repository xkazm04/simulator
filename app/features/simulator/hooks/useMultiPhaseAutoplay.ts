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
      return { ...state, phase: 'error', error: action.error };
    }

    case 'ABORT': {
      return { ...state, phase: 'complete' };
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
  saveImageToPanel: (promptId: string, promptText: string) => void;
  leftPanelSlots: Array<{ image: { url: string } | null }>;
  rightPanelSlots: Array<{ image: { url: string } | null }>;

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

  // Project context
  currentProjectId: string | null;
  currentProjectName: string;

  // Generation trigger
  onRegeneratePrompts: (overrides?: { feedback?: { positive: string; negative: string } }) => void;

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

  // Actions
  startMultiPhase: (config: ExtendedAutoplayConfig) => void;
  abort: () => void;
  reset: () => void;
}

export function useMultiPhaseAutoplay(
  deps: MultiPhaseAutoplayDeps
): UseMultiPhaseAutoplayReturn {
  const {
    generatedImages,
    isGeneratingImages,
    generateImagesFromPrompts,
    saveImageToPanel,
    leftPanelSlots,
    rightPanelSlots,
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
    currentProjectId,
    currentProjectName,
    onRegeneratePrompts,
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

  // Create orchestrator deps that change based on current phase
  const orchestratorDeps: AutoplayOrchestratorDeps = useMemo(() => ({
    generatedImages,
    isGeneratingImages,
    generateImagesFromPrompts,
    saveImageToPanel: (promptId: string, promptText: string) => {
      saveImageToPanel(promptId, promptText);
      // Track save for current phase
      const currentPhase = currentPhaseRef.current;
      if (currentPhase === 'sketch' || currentPhase === 'gameplay') {
        savedImagesThisPhaseRef.current++;
        dispatch({ type: 'IMAGE_SAVED', phase: currentPhase });
        // Log the save event
        logEvent('image_saved', `Image saved (${currentPhase})`, {
          phase: currentPhase,
          promptId,
        });
      }
    },
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

  // ACTUALLY USE the orchestrator for image generation
  const singlePhaseOrchestrator = useAutoplayOrchestrator(orchestratorDeps);

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

    // Set output mode based on first phase
    const firstPhase = config.sketchCount > 0 ? 'sketch' : 'gameplay';
    setOutputMode(firstPhase === 'sketch' ? 'sketch' : 'gameplay');

    // Log start event
    logEvent('phase_started', `Starting autoplay: ${firstPhase} phase`, {
      phase: firstPhase,
    });

    dispatch({ type: 'START', config });
  }, [canStart, baseImage, generatedPrompts, setOutputMode]);

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

    // Check if current image generation phase is complete
    if (phase === 'sketch') {
      if (sketchProgress.saved >= config.sketchCount) {
        console.log('[MultiPhase] Concept phase complete');
        dispatch({ type: 'ADVANCE_PHASE' });
      }
    } else if (phase === 'gameplay') {
      if (gameplayProgress.saved >= config.gameplayCount) {
        console.log('[MultiPhase] Gameplay phase complete');
        dispatch({ type: 'ADVANCE_PHASE' });
      }
    }
  }, [state, setOutputMode, logEvent]);

  /**
   * Effect: Delegate image generation phases to single-phase orchestrator
   * When multi-phase enters 'sketch' or 'gameplay', start the single-phase orchestrator
   * which handles the actual generate -> evaluate -> refine loop
   */
  useEffect(() => {
    const { phase, config, sketchProgress, gameplayProgress } = state;

    // Only delegate for image generation phases
    if (phase !== 'sketch' && phase !== 'gameplay') {
      return;
    }

    // Calculate target for current phase
    const targetForPhase = phase === 'sketch'
      ? config.sketchCount - sketchProgress.saved
      : config.gameplayCount - gameplayProgress.saved;

    // If we've already met the target, don't start orchestrator
    if (targetForPhase <= 0) {
      return;
    }

    // Only start if not already running
    if (!singlePhaseOrchestrator.isRunning && singlePhaseOrchestrator.canStart) {
      console.log(`[MultiPhase] Delegating ${phase} phase to single-phase orchestrator (target: ${targetForPhase})`);
      singlePhaseOrchestrator.startAutoplay({
        targetSavedCount: targetForPhase,
        maxIterations: config.maxIterationsPerImage,
      });
    }
  }, [state.phase, state.config, state.sketchProgress, state.gameplayProgress, singlePhaseOrchestrator]);

  /**
   * Effect: Detect single-phase completion and advance multi-phase
   */
  useEffect(() => {
    const { phase } = state;

    if (phase !== 'sketch' && phase !== 'gameplay') {
      return;
    }

    // When single-phase orchestrator completes, advance to next phase
    if (!singlePhaseOrchestrator.isRunning && singlePhaseOrchestrator.completionReason) {
      console.log(`[MultiPhase] Single-phase completed: ${singlePhaseOrchestrator.completionReason}`);

      // Check if we should advance based on saved count
      const progress = phase === 'sketch' ? state.sketchProgress : state.gameplayProgress;
      const target = phase === 'sketch' ? state.config.sketchCount : state.config.gameplayCount;

      if (progress.saved >= target || singlePhaseOrchestrator.completionReason !== 'target_met') {
        dispatch({ type: 'ADVANCE_PHASE' });
      }

      // Reset single-phase for potential reuse
      singlePhaseOrchestrator.resetAutoplay();
    }
  }, [state, singlePhaseOrchestrator.isRunning, singlePhaseOrchestrator.completionReason, singlePhaseOrchestrator.resetAutoplay]);

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

    // Phase timeout: 2 minutes allows for multiple image generations + evaluations
    // This is a safety net, not the normal exit path
    const PHASE_TIMEOUT_MS = 120000; // 2 minutes per phase
    const timeoutId = setTimeout(() => {
      console.error(`[MultiPhase] Phase '${phase}' timed out after ${PHASE_TIMEOUT_MS / 1000}s`);
      logEvent('timeout', `Phase '${phase}' timed out after 2 minutes`, { phase });
      dispatch({ type: 'ERROR', error: `Phase '${phase}' timed out - please try again` });
    }, PHASE_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [state.phase, logEvent]);

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

    // For AutoplayControls compatibility
    status: state.phase,
    currentIteration: 1, // Multi-phase doesn't have iterations in the same way
    maxIterations: state.config.maxIterationsPerImage,
    totalSaved,
    targetSaved,
    completionReason,

    // Actions
    startMultiPhase,
    abort,
    reset,
  };
}
