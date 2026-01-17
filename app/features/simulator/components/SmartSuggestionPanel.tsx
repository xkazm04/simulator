/**
 * SmartSuggestionPanel - AI-powered suggestions based on user learning
 *
 * Displays smart suggestions for:
 * - Dimension types to add
 * - Weight adjustments
 * - Negative prompts
 * - Output mode recommendations
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
  Sparkles,
  Scale,
  Ban,
  MonitorPlay,
  Loader2,
} from 'lucide-react';
import { SmartSuggestion, Dimension, DimensionType, OutputMode } from '../types';
import { generateSmartSuggestions, recordSuggestionResponse, storeSuggestion } from '../lib/preferenceEngine';
import { semanticColors } from '../lib/semanticColors';
import { expandCollapse, transitions } from '../lib/motion';

interface SmartSuggestionPanelProps {
  dimensions: Dimension[];
  baseImageDescription: string;
  onAcceptDimensionSuggestion?: (dimensionType: DimensionType, weight?: number) => void;
  onAcceptWeightSuggestion?: (dimensionType: DimensionType, weight: number) => void;
  onAcceptNegativePrompt?: (negativePrompt: string) => void;
  onAcceptOutputMode?: (mode: OutputMode) => void;
  isGenerating?: boolean;
}

const suggestionIcons: Record<SmartSuggestion['type'], React.ReactNode> = {
  dimension: <Sparkles size={14} className="text-cyan-400" />,
  weight: <Scale size={14} className="text-purple-400" />,
  negative_prompt: <Ban size={14} className="text-rose-400" />,
  output_mode: <MonitorPlay size={14} className="text-amber-400" />,
  element_lock: <Check size={14} className="text-green-400" />,
};

export function SmartSuggestionPanel({
  dimensions,
  baseImageDescription,
  onAcceptDimensionSuggestion,
  onAcceptWeightSuggestion,
  onAcceptNegativePrompt,
  onAcceptOutputMode,
  isGenerating = false,
}: SmartSuggestionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Load suggestions when dimensions change (client-side only)
  const loadSuggestions = useCallback(async () => {
    // Only run on client side (IndexedDB not available on server)
    if (typeof window === 'undefined') return;
    if (dimensions.length === 0 && !baseImageDescription) return;

    setIsLoading(true);
    try {
      const newSuggestions = await generateSmartSuggestions(dimensions, baseImageDescription);
      // Store suggestions for tracking
      for (const suggestion of newSuggestions) {
        await storeSuggestion(suggestion);
      }
      setSuggestions(newSuggestions.filter((s) => !dismissedIds.has(s.id)));
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dimensions, baseImageDescription, dismissedIds]);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      loadSuggestions();
    }
  }, [loadSuggestions]);

  const handleAccept = async (suggestion: SmartSuggestion) => {
    await recordSuggestionResponse(suggestion.id, true);

    switch (suggestion.type) {
      case 'dimension':
        if (suggestion.data.dimensionType && onAcceptDimensionSuggestion) {
          onAcceptDimensionSuggestion(suggestion.data.dimensionType, suggestion.data.weight);
        }
        break;
      case 'weight':
        if (suggestion.data.dimensionType && suggestion.data.weight != null && onAcceptWeightSuggestion) {
          onAcceptWeightSuggestion(suggestion.data.dimensionType, suggestion.data.weight);
        }
        break;
      case 'negative_prompt':
        if (suggestion.data.negativePrompt && onAcceptNegativePrompt) {
          onAcceptNegativePrompt(suggestion.data.negativePrompt);
        }
        break;
      case 'output_mode':
        if (suggestion.data.outputMode && onAcceptOutputMode) {
          onAcceptOutputMode(suggestion.data.outputMode);
        }
        break;
    }

    // Remove from list
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  };

  const handleDismiss = async (suggestion: SmartSuggestion) => {
    await recordSuggestionResponse(suggestion.id, false);
    setDismissedIds((prev) => new Set([...prev, suggestion.id]));
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  };

  const visibleSuggestions = suggestions.filter((s) => s.confidence >= 0.5);

  if (visibleSuggestions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="border border-purple-500/20 bg-purple-500/5 radius-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-purple-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-purple-400" />
          <span className="type-body-sm font-medium text-purple-300">
            Smart Suggestions
          </span>
          {visibleSuggestions.length > 0 && (
            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 type-label radius-sm">
              {visibleSuggestions.length}
            </span>
          )}
          {isLoading && <Loader2 size={12} className="animate-spin text-purple-400" />}
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-slate-500" />
        ) : (
          <ChevronDown size={16} className="text-slate-500" />
        )}
      </button>

      {/* Suggestions List */}
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
            <div className="p-3 pt-0 space-y-2">
              {visibleSuggestions.map((suggestion) => (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-start gap-3 p-2 bg-slate-900/50 radius-md border border-slate-800 group hover:border-purple-500/30 transition-colors"
                >
                  {/* Icon */}
                  <div className="mt-0.5">{suggestionIcons[suggestion.type]}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="type-body-sm text-slate-200 truncate">
                      {suggestion.suggestion}
                    </p>
                    <p className="type-label text-slate-500 mt-0.5">
                      {suggestion.reason}
                    </p>
                    {/* Confidence bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-slate-800 radius-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 radius-full"
                          style={{ width: `${suggestion.confidence * 100}%` }}
                        />
                      </div>
                      <span className="type-label text-slate-600">
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleAccept(suggestion)}
                      disabled={isGenerating}
                      className={`p-1.5 radius-sm transition-colors ${
                        isGenerating
                          ? 'text-slate-600 cursor-not-allowed'
                          : 'text-green-400 hover:bg-green-500/20'
                      }`}
                      title="Apply suggestion"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => handleDismiss(suggestion)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 radius-sm transition-colors"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}

              {visibleSuggestions.length === 0 && !isLoading && (
                <p className="type-label text-slate-500 text-center py-4">
                  No suggestions available yet. Keep using the simulator to build your preference profile!
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SmartSuggestionPanel;
