/**
 * PosterModal - Fullscreen modal for viewing poster details
 * Design: Clean Manuscript style with rose accent
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Film, Calendar, FileText } from 'lucide-react';
import { GalleryPoster } from './PosterGallery';
import { fadeIn, transitions } from '../lib/motion';

interface PosterModalProps {
  poster: GalleryPoster | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PosterModal({ poster, isOpen, onClose }: PosterModalProps) {
  if (!poster) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={onClose}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            data-testid="poster-modal-close-btn"
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors z-10"
          >
            <X size={20} />
          </button>

          {/* Modal content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={transitions.spring}
            className="relative max-w-4xl w-full mx-4 flex flex-col md:flex-row gap-6 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Poster image */}
            <div className="flex-shrink-0">
              <div className="relative w-full md:w-80 aspect-[2/3] radius-lg overflow-hidden border border-rose-500/30 shadow-floating shadow-rose-900/30">
                <Image
                  src={poster.image_url}
                  alt={poster.project_name}
                  fill
                  className="object-cover"
                  unoptimized
                />

                {/* Film badge */}
                <div className="absolute top-3 right-3 p-2 rounded-full bg-rose-500/20 border border-rose-500/30 backdrop-blur-sm">
                  <Film size={16} className="text-rose-400" />
                </div>
              </div>
            </div>

            {/* Poster info */}
            <div className="flex-1 flex flex-col gap-4 text-left">
              {/* Project name */}
              <div>
                <h2 className="type-title font-bold text-white">{poster.project_name}</h2>
                <div className="flex items-center gap-2 mt-2 text-slate-500">
                  <Calendar size={14} />
                  <span className="text-sm font-mono">
                    {new Date(poster.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Prompt */}
              {poster.prompt && (
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-rose-400" />
                    <span className="text-xs font-mono uppercase text-slate-500">Generation Prompt</span>
                  </div>
                  <div className="p-4 radius-lg bg-slate-900/80 border border-slate-800 max-h-48 overflow-y-auto custom-scrollbar" data-testid="poster-modal-prompt-container">
                    <p className="text-sm text-slate-300 font-mono leading-relaxed">
                      {poster.prompt}
                    </p>
                  </div>
                </div>
              )}

              {/* Dimensions used (if available) */}
              {poster.dimensions_json && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono uppercase text-slate-500">Dimensions Used</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {JSON.parse(poster.dimensions_json).map((dim: { type: string; reference: string }, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700 type-label font-mono text-slate-400"
                      >
                        {dim.type}: {dim.reference.slice(0, 30)}{dim.reference.length > 30 ? '...' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PosterModal;
