/**
 * FeedbackPanel - Iterative refinement through feedback mechanisms
 * Design: Clean Manuscript style
 *
 * Layout: [PRESERVE] [GENERATE] [CHANGE]
 *
 * Semantic Colors:
 * - green: Preserve/locked (success state)
 * - amber: Change (warning/attention)
 * - cyan: Primary action (generate, active elements)
 * - purple: Processing/AI mode
 * - rose: Poster mode
 *
 * Option A: Lock entire prompts as positive examples
 * Option B: Lock individual elements for granular control
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, RefreshCw, Wand2, Loader2, MonitorPlay, Palette, Film, ChevronDown, ChevronUp, Brain, BarChart3, Undo2, Redo2 } from 'lucide-react';
import { Dimension, OutputMode, PromptElement, createDimensionWithDefaults, InteractiveMode, NegativePromptItem } from '../../types';
import { ElementToDimensionButton } from '../../components/ElementToDimensionButton';
import { InteractiveModeToggle } from '../../subfeature_interactive';
import { NegativePromptInput } from '../../components/NegativePromptInput';
import { FeedbackAnalyticsPanel } from '../../components/FeedbackAnalytics';
import { useState, useEffect, useCallback } from 'react';
import { semanticColors } from '../../lib/semanticColors';
import { expandCollapse, transitions } from '../../lib/motion';
import { getLearningStatus } from '../../lib/feedbackLearning';

interface FeedbackPanelProps {
  feedback: { positive: string; negative: string };
  onFeedbackChange: (val: { positive: string; negative: string }) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  isGeneratingPoster?: boolean;
  canGenerate: boolean;
  hasLockedPrompts: boolean;
  lockedElements: PromptElement[];
  outputMode: OutputMode;
  onOutputModeChange: (mode: OutputMode) => void;
  onConvertElementsToDimensions: (dimensions: Dimension[]) => void;
  variant?: 'default' | 'minimal' | 'stacked';
  // Interactive prototype props
  interactiveMode?: InteractiveMode;
  availableInteractiveModes?: InteractiveMode[];
  onInteractiveModeChange?: (mode: InteractiveMode) => void;
  // Negative prompt props
  negativePrompts?: NegativePromptItem[];
  onNegativePromptsChange?: (negatives: NegativePromptItem[]) => void;
  dimensions?: Dimension[];
  // Prompt history props
  promptHistory?: {
    canUndo: boolean;
    canRedo: boolean;
    historyLength: number;
    positionLabel: string;
  };
  onPromptUndo?: () => void;
  onPromptRedo?: () => void;
}

export function FeedbackPanel({
  feedback,
  onFeedbackChange,
  onGenerate,
  isGenerating,
  isGeneratingPoster = false,
  canGenerate,
  hasLockedPrompts,
  lockedElements,
  outputMode,
  onOutputModeChange,
  onConvertElementsToDimensions,
  variant = 'default',
  interactiveMode = 'static',
  availableInteractiveModes = ['static'],
  onInteractiveModeChange,
  negativePrompts = [],
  onNegativePromptsChange,
  dimensions = [],
  promptHistory,
  onPromptUndo,
  onPromptRedo,
}: FeedbackPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [learningStatus, setLearningStatus] = useState<{
    totalFeedback: number;
    preferences: number;
    patterns: number;
    positiveRate: number;
  } | null>(null);
  const hasLockedItems = hasLockedPrompts || lockedElements.length > 0;
  const isAnyGenerating = isGenerating || isGeneratingPoster;

  // Load learning status
  useEffect(() => {
    getLearningStatus().then(setLearningStatus).catch(console.error);
  }, []);

  // Auto-expand when generating
  useEffect(() => {
    if (isAnyGenerating) {
      setIsExpanded(true);
    }
  }, [isAnyGenerating]);

  // Handle Enter key to trigger generation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && canGenerate && !isAnyGenerating) {
      // Don't trigger if focus is in a textarea
      const target = e.target as HTMLElement;
      if (target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        onGenerate();
      }
    }
  }, [canGenerate, isAnyGenerating, onGenerate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-md">

      {/* Header / Toggle with Learning Status */}
      <div className="flex items-center justify-between -mt-lg mb-sm relative z-10">
        {/* Learning Status Indicator */}
        <div className="flex items-center gap-2">
          {learningStatus && learningStatus.totalFeedback > 0 && (
            <button
              onClick={() => setShowAnalytics(true)}
              className={`flex items-center gap-1.5 px-2 py-1 radius-md type-label transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50
                ${learningStatus.patterns > 0
                  ? `${semanticColors.processing.bg} ${semanticColors.processing.text} ${semanticColors.processing.border} border`
                  : 'text-slate-500 hover:text-purple-400 bg-slate-800/30'
                }`}
              title="View learning analytics"
            >
              <Brain size={12} />
              <span>
                {learningStatus.patterns > 0
                  ? `${learningStatus.patterns} patterns`
                  : `${learningStatus.totalFeedback} feedback`
                }
              </span>
            </button>
          )}
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="feedback-expand-toggle"
          className="p-1.5 text-slate-600 hover:text-cyan-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 radius-sm"
          title={isExpanded ? 'Hide controls' : 'Show controls'}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Analytics Button (right side) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnalytics(true)}
            className="p-1.5 text-slate-600 hover:text-purple-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 radius-sm"
            title="View learning analytics"
          >
            <BarChart3 size={14} />
          </button>
        </div>
      </div>

      {/* Analytics Modal */}
      <AnimatePresence>
        {showAnalytics && (
          <FeedbackAnalyticsPanel
            isOpen={showAnalytics}
            onClose={() => setShowAnalytics(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={expandCollapse}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.normal}
            className="overflow-hidden"
          >
            {/* Layout Container */}
            <div className={`grid gap-md items-start ${variant === 'stacked' ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-[1fr_auto_1fr]'}`}>

              {/* Left: What to preserve - green for success/locked semantic */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
                    <Lock size={12} className={semanticColors.success.text} />
                    Preserve
                  </label>
                  {hasLockedPrompts && (
                    <span className={`type-label px-1.5 py-0.5 radius-sm border ${semanticColors.success.text} ${semanticColors.success.bg} ${semanticColors.success.border}`}
                          data-testid="prompts-active-badge">
                      Prompts active
                    </span>
                  )}
                </div>

                {/* Locked elements list - cyan for primary action */}
                {lockedElements.length > 0 && (
                  <div className={`px-3 py-2 ${semanticColors.primary.bg} border ${semanticColors.primary.border} radius-md space-y-2 mb-2`}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono type-label text-cyan-400">
                        {lockedElements.length} elements locked
                      </span>
                    </div>
                    {/* Convert to Dimensions Button */}
                    {onConvertElementsToDimensions && (
                      <div className="pt-1 border-t border-cyan-500/20">
                        <ElementToDimensionButton
                          lockedElements={lockedElements}
                          onApply={onConvertElementsToDimensions}
                          isDisabled={isGenerating}
                        />
                      </div>
                    )}
                  </div>
                )}

                <textarea
                  value={feedback.positive}
                  onChange={(e) => onFeedbackChange({ ...feedback, positive: e.target.value })}
                  placeholder={hasLockedPrompts || lockedElements.length > 0
                    ? `${hasLockedPrompts ? 'Locked prompts' : ''} ${hasLockedPrompts && lockedElements.length > 0 ? '+' : ''} ${lockedElements.length > 0 ? `${lockedElements.length} elements` : ''} active.`
                    : "What should stay the same? (e.g. 'composition', 'lighting')"}
                  className={`w-full h-24 bg-slate-900/50 border radius-md p-3 text-xs placeholder-slate-600 resize-none
                              focus:outline-none focus:ring-1 transition-all
                              ${feedback.positive ? 'border-green-500/30 ring-green-500/30' : 'border-slate-800 focus:border-green-500/50 focus:ring-green-500/50'}`}
                />
              </div>

              {/* Center: Generate Button + Mode Toggle (Default Layout) */}
              {variant === 'default' && (
                <div className="flex flex-col items-center justify-center py-md">
                  {/* ... (Generate button logic for default variant if needed, but we are in stacked usually) ... */}
                </div>
              )}

              {/* Right: What to change - amber for warning/attention semantic */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
                    <RefreshCw size={12} className={semanticColors.warning.text} />
                    Change
                  </label>
                </div>
                <textarea
                  value={feedback.negative}
                  onChange={(e) => onFeedbackChange({ ...feedback, negative: e.target.value })}
                  placeholder="What should be different? (e.g. 'make it darker', 'change angle')"
                  className={`w-full h-24 bg-slate-900/50 border radius-md p-3 text-xs placeholder-slate-600 resize-none
                              focus:outline-none focus:ring-1 transition-all
                              ${feedback.negative ? 'border-amber-500/30 ring-amber-500/30' : 'border-slate-800 focus:border-amber-500/50 focus:ring-amber-500/50'}`}
                />
                {feedback.negative && (
                  <motion.div
                    variants={expandCollapse}
                    initial="initial"
                    animate="animate"
                    transition={transitions.normal}
                    className="flex justify-end"
                  >
                    <button
                      onClick={() => onConvertElementsToDimensions?.(
                        [createDimensionWithDefaults({ id: '1', type: 'mood', label: 'Mood', icon: 'Sparkles', placeholder: 'Mood', reference: feedback.negative })]
                      )}
                      data-testid="refine-dimensions-btn"
                      className="type-label text-amber-500 hover:text-amber-400 flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 radius-sm"
                      title="Convert feedback to dimensions"
                    >
                      <Sparkles size={10} />
                      Refine dimensions
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Negative Prompts Section */}
            {onNegativePromptsChange && (
              <div className="mt-md pt-md border-t border-slate-800/50">
                <NegativePromptInput
                  negativePrompts={negativePrompts}
                  onNegativePromptsChange={onNegativePromptsChange}
                  dimensions={dimensions}
                  isGenerating={isAnyGenerating}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Generate Button for Stacked Variant (Always Visible) */}
      {variant === 'stacked' && (
        <div className={`flex flex-col items-center transition-all duration-300 ${isExpanded ? 'pt-md mt-sm border-t border-slate-800/50' : ''}`}>

          <div className="w-full flex gap-sm items-center">
            {/* Interactive Mode Toggle - appears before output mode when available */}
            {onInteractiveModeChange && availableInteractiveModes.length > 1 && (
              <InteractiveModeToggle
                mode={interactiveMode}
                availableModes={availableInteractiveModes}
                onModeChange={onInteractiveModeChange}
                disabled={isAnyGenerating}
              />
            )}

            {/* Output Mode Toggle - 50% width */}
            <div className="flex-1 flex radius-md border border-slate-800 bg-slate-900/50 overflow-hidden">
              <button
                onClick={() => onOutputModeChange('concept')}
                data-testid="output-mode-concept"
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 type-label font-mono uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900
                            ${outputMode === 'concept'
                              ? 'bg-amber-500/20 text-amber-400 border-r border-amber-500/30'
                              : 'text-slate-500 hover:text-slate-300 border-r border-slate-800'}`}
                title="Concept Art Mode"
              >
                <Palette size={12} />
                <span>Concept</span>
              </button>
              <button
                onClick={() => onOutputModeChange('gameplay')}
                data-testid="output-mode-gameplay"
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 type-label font-mono uppercase tracking-wide transition-colors border-r focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900
                            ${outputMode === 'gameplay'
                              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                              : 'text-slate-500 hover:text-slate-300 border-slate-800'}`}
                title="Gameplay Screenshot Mode"
              >
                <MonitorPlay size={12} />
                <span>Gameplay</span>
              </button>
              <button
                onClick={() => onOutputModeChange('poster')}
                data-testid="output-mode-poster"
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 type-label font-mono uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900
                            ${outputMode === 'poster'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'text-slate-500 hover:text-slate-300'}`}
                title="Generate Key Art Poster"
              >
                <Film size={12} />
                <span>Poster</span>
              </button>
            </div>

            {/* Generate Button - Slimmer */}
            <button
              onClick={onGenerate}
              disabled={!canGenerate || isAnyGenerating}
              data-testid="generate-btn"
              className={`flex-1 relative group overflow-hidden radius-md p-[1px] btn-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
                  ${!canGenerate || isAnyGenerating
                  ? 'opacity-50 cursor-not-allowed grayscale'
                  : 'hover:scale-[1.005]'
                }`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative h-7 bg-black/90 radius-md flex items-center justify-center gap-2 group-hover:bg-black/80 transition-colors px-4">
                {isAnyGenerating ? (
                  <>
                    <Loader2 className={`animate-spin ${isGeneratingPoster ? 'text-rose-400' : 'text-cyan-400'}`} size={14} />
                    <span className={`font-mono type-body-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r ${isGeneratingPoster ? 'from-rose-400 to-amber-400' : 'from-cyan-400 to-purple-400'}`}>
                      {isGeneratingPoster ? 'GENERATING POSTER...' : 'SIMULATING...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Wand2 className={`group-hover:rotate-12 transition-transform duration-300 ${canGenerate ? 'text-cyan-400' : 'text-slate-600'}`} size={14} />
                    <span className={`font-mono type-body-sm tracking-wider ${canGenerate ? 'text-white group-hover:text-cyan-50' : 'text-slate-500'}`}>
                      GENERATE
                    </span>
                    <span className="hidden sm:inline font-mono type-label text-slate-600 ml-1">⏎</span>
                  </>
                )}
              </div>
            </button>

            {/* Undo/Redo Controls */}
            {promptHistory && promptHistory.historyLength > 0 && (
              <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800 radius-md px-1.5 py-0.5">
                <button
                  onClick={onPromptUndo}
                  disabled={!promptHistory.canUndo || isAnyGenerating}
                  data-testid="prompt-undo-btn"
                  className={`p-1.5 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50
                    ${promptHistory.canUndo && !isAnyGenerating
                      ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50'
                      : 'text-slate-700 cursor-not-allowed'
                    }`}
                  title="Undo to previous generation"
                >
                  <Undo2 size={14} />
                </button>
                <span className="font-mono type-label text-slate-500 px-1 min-w-[3rem] text-center">
                  {promptHistory.positionLabel}
                </span>
                <button
                  onClick={onPromptRedo}
                  disabled={!promptHistory.canRedo || isAnyGenerating}
                  data-testid="prompt-redo-btn"
                  className={`p-1.5 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50
                    ${promptHistory.canRedo && !isAnyGenerating
                      ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50'
                      : 'text-slate-700 cursor-not-allowed'
                    }`}
                  title="Redo to next generation"
                >
                  <Redo2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FeedbackPanel;
