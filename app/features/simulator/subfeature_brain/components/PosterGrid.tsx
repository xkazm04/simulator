/**
 * PosterGrid - 2x2 grid for poster selection with save animation
 *
 * Features:
 * - Displays 4 poster variations in a grid
 * - Click to select a poster
 * - Save button in center when poster is selected
 * - Animation: fade out unselected, expand selected on save
 * - Uses maximum available space from parent
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Save, X } from 'lucide-react';
import { PosterGeneration } from '../../hooks/usePoster';

interface PosterGridProps {
  generations: PosterGeneration[];
  selectedIndex: number | null;
  isSaving: boolean;
  onSelect: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function PosterGrid({
  generations,
  selectedIndex,
  isSaving,
  onSelect,
  onSave,
  onCancel,
}: PosterGridProps) {
  // Track if we're in the "saving" animation state
  const [showSaveAnimation, setShowSaveAnimation] = useState(false);

  // Check if at least one poster is ready
  const hasCompletePoster = generations.some((g) => g.status === 'complete');

  // Check if all posters are done (complete or failed)
  const allDone = generations.length > 0 && generations.every(
    (g) => g.status === 'complete' || g.status === 'failed'
  );

  // Handle save with animation
  const handleSave = () => {
    if (selectedIndex === null) return;
    setShowSaveAnimation(true);
    // Delay actual save to allow animation to play
    setTimeout(() => {
      onSave();
    }, 600);
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* 2x2 Grid - fills available space */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 auto-rows-fr">
        {generations.map((gen) => {
          const isSelected = selectedIndex === gen.index;
          const isOther = selectedIndex !== null && !isSelected;
          const shouldFadeOut = showSaveAnimation && isOther;
          const shouldExpand = showSaveAnimation && isSelected;

          return (
            <motion.div
              key={gen.index}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: shouldFadeOut ? 0 : 1,
                scale: shouldExpand ? 1.02 : 1,
                gridColumn: shouldExpand ? '1 / -1' : 'auto',
                gridRow: shouldExpand ? '1 / -1' : 'auto',
              }}
              transition={{
                duration: 0.4,
                ease: 'easeInOut',
              }}
              className={`relative rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                gen.status === 'complete'
                  ? isSelected
                    ? 'border-rose-500 shadow-lg shadow-rose-500/30 cursor-pointer'
                    : 'border-slate-700 hover:border-rose-500/50 cursor-pointer'
                  : 'border-slate-700/50'
              } ${shouldFadeOut ? 'pointer-events-none' : ''}`}
              onClick={() => {
                if (gen.status === 'complete' && !showSaveAnimation && !isSaving) {
                  onSelect(gen.index);
                }
              }}
            >
              {/* Loading state */}
              {(gen.status === 'pending' || gen.status === 'generating') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80">
                  <Loader2 className="w-8 h-8 text-rose-400 animate-spin mb-2" />
                  <span className="font-mono text-xs text-slate-400">
                    {gen.status === 'pending' ? 'Queued...' : 'Generating...'}
                  </span>
                </div>
              )}

              {/* Failed state */}
              {gen.status === 'failed' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 p-4">
                  <X className="w-8 h-8 text-red-400 mb-2" />
                  <span className="font-mono text-xs text-red-400 text-center line-clamp-3">
                    {gen.error || 'Failed'}
                  </span>
                </div>
              )}

              {/* Completed - show image */}
              {gen.status === 'complete' && gen.imageUrl && (
                <>
                  <Image
                    src={gen.imageUrl}
                    alt={`Poster variation ${gen.index + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />

                  {/* Selection indicator */}
                  <AnimatePresence>
                    {isSelected && !showSaveAnimation && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-500 shadow-lg"
                      >
                        <Check size={14} className="text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Hover overlay */}
                  {!isSelected && !showSaveAnimation && (
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                      <span className="font-mono text-xs text-white bg-black/50 px-2 py-1 rounded">
                        Click to select
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Variation number badge */}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-xs font-mono text-slate-300">
                #{gen.index + 1}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Center Save Button - appears when poster is selected */}
      <AnimatePresence>
        {selectedIndex !== null && hasCompletePoster && allDone && !showSaveAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto flex flex-col items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 disabled:cursor-not-allowed rounded-lg text-white font-medium shadow-xl shadow-rose-900/50 transition-all hover:scale-105"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {isSaving ? 'Saving...' : 'Save Poster'}
              </button>
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="text-sm text-slate-400 hover:text-slate-200 font-mono disabled:opacity-50"
              >
                Cancel & Discard All
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions when no selection */}
      {selectedIndex === null && hasCompletePoster && allDone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-center shrink-0"
        >
          <p className="font-mono text-xs text-slate-500">
            Click a poster to select it for saving
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default PosterGrid;
