/**
 * SmartBreakdown - Parse a sentence into structured dimensions
 * Design: Clean Manuscript style
 *
 * Semantic Colors:
 * - purple: Processing/AI-related feature
 * - amber: Alternative mode (concept art)
 * - red: Error state
 *
 * User types a vision like "Baldur's Gate but in Star Wars with modern graphics"
 * Click wand button → AI parses and populates all dimensions
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { smartBreakdown, SmartBreakdownResult } from '../lib/simulatorAI';
import { Dimension, DimensionType, OutputMode, createDimensionWithDefaults } from '../../types';
import { getDimensionPreset } from '../../subfeature_dimensions/lib/defaultDimensions';
import { v4 as uuidv4 } from 'uuid';
import { semanticColors } from '../../lib/semanticColors';
import { expandCollapse, slideDown, transitions } from '../../lib/motion';

interface SmartBreakdownProps {
  onApply: (
    baseImage: string,
    dimensions: Dimension[],
    outputMode: OutputMode
  ) => void;
  isDisabled?: boolean;
}

export function SmartBreakdown({ onApply, isDisabled }: SmartBreakdownProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SmartBreakdownResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleBreakdown = async () => {
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await smartBreakdown(input);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse vision');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (!result) return;

    // Convert result dimensions to Dimension objects with default lens settings
    const dimensions: Dimension[] = result.dimensions.map((d) => {
      const preset = getDimensionPreset(d.type as DimensionType);
      return createDimensionWithDefaults({
        id: uuidv4(),
        type: d.type as DimensionType,
        label: preset?.label || d.type,
        icon: preset?.icon || '✨',
        placeholder: preset?.placeholder || '',
        reference: d.reference,
      });
    });

    onApply(result.baseImage.description, dimensions, result.suggestedOutputMode);
    setResult(null);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBreakdown();
    }
  };

  return (
    <div className="space-y-sm">
      {/* Header with collapse toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-sm w-full text-left group"
      >
        <Sparkles size={14} className="text-purple-400" />
        <span className="font-mono type-label uppercase tracking-wider text-slate-400">
          // smart_breakdown
        </span>
        <span className="font-mono type-label text-slate-500 ml-1">
          (describe your vision in one sentence)
        </span>
        <div className="flex-1" />
        {isExpanded ? (
          <ChevronUp size={12} className="text-slate-600" />
        ) : (
          <ChevronDown size={12} className="text-slate-600" />
        )}
      </button>

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
            {/* Input Row */}
            <div className="flex gap-sm">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., &quot;Baldur's Gate but in Star Wars with modern graphics&quot;"
                  disabled={isProcessing || isDisabled}
                  className="w-full px-4 py-3 bg-slate-900/60 border border-purple-500/30
                            rounded-md text-sm text-slate-200 placeholder-slate-500
                            focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20
                            font-mono transition-colors disabled:opacity-50"
                />
              </div>

              <button
                onClick={handleBreakdown}
                disabled={!input.trim() || isProcessing || isDisabled}
                className={`flex items-center gap-2 px-4 py-3 rounded-md font-mono text-xs uppercase tracking-wide
                           transition-all duration-200 ${
                  input.trim() && !isProcessing
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30'
                    : 'bg-slate-800/50 text-slate-600 border border-slate-700/50 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    parsing...
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    parse
                  </>
                )}
              </button>
            </div>

            {/* Error - red for error state */}
            {error && (
              <div className={`mt-2 px-3 py-2 ${semanticColors.error.bg} border ${semanticColors.error.border} rounded-md`}>
                <p className={`font-mono type-label ${semanticColors.error.text}`}>{error}</p>
              </div>
            )}

            {/* Result Preview */}
            <AnimatePresence>
              {result && (
                <motion.div
                  variants={slideDown}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transitions.normal}
                  className="mt-sm p-md bg-purple-500/5 border border-purple-500/30 rounded-md space-y-sm"
                >
                  {/* Base Image */}
                  <div>
                    <span className="font-mono type-label uppercase tracking-wider text-purple-400">
                      base format:
                    </span>
                    <p className="mt-1 font-mono text-xs text-slate-300">
                      {result.baseImage.format}
                    </p>
                    <p className="mt-0.5 font-mono type-label text-slate-500 line-clamp-2">
                      {result.baseImage.description}
                    </p>
                  </div>

                  {/* Dimensions Preview */}
                  <div>
                    <span className="font-mono type-label uppercase tracking-wider text-purple-400">
                      extracted dimensions ({result.dimensions.length}):
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {result.dimensions.map((dim, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800/50
                                    border border-slate-700/50 rounded-sm font-mono type-label text-slate-300"
                          title={dim.reference}
                        >
                          {getDimensionPreset(dim.type as DimensionType)?.icon || '✨'}
                          {dim.type}
                          <span className="text-slate-600">
                            ({Math.round(dim.confidence * 100)}%)
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Mode */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono type-label uppercase tracking-wider text-purple-400">
                      suggested mode:
                    </span>
                    <span className={`font-mono type-label px-2 py-0.5 rounded-sm ${
                      result.suggestedOutputMode === 'gameplay'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {result.suggestedOutputMode}
                    </span>
                  </div>

                  {/* Reasoning */}
                  <p className="font-mono type-label text-slate-500 italic">
                    {result.reasoning}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-sm pt-sm border-t border-purple-500/20">
                    <button
                      onClick={handleApply}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2
                                bg-purple-500/20 text-purple-400 border border-purple-500/40
                                rounded-md font-mono text-xs uppercase tracking-wide
                                hover:bg-purple-500/30 transition-colors"
                    >
                      <Sparkles size={12} />
                      apply to simulator
                    </button>
                    <button
                      onClick={() => setResult(null)}
                      className="px-4 py-2 text-slate-500 hover:text-slate-300
                                font-mono text-xs uppercase tracking-wide transition-colors"
                    >
                      cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SmartBreakdown;
