/**
 * SketchSidebar - Vertical gallery for sketch-type images
 * Displays on left or right side of the hero zone
 * Supports max 3 visible images with vertical carousel for overflow
 */

'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { cn } from '@/app/lib/utils';

interface SketchImage {
  id: string;
  image_url: string;
  prompt: string | null;
}

interface SketchSidebarProps {
  images: SketchImage[];
  side: 'left' | 'right';
  onImageClick: (imageId: string) => void;
}

export function SketchSidebar({ images, side, onImageClick }: SketchSidebarProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const maxVisible = 3;
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + maxVisible < images.length;

  const handleImageLoad = (imageId: string) => {
    setLoadedImages(prev => new Set(prev).add(imageId));
  };

  const scrollUp = () => {
    if (canScrollUp) setScrollOffset(prev => prev - 1);
  };

  const scrollDown = () => {
    if (canScrollDown) setScrollOffset(prev => prev + 1);
  };

  const visibleImages = images.slice(scrollOffset, scrollOffset + maxVisible);

  if (images.length === 0) return null;

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center gap-4 py-6 px-4",
        side === 'left' ? 'pr-6' : 'pl-6'
      )}
      initial={{ opacity: 0, x: side === 'left' ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
        <Pencil size={12} />
        <span className="text-[10px] font-mono uppercase tracking-wider">Sketches</span>
      </div>

      {/* Scroll Up Button */}
      {images.length > maxVisible && (
        <button
          onClick={scrollUp}
          disabled={!canScrollUp}
          className={cn(
            "p-1.5 rounded-full border transition-all",
            canScrollUp
              ? "border-white/20 text-white/60 hover:text-white hover:bg-white/10"
              : "border-white/5 text-white/20 cursor-not-allowed"
          )}
        >
          <ChevronUp size={16} />
        </button>
      )}

      {/* Images */}
      <div className="flex flex-col gap-4">
        <AnimatePresence mode="popLayout">
          {visibleImages.map((image, index) => (
            <motion.div
              key={image.id}
              className="group cursor-pointer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              onClick={() => onImageClick(image.id)}
            >
              <div className="relative w-32 sm:w-36 lg:w-44 xl:w-48 aspect-[3/4] rounded-lg overflow-hidden border border-white/10 bg-slate-900/50 group-hover:border-amber-500/50 transition-all duration-300 shadow-lg shadow-black/30 group-hover:shadow-amber-500/20">
                {/* Loading skeleton */}
                <div className={cn(
                  "absolute inset-0 z-10 transition-opacity duration-300 bg-gradient-to-br from-slate-800 to-slate-900",
                  loadedImages.has(image.id) ? "opacity-0 pointer-events-none" : "opacity-100"
                )}>
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                </div>

                <Image
                  src={image.image_url}
                  alt="Sketch"
                  fill
                  className={cn(
                    "object-cover group-hover:scale-105 transition-all duration-500",
                    loadedImages.has(image.id) ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => handleImageLoad(image.id)}
                  sizes="(max-width: 768px) 100px, 128px"
                  unoptimized
                />

                {/* Sketch overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Paper texture overlay */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuOCIgbnVtT2N0YXZlcz0iNCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuMDUiLz48L3N2Zz4=')] opacity-30 mix-blend-overlay pointer-events-none" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Scroll Down Button */}
      {images.length > maxVisible && (
        <button
          onClick={scrollDown}
          disabled={!canScrollDown}
          className={cn(
            "p-1.5 rounded-full border transition-all",
            canScrollDown
              ? "border-white/20 text-white/60 hover:text-white hover:bg-white/10"
              : "border-white/5 text-white/20 cursor-not-allowed"
          )}
        >
          <ChevronDown size={16} />
        </button>
      )}

      {/* Image count */}
      {images.length > maxVisible && (
        <span className="text-[9px] font-mono text-slate-600">
          {scrollOffset + 1}-{Math.min(scrollOffset + maxVisible, images.length)} / {images.length}
        </span>
      )}
    </motion.div>
  );
}

export default SketchSidebar;
