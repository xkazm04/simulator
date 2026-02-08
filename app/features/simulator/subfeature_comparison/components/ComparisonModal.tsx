/**
 * ComparisonModal - Full-screen 2x2 grid comparison view for generated prompts
 *
 * Allows users to compare up to 4 generations in a full-screen grid,
 * maximizing image resolution. Two modes: selection grid → comparison grid.
 */

'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  X,
  GitCompare,
  CheckCircle2,
  ImageIcon,
  ChevronDown,
} from 'lucide-react';
import {
  ComparisonModalProps,
  GeneratedPrompt,
  GeneratedImage,
} from '../../types';
import { fadeIn, transitions } from '../../lib/motion';
import { semanticColors } from '../../lib/semanticColors';

export function ComparisonModal({
  isOpen,
  onClose,
  allPrompts,
  allImages,
  initialSelectedIds = [],
  dimensions,
}: ComparisonModalProps) {
  // Stabilize initialSelectedIds to avoid infinite loop
  const stableInitialIds = useRef(initialSelectedIds);

  // Selected prompt IDs for comparison
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(stableInitialIds.current.length >= 2 ? stableInitialIds.current : [])
  );

  // Selection mode vs comparison mode
  const [isSelectionMode, setIsSelectionMode] = useState(stableInitialIds.current.length < 2);

  // Toggle selection
  const toggleSelection = useCallback((promptId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(promptId)) {
        next.delete(promptId);
      } else {
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

  // Reset state when modal opens - use isOpen as sole dependency
  React.useEffect(() => {
    if (isOpen) {
      const ids = stableInitialIds.current;
      if (ids.length >= 2) {
        setSelectedIds(new Set(ids));
        setIsSelectionMode(false);
      } else {
        setSelectedIds(new Set());
        setIsSelectionMode(true);
      }
    }
  }, [isOpen]);

  // Update the ref when prop changes (for next open)
  React.useEffect(() => {
    stableInitialIds.current = initialSelectedIds;
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex flex-col">
        {/* Backdrop */}
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          className="absolute inset-0 bg-black/95"
        />

        {/* Full-screen content */}
        <div className="relative flex flex-col w-full h-full">
          {/* Compact header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/50 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className={`p-1 radius-sm border ${semanticColors.processing.border} ${semanticColors.processing.bg}`}>
                <GitCompare size={12} className={semanticColors.processing.text} />
              </div>
              <span className="text-sm font-medium text-slate-300">
                {isSelectionMode
                  ? `Select prompts (${selectedIds.size}/4)`
                  : `Comparing ${selectedPrompts.length} scenes`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isSelectionMode && (
                <button
                  onClick={handleBackToSelection}
                  className="flex items-center gap-1.5 px-2.5 py-1 radius-sm border border-slate-700 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <ChevronDown size={12} className="rotate-90" />
                  Change
                </button>
              )}

              {isSelectionMode && (
                <button
                  onClick={handleStartComparison}
                  disabled={selectedIds.size < 2}
                  className={`flex items-center gap-1.5 px-3 py-1 radius-sm border text-xs font-mono transition-colors ${
                    selectedIds.size >= 2
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30'
                      : 'border-slate-700 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <GitCompare size={12} />
                  Compare ({selectedIds.size})
                </button>
              )}

              <button
                onClick={onClose}
                className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Content area - full remaining space */}
          <div className="flex-1 overflow-hidden">
            {isSelectionMode ? (
              /* Selection grid */
              <div className="h-full overflow-y-auto custom-scrollbar p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {allPrompts.map((prompt) => {
                    const image = allImages.find((img) => img.promptId === prompt.id);
                    const hasImage = image?.status === 'complete' && image?.url;
                    const isSelected = selectedIds.has(prompt.id);

                    return (
                      <button
                        key={prompt.id}
                        onClick={() => toggleSelection(prompt.id)}
                        className={`relative aspect-video bg-slate-900 rounded-lg border-2 overflow-hidden transition-all ${
                          isSelected
                            ? 'border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                            : 'border-slate-700/50 hover:border-slate-600'
                        }`}
                      >
                        {hasImage ? (
                          <Image
                            src={image.url!}
                            alt={prompt.sceneType}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ImageIcon size={24} className="text-slate-700" />
                          </div>
                        )}

                        {/* Selection indicator */}
                        <div className={`absolute top-2 right-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-cyan-500 border-cyan-500'
                            : 'bg-black/50 border-slate-500 backdrop-blur-sm'
                        }`}>
                          {isSelected && <CheckCircle2 size={14} className="text-white" />}
                        </div>

                        {/* Scene label */}
                        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-mono text-slate-400 backdrop-blur-sm">
                          Scene {prompt.sceneNumber}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Full-screen 2x2 comparison grid */
              <div className={`h-full grid gap-1 p-1 ${
                selectedPrompts.length === 2
                  ? 'grid-cols-2 grid-rows-1'
                  : selectedPrompts.length === 3
                    ? 'grid-cols-2 grid-rows-2'
                    : 'grid-cols-2 grid-rows-2'
              }`}>
                {selectedPrompts.map((item) => {
                  const hasImage = item.image?.status === 'complete' && item.image?.url;

                  return (
                    <div
                      key={item.prompt.id}
                      className="relative bg-black rounded overflow-hidden"
                    >
                      {hasImage ? (
                        <Image
                          src={item.image!.url!}
                          alt={item.prompt.sceneType}
                          fill
                          className="object-contain"
                          unoptimized
                          sizes="50vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950">
                          <ImageIcon size={32} className="text-slate-700" />
                          <span className="font-mono text-xs text-slate-600 uppercase">
                            {item.image?.status === 'generating' ? 'Generating...' : 'No Image'}
                          </span>
                        </div>
                      )}

                      {/* Scene label overlay */}
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded-md backdrop-blur-sm flex items-center gap-1.5">
                        <span className="font-mono text-xs text-cyan-400 uppercase">
                          Scene {item.prompt.sceneNumber}
                        </span>
                        <span className="text-slate-600 text-[10px] font-mono">
                          {item.prompt.sceneType}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}

export default ComparisonModal;
