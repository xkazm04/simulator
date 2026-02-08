/**
 * PersistentActionBar - Mode selector + Generate/Auto/Undo-Redo buttons
 *
 * Extracted from DirectorControl so it can be rendered persistently
 * at the bottom of CentralBrain, visible across all tabs.
 *
 * Uses context hooks directly for state access.
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  Undo2,
  Redo2,
  Sparkles,
  MonitorPlay,
  Pencil,
  Clapperboard,
  Film,
} from 'lucide-react';
import {
  GeneratedImage,
  OutputMode,
  ExtendedAutoplayConfig,
  AutoplayLogEntry,
  AutoplayPhase,
  DimensionType,
  DimensionPreset,
} from '../../types';
import { useBrainState, useBrainActions } from '../BrainContext';
import { usePromptsState, usePromptsActions } from '../../subfeature_prompts/PromptsContext';
import { useDimensionsState, useDimensionsActions } from '../../subfeature_dimensions/DimensionsContext';
import { useSimulatorContext } from '../../SimulatorContext';
import { semanticColors } from '../../lib/semanticColors';
import { refineFeedback, smartBreakdown } from '../lib/simulatorAI';
import { AutoplaySetupModal } from './AutoplaySetupModal';
import { DEFAULT_DIMENSIONS, EXTRA_DIMENSIONS } from '../../subfeature_dimensions/lib/defaultDimensions';
import { createDimensionWithDefaults } from '../../types';
import { useViewModeStore } from '../../stores';

export interface PersistentActionBarProps {
  isGeneratingPoster: boolean;
  onGeneratePoster?: () => Promise<void>;
  generatedImages: GeneratedImage[];
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
    currentIteration?: number;
    maxIterations?: number;
    currentImageInPhase?: number;
    phaseTarget?: number;
    singlePhaseStatus?: string;
  };
  eventLog?: {
    textEvents: AutoplayLogEntry[];
    imageEvents: AutoplayLogEntry[];
    clearEvents: () => void;
  };
}

export function PersistentActionBar({
  isGeneratingPoster,
  onGeneratePoster,
  generatedImages,
  multiPhaseAutoplay,
  eventLog,
}: PersistentActionBarProps) {
  const brainState = useBrainState();
  const brainActions = useBrainActions();
  const promptsState = usePromptsState();
  const promptsActions = usePromptsActions();
  const dimensionsState = useDimensionsState();
  const dimensionsActions = useDimensionsActions();
  const simulator = useSimulatorContext();
  const { setViewMode } = useViewModeStore();

  const [isRefining, setIsRefining] = useState(false);
  const [isAutoplayModalOpen, setIsAutoplayModalOpen] = useState(false);

  const isAutoplayLocked = multiPhaseAutoplay?.isRunning ?? false;
  const isAnyGenerating = simulator.isGenerating || isGeneratingPoster || isRefining || isAutoplayLocked;

  const getStatusLabel = useCallback((): { label: string; colorClass: string } => {
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
    if (isRefining) return { label: 'REFINING...', colorClass: 'from-amber-400 to-orange-400' };
    if (isGeneratingPoster) return { label: 'GENERATING POSTER...', colorClass: 'from-rose-400 to-amber-400' };
    if (simulator.isGenerating) return { label: 'SIMULATING...', colorClass: 'from-cyan-400 to-purple-400' };
    return { label: 'GENERATE', colorClass: '' };
  }, [multiPhaseAutoplay?.isRunning, multiPhaseAutoplay?.phase, isRefining, isGeneratingPoster, simulator.isGenerating]);

  const handleSmartBreakdownForAutoplay = useCallback(async (visionSentence: string): Promise<boolean> => {
    try {
      const result = await smartBreakdown(visionSentence);
      if (!result.success) return false;

      brainActions.setBaseImage(result.baseImage.description);
      brainActions.setVisionSentence(visionSentence);
      brainActions.setBreakdown({
        baseImage: { format: result.baseImage.format, keyElements: result.baseImage.keyElements },
        reasoning: result.reasoning,
      });
      brainActions.setOutputMode(result.suggestedOutputMode);

      const newDimensions = result.dimensions.map(d => {
        const allPresets: DimensionPreset[] = [...DEFAULT_DIMENSIONS, ...EXTRA_DIMENSIONS];
        const preset = allPresets.find(p => p.type === d.type);
        if (preset) {
          return createDimensionWithDefaults({
            ...preset,
            id: `${d.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            reference: d.reference,
          });
        }
        return createDimensionWithDefaults({
          type: d.type,
          label: d.type.charAt(0).toUpperCase() + d.type.slice(1),
          icon: 'Sparkles',
          placeholder: `Enter ${d.type}...`,
          id: `${d.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          reference: d.reference,
        });
      });
      dimensionsActions.setDimensions(newDimensions);
      return true;
    } catch (error) {
      console.error('[PersistentActionBar] Smart Breakdown error:', error);
      return false;
    }
  }, [brainActions, dimensionsActions]);

  const handleGenerateWithRefinement = useCallback(async () => {
    if (brainState.outputMode === 'poster') {
      if (onGeneratePoster) await onGeneratePoster();
      setViewMode('poster');
      return;
    }

    const changeFeedback = brainState.feedback.negative?.trim();
    let refinedBaseImage = brainState.baseImage;
    let refinedDimensionsForApi: Array<{ type: DimensionType; label: string; reference: string }> =
      dimensionsState.dimensions.map(d => ({ type: d.type, label: d.label, reference: d.reference }));

    if (changeFeedback) {
      setIsRefining(true);
      try {
        const result = await refineFeedback({
          basePrompt: brainState.baseImage,
          dimensions: dimensionsState.dimensions,
          changeFeedback,
          outputMode: brainState.outputMode,
        });

        if (result.success && result.refinedPrompt) {
          refinedBaseImage = result.refinedPrompt;
          if (result.refinedPrompt !== brainState.baseImage) {
            brainActions.setBaseImage(result.refinedPrompt);
          }
          if (result.refinedDimensions && result.refinedDimensions.length > 0) {
            const mergedDimensions = dimensionsState.dimensions.map(existing => {
              const refined = result.refinedDimensions?.find(r => r.id === existing.id || r.type === existing.type);
              return refined ? { ...existing, reference: refined.reference } : existing;
            });
            dimensionsActions.setDimensions(mergedDimensions);
            refinedDimensionsForApi = mergedDimensions.map(d => ({ type: d.type, label: d.label, reference: d.reference }));
          }
          brainActions.setFeedback({ ...brainState.feedback, negative: '' });
        }
      } catch (error) {
        console.error('Failed to refine feedback:', error);
      } finally {
        setIsRefining(false);
      }
    }

    simulator.handleGenerate({ baseImage: refinedBaseImage, dimensions: refinedDimensionsForApi });
  }, [brainState, brainActions, dimensionsState.dimensions, dimensionsActions, simulator, onGeneratePoster]);

  // Ctrl+Enter keyboard shortcut
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && simulator.canGenerate && !isAnyGenerating) {
      e.preventDefault();
      handleGenerateWithRefinement();
    }
  }, [simulator.canGenerate, isAnyGenerating, handleGenerateWithRefinement]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="px-lg pb-lg pt-2 bg-black/20 shrink-0 relative z-20 border-t border-white/[0.04]">
      <div className="space-y-2">
        {/* Output Mode Segmented Control */}
        {!isAutoplayLocked && (() => {
          const modes: Array<{ id: OutputMode; label: string; icon: React.ReactNode; color: string; activeColor: string; title: string }> = [
            { id: 'gameplay', label: 'Gameplay', icon: <MonitorPlay size={12} />, color: 'text-purple-400', activeColor: 'bg-purple-500/25 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]', title: 'Gameplay Screenshot with HUD/UI' },
            { id: 'sketch', label: 'Sketch', icon: <Pencil size={12} />, color: 'text-amber-400', activeColor: 'bg-amber-500/25 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]', title: 'Hand-drawn Concept Sketch' },
            { id: 'trailer', label: 'Trailer', icon: <Clapperboard size={12} />, color: 'text-cyan-400', activeColor: 'bg-cyan-500/25 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]', title: 'Cinematic Trailer Scene' },
            { id: 'realistic', label: 'Realistic', icon: <Sparkles size={12} />, color: 'text-emerald-400', activeColor: 'bg-emerald-500/25 border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.15)]', title: 'Next-gen Photorealistic' },
            { id: 'poster', label: 'Poster', icon: <Film size={12} />, color: 'text-rose-400', activeColor: 'bg-rose-500/25 border-rose-500/40 shadow-[0_0_12px_rgba(251,113,133,0.15)]', title: 'Key Art Poster' },
          ];
          const activeIndex = modes.findIndex(m => m.id === brainState.outputMode);
          const activeMode = modes[activeIndex];

          return (
            <div className="flex gap-2 items-center mb-2">
              <span className="text-xs font-medium text-slate-500 mr-1">Mode:</span>
              <div className="relative flex radius-md border border-slate-800 bg-slate-900/50 p-0.5">
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
                  const isActive = brainState.outputMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => brainActions.setOutputMode(mode.id)}
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

        {/* Autoplay + Generate button + Undo/Redo */}
        <div className="flex gap-2 items-center">
          {/* Multi-Phase Autoplay */}
          {brainState.outputMode !== 'poster' && multiPhaseAutoplay && (
            <>
              {multiPhaseAutoplay.isRunning ? (
                <button
                  onClick={() => setIsAutoplayModalOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1 radius-sm border transition-colors
                    ${semanticColors.processing.bg} ${semanticColors.processing.border} ${semanticColors.processing.text}
                    hover:brightness-125`}
                  data-testid="autoplay-activity-btn"
                  title="Autoplay running — click to view activity"
                >
                  <Loader2 size={12} className="animate-spin" />
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

          {/* Generate Button */}
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
                <span className={`font-mono text-md tracking-wider ${simulator.canGenerate ? 'text-white group-hover:text-cyan-50' : 'text-slate-500'}`}>
                    GENERATE
                  </span>
              )}
            </div>
          </button>

          {/* Undo/Redo Controls */}
          {promptsState.promptHistory && promptsState.promptHistory.historyLength > 0 && (
            <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800 radius-md px-2 py-1.5 h-10">
              <button
                onClick={promptsActions.handlePromptUndo}
                disabled={!promptsState.promptHistory.canUndo || isAnyGenerating}
                data-testid="prompt-undo-btn"
                className={`p-2 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50
                  ${promptsState.promptHistory.canUndo && !isAnyGenerating
                    ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50'
                    : 'text-slate-700 cursor-not-allowed'
                  }`}
                title="Undo to previous generation"
              >
                <Undo2 size={16} />
              </button>
              <span className="font-mono text-sm text-slate-500 px-2 min-w-[4rem] text-center">
                {promptsState.promptHistory.positionLabel}
              </span>
              <button
                onClick={promptsActions.handlePromptRedo}
                disabled={!promptsState.promptHistory.canRedo || isAnyGenerating}
                data-testid="prompt-redo-btn"
                className={`p-2 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50
                  ${promptsState.promptHistory.canRedo && !isAnyGenerating
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

      {/* Autoplay modal */}
      {multiPhaseAutoplay && (
        <AutoplaySetupModal
          isOpen={isAutoplayModalOpen}
          onClose={() => setIsAutoplayModalOpen(false)}
          onStart={(config) => {
            eventLog?.clearEvents();
            multiPhaseAutoplay.onStart(config);
          }}
          hasContent={multiPhaseAutoplay.hasContent}
          onSmartBreakdown={handleSmartBreakdownForAutoplay}
          visionSentence={brainState.visionSentence}
          onVisionSentenceChange={brainActions.setVisionSentence}
          canStart={multiPhaseAutoplay.canStart}
          canStartReason={multiPhaseAutoplay.canStartReason}
          isRunning={multiPhaseAutoplay.isRunning}
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
          activePrompts={promptsState.generatedPrompts}
          activeImages={generatedImages}
          onRetry={multiPhaseAutoplay.onRetry}
          errorPhase={multiPhaseAutoplay.errorPhase}
          currentImageInPhase={multiPhaseAutoplay.currentImageInPhase}
          phaseTarget={multiPhaseAutoplay.phaseTarget}
          singlePhaseStatus={multiPhaseAutoplay.singlePhaseStatus}
        />
      )}
    </div>
  );
}
