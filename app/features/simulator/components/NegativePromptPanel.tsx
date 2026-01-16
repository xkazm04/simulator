/**
 * NegativePromptPanel - Input for negative prompts (elements to avoid)
 *
 * Features:
 * - Global negatives (apply to all scenes)
 * - Per-prompt negatives (specific to individual prompts)
 * - Auto-suggestions based on dimension choices
 * - Quick-add from common negatives library
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ban, X, Plus, Sparkles, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  NegativePromptItem,
  NegativePromptSuggestion,
  COMMON_NEGATIVES,
  DIMENSION_NEGATIVE_SUGGESTIONS,
  Dimension,
  DimensionType,
} from '../types';
import { semanticColors } from '../lib/semanticColors';
import { expandCollapse, transitions } from '../lib/motion';

interface NegativePromptPanelProps {
  negativePrompts: NegativePromptItem[];
  onNegativePromptsChange: (negatives: NegativePromptItem[]) => void;
  dimensions: Dimension[];
  disabled?: boolean;
}

export function NegativePromptPanel({
  negativePrompts,
  onNegativePromptsChange,
  dimensions,
  disabled = false,
}: NegativePromptPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('quality');

  // Get global negatives only
  const globalNegatives = useMemo(
    () => negativePrompts.filter((n) => n.scope === 'global'),
    [negativePrompts]
  );

  // Generate suggestions based on filled dimensions
  const suggestions = useMemo<NegativePromptSuggestion[]>(() => {
    const result: NegativePromptSuggestion[] = [];
    const existingTexts = new Set(negativePrompts.map((n) => n.text.toLowerCase()));

    dimensions
      .filter((d) => d.reference.trim())
      .forEach((dim) => {
        const dimSuggestions = DIMENSION_NEGATIVE_SUGGESTIONS[dim.type as DimensionType];
        if (dimSuggestions) {
          dimSuggestions.forEach((s) => {
            if (!existingTexts.has(s.text.toLowerCase())) {
              result.push(s);
            }
          });
        }
      });

    return result;
  }, [dimensions, negativePrompts]);

  // Handle adding a negative prompt
  const handleAddNegative = useCallback(
    (text: string, isAutoSuggested = false) => {
      if (!text.trim()) return;

      const newNegative: NegativePromptItem = {
        id: uuidv4(),
        text: text.trim(),
        scope: 'global',
        isAutoSuggested,
      };

      onNegativePromptsChange([...negativePrompts, newNegative]);
      setInputValue('');
    },
    [negativePrompts, onNegativePromptsChange]
  );

  // Handle removing a negative prompt
  const handleRemoveNegative = useCallback(
    (id: string) => {
      onNegativePromptsChange(negativePrompts.filter((n) => n.id !== id));
    },
    [negativePrompts, onNegativePromptsChange]
  );

  // Handle Enter key in input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAddNegative(inputValue);
      }
    },
    [inputValue, handleAddNegative]
  );

  // Build negative prompt string for display/copy
  const negativePromptString = useMemo(
    () => globalNegatives.map((n) => n.text).join(', '),
    [globalNegatives]
  );

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
          <Ban size={12} className={semanticColors.error.text} />
          Negative Prompts
          {globalNegatives.length > 0 && (
            <span className="font-mono type-label text-red-400/70">
              ({globalNegatives.length})
            </span>
          )}
        </label>
        {suggestions.length > 0 && (
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="type-label text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
            data-testid="negative-suggestions-toggle"
          >
            <Lightbulb size={10} />
            {suggestions.length} suggestions
            {showSuggestions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>

      {/* Suggestions panel */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            variants={expandCollapse}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.normal}
            className="overflow-hidden"
          >
            <div className={`p-2 ${semanticColors.warning.bg} border ${semanticColors.warning.border} radius-md mb-2`}>
              <div className="text-xs text-amber-400/80 mb-2 font-medium">
                Based on your dimensions:
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAddNegative(s.text, true)}
                    disabled={disabled}
                    className="px-2 py-0.5 type-label bg-amber-900/30 text-amber-300 radius-sm border border-amber-700/30 hover:bg-amber-800/40 hover:border-amber-600/40 transition-colors disabled:opacity-50 flex items-center gap-1"
                    title={s.reason}
                    data-testid={`negative-suggestion-${idx}`}
                  >
                    <Plus size={10} />
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input field */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add negative prompt (e.g., 'blurry', 'deformed')"
          disabled={disabled}
          className={`flex-1 bg-slate-900/50 border radius-md px-3 py-2 text-xs placeholder-slate-600
                      focus:outline-none focus:ring-1 transition-all disabled:opacity-50
                      ${inputValue ? 'border-red-500/30 ring-red-500/30' : 'border-slate-800 focus:border-red-500/50 focus:ring-red-500/50'}`}
          data-testid="negative-prompt-input"
        />
        <button
          onClick={() => handleAddNegative(inputValue)}
          disabled={disabled || !inputValue.trim()}
          className="px-3 py-2 bg-red-900/30 text-red-400 radius-md border border-red-700/30 hover:bg-red-800/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="negative-prompt-add-btn"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Active negative prompts */}
      {globalNegatives.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {globalNegatives.map((negative) => (
            <motion.span
              key={negative.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`inline-flex items-center gap-1 px-2 py-0.5 radius-sm text-xs border
                         ${negative.isAutoSuggested
                           ? 'bg-amber-900/20 text-amber-300 border-amber-700/30'
                           : 'bg-red-900/20 text-red-300 border-red-700/30'
                         }`}
              data-testid={`negative-chip-${negative.id}`}
            >
              {negative.isAutoSuggested && <Sparkles size={10} className="text-amber-400" />}
              {negative.text}
              <button
                onClick={() => handleRemoveNegative(negative.id)}
                disabled={disabled}
                className="ml-0.5 hover:text-red-200 transition-colors disabled:opacity-50"
                data-testid={`negative-chip-remove-${negative.id}`}
              >
                <X size={12} />
              </button>
            </motion.span>
          ))}
        </div>
      )}

      {/* Common negatives library toggle */}
      <div className="pt-1">
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className="type-label text-slate-500 hover:text-slate-400 flex items-center gap-1 transition-colors"
          data-testid="negative-library-toggle"
        >
          {showLibrary ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          Common negatives library
        </button>
      </div>

      {/* Library panel */}
      <AnimatePresence>
        {showLibrary && (
          <motion.div
            variants={expandCollapse}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.normal}
            className="overflow-hidden"
          >
            <div className="p-2 bg-slate-900/50 border border-slate-800 radius-md space-y-2">
              {/* Category tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {Object.keys(COMMON_NEGATIVES).map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-2 py-1 type-label radius-sm transition-colors whitespace-nowrap
                               ${selectedCategory === category
                                 ? 'bg-slate-700 text-slate-200'
                                 : 'text-slate-500 hover:text-slate-400'
                               }`}
                    data-testid={`negative-category-${category}`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Category items */}
              <div className="flex flex-wrap gap-1">
                {COMMON_NEGATIVES[selectedCategory]?.map((text, idx) => {
                  const isAdded = negativePrompts.some(
                    (n) => n.text.toLowerCase() === text.toLowerCase()
                  );
                  return (
                    <button
                      key={idx}
                      onClick={() => !isAdded && handleAddNegative(text)}
                      disabled={disabled || isAdded}
                      className={`px-2 py-0.5 type-label radius-sm border transition-colors
                                 ${isAdded
                                   ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                                   : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-300'
                                 }`}
                      data-testid={`negative-library-item-${idx}`}
                    >
                      {isAdded ? '✓ ' : '+ '}
                      {text}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview of combined negative prompt */}
      {negativePromptString && (
        <div className="pt-2">
          <div className="text-xs text-slate-500 mb-1">Combined negative prompt:</div>
          <div className="p-2 bg-slate-900/30 border border-slate-800/50 radius-sm font-mono text-xs text-red-400/70 break-words">
            {negativePromptString}
          </div>
        </div>
      )}
    </div>
  );
}

export default NegativePromptPanel;
