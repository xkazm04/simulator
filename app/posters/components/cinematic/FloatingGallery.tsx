/**
 * FloatingGallery - Horizontal scrolling image gallery with hover effects
 * Displays all project images in a film-strip style layout
 */

'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Play, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { slideUp, galleryItemPreset } from '@/app/features/simulator/lib/motion';
import { MediaSkeleton } from './MediaSkeleton';
import { cn } from '@/app/lib/utils';

interface GalleryImage {
  id: string;
  url: string;
  label: string;
  isPoster?: boolean;
  hasVideo?: boolean;
}

interface FloatingGalleryProps {
  images: GalleryImage[];
  onImageClick: (imageId: string) => void;
}

export function FloatingGallery({ images, onImageClick }: FloatingGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = (imageId: string) => {
    setLoadedImages(prev => new Set(prev).add(imageId));
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (images.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm font-mono text-slate-600">No images saved</p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col justify-center px-4">
      {/* Section Label */}
      <motion.div
        className="text-center mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          Image Gallery • {images.length} items
        </span>
      </motion.div>

      {/* Gallery Container */}
      <div className="relative">
        {/* Scroll Buttons */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/60 border border-white/10 text-white/60 hover:text-white hover:bg-black/80 transition-all backdrop-blur-sm"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/60 border border-white/10 text-white/60 hover:text-white hover:bg-black/80 transition-all backdrop-blur-sm"
        >
          <ChevronRight size={20} />
        </button>

        {/* Scrollable Gallery */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-12 py-4"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              className="shrink-0 group cursor-pointer"
              style={{ scrollSnapAlign: 'center' }}
              variants={slideUp}
              initial="initial"
              animate="animate"
              transition={galleryItemPreset.getTransition(index)}
              onClick={() => onImageClick(image.id)}
            >
              {/* Card */}
              <div className="relative w-32 sm:w-40 lg:w-48">
                {/* Image */}
                <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-white/10 bg-slate-900/50 group-hover:border-cyan-500/50 transition-all duration-300 shadow-lg shadow-black/30 group-hover:shadow-cyan-500/20">
                  {/* Skeleton - fades out when loaded */}
                  <div className={cn(
                    "absolute inset-0 z-10 transition-opacity duration-300",
                    loadedImages.has(image.id) ? "opacity-0 pointer-events-none" : "opacity-100"
                  )}>
                    <MediaSkeleton variant="image" className="w-full h-full" />
                  </div>

                  <Image
                    src={image.url}
                    alt={image.label}
                    fill
                    className={cn(
                      "object-cover group-hover:scale-110 transition-all duration-500",
                      loadedImages.has(image.id) ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={() => handleImageLoad(image.id)}
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    unoptimized
                  />

                  {/* Poster badge */}
                  {image.isPoster && (
                    <div className="absolute top-2 left-2 z-20 p-1 rounded bg-rose-500/20 border border-rose-500/30 backdrop-blur-sm">
                      <Star size={10} className="text-rose-400" fill="currentColor" />
                    </div>
                  )}

                  {/* Video badge */}
                  {image.hasVideo && (
                    <div className="absolute top-2 right-2 z-20 p-1 rounded bg-purple-500/20 border border-purple-500/30 backdrop-blur-sm">
                      <Play size={10} className="text-purple-400" fill="currentColor" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  {/* Reflection effect */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Label */}
                <div className="mt-2 text-center">
                  <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-wider">
                    {image.label}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Gradient masks */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

export default FloatingGallery;
