/**
 * SketchSidebar - Vertical gallery for sketch-type images
 * Displays on left or right side of the hero zone
 * Supports max 3 visible images with vertical carousel for overflow
 *
 * Performance: Each image card manages its own load/error state independently.
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Pencil, AlertTriangle } from 'lucide-react';
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
  onImageError?: (imageId: string) => void;
}

const IMAGE_SIZES = '(max-width: 640px) 128px, (max-width: 768px) 144px, (max-width: 1280px) 176px, 192px';

/**
 * Individual sketch image card — manages its own loading/error state.
 */
function SketchImageCard({
  image,
  index,
  onImageClick,
  onImageError,
}: {
  image: SketchImage;
  index: number;
  onImageClick: (imageId: string) => void;
  onImageError?: (imageId: string) => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
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
        {/* Loading skeleton / Error */}
        <div className={cn(
          "absolute inset-0 z-10 transition-opacity duration-300 bg-gradient-to-br from-slate-800 to-slate-900",
          isLoaded && !hasError ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
          {hasError ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
              <AlertTriangle size={16} className="text-slate-500" />
              <span className="text-[9px] font-mono text-slate-500">Unavailable</span>
            </div>
          ) : (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          )}
        </div>

        <Image
          src={image.image_url}
          alt="Sketch"
          fill
          loading="lazy"
          className={cn(
            "object-cover group-hover:scale-105 transition-all duration-500",
            isLoaded && !hasError ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => { setHasError(true); onImageError?.(image.id); }}
          sizes={IMAGE_SIZES}
        />

        {/* Sketch overlay effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Paper texture overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuOCIgbnVtT2N0YXZlcz0iNCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuMDUiLz48L3N2Zz4=')] opacity-30 mix-blend-overlay pointer-events-none" />
      </div>
    </motion.div>
  );
}

export function SketchSidebar({ images, side, onImageClick, onImageError }: SketchSidebarProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const maxVisible = 3;
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + maxVisible < images.length;

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
            <SketchImageCard
              key={image.id}
              image={image}
              index={index}
              onImageClick={onImageClick}
              onImageError={onImageError}
            />
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
