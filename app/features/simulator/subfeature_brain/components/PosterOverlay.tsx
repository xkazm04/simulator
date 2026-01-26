/**
 * PosterOverlay - Displays poster generation grid or saved poster
 *
 * Shows:
 * - 2x2 PosterGrid during generation (with selection)
 * - Saved poster when no generation in progress
 * - Uses maximum available space from parent container
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Film, Loader2 } from 'lucide-react';
import { ProjectPoster } from '../../types';
import { PosterGeneration } from '../../hooks/usePoster';
import { PosterGrid } from './PosterGrid';

interface PosterOverlayProps {
  // Saved poster
  poster: ProjectPoster | null;

  // Generation state
  posterGenerations: PosterGeneration[];
  selectedIndex: number | null;
  isGenerating: boolean;
  isSaving?: boolean;

  // Actions
  onSelect: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function PosterOverlay({
  poster,
  posterGenerations,
  selectedIndex,
  isGenerating,
  isSaving = false,
  onSelect,
  onSave,
  onCancel,
}: PosterOverlayProps) {
  // Show grid if we have generations (in progress or complete)
  const showGrid = posterGenerations.length > 0;

  // Show loading state only when generating but no generations started yet
  const showInitialLoading = isGenerating && posterGenerations.length === 0;

  if (showInitialLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex flex-col items-center justify-center h-full gap-6"
      >
        <div className="relative">
          <div className="p-6 rounded-full bg-rose-500/20 border border-rose-500/30">
            <Loader2 size={48} className="text-rose-400 animate-spin" />
          </div>
          <div className="absolute -inset-3 bg-rose-500/10 rounded-full animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-slate-300">Generating 4 Posters</p>
          <p className="text-sm text-slate-500 mt-2 font-mono">Creating unique variations from your dimensions...</p>
        </div>
      </motion.div>
    );
  }

  if (showGrid) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex flex-col h-full"
      >
        <div className="mb-3 shrink-0">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider text-center">
            Select Your Poster
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <PosterGrid
            generations={posterGenerations}
            selectedIndex={selectedIndex}
            isSaving={isSaving}
            onSelect={onSelect}
            onSave={onSave}
            onCancel={onCancel}
          />
        </div>
      </motion.div>
    );
  }

  if (!poster) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex flex-col items-center justify-center h-full gap-6"
      >
        <div className="p-6 rounded-full bg-slate-800/50 border border-slate-700/50">
          <Film size={48} className="text-slate-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-slate-400">No Poster Generated</p>
          <p className="text-sm text-slate-600 mt-2 font-mono max-w-sm">
            Select &quot;Poster&quot; mode and click Generate to create key art, or upload your own image
          </p>
        </div>
      </motion.div>
    );
  }

  // Show saved poster - fills available space
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col h-full gap-4"
    >
      {/* Poster Image - takes available height */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="relative h-full max-h-full aspect-[2/3] rounded-lg overflow-hidden border-2 border-rose-500/30 shadow-elevated shadow-rose-900/30">
          <Image
            src={poster.imageUrl}
            alt="Project Poster"
            fill
            className="object-cover"
            unoptimized
          />
          {/* Subtle overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

          {/* Corner badge */}
          <div className="absolute top-3 right-3 p-2 rounded-full bg-rose-500/20 border border-rose-500/30 backdrop-blur-sm">
            <Film size={16} className="text-rose-400" />
          </div>
        </div>
      </div>

      {/* Info row - shrinks */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-2">
        {/* Prompt preview */}
        {poster.prompt && (
          <p className="text-xs text-slate-500 font-mono leading-relaxed line-clamp-2 flex-1">
            {poster.prompt}
          </p>
        )}
        {/* Timestamp */}
        <p className="text-xs text-slate-600 font-mono whitespace-nowrap">
          {new Date(poster.createdAt).toLocaleDateString()}
        </p>
      </div>
    </motion.div>
  );
}

export default PosterOverlay;
