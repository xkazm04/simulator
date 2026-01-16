/**
 * RefinementSuggester - AI-powered improvement suggestions component
 *
 * Displays refinement suggestions based on learned patterns and user preferences.
 * Allows users to apply suggestions to improve prompt generation.
 *
 * Design: Clean Manuscript style with semantic colors
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Plus,
  Minus,
  Edit3,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  Brain,
} from 'lucide-react';
import { RefinementSuggestion, GeneratedPrompt } from '../types';
import { semanticColors } from '../lib/semanticColors';
import { expandCollapse, transitions } from '../lib/motion';
import {
  getAIRefinementSuggestions,
  isLearningReady,
} from '../lib/feedbackLearning';
import { getPreferenceProfile, getAllFeedback } from '../lib/preferenceEngine';

interface RefinementSuggesterProps {
  prompt: GeneratedPrompt;
  onApplySuggestion?: (suggestion: RefinementSuggestion) => void;
  onDismissSuggestion?: (suggestionId: string) => void;
  autoLoad?: boolean;
}

// Icon mapping for suggestion types
const suggestionTypeIcons = {
  add: Plus,
  remove: Minus,
  modify: Edit3,
  emphasize: TrendingUp,
  deemphasize: TrendingDown,
};

// Color mapping for suggestion types
const suggestionTypeColors = {
  add: semanticColors.success,
  remove: semanticColors.error,
  modify: semanticColors.primary,
  emphasize: semanticColors.success,
  deemphasize: semanticColors.warning,
};

export function RefinementSuggester({
  prompt,
  onApplySuggestion,
  onDismissSuggestion,
  autoLoad = true,
}: RefinementSuggesterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<RefinementSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [learningStatus, setLearningStatus] = useState<{
    ready: boolean;
    feedbackCount: number;
    requiredCount: number;
    progress: number;
  } | null>(null);

  // Load suggestions
  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const profile = await getPreferenceProfile();
      const feedback = await getAllFeedback(20);
      const status = await isLearningReady();
      setLearningStatus(status);

      if (!status.ready) {
        setSuggestions([]);
        return;
      }

      // Try AI-powered suggestions first, fall back to local
      const newSuggestions = await getAIRefinementSuggestions(prompt, feedback, profile);
      setSuggestions(newSuggestions);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
      setError('Failed to load suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad) {
      loadSuggestions();
    }
  }, [autoLoad, loadSuggestions]);

  // Handle apply suggestion
  const handleApply = useCallback(
    (suggestion: RefinementSuggestion) => {
      onApplySuggestion?.(suggestion);
      // Remove from visible list
      setDismissedIds((prev) => new Set([...prev, suggestion.id]));
    },
    [onApplySuggestion]
  );

  // Handle dismiss suggestion
  const handleDismiss = useCallback(
    (suggestionId: string) => {
      onDismissSuggestion?.(suggestionId);
      setDismissedIds((prev) => new Set([...prev, suggestionId]));
    },
    [onDismissSuggestion]
  );

  // Filter out dismissed suggestions
  const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id));

  // Don't render if no suggestions and not loading
  if (!isLoading && visibleSuggestions.length === 0 && learningStatus?.ready) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-3 py-2 radius-md transition-colors
          ${visibleSuggestions.length > 0
            ? `${semanticColors.processing.bg} ${semanticColors.processing.border} border`
            : 'bg-slate-800/30 border border-slate-700/30'
          }
          hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50`}
      >
        <div className="flex items-center gap-2">
          <Brain
            size={14}
            className={visibleSuggestions.length > 0 ? 'text-purple-400' : 'text-slate-500'}
          />
          <span
            className={`type-label ${
              visibleSuggestions.length > 0 ? 'text-purple-400' : 'text-slate-500'
            }`}
          >
            {isLoading
              ? 'Analyzing...'
              : learningStatus && !learningStatus.ready
              ? `Learning (${Math.round(learningStatus.progress * 100)}%)`
              : visibleSuggestions.length > 0
              ? `${visibleSuggestions.length} suggestion${visibleSuggestions.length !== 1 ? 's' : ''}`
              : 'No suggestions'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadSuggestions();
              }}
              className="p-1 text-slate-500 hover:text-purple-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 radius-sm"
              title="Refresh suggestions"
            >
              <RefreshCw size={12} />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp size={14} className="text-slate-500" />
          ) : (
            <ChevronDown size={14} className="text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
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
            <div className="space-y-2">
              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-4 text-purple-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="type-body-sm">Analyzing your preferences...</span>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className={`p-3 radius-md ${semanticColors.error.bg} ${semanticColors.error.border} border`}>
                  <span className={`type-body-sm ${semanticColors.error.text}`}>{error}</span>
                </div>
              )}

              {/* Learning not ready */}
              {!isLoading && learningStatus && !learningStatus.ready && (
                <div className="p-3 radius-md bg-slate-800/30 border border-slate-700/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb size={14} className="text-amber-400" />
                    <span className="type-label text-amber-400">Learning in progress</span>
                  </div>
                  <p className="type-body-sm text-slate-400 mb-2">
                    Rate more prompts to unlock personalized suggestions.
                    {learningStatus.feedbackCount} of {learningStatus.requiredCount} needed.
                  </p>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-slate-700/50 radius-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500/50 transition-all duration-300"
                      style={{ width: `${learningStatus.progress * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Suggestions list */}
              {!isLoading && visibleSuggestions.length > 0 && (
                <div className="space-y-2">
                  {visibleSuggestions.map((suggestion) => {
                    const Icon = suggestionTypeIcons[suggestion.type];
                    const colors = suggestionTypeColors[suggestion.type];

                    return (
                      <motion.div
                        key={suggestion.id}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`p-3 radius-md border ${colors.bg} ${colors.border}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Type icon */}
                          <div className={`p-1.5 radius-sm ${colors.bg}`}>
                            <Icon size={14} className={colors.text} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`type-label ${colors.text} capitalize`}>
                                {suggestion.type}
                              </span>
                              <span className="type-label text-slate-500">
                                &quot;{suggestion.target}&quot;
                              </span>
                              <span className="type-label text-slate-600">
                                ({Math.round(suggestion.confidence * 100)}% confidence)
                              </span>
                            </div>
                            <p className="type-body-sm text-slate-300 mb-1">
                              {suggestion.suggestion}
                            </p>
                            <p className="type-label text-slate-500">{suggestion.reason}</p>

                            {/* Source badge */}
                            <div className="mt-2">
                              <span
                                className={`type-label px-1.5 py-0.5 radius-sm ${
                                  suggestion.source === 'ai'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : suggestion.source === 'pattern'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}
                              >
                                {suggestion.source === 'ai'
                                  ? 'AI Analysis'
                                  : suggestion.source === 'pattern'
                                  ? 'Pattern Match'
                                  : 'Your Feedback'}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleApply(suggestion)}
                              className={`p-1.5 radius-sm ${colors.bg} ${colors.text} hover:bg-opacity-30 transition-colors focus:outline-none focus-visible:ring-2 ${colors.ring}`}
                              title="Apply this suggestion"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => handleDismiss(suggestion.id)}
                              className="p-1.5 radius-sm bg-slate-700/30 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50"
                              title="Dismiss"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Empty state (after learning is ready) */}
              {!isLoading &&
                learningStatus?.ready &&
                visibleSuggestions.length === 0 && (
                  <div className="p-3 radius-md bg-slate-800/30 border border-slate-700/30 text-center">
                    <Lightbulb size={20} className="text-slate-600 mx-auto mb-2" />
                    <p className="type-body-sm text-slate-500">
                      No suggestions for this prompt. Keep rating to improve recommendations!
                    </p>
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default RefinementSuggester;
