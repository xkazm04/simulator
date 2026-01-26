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

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Command,
  Trash2,
  Wand2,
  Loader2,
  Palette,
  MonitorPlay,
  Film,
  Undo2,
  Redo2,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  InteractiveMode,
  GeneratedImage,
  OutputMode,
  Dimension,
} from '../../types';
import { InteractiveModeToggle } from '../../subfeature_interactive';
import { NegativePromptInput } from '../../components/NegativePromptInput';
import { SmartSuggestionPanel } from '../../components/SmartSuggestionPanel';
import { useBrainContext } from '../BrainContext';
import { DEFAULT_DIMENSIONS, EXTRA_DIMENSIONS } from '../../subfeature_dimensions/lib/defaultDimensions';
import { createDimensionWithDefaults, NegativePromptItem, DimensionType, DimensionPreset } from '../../types';
import { usePromptsContext } from '../../subfeature_prompts/PromptsContext';
import { useDimensionsContext } from '../../subfeature_dimensions/DimensionsContext';
import { useSimulatorContext } from '../../SimulatorContext';
import { expandCollapse, transitions } from '../../lib/motion';
import { semanticColors } from '../../lib/semanticColors';
import { refineFeedback } from '../lib/simulatorAI';

export interface DirectorControlProps {
  // Interactive mode props
  interactiveMode: InteractiveMode;
  availableInteractiveModes: InteractiveMode[];
  onInteractiveModeChange?: (mode: InteractiveMode) => void;

  // Image generation props
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  onDeleteGenerations?: () => void;

  // Poster generation
  isGeneratingPoster: boolean;
  onGeneratePoster?: () => Promise<void>;
}

export function DirectorControl({
  interactiveMode,
  availableInteractiveModes,
  onInteractiveModeChange,
  generatedImages,
  isGeneratingImages,
  onDeleteGenerations,
  isGeneratingPoster,
  onGeneratePoster,
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

  const isAnyGenerating = simulator.isGenerating || isGeneratingPoster || isRefining;

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

  const handleAcceptNegativePrompt = useCallback((negativePrompt: string) => {
    // Add to negative prompts - split by comma and create global scope items
    const newPrompts: NegativePromptItem[] = negativePrompt.split(',').map(text => ({
      id: `neg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      scope: 'global' as const,
      isAutoSuggested: true, // Mark as auto-suggested from learning
    })).filter(p => p.text);
    prompts.setNegativePrompts([...prompts.negativePrompts, ...newPrompts]);
  }, [prompts]);

  const handleAcceptOutputMode = useCallback((mode: OutputMode) => {
    brain.setOutputMode(mode);
  }, [brain]);

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
    if (brain.outputMode === 'poster' && onGeneratePoster) {
      await onGeneratePoster();
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
            {brain.feedback.negative && (
              <span className="type-label text-amber-400 flex items-center gap-1">
                <Sparkles size={10} />
                Will refine on generate
              </span>
            )}
          </div>
          <textarea
            value={brain.feedback.negative}
            onChange={(e) => brain.setFeedback({ ...brain.feedback, negative: e.target.value })}
            placeholder="Describe what should be different... (e.g. 'make it darker', 'change the mood to mysterious', 'add rain effects')"
            className={`w-full h-20 bg-slate-900/50 border radius-md p-3 text-sm placeholder-slate-600 resize-none
                        focus:outline-none focus:ring-1 transition-all
                        ${brain.feedback.negative ? 'border-amber-500/30 ring-amber-500/30' : 'border-slate-800 focus:border-amber-500/50 focus:ring-amber-500/50'}`}
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
            {/* Negative Prompt Input */}
            <div className="mb-4">
              <NegativePromptInput
                negativePrompts={prompts.negativePrompts}
                onNegativePromptsChange={prompts.setNegativePrompts}
                dimensions={dimensions.dimensions}
                isGenerating={isAnyGenerating}
              />
            </div>

            {/* Smart Suggestions Panel */}
            {showSuggestions && (
              <SmartSuggestionPanel
                dimensions={dimensions.dimensions}
                baseImageDescription={brain.baseImage}
                onAcceptDimensionSuggestion={handleAcceptDimensionSuggestion}
                onAcceptWeightSuggestion={handleAcceptWeightSuggestion}
                onAcceptNegativePrompt={handleAcceptNegativePrompt}
                onAcceptOutputMode={handleAcceptOutputMode}
                isGenerating={isAnyGenerating}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two-row action area */}
      <div className="space-y-2">
        {/* Row 1: Mode selection */}
        <div className="flex gap-2 items-center">
          {/* Interactive Mode Toggle */}
          {onInteractiveModeChange && availableInteractiveModes.length > 1 && (
            <InteractiveModeToggle
              mode={interactiveMode}
              availableModes={availableInteractiveModes}
              onModeChange={onInteractiveModeChange}
              disabled={isAnyGenerating}
            />
          )}

          {/* Output Mode Toggle - full width */}
          <div className="flex-1 flex radius-md border border-slate-800 bg-slate-900/50 overflow-hidden">
            <button
              onClick={() => brain.setOutputMode('concept')}
              data-testid="output-mode-concept"
              className={`flex-1 py-2 flex items-center justify-center gap-2 text-md font-mono uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50
                          ${brain.outputMode === 'concept'
                            ? 'bg-amber-500/20 text-amber-400 border-r border-amber-500/30'
                            : 'text-slate-500 hover:text-slate-300 border-r border-slate-800'}`}
              title="Concept Art Mode"
            >
              <Palette size={14} />
              <span>Concept</span>
            </button>
            <button
              onClick={() => brain.setOutputMode('gameplay')}
              data-testid="output-mode-gameplay"
              className={`flex-1 py-2 flex items-center justify-center gap-2 text-md font-mono uppercase tracking-wide transition-colors border-r focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50
                          ${brain.outputMode === 'gameplay'
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            : 'text-slate-500 hover:text-slate-300 border-slate-800'}`}
              title="Gameplay Screenshot Mode"
            >
              <MonitorPlay size={14} />
              <span>Gameplay</span>
            </button>
            <button
              onClick={() => brain.setOutputMode('poster')}
              data-testid="output-mode-poster"
              className={`flex-1 py-2 flex items-center justify-center gap-2 text-md font-mono uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50
                          ${brain.outputMode === 'poster'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'text-slate-500 hover:text-slate-300'}`}
              title="Generate Key Art Poster"
            >
              <Film size={14} />
              <span>Poster</span>
            </button>
          </div>
        </div>

        {/* Row 2: Generate button + History */}
        <div className="flex gap-2 items-center">
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
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative h-10 bg-black/90 radius-md flex items-center justify-center gap-3 group-hover:bg-black/80 transition-colors px-6">
              {isAnyGenerating ? (
                <>
                  <Loader2 className={`animate-spin ${isRefining ? 'text-amber-400' : isGeneratingPoster ? 'text-rose-400' : 'text-cyan-400'}`} size={18} />
                  <span className={`font-mono text-md tracking-wider text-transparent bg-clip-text bg-gradient-to-r ${isRefining ? 'from-amber-400 to-orange-400' : isGeneratingPoster ? 'from-rose-400 to-amber-400' : 'from-cyan-400 to-purple-400'}`}>
                    {isRefining ? 'REFINING...' : isGeneratingPoster ? 'GENERATING POSTER...' : 'SIMULATING...'}
                  </span>
                </>
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
    </div>
  );
}

export default DirectorControl;
