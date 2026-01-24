/**
 * SavedImageComparison - Before/After image comparison display
 * Shows original and regenerated images side by side with expand functionality
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, ArrowRight, Loader2, X } from 'lucide-react';

interface SavedImageComparisonProps {
  originalUrl: string;
  regeneratedUrl: string | null;
  isRegenerating: boolean;
  slotLabel: string;
  expandedImage: 'original' | 'regenerated' | null;
  onExpandImage: (image: 'original' | 'regenerated' | null) => void;
}

export function SavedImageComparison({
  originalUrl,
  regeneratedUrl,
  isRegenerating,
  slotLabel,
  expandedImage,
  onExpandImage,
}: SavedImageComparisonProps) {
  return (
    <>
      {/* Image Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        {/* Original Image */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono type-label text-slate-500 uppercase">
                {regeneratedUrl ? 'Original' : 'Saved Image'}
              </span>
              <span className="font-mono type-label text-amber-400">{slotLabel}</span>
            </div>
            <button
              onClick={() => onExpandImage('original')}
              className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
              title="View full size"
            >
              <Maximize2 size={14} />
            </button>
          </div>
          <div
            className="relative aspect-video radius-md overflow-hidden border border-slate-700 bg-slate-900/50 cursor-pointer hover:border-cyan-500/50 transition-colors group"
            onClick={() => onExpandImage('original')}
          >
            <Image
              src={originalUrl}
              alt={`Saved image ${slotLabel}`}
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Maximize2 className="text-white/0 group-hover:text-white/80 transition-colors" size={24} />
            </div>
          </div>
        </div>

        {/* Regenerated Image (or placeholder) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono type-label text-slate-500 uppercase">
                {regeneratedUrl ? 'Regenerated' : 'New Version'}
              </span>
              {regeneratedUrl && (
                <span className="font-mono type-label text-green-500">Ready to save</span>
              )}
            </div>
            {regeneratedUrl && (
              <button
                onClick={() => onExpandImage('regenerated')}
                className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
                title="View full size"
              >
                <Maximize2 size={14} />
              </button>
            )}
          </div>
          <div
            className={`relative aspect-video radius-md overflow-hidden border border-slate-700 bg-slate-900/50 ${regeneratedUrl ? 'cursor-pointer hover:border-cyan-500/50 group' : ''} transition-colors`}
            onClick={() => regeneratedUrl && onExpandImage('regenerated')}
          >
            {regeneratedUrl ? (
              <>
                <Image
                  src={regeneratedUrl}
                  alt="Regenerated"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Maximize2 className="text-white/0 group-hover:text-white/80 transition-colors" size={24} />
                </div>
              </>
            ) : isRegenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
                <span className="font-mono text-xs text-slate-400">Generating with Gemini...</span>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <ArrowRight className="w-8 h-8 text-slate-600 mb-2" />
                <span className="font-mono text-xs text-slate-500">Enter a prompt below</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-size Image Overlay */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => onExpandImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-[95vw] max-h-[95vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={expandedImage === 'original' ? originalUrl : regeneratedUrl || originalUrl}
                alt={expandedImage === 'original' ? `Saved image ${slotLabel}` : 'Regenerated image'}
                width={1920}
                height={1080}
                className="object-contain max-w-[95vw] max-h-[95vh] w-auto h-auto"
                unoptimized
              />
              <button
                onClick={() => onExpandImage(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 radius-md transition-colors"
                title="Close preview"
              >
                <X size={20} className="text-white" />
              </button>
              <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/50 radius-md">
                <span className="font-mono text-sm text-white">
                  {expandedImage === 'original' ? `Original - ${slotLabel}` : 'Regenerated'}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
