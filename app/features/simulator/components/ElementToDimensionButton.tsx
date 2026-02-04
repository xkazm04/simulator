/**
 * ElementToDimensionButton - Convert locked elements into reusable dimension cards
 * Design: Clean Manuscript style
 *
 * When user has locked elements, this button lets them convert those
 * into dimension cards they can reuse in future simulations.
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Loader2, Check, X, Sparkles } from 'lucide-react';
import { PromptElement, Dimension, DimensionType, createDimensionWithDefaults } from '../types';
import { elementToDimension, ElementToDimensionResult } from '../subfeature_brain/lib/simulatorAI';
import { getDimensionPreset } from '../lib/defaultDimensions';
import { v4 as uuidv4 } from 'uuid';

interface ElementToDimensionButtonProps {
  lockedElements: PromptElement[];
  onApply: (dimensions: Dimension[]) => void;
  isDisabled?: boolean;
}

export function ElementToDimensionButton({
  lockedElements,
  onApply,
  isDisabled,
}: ElementToDimensionButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ElementToDimensionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (lockedElements.length === 0) {
    return null;
  }

  const handleConvert = async () => {
    if (isProcessing || lockedElements.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const elements = lockedElements.map((el) => ({
        text: el.text,
        category: el.category,
      }));

      const response = await elementToDimension(elements);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert elements');
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

    onApply(dimensions);
    setResult(null);
  };

  const handleCancel = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-2">
      {/* Convert Button */}
      {!result && (
        <button
          onClick={handleConvert}
          disabled={isProcessing || isDisabled}
          className={`flex items-center gap-2 px-3 py-1.5 radius-lg font-mono type-label uppercase tracking-wide
                     transition-all duration-200 ${
            !isProcessing && !isDisabled
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20'
              : 'bg-slate-800/50 text-slate-600 border border-slate-700/50 cursor-not-allowed'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              converting...
            </>
          ) : (
            <>
              <Layers size={12} />
              convert to dimensions ({lockedElements.length})
            </>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 radius-lg">
          <p className="font-mono type-label text-red-400">{error}</p>
        </div>
      )}

      {/* Result Preview */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-cyan-500/5 border border-cyan-500/30 radius-lg space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-cyan-400" />
                <span className="font-mono type-label uppercase tracking-wider text-cyan-400">
                  converted dimensions
                </span>
              </div>

              {/* Dimensions Preview */}
              <div className="space-y-2">
                {result.dimensions.map((dim, idx) => {
                  const preset = getDimensionPreset(dim.type as DimensionType);
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2 bg-slate-800/50 radius-sm border border-slate-700/50"
                    >
                      <span className="text-sm">{preset?.icon || '✨'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono type-label text-cyan-400 uppercase">
                            {dim.type}
                          </span>
                          <span className="font-mono type-label text-slate-500">
                            from: {dim.sourceElements.join(', ')}
                          </span>
                        </div>
                        <p className="font-mono type-label text-slate-300 mt-1 line-clamp-2">
                          {dim.reference}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reasoning */}
              <p className="font-mono type-label text-slate-500 italic">
                {result.reasoning}
              </p>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-cyan-500/20">
                <button
                  onClick={handleApply}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5
                            bg-cyan-500/20 text-cyan-400 border border-cyan-500/40
                            radius-sm font-mono type-label uppercase tracking-wide
                            hover:bg-cyan-500/30 transition-colors"
                >
                  <Check size={12} />
                  add to dimensions
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-slate-500 hover:text-slate-300
                            font-mono type-label uppercase tracking-wide transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ElementToDimensionButton;
