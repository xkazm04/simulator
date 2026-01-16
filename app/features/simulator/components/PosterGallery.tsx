/**
 * PosterGallery - Grid display of all project posters
 * Design: Clean Manuscript style with rose accent
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Film, Loader2 } from 'lucide-react';
import { slideUp, galleryItemPreset } from '../lib/motion';

export interface GalleryPoster {
  id: string;
  project_id: string;
  project_name: string;
  image_url: string;
  prompt: string | null;
  dimensions_json: string | null;
  created_at: string;
}

interface PosterGalleryProps {
  posters: GalleryPoster[];
  isLoading?: boolean;
  onPosterClick?: (poster: GalleryPoster) => void;
}

export function PosterGallery({ posters, isLoading = false, onPosterClick }: PosterGalleryProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="p-4 rounded-full bg-rose-500/20 border border-rose-500/30">
          <Loader2 size={32} className="text-rose-400 animate-spin" />
        </div>
        <p className="text-sm text-slate-400 font-mono">Loading gallery...</p>
      </div>
    );
  }

  if (posters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="p-6 rounded-full bg-slate-800/50 border border-slate-700/50">
          <Film size={48} className="text-slate-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-slate-400">No Posters Yet</p>
          <p className="text-sm text-slate-600 mt-2 font-mono max-w-md">
            Generate your first poster by selecting &quot;Poster&quot; mode in the Simulator and clicking Generate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
      {posters.map((poster, index) => (
        <motion.div
          key={poster.id}
          variants={slideUp}
          initial="initial"
          animate="animate"
          transition={galleryItemPreset.getTransition(index)}
          className="group cursor-pointer"
          onClick={() => onPosterClick?.(poster)}
        >
          <div className="relative aspect-[2/3] radius-lg overflow-hidden border border-slate-700/50 bg-slate-900/50 hover:border-rose-500/50 transition-all duration-300 hover:shadow-elevated hover:shadow-rose-900/20">
            <Image
              src={poster.image_url}
              alt={poster.project_name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              unoptimized
            />

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Project name label */}
            <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <p className="text-sm font-medium text-white truncate">{poster.project_name}</p>
              <p className="type-label text-slate-400 font-mono mt-1">
                {new Date(poster.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Film icon badge */}
            <div className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
              <Film size={12} className="text-rose-400" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default PosterGallery;
