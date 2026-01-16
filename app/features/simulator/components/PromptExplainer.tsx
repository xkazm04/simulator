/**
 * PromptExplainer - Shows reasoning behind prompt element choices
 *
 * Displays explanations for why specific elements were included in a prompt,
 * highlighting which user preferences and patterns influenced the generation.
 *
 * Design: Clean Manuscript style with semantic colors
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Brain,
  History,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { GeneratedPrompt, PromptExplanation, PreferenceProfile } from '../types';
import { semanticColors, getCategoryColors } from '../lib/semanticColors';
import { expandCollapse, transitions } from '../lib/motion';
import { generatePromptExplanation } from '../lib/feedbackLearning';
import { getPreferenceProfile } from '../lib/preferenceEngine';

interface PromptExplainerProps {
  prompt: GeneratedPrompt;
  showByDefault?: boolean;
  compact?: boolean;
}

// Impact level colors
const impactColors = {
  high: 'text-green-400 bg-green-500/10 border-green-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  low: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

export function PromptExplainer({
  prompt,
  showByDefault = false,
  compact = false,
}: PromptExplainerProps) {
  const [isExpanded, setIsExpanded] = useState(showByDefault);
  const [explanation, setExplanation] = useState<PromptExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<PreferenceProfile | null>(null);

  // Load explanation
  const loadExplanation = useCallback(async () => {
    setIsLoading(true);

    try {
      const userProfile = await getPreferenceProfile();
      setProfile(userProfile);
      const newExplanation = await generatePromptExplanation(prompt, userProfile);
      setExplanation(newExplanation);
    } catch (err) {
      console.error('Failed to load explanation:', err);
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  // Load on expand
  useEffect(() => {
    if (isExpanded && !explanation) {
      loadExplanation();
    }
  }, [isExpanded, explanation, loadExplanation]);

  // Count influenced elements
  const influencedCount = explanation?.elementExplanations.filter(
    (e) => e.influencedByPreference
  ).length || 0;

  const hasPersonalization = influencedCount > 0 || (profile?.preferences.length || 0) > 0;

  if (compact) {
    // Compact mode: just a small indicator
    return (
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`p-1 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50
          ${hasPersonalization
            ? `${semanticColors.processing.bg} ${semanticColors.processing.text}`
            : 'text-slate-600 hover:text-slate-400'
          }`}
        title={hasPersonalization ? 'Personalized - click for details' : 'Click for prompt explanation'}
      >
        <Info size={14} />
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-3 py-2 radius-md transition-colors
          ${hasPersonalization
            ? `${semanticColors.processing.bg} ${semanticColors.processing.border} border`
            : 'bg-slate-800/30 border border-slate-700/30'
          }
          hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50`}
      >
        <div className="flex items-center gap-2">
          <Info
            size={14}
            className={hasPersonalization ? 'text-purple-400' : 'text-slate-500'}
          />
          <span
            className={`type-label ${hasPersonalization ? 'text-purple-400' : 'text-slate-500'}`}
          >
            {hasPersonalization
              ? `Personalized (${influencedCount} element${influencedCount !== 1 ? 's' : ''})`
              : 'Prompt explanation'}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={14} className="text-slate-500" />
        ) : (
          <ChevronDown size={14} className="text-slate-500" />
        )}
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
            <div
              className={`p-3 radius-md border ${semanticColors.processing.bg} ${semanticColors.processing.border}`}
            >
              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-4 text-purple-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="type-body-sm">Analyzing prompt...</span>
                </div>
              )}

              {/* Explanation content */}
              {!isLoading && explanation && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-start gap-2">
                    <Sparkles size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                    <p className="type-body-sm text-slate-300">{explanation.summary}</p>
                  </div>

                  {/* Applied preferences */}
                  {explanation.appliedPreferences.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Brain size={12} className="text-purple-400" />
                        <span className="type-label text-purple-400">
                          Applied preferences
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {explanation.appliedPreferences.map((pref) => (
                          <span
                            key={pref.preferenceId}
                            className={`px-2 py-1 radius-sm type-label border ${impactColors[pref.impact]}`}
                            title={`${pref.impact} impact`}
                          >
                            {pref.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Element explanations */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <History size={12} className="text-slate-400" />
                      <span className="type-label text-slate-400">Element breakdown</span>
                    </div>
                    <div className="space-y-2">
                      {explanation.elementExplanations.map((elem) => {
                        const categoryColors = getCategoryColors(
                          prompt.elements.find((e) => e.id === elem.elementId)?.category || 'quality'
                        );

                        return (
                          <div
                            key={elem.elementId}
                            className={`p-2 radius-sm border ${categoryColors.bg} ${categoryColors.border}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`type-label ${categoryColors.text}`}>
                                {elem.text}
                              </span>
                              {elem.influencedByPreference && (
                                <span className="type-label px-1.5 py-0.5 radius-sm bg-purple-500/20 text-purple-400">
                                  <Sparkles size={10} className="inline mr-1" />
                                  Personalized
                                </span>
                              )}
                            </div>
                            <p className="type-body-sm text-slate-400">{elem.reason}</p>
                            {elem.relatedPatterns && elem.relatedPatterns.length > 0 && (
                              <div className="mt-1 flex items-center gap-1">
                                <TrendingUp size={10} className="text-cyan-400" />
                                <span className="type-label text-cyan-400">
                                  {elem.relatedPatterns[0]}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* No personalization message */}
                  {!hasPersonalization && (
                    <div className="p-2 radius-sm bg-slate-800/30 border border-slate-700/30">
                      <p className="type-body-sm text-slate-500">
                        Rate prompts to enable personalized generation! Your feedback helps
                        the AI learn your preferences.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!isLoading && !explanation && (
                <div className="py-4 text-center">
                  <Info size={20} className="text-slate-600 mx-auto mb-2" />
                  <p className="type-body-sm text-slate-500">
                    Unable to load explanation.
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

export default PromptExplainer;
