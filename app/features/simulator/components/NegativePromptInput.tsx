/**
 * NegativePromptInput - Component for managing negative prompts
 *
 * Features:
 * - Global negatives that apply to all generated scenes
 * - Per-prompt negatives for specific scene customization
 * - Auto-suggestions based on active dimension choices
 * - Quick-add from common negative categories
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Ban,
  Sparkles,
  Globe,
  Target,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  NegativePromptItem,
  NegativePromptSuggestion,
  Dimension,
  COMMON_NEGATIVES,
  DIMENSION_NEGATIVE_SUGGESTIONS,
  DimensionType,
} from '../types';
import { expandCollapse, transitions, fadeIn } from '../lib/motion';
import { semanticColors } from '../lib/semanticColors';

interface NegativePromptInputProps {
  /** Current list of negative prompts */
  negativePrompts: NegativePromptItem[];
  /** Callback when negatives change */
  onNegativePromptsChange: (negatives: NegativePromptItem[]) => void;
  /** Active dimensions for auto-suggestions */
  dimensions: Dimension[];
  /** Whether generation is in progress */
  isGenerating?: boolean;
  /** Optional prompt ID for per-prompt negatives */
  targetPromptId?: string;
  /** Compact mode for inline display */
  compact?: boolean;
}

export function NegativePromptInput({
  negativePrompts,
  onNegativePromptsChange,
  dimensions,
  isGenerating = false,
  targetPromptId,
  compact = false,
}: NegativePromptInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [scope, setScope] = useState<'global' | 'prompt'>('global');

  // Filter negatives by scope
  const globalNegatives = useMemo(
    () => negativePrompts.filter((n) => n.scope === 'global'),
    [negativePrompts]
  );

  const promptNegatives = useMemo(
    () => negativePrompts.filter((n) => n.scope === 'prompt' && (!targetPromptId || n.promptId === targetPromptId)),
    [negativePrompts, targetPromptId]
  );

  // Generate auto-suggestions based on active dimensions
  const autoSuggestions = useMemo(() => {
    const suggestions: NegativePromptSuggestion[] = [];
    const existingTexts = new Set(negativePrompts.map((n) => n.text.toLowerCase()));

    dimensions.forEach((dim) => {
      if (dim.reference?.trim()) {
        const dimSuggestions = DIMENSION_NEGATIVE_SUGGESTIONS[dim.type as DimensionType];
        if (dimSuggestions) {
          dimSuggestions.forEach((suggestion) => {
            if (!existingTexts.has(suggestion.text.toLowerCase())) {
              suggestions.push(suggestion);
            }
          });
        }
      }
    });

    return suggestions;
  }, [dimensions, negativePrompts]);

  // Add a negative prompt
  const handleAddNegative = useCallback((text: string, isAutoSuggested = false) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Check for duplicates
    const exists = negativePrompts.some(
      (n) => n.text.toLowerCase() === trimmedText.toLowerCase() && n.scope === scope
    );
    if (exists) return;

    const newItem: NegativePromptItem = {
      id: uuidv4(),
      text: trimmedText,
      scope,
      promptId: scope === 'prompt' ? targetPromptId : undefined,
      isAutoSuggested,
    };

    onNegativePromptsChange([...negativePrompts, newItem]);
    setInputValue('');
  }, [negativePrompts, onNegativePromptsChange, scope, targetPromptId]);

  // Remove a negative prompt
  const handleRemoveNegative = useCallback((id: string) => {
    onNegativePromptsChange(negativePrompts.filter((n) => n.id !== id));
  }, [negativePrompts, onNegativePromptsChange]);

  // Handle keyboard input
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleAddNegative(inputValue);
    }
  }, [inputValue, handleAddNegative]);

  // Add from suggestion
  const handleAddSuggestion = useCallback((suggestion: NegativePromptSuggestion) => {
    handleAddNegative(suggestion.text, true);
  }, [handleAddNegative]);

  // Add from category
  const handleAddFromCategory = useCallback((text: string) => {
    handleAddNegative(text);
    setActiveCategory(null);
  }, [handleAddNegative]);

  // Render negative chip
  const renderNegativeChip = (item: NegativePromptItem) => (
    <motion.div
      key={item.id}
      variants={fadeIn}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`inline-flex items-center gap-1 px-2 py-1 radius-sm text-xs
                  ${item.isAutoSuggested
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}
      data-testid={`negative-chip-${item.id}`}
    >
      <Ban size={10} className="opacity-60" />
      <span className="max-w-[120px] truncate">{item.text}</span>
      <button
        onClick={() => handleRemoveNegative(item.id)}
        className="hover:text-white transition-colors ml-0.5"
        disabled={isGenerating}
        data-testid={`remove-negative-${item.id}`}
      >
        <X size={12} />
      </button>
    </motion.div>
  );

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {negativePrompts.slice(0, 5).map(renderNegativeChip)}
        {negativePrompts.length > 5 && (
          <span className="text-xs text-slate-500">+{negativePrompts.length - 5} more</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header with toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 radius-md bg-slate-900/30 border border-slate-800 hover:border-red-500/30 transition-colors"
        data-testid="negative-prompt-toggle"
      >
        <div className="flex items-center gap-2">
          <Ban size={14} className="text-red-400" />
          <span className="text-xs font-medium text-slate-300">Negative Prompts</span>
          {negativePrompts.length > 0 && (
            <span className="type-label px-1.5 py-0.5 radius-sm bg-red-500/20 text-red-400 border border-red-500/30">
              {negativePrompts.length}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={transitions.normal}
        >
          <ChevronDown size={14} className="text-slate-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={expandCollapse}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.normal}
            className="overflow-hidden space-y-3"
          >
            {/* Scope toggle */}
            <div className="flex gap-1 p-1 radius-md bg-slate-900/50 border border-slate-800">
              <button
                onClick={() => setScope('global')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 type-label font-mono uppercase tracking-wide transition-colors radius-sm
                            ${scope === 'global'
                              ? 'bg-red-500/20 text-red-400'
                              : 'text-slate-500 hover:text-slate-300'}`}
                data-testid="scope-global-btn"
              >
                <Globe size={12} />
                <span>Global</span>
              </button>
              <button
                onClick={() => setScope('prompt')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 type-label font-mono uppercase tracking-wide transition-colors radius-sm
                            ${scope === 'prompt'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'text-slate-500 hover:text-slate-300'}`}
                data-testid="scope-prompt-btn"
              >
                <Target size={12} />
                <span>Per-Prompt</span>
              </button>
            </div>

            {/* Input field */}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add negative prompt (e.g., blurry, watermark)"
                className="flex-1 bg-slate-900/50 border border-slate-800 radius-md px-3 py-2 text-xs placeholder-slate-600
                           focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all"
                disabled={isGenerating}
                data-testid="negative-prompt-input"
              />
              <button
                onClick={() => handleAddNegative(inputValue)}
                disabled={!inputValue.trim() || isGenerating}
                className="px-3 py-2 radius-md bg-red-500/20 text-red-400 border border-red-500/30
                           hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="add-negative-btn"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Current negatives */}
            {(scope === 'global' ? globalNegatives : promptNegatives).length > 0 && (
              <div className="space-y-2">
                <span className="type-label text-slate-500 uppercase">
                  {scope === 'global' ? 'Global' : 'Per-Prompt'} Negatives
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <AnimatePresence mode="popLayout">
                    {(scope === 'global' ? globalNegatives : promptNegatives).map(renderNegativeChip)}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Auto-suggestions */}
            {autoSuggestions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  data-testid="toggle-suggestions-btn"
                >
                  <Sparkles size={12} />
                  <span>AI Suggestions ({autoSuggestions.length})</span>
                  <motion.div
                    animate={{ rotate: showSuggestions ? 180 : 0 }}
                    transition={transitions.normal}
                  >
                    <ChevronDown size={12} />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {showSuggestions && (
                    <motion.div
                      variants={expandCollapse}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={transitions.normal}
                      className="space-y-1.5"
                    >
                      {autoSuggestions.map((suggestion, idx) => (
                        <button
                          key={`${suggestion.text}-${idx}`}
                          onClick={() => handleAddSuggestion(suggestion)}
                          className="w-full flex items-center justify-between p-2 radius-sm bg-purple-500/10 border border-purple-500/20
                                     hover:bg-purple-500/20 hover:border-purple-500/30 transition-colors text-left"
                          disabled={isGenerating}
                          data-testid={`suggestion-${idx}`}
                        >
                          <div className="flex items-center gap-2">
                            <Lightbulb size={12} className="text-purple-400" />
                            <span className="text-xs text-purple-300">{suggestion.text}</span>
                          </div>
                          <span className="type-label text-slate-500">{suggestion.reason}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Quick-add categories */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="type-label text-slate-500 uppercase">Quick Add</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(COMMON_NEGATIVES).map((category) => (
                  <div key={category} className="relative">
                    <button
                      onClick={() => setActiveCategory(activeCategory === category ? null : category)}
                      className={`px-2 py-1 radius-sm type-label font-mono uppercase tracking-wide transition-colors
                                  ${activeCategory === category
                                    ? 'bg-slate-700 text-slate-200 border border-slate-600'
                                    : 'bg-slate-900/50 text-slate-500 border border-slate-800 hover:border-slate-700 hover:text-slate-400'}`}
                      data-testid={`category-${category}-btn`}
                    >
                      {category}
                    </button>

                    <AnimatePresence>
                      {activeCategory === category && (
                        <motion.div
                          variants={fadeIn}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="absolute top-full left-0 mt-1 z-20 p-2 bg-slate-900 border border-slate-700 radius-md shadow-lg min-w-[160px]"
                        >
                          <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                            {COMMON_NEGATIVES[category].map((text) => {
                              const isAdded = negativePrompts.some(
                                (n) => n.text.toLowerCase() === text.toLowerCase()
                              );
                              return (
                                <button
                                  key={text}
                                  onClick={() => !isAdded && handleAddFromCategory(text)}
                                  disabled={isAdded || isGenerating}
                                  className={`w-full text-left px-2 py-1 radius-sm text-xs transition-colors
                                              ${isAdded
                                                ? 'text-slate-600 cursor-not-allowed'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                                  data-testid={`category-item-${text}`}
                                >
                                  {isAdded && <span className="mr-1">✓</span>}
                                  {text}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NegativePromptInput;
