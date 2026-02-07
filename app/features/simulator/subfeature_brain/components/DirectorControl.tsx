/**
 * DirectorControl - Feedback and generation control panel
 *
 * Extracted from CentralBrain for cleaner code organization.
 * Contains:
 * - Change input (feedback for what to modify)
 * - Output mode selection (Concept/Gameplay/Poster)
 * - Generate button with undo/redo history
 * - Delete images action
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Command,
  Trash2,
  Wand2,
  Loader2,
  Undo2,
  Redo2,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MonitorPlay,
  Pencil,
  Clapperboard,
  Film,
} from 'lucide-react';
import {
  GeneratedImage,
  OutputMode,
  Dimension,
  ExtendedAutoplayConfig,
  AutoplayLogEntry,
  AutoplayPhase,
} from '../../types';
import { SmartSuggestionPanel } from '../../components/SmartSuggestionPanel';
import { useBrainContext } from '../BrainContext';
import { DEFAULT_DIMENSIONS, EXTRA_DIMENSIONS } from '../../subfeature_dimensions/lib/defaultDimensions';
import { createDimensionWithDefaults, DimensionType, DimensionPreset } from '../../types';
import { usePromptsContext } from '../../subfeature_prompts/PromptsContext';
import { useDimensionsContext } from '../../subfeature_dimensions/DimensionsContext';
import { useSimulatorContext } from '../../SimulatorContext';
import { expandCollapse, transitions } from '../../lib/motion';
import { semanticColors } from '../../lib/semanticColors';
import { refineFeedback, smartBreakdown } from '../lib/simulatorAI';
import { AutoplaySetupModal } from './AutoplaySetupModal';

export interface DirectorControlProps {
  // Image generation props
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  onDeleteGenerations?: () => void;

  // Poster generation
  isGeneratingPoster: boolean;
  onGeneratePoster?: () => Promise<void>;

  // Multi-phase autoplay props
  multiPhaseAutoplay?: {
    isRunning: boolean;
    canStart: boolean;
    canStartReason: string | null;
    hasContent: boolean;
    phase: string;
    sketchProgress: { saved: number; target: number };
    gameplayProgress: { saved: number; target: number };
    posterSelected: boolean;
    hudGenerated: number;
    error?: string;
    errorPhase?: string;
    onStart: (config: ExtendedAutoplayConfig) => void;
    onStop: () => void;
    onReset: () => void;
    onRetry?: () => void;
    /** Current iteration number (1-based) - optional */
    currentIteration?: number;
    /** Max iterations configured - optional */
    maxIterations?: number;
  };

  // Event log for activity modal (optional)
  eventLog?: {
    textEvents: AutoplayLogEntry[];
    imageEvents: AutoplayLogEntry[];
    clearEvents: () => void;
  };
}

export function DirectorControl({
  generatedImages,
  isGeneratingImages,
  onDeleteGenerations,
  isGeneratingPoster,
  onGeneratePoster,
  multiPhaseAutoplay,
  eventLog,
}: DirectorControlProps) {
  // Get state and handlers from contexts
  const brain = useBrainContext();
  const prompts = usePromptsContext();
  const dimensions = useDimensionsContext();
  const simulator = useSimulatorContext();

  // Local state
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Autoplay modal state - rendered inline to receive reactive prop updates
  const [isAutoplayModalOpen, setIsAutoplayModalOpen] = useState(false);

  // Debounced feedback: local draft avoids re-renders during typing
  const [feedbackDraft, setFeedbackDraft] = useState(brain.feedback.negative || '');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync draft from context when context changes externally (e.g. after refinement clears it)
  useEffect(() => {
    setFeedbackDraft(brain.feedback.negative || '');
  }, [brain.feedback.negative]);

  const handleFeedbackChange = useCallback((value: string) => {
    setFeedbackDraft(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      brain.setFeedback({ ...brain.feedback, negative: value });
    }, 300);
  }, [brain]);

  // Derive autoplay lock state from multi-phase autoplay
  const isAutoplayLocked = multiPhaseAutoplay?.isRunning ?? false;

  const isAnyGenerating = simulator.isGenerating || isGeneratingPoster || isRefining || isAutoplayLocked;

  /**
   * Derive human-readable status label from autoplay state
   * Returns appropriate label based on current operation
   */
  const getStatusLabel = useCallback((): { label: string; colorClass: string } => {
    // Multi-phase autoplay running - derive from phase
    if (multiPhaseAutoplay?.isRunning) {
      switch (multiPhaseAutoplay.phase) {
        case 'sketch':
        case 'gameplay':
          return { label: 'GENERATING...', colorClass: 'from-cyan-400 to-purple-400' };
        case 'poster':
          return { label: 'SELECTING POSTER...', colorClass: 'from-rose-400 to-amber-400' };
        case 'hud':
          return { label: 'GENERATING HUD...', colorClass: 'from-green-400 to-emerald-400' };
        default:
          return { label: 'SIMULATING...', colorClass: 'from-cyan-400 to-purple-400' };
      }
    }

    // Local state checks (refining, poster generation, regular generation)
    if (isRefining) {
      return { label: 'REFINING...', colorClass: 'from-amber-400 to-orange-400' };
    }
    if (isGeneratingPoster) {
      return { label: 'GENERATING POSTER...', colorClass: 'from-rose-400 to-amber-400' };
    }
    if (simulator.isGenerating) {
      return { label: 'SIMULATING...', colorClass: 'from-cyan-400 to-purple-400' };
    }

    // Idle state
    return { label: 'GENERATE', colorClass: '' };
  }, [multiPhaseAutoplay?.isRunning, multiPhaseAutoplay?.phase, isRefining, isGeneratingPoster, simulator.isGenerating]);

  // Smart suggestion handlers
  const handleAcceptDimensionSuggestion = useCallback((dimensionType: DimensionType, weight?: number) => {
    // Find preset for this dimension type in all available presets
    const allPresets: DimensionPreset[] = [...DEFAULT_DIMENSIONS, ...EXTRA_DIMENSIONS];
    const preset = allPresets.find(p => p.type === dimensionType);
    if (preset) {
      const baseDimension = createDimensionWithDefaults({
        ...preset,
        id: `${dimensionType}-${Date.now()}`,
        reference: '',
      });
      // Apply suggested weight if provided
      const newDimension = weight != null
        ? { ...baseDimension, weight }
        : baseDimension;
      dimensions.setDimensions([...dimensions.dimensions, newDimension]);
    }
  }, [dimensions]);

  const handleAcceptWeightSuggestion = useCallback((dimensionType: DimensionType, weight: number) => {
    const updated = dimensions.dimensions.map(d =>
      d.type === dimensionType ? { ...d, weight } : d
    );
    dimensions.setDimensions(updated);
  }, [dimensions]);

  const handleAcceptOutputMode = useCallback((mode: OutputMode) => {
    brain.setOutputMode(mode);
  }, [brain]);

  /**
   * Handle Smart Breakdown from autoplay modal
   * Called when user starts autoplay without existing content but with a prompt idea
   */
  const handleSmartBreakdownForAutoplay = useCallback(async (visionSentence: string): Promise<boolean> => {
    try {
      const result = await smartBreakdown(visionSentence);

      if (!result.success) {
        console.error('[DirectorControl] Smart Breakdown failed');
        return false;
      }

      // Update brain context with the results
      brain.setBaseImage(result.baseImage.description);
      brain.setVisionSentence(visionSentence);
      brain.setBreakdown({
        baseImage: {
          format: result.baseImage.format,
          keyElements: result.baseImage.keyElements,
        },
        reasoning: result.reasoning,
      });
      brain.setOutputMode(result.suggestedOutputMode);

      // Create and set dimensions
      const newDimensions = result.dimensions.map(d => {
        const allPresets = [...DEFAULT_DIMENSIONS, ...EXTRA_DIMENSIONS];
        const preset = allPresets.find(p => p.type === d.type);
        if (preset) {
          return createDimensionWithDefaults({
            ...preset,
            id: `${d.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            reference: d.reference,
          });
        }
        // Fallback if no preset found
        return createDimensionWithDefaults({
          type: d.type,
          label: d.type.charAt(0).toUpperCase() + d.type.slice(1),
          icon: 'Sparkles',
          placeholder: `Enter ${d.type}...`,
          id: `${d.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          reference: d.reference,
        });
      });

      dimensions.setDimensions(newDimensions);

      console.log('[DirectorControl] Smart Breakdown applied for autoplay');
      return true;
    } catch (error) {
      console.error('[DirectorControl] Smart Breakdown error:', error);
      return false;
    }
  }, [brain, dimensions]);

  // Auto-expand when generating
  useEffect(() => {
    if (simulator.isGenerating || isGeneratingPoster) {
      setIsExpanded(true);
    }
  }, [simulator.isGenerating, isGeneratingPoster]);

  // Handle Enter key to trigger generation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && simulator.canGenerate && !isAnyGenerating) {
      e.preventDefault();
      handleGenerateWithRefinement();
    }
  }, [simulator.canGenerate, isAnyGenerating]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /**
   * Handle generation with optional feedback refinement
   * If "Change" input has content AND not in poster mode, first refine base prompt and dimensions via LLM
   * Then pass the refined data directly to handleGenerate (don't rely on state update)
   * Poster mode skips refinement since it uses dimensions directly
   */
  const handleGenerateWithRefinement = useCallback(async () => {
    // Poster mode: skip refinement, go directly to poster generation
    if (brain.outputMode === 'poster') {
      console.log('[DirectorControl] Poster mode detected, calling onGeneratePoster');
      if (onGeneratePoster) {
        await onGeneratePoster();
      } else {
        console.warn('[DirectorControl] onGeneratePoster callback not provided');
      }
      return;
    }

    const changeFeedback = brain.feedback.negative?.trim();

    // Track refined values to pass directly to generation
    let refinedBaseImage = brain.baseImage;
    let refinedDimensionsForApi: Array<{ type: DimensionType; label: string; reference: string }> =
      dimensions.dimensions.map(d => ({
        type: d.type,
        label: d.label,
        reference: d.reference,
      }));

    // Only call refineFeedback if there's feedback to apply
    if (changeFeedback) {
      setIsRefining(true);
      try {
        // Call LLM to refine based on feedback
        const result = await refineFeedback({
          basePrompt: brain.baseImage,
          dimensions: dimensions.dimensions,
          changeFeedback,
          outputMode: brain.outputMode,
        });

        if (result.success && result.refinedPrompt) {
          // Track refined base prompt
          refinedBaseImage = result.refinedPrompt;

          // Update state for UI display
          if (result.refinedPrompt !== brain.baseImage) {
            brain.setBaseImage(result.refinedPrompt);
          }

          // Update dimensions if refined - merge with existing to preserve all properties
          if (result.refinedDimensions && result.refinedDimensions.length > 0) {
            const mergedDimensions = dimensions.dimensions.map(existing => {
              const refined = result.refinedDimensions?.find(r => r.id === existing.id || r.type === existing.type);
              if (refined) {
                return { ...existing, reference: refined.reference };
              }
              return existing;
            });

            // Update state for UI
            dimensions.setDimensions(mergedDimensions);

            // Track refined dimensions for API
            refinedDimensionsForApi = mergedDimensions.map(d => ({
              type: d.type,
              label: d.label,
              reference: d.reference,
            }));
          }

          // Clear the change feedback after applying
          brain.setFeedback({ ...brain.feedback, negative: '' });
        }
      } catch (error) {
        console.error('Failed to refine feedback:', error);
      } finally {
        setIsRefining(false);
      }
    }

    // Regular generation, passing refined data directly
    // This ensures we use the NEW values even if React state hasn't updated yet
    simulator.handleGenerate({
      baseImage: refinedBaseImage,
      dimensions: refinedDimensionsForApi,
    });
  }, [brain, dimensions, simulator, onGeneratePoster]);

  return (
    <div className="p-lg bg-black/20 shrink-0 relative z-20">
      {/* Header with actions */}
      <div className="mb-md flex items-center justify-between relative z-30">
        <span className="text-md uppercase tracking-widest text-white font-medium flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
          <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          Director Control
        </span>
        <div className="flex items-center gap-3">
          {/* Delete Images button */}
          {generatedImages.length > 0 && onDeleteGenerations && (
            <button
              onClick={onDeleteGenerations}
              disabled={isGeneratingImages}
              data-testid="delete-images-btn"
              className="text-md text-red-400/80 font-mono flex items-center gap-1.5 border border-red-900/50 radius-sm px-3 py-1 hover:bg-red-950/30 hover:border-red-800/50 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
            >
              <Trash2 size={12} /> <span>DELETE IMAGES</span>
            </button>
          )}
          {/* Toggle expand for advanced options */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="director-expand-toggle"
            className="p-1.5 text-slate-600 hover:text-cyan-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 radius-sm"
            title={isExpanded ? 'Hide advanced options' : 'Show advanced options'}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {/* Keyboard shortcut hint */}
          <div className="text-md text-slate-500 font-mono flex items-center gap-1.5 border border-slate-800 radius-sm px-3 py-1">
            <Command size={12} /> <Zap size={12} /> <span>CTRL+ENTER</span>
          </div>
        </div>
      </div>

      {/* Change Input - Always visible when base prompt exists */}
      {brain.baseImage && (
        <div className="space-y-2 mb-md">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
              <RefreshCw size={12} className={semanticColors.warning.text} />
              What to Change
            </label>
            {feedbackDraft && (
              <span className="type-label text-amber-400 flex items-center gap-1">
                <Sparkles size={10} />
                Will refine on generate
              </span>
            )}
          </div>
          <textarea
            value={feedbackDraft}
            onChange={(e) => handleFeedbackChange(e.target.value)}
            placeholder="Describe what should be different... (e.g. 'make it darker', 'change the mood to mysterious', 'add rain effects')"
            className={`w-full h-20 bg-slate-900/50 border radius-md p-3 text-sm placeholder-slate-600 resize-none
                        focus:outline-none focus:ring-1 transition-all
                        ${feedbackDraft ? 'border-amber-500/30 ring-amber-500/30' : 'border-slate-800 focus:border-amber-500/50 focus:ring-amber-500/50'}`}
            disabled={isAnyGenerating}
          />
          <p className="font-mono type-label text-slate-600">
            LLM will analyze your feedback and update the base prompt and dimensions accordingly before generating.
          </p>
        </div>
      )}

      {/* Expandable Advanced Options Section */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={expandCollapse}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.normal}
            className="overflow-hidden mb-md"
          >
            {/* Smart Suggestions Panel */}
            {showSuggestions && (
              <SmartSuggestionPanel
                dimensions={dimensions.dimensions}
                baseImageDescription={brain.baseImage}
                onAcceptDimensionSuggestion={handleAcceptDimensionSuggestion}
                onAcceptWeightSuggestion={handleAcceptWeightSuggestion}
                onAcceptOutputMode={handleAcceptOutputMode}
                isGenerating={isAnyGenerating}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action area */}
      <div className="space-y-2">
        {/* Output Mode Segmented Control - sliding highlight */}
        {!isAutoplayLocked && (() => {
          const modes: Array<{ id: OutputMode; label: string; icon: React.ReactNode; color: string; activeColor: string; title: string }> = [
            { id: 'gameplay', label: 'Gameplay', icon: <MonitorPlay size={12} />, color: 'text-purple-400', activeColor: 'bg-purple-500/25 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]', title: 'Gameplay Screenshot with HUD/UI' },
            { id: 'sketch', label: 'Sketch', icon: <Pencil size={12} />, color: 'text-amber-400', activeColor: 'bg-amber-500/25 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]', title: 'Hand-drawn Concept Sketch' },
            { id: 'trailer', label: 'Trailer', icon: <Clapperboard size={12} />, color: 'text-cyan-400', activeColor: 'bg-cyan-500/25 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]', title: 'Cinematic Trailer Scene' },
            { id: 'realistic', label: 'Realistic', icon: <Sparkles size={12} />, color: 'text-emerald-400', activeColor: 'bg-emerald-500/25 border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.15)]', title: 'Next-gen Photorealistic' },
            { id: 'poster', label: 'Poster', icon: <Film size={12} />, color: 'text-rose-400', activeColor: 'bg-rose-500/25 border-rose-500/40 shadow-[0_0_12px_rgba(251,113,133,0.15)]', title: 'Key Art Poster' },
          ];
          const activeIndex = modes.findIndex(m => m.id === brain.outputMode);
          const activeMode = modes[activeIndex];

          return (
            <div className="flex gap-2 items-center mb-2">
              <span className="text-xs font-medium text-slate-500 mr-1">Mode:</span>
              <div className="relative flex radius-md border border-slate-800 bg-slate-900/50 p-0.5">
                {/* Sliding highlight */}
                <motion.div
                  className={`absolute top-0.5 bottom-0.5 radius-sm border ${activeMode?.activeColor || ''}`}
                  initial={false}
                  animate={{
                    left: `${activeIndex * (100 / modes.length)}%`,
                    width: `${100 / modes.length}%`,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  style={{ padding: '2px' }}
                />
                {modes.map((mode) => {
                  const isActive = brain.outputMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => brain.setOutputMode(mode.id)}
                      disabled={isAnyGenerating}
                      data-testid={`output-mode-${mode.id}`}
                      title={mode.title}
                      className={`relative z-10 px-2.5 py-1.5 flex items-center justify-center gap-1 text-xs font-mono uppercase tracking-wide transition-colors
                        ${isActive ? mode.color : 'text-slate-500 hover:text-slate-300'}
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {mode.icon}
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Autoplay + Generate button + History */}
        <div className="flex gap-2 items-center">
          {/* Multi-Phase Autoplay - show modal trigger when multi-phase is available */}
          {brain.outputMode !== 'poster' && multiPhaseAutoplay && (
            <>
              {multiPhaseAutoplay.isRunning ? (
                /* When running, show a compact status button that reopens the activity modal */
                <button
                  onClick={() => setIsAutoplayModalOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1 radius-sm border transition-colors
                    ${semanticColors.processing.bg} ${semanticColors.processing.border} ${semanticColors.processing.text}
                    hover:brightness-125`}
                  data-testid="autoplay-activity-btn"
                >
                  <Sparkles size={12} className="animate-pulse" />
                  <span className="font-mono type-label uppercase">
                    {multiPhaseAutoplay.sketchProgress.saved + multiPhaseAutoplay.gameplayProgress.saved}/
                    {multiPhaseAutoplay.sketchProgress.target + multiPhaseAutoplay.gameplayProgress.target}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setIsAutoplayModalOpen(true)}
                  disabled={!multiPhaseAutoplay.canStart || (isAnyGenerating && !isAutoplayLocked)}
                  title={multiPhaseAutoplay.canStartReason || undefined}
                  className={`flex items-center gap-1.5 px-3 py-1 radius-sm border transition-colors
                    ${!multiPhaseAutoplay.canStart || (isAnyGenerating && !isAutoplayLocked)
                      ? 'bg-slate-900/50 border-slate-700 text-slate-600 cursor-not-allowed opacity-50'
                      : `${semanticColors.processing.bg} ${semanticColors.processing.border} ${semanticColors.processing.text} hover:brightness-125`
                    }`}
                  data-testid="autoplay-setup-btn"
                >
                  <Sparkles size={12} />
                  <span className="font-mono type-label uppercase">Auto</span>
                </button>
              )}
            </>
          )}

          {/* Generate Button - takes most space */}
          <button
            onClick={handleGenerateWithRefinement}
            disabled={!simulator.canGenerate || isAnyGenerating}
            data-testid="generate-btn"
            className={`flex-1 relative group overflow-hidden radius-md p-[1px] btn-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
                ${!simulator.canGenerate || isAnyGenerating
                ? 'opacity-50 cursor-not-allowed grayscale'
                : 'hover:scale-[1.005]'
              }`}
          >
            {/* Animated gradient border - shifts during autoplay */}
            {isAutoplayLocked ? (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 opacity-80"
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{ backgroundSize: '200% 100%' }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
            )}
            <div className="relative h-10 bg-black/90 radius-md flex items-center justify-center gap-3 group-hover:bg-black/80 transition-colors px-6">
              {isAnyGenerating ? (
                (() => {
                  const status = getStatusLabel();
                  return (
                    <>
                      <Loader2 className={`animate-spin ${
                        status.colorClass.includes('amber') ? 'text-amber-400' :
                        status.colorClass.includes('rose') ? 'text-rose-400' :
                        status.colorClass.includes('green') ? 'text-green-400' :
                        'text-cyan-400'
                      }`} size={18} />
                      <span className={`font-mono text-md tracking-wider text-transparent bg-clip-text bg-gradient-to-r ${status.colorClass}`}>
                        {status.label}
                      </span>
                    </>
                  );
                })()
              ) : (
                <>
                  <Wand2 className={`group-hover:rotate-12 transition-transform duration-300 ${simulator.canGenerate ? 'text-cyan-400' : 'text-slate-600'}`} size={18} />
                  <span className={`font-mono text-md tracking-wider ${simulator.canGenerate ? 'text-white group-hover:text-cyan-50' : 'text-slate-500'}`}>
                    GENERATE
                  </span>
                  <span className="hidden sm:inline font-mono text-sm text-slate-600 ml-2">⏎</span>
                </>
              )}
            </div>
          </button>

          {/* Undo/Redo Controls */}
          {prompts.promptHistory && prompts.promptHistory.historyLength > 0 && (
            <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800 radius-md px-2 py-1.5 h-10">
              <button
                onClick={prompts.handlePromptUndo}
                disabled={!prompts.promptHistory.canUndo || isAnyGenerating}
                data-testid="prompt-undo-btn"
                className={`p-2 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50
                  ${prompts.promptHistory.canUndo && !isAnyGenerating
                    ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50'
                    : 'text-slate-700 cursor-not-allowed'
                  }`}
                title="Undo to previous generation"
              >
                <Undo2 size={16} />
              </button>
              <span className="font-mono text-sm text-slate-500 px-2 min-w-[4rem] text-center">
                {prompts.promptHistory.positionLabel}
              </span>
              <button
                onClick={prompts.handlePromptRedo}
                disabled={!prompts.promptHistory.canRedo || isAnyGenerating}
                data-testid="prompt-redo-btn"
                className={`p-2 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50
                  ${prompts.promptHistory.canRedo && !isAnyGenerating
                    ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50'
                    : 'text-slate-700 cursor-not-allowed'
                  }`}
                title="Redo to next generation"
              >
                <Redo2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Autoplay modal - rendered inline for reactive prop updates */}
      {multiPhaseAutoplay && (
        <AutoplaySetupModal
          isOpen={isAutoplayModalOpen}
          onClose={() => setIsAutoplayModalOpen(false)}
          onStart={(config) => {
            // Clear events when starting fresh
            eventLog?.clearEvents();
            multiPhaseAutoplay.onStart(config);
          }}
          hasContent={multiPhaseAutoplay.hasContent}
          onSmartBreakdown={handleSmartBreakdownForAutoplay}
          canStart={multiPhaseAutoplay.canStart}
          canStartReason={multiPhaseAutoplay.canStartReason}
          isRunning={multiPhaseAutoplay.isRunning}
          // Activity mode props - these now update reactively!
          currentPhase={multiPhaseAutoplay.phase as AutoplayPhase}
          sketchProgress={multiPhaseAutoplay.sketchProgress}
          gameplayProgress={multiPhaseAutoplay.gameplayProgress}
          posterSelected={multiPhaseAutoplay.posterSelected}
          hudGenerated={multiPhaseAutoplay.hudGenerated}
          hudTarget={multiPhaseAutoplay.gameplayProgress.target}
          error={multiPhaseAutoplay.error}
          textEvents={eventLog?.textEvents || []}
          imageEvents={eventLog?.imageEvents || []}
          onStop={multiPhaseAutoplay.onStop}
          onReset={() => {
            multiPhaseAutoplay.onReset();
            eventLog?.clearEvents();
          }}
          currentIteration={multiPhaseAutoplay.currentIteration}
          maxIterations={multiPhaseAutoplay.maxIterations}
          activePrompts={prompts.generatedPrompts}
          activeImages={generatedImages}
          onRetry={multiPhaseAutoplay.onRetry}
          errorPhase={multiPhaseAutoplay.errorPhase}
        />
      )}
    </div>
  );
}

export default DirectorControl;
