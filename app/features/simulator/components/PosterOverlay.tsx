/**
 * PosterOverlay - Displays the project poster in the Source Analysis section
 * Design: Clean Manuscript style with rose accent
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Film, Loader2 } from 'lucide-react';
import { ProjectPoster } from '../types';

interface PosterOverlayProps {
  poster: ProjectPoster | null;
  isGenerating?: boolean;
}

export function PosterOverlay({ poster, isGenerating = false }: PosterOverlayProps) {

  if (isGenerating) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex flex-col items-center justify-center h-full py-12 gap-4"
      >
        <div className="relative">
          <div className="p-4 rounded-full bg-rose-500/20 border border-rose-500/30">
            <Loader2 size={32} className="text-rose-400 animate-spin" />
          </div>
          <div className="absolute -inset-2 bg-rose-500/10 rounded-full animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">Generating Poster</p>
          <p className="text-xs text-slate-500 mt-1 font-mono">Creating unique key art from your dimensions...</p>
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
        className="flex flex-col items-center justify-center h-full py-12 gap-4"
      >
        <div className="p-4 rounded-full bg-slate-800/50 border border-slate-700/50">
          <Film size={32} className="text-slate-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-400">No Poster Generated</p>
          <p className="text-xs text-slate-600 mt-1 font-mono">
            Select &quot;Poster&quot; mode and click Generate to create key art
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center gap-4 pb-4"
    >
      {/* Poster Image */}
      <div className="relative mx-auto">
        <div
          className="relative rounded-lg overflow-hidden border border-rose-500/30 shadow-elevated shadow-rose-900/20"
          style={{ maxWidth: '200px' }}
        >
          <div className="relative aspect-[2/3]">
            <Image
              src={poster.imageUrl}
              alt="Project Poster"
              fill
              className="object-cover"
              unoptimized
            />
            {/* Subtle overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Corner badge */}
        <div className="absolute -top-2 -right-2 p-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 backdrop-blur-sm">
          <Film size={12} className="text-rose-400" />
        </div>
      </div>

      {/* Prompt preview */}
      {poster.prompt && (
        <div className="w-full max-w-xs overflow-hidden">
          <p className="type-label text-slate-500 font-mono text-center leading-relaxed line-clamp-3">
            {poster.prompt}
          </p>
        </div>
      )}

      {/* Timestamp */}
      <p className="type-label text-slate-600 font-mono">
        Generated: {new Date(poster.createdAt).toLocaleDateString()}
      </p>
    </motion.div>
  );
}

export default PosterOverlay;
