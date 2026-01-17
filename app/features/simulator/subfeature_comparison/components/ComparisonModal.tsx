/**
 * ComparisonModal - Side-by-side comparison view for generated prompts
 *
 * Allows users to compare two or more generations side by side,
 * highlighting differences in dimensions, prompts, and resulting images.
 * Useful for A/B testing creative directions or showing progress.
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  GitCompare,
  Eye,
  EyeOff,
  LayoutGrid,
  Percent,
  ChevronDown,
  Plus,
  Minus,
} from 'lucide-react';
import {
  ComparisonModalProps,
  GeneratedPrompt,
  GeneratedImage,
  ComparisonViewOptions,
} from '../../types';
import { ComparisonCard } from './ComparisonCard';
import { IconButton } from '@/app/components/ui';
import { fadeIn, modalContent, transitions, staggerContainer, staggerItem } from '../../lib/motion';
import { semanticColors } from '../../lib/semanticColors';
import {
  compareElements,
  getComparisonStats,
  getSceneTypeDifferences,
  formatDimensionForComparison,
} from '../../lib/comparison';

export function ComparisonModal({
  isOpen,
  onClose,
  allPrompts,
  allImages,
  initialSelectedIds = [],
  dimensions,
}: ComparisonModalProps) {
  // Selected prompt IDs for comparison
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelectedIds.length >= 2 ? initialSelectedIds : [])
  );

  // View options
  const [viewOptions, setViewOptions] = useState<ComparisonViewOptions>({
    showDimensions: true,
    showElements: true,
    showImages: true,
    highlightDifferences: true,
  });

  // Selection mode vs comparison mode
  const [isSelectionMode, setIsSelectionMode] = useState(initialSelectedIds.length < 2);

  // Toggle selection
  const toggleSelection = useCallback((promptId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(promptId)) {
        next.delete(promptId);
      } else {
        // Limit to 4 selections max
        if (next.size < 4) {
          next.add(promptId);
        }
      }
      return next;
    });
  }, []);

  // Get selected prompts with their images
  const selectedPrompts = useMemo(() => {
    return Array.from(selectedIds)
      .map((id) => {
        const prompt = allPrompts.find((p) => p.id === id);
        const image = allImages.find((img) => img.promptId === id);
        return prompt ? { prompt, image } : null;
      })
      .filter((item): item is { prompt: GeneratedPrompt; image: GeneratedImage | undefined } => item !== null);
  }, [selectedIds, allPrompts, allImages]);

  // Compute comparison stats
  const stats = useMemo(() => {
    if (selectedPrompts.length < 2) return null;
    return getComparisonStats(selectedPrompts.map((s) => s.prompt));
  }, [selectedPrompts]);

  // Scene type differences
  const sceneTypeDiff = useMemo(() => {
    if (selectedPrompts.length < 2) return null;
    return getSceneTypeDifferences(selectedPrompts.map((s) => s.prompt));
  }, [selectedPrompts]);

  // Element diff between first two prompts (for highlighting)
  const elementDiff = useMemo(() => {
    if (selectedPrompts.length < 2) return null;
    return compareElements(selectedPrompts[0].prompt, selectedPrompts[1].prompt);
  }, [selectedPrompts]);

  // Start comparison
  const handleStartComparison = () => {
    if (selectedIds.size >= 2) {
      setIsSelectionMode(false);
    }
  };

  // Back to selection
  const handleBackToSelection = () => {
    setIsSelectionMode(true);
  };

  // Toggle view option
  const toggleViewOption = (key: keyof ComparisonViewOptions) => {
    setViewOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Reset to initial state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (initialSelectedIds.length >= 2) {
        setSelectedIds(new Set(initialSelectedIds));
        setIsSelectionMode(false);
      } else {
        setSelectedIds(new Set());
        setIsSelectionMode(true);
      }
    }
  }, [isOpen, initialSelectedIds]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          data-testid="comparison-modal-backdrop"
        />

        {/* Modal Content */}
        <motion.div
          variants={modalContent}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          className="relative w-full max-w-7xl max-h-[95vh] bg-surface-primary border border-slate-700 radius-lg overflow-hidden flex flex-col shadow-floating"
          onClick={(e) => e.stopPropagation()}
          data-testid="comparison-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 radius-sm border ${semanticColors.processing.border} ${semanticColors.processing.bg}`}>
                <GitCompare size={14} className={semanticColors.processing.text} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-200">
                  {isSelectionMode ? 'Select Prompts to Compare' : 'Side-by-Side Comparison'}
                </h3>
                <p className="type-label font-mono text-slate-500">
                  {isSelectionMode
                    ? `${selectedIds.size} of 4 selected (min 2)`
                    : `Comparing ${selectedPrompts.length} generations`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Stats badge when comparing */}
              {!isSelectionMode && stats && (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-800/50 radius-md border border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Percent size={12} className="text-green-400" />
                    <span className="font-mono type-label text-green-400">
                      {stats.similarityPercent}% similar
                    </span>
                  </div>
                  <div className="w-px h-4 bg-slate-700" />
                  <span className="font-mono type-label text-slate-500">
                    {stats.commonElements} common / {stats.uniqueElements} unique
                  </span>
                </div>
              )}

              <IconButton
                size="md"
                variant="subtle"
                colorScheme="default"
                onClick={onClose}
                data-testid="comparison-modal-close-btn"
                label="Close"
              >
                <X size={16} />
              </IconButton>
            </div>
          </div>

          {/* View Controls (when comparing) */}
          {!isSelectionMode && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/50 bg-slate-900/30 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono type-label text-slate-600 uppercase mr-2">View:</span>

                <button
                  onClick={() => toggleViewOption('highlightDifferences')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 radius-sm border text-xs font-medium transition-colors ${
                    viewOptions.highlightDifferences
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : 'border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                  data-testid="toggle-highlight-differences"
                >
                  {viewOptions.highlightDifferences ? <Eye size={12} /> : <EyeOff size={12} />}
                  Differences
                </button>

                <button
                  onClick={() => toggleViewOption('showElements')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 radius-sm border text-xs font-medium transition-colors ${
                    viewOptions.showElements
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                  data-testid="toggle-show-elements"
                >
                  <LayoutGrid size={12} />
                  Elements
                </button>
              </div>

              <button
                onClick={handleBackToSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 radius-sm border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                data-testid="back-to-selection-btn"
              >
                <ChevronDown size={12} className="rotate-90" />
                Change Selection
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {isSelectionMode ? (
              // Selection Mode: Show all prompts in a grid
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              >
                {allPrompts.map((prompt, index) => {
                  const image = allImages.find((img) => img.promptId === prompt.id);
                  return (
                    <ComparisonCard
                      key={prompt.id}
                      prompt={prompt}
                      image={image}
                      index={index}
                      position="first"
                      highlightDifferences={false}
                      showElements={false}
                      showPromptText={false}
                      selectionMode
                      isSelected={selectedIds.has(prompt.id)}
                      onToggleSelect={toggleSelection}
                    />
                  );
                })}
              </motion.div>
            ) : (
              // Comparison Mode: Side-by-side view
              <div className="space-y-6">
                {/* Dimensions Context */}
                {viewOptions.showDimensions && dimensions.length > 0 && (
                  <div className="p-4 bg-slate-900/40 radius-md border border-slate-800">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-mono type-label text-slate-400 uppercase">
                        Generation Context
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dimensions.map((dim) => (
                        <div
                          key={dim.id}
                          className="px-2.5 py-1 bg-slate-800/50 radius-sm border border-slate-700 text-xs"
                        >
                          <span className="text-slate-500 mr-1.5">{dim.label}:</span>
                          <span className="text-cyan-400 font-medium">
                            {formatDimensionForComparison(dim)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Scene type comparison */}
                    {sceneTypeDiff && !sceneTypeDiff.areAllSame && (
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <span className="font-mono type-label text-amber-400">
                          Different scene types detected
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Side-by-side Comparison Grid */}
                <div
                  className={`grid gap-4 ${
                    selectedPrompts.length === 2
                      ? 'grid-cols-2'
                      : selectedPrompts.length === 3
                        ? 'grid-cols-3'
                        : 'grid-cols-2 lg:grid-cols-4'
                  }`}
                >
                  {selectedPrompts.map((item, index) => (
                    <ComparisonCard
                      key={item.prompt.id}
                      prompt={item.prompt}
                      image={item.image}
                      index={index}
                      elementDiff={elementDiff ?? undefined}
                      position={index === 0 ? 'first' : 'second'}
                      highlightDifferences={viewOptions.highlightDifferences}
                      showElements={viewOptions.showElements}
                      showPromptText={true}
                    />
                  ))}
                </div>

                {/* Difference Legend */}
                {viewOptions.highlightDifferences && elementDiff && (
                  <div className="flex items-center justify-center gap-6 p-3 bg-slate-900/40 radius-md border border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 radius-sm ring-2 ring-amber-500/50 bg-amber-500/20" />
                      <span className="type-label text-slate-400">
                        Unique to first ({elementDiff.onlyInFirst.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 radius-sm ring-2 ring-cyan-500/50 bg-cyan-500/20" />
                      <span className="type-label text-slate-400">
                        Unique to second ({elementDiff.onlyInSecond.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 radius-sm ring-1 ring-green-500/30 bg-green-500/10" />
                      <span className="type-label text-slate-400">
                        Common ({elementDiff.common.length})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-slate-900/30 border-t border-slate-800 flex items-center justify-between shrink-0">
            {isSelectionMode ? (
              <>
                <span className="type-label text-slate-500">
                  Select 2-4 prompts to compare side by side
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    disabled={selectedIds.size === 0}
                    className="px-3 py-1.5 radius-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="clear-selection-btn"
                  >
                    <Minus size={12} className="inline mr-1" />
                    Clear
                  </button>
                  <button
                    onClick={handleStartComparison}
                    disabled={selectedIds.size < 2}
                    className={`px-4 py-1.5 radius-md border text-xs font-medium transition-colors ${
                      selectedIds.size >= 2
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30'
                        : 'border-slate-700 text-slate-500 opacity-50 cursor-not-allowed'
                    }`}
                    data-testid="start-comparison-btn"
                  >
                    <GitCompare size={12} className="inline mr-1" />
                    Compare ({selectedIds.size})
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // Add more prompts
                      setIsSelectionMode(true);
                    }}
                    disabled={selectedIds.size >= 4}
                    className="flex items-center gap-1.5 px-3 py-1.5 radius-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                    data-testid="add-more-btn"
                  >
                    <Plus size={12} />
                    Add More
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 radius-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  data-testid="comparison-close-btn"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ComparisonModal;
