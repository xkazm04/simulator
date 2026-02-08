/**
 * PosterGallery - Grid display of all project posters
 * Design: Clean Manuscript style with rose accent
 *
 * Performance optimizations:
 * - Native lazy loading + Next.js image optimization with responsive sizes
 * - Viewport-aware animation: first 12 use Framer Motion, rest use CSS + IntersectionObserver
 * - CSS content-visibility: auto for offscreen cards
 * - Per-image skeleton shimmer with fade-in on load
 */

'use client';

import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Film, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/app/lib/utils';
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
  /** Show skeleton placeholders while generating new images */
  isGenerating?: boolean;
  /** Number of skeleton cards to show during generation */
  skeletonCount?: number;
  onPosterClick?: (poster: GalleryPoster) => void;
  /** Called when a poster image fails to load (e.g. 403 from CDN) */
  onPosterError?: (posterId: string) => void;
}

const IMMEDIATE_ANIMATION_COUNT = 12;

const IMAGE_SIZES = '(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw';

/**
 * Skeleton loading card for gallery items
 * Matches the aspect ratio and styling of actual poster cards
 */
function PosterSkeleton({ index }: { index: number }) {
  return (
    <div
      className="relative aspect-[2/3] radius-lg overflow-hidden border border-slate-700/30 bg-slate-800/50 animate-pulse"
      data-testid={`poster-skeleton-${index}`}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shimmer" />

      {/* Decorative elements */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="p-3 rounded-full bg-rose-500/10 border border-rose-500/20">
          <Loader2 size={20} className="text-rose-400/50 animate-spin" />
        </div>
        <span className="font-mono type-label text-slate-600">generating...</span>
      </div>

      {/* Bottom gradient placeholder */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/40 to-transparent">
        <div className="h-3 w-3/4 bg-slate-700/50 rounded mb-2" />
        <div className="h-2 w-1/2 bg-slate-700/30 rounded" />
      </div>
    </div>
  );
}

/**
 * Individual poster card with viewport-aware animation and image loading states.
 *
 * First N cards (IMMEDIATE_ANIMATION_COUNT) use Framer Motion stagger.
 * Remaining cards use IntersectionObserver + CSS transitions for performance.
 */
function PosterCard({
  poster,
  index,
  onPosterClick,
  onPosterError,
}: {
  poster: GalleryPoster;
  index: number;
  onPosterClick?: (poster: GalleryPoster) => void;
  onPosterError?: (posterId: string) => void;
}) {
  const isImmediate = index < IMMEDIATE_ANIMATION_COUNT;
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(isImmediate);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // IntersectionObserver for below-fold cards
  useEffect(() => {
    if (isImmediate) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isImmediate]);

  const cardContent = (
    <>
      {/* Image container */}
      <div className="relative aspect-[2/3] radius-lg overflow-hidden border border-slate-700/50 bg-slate-900/50 hover:border-rose-500/50 transition-all duration-300 hover:shadow-elevated hover:shadow-rose-900/20">
        {/* Skeleton / Error - fades out when loaded */}
        <div
          className={cn(
            'absolute inset-0 z-10 transition-opacity duration-500',
            isLoaded && !hasError ? 'opacity-0 pointer-events-none' : 'opacity-100',
          )}
        >
          {hasError ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-800/80">
              <AlertTriangle size={20} className="text-slate-500" />
              <span className="text-[10px] font-mono text-slate-500">Unavailable</span>
            </div>
          ) : (
            <div className="absolute inset-0 bg-slate-800/50 animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shimmer" />
            </div>
          )}
        </div>

        <Image
          src={poster.image_url}
          alt={poster.project_name}
          fill
          loading="lazy"
          sizes={IMAGE_SIZES}
          className={cn(
            'object-cover group-hover:scale-105 transition-all duration-500',
            isLoaded && !hasError ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => { setHasError(true); onPosterError?.(poster.id); }}
        />

        {/* Film icon badge - visible on hover */}
        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
          <Film size={12} className="text-rose-400" />
        </div>
      </div>

      {/* Title and date below image */}
      <div className="mt-2 px-1">
        <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
          {poster.project_name}
        </p>
        <p className="type-label text-slate-500 font-mono mt-0.5">
          {new Date(poster.created_at).toLocaleDateString()}
        </p>
      </div>
    </>
  );

  // First N cards: Framer Motion stagger
  if (isImmediate) {
    return (
      <motion.div
        variants={slideUp}
        initial="initial"
        animate="animate"
        transition={galleryItemPreset.getTransition(index)}
        className="group cursor-pointer"
        onClick={() => onPosterClick?.(poster)}
      >
        {cardContent}
      </motion.div>
    );
  }

  // Below-fold cards: CSS transition + IntersectionObserver + content-visibility
  return (
    <div
      ref={cardRef}
      className="group cursor-pointer transition-all duration-500 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'none' : 'translateY(12px)',
        contentVisibility: 'auto',
        containIntrinsicSize: '0 400px',
      }}
      onClick={() => onPosterClick?.(poster)}
    >
      {cardContent}
    </div>
  );
}

export function PosterGallery({
  posters,
  isLoading = false,
  isGenerating = false,
  skeletonCount = 4,
  onPosterClick,
  onPosterError,
}: PosterGalleryProps) {
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
      {/* Skeleton loading cards during generation */}
      {isGenerating && Array.from({ length: skeletonCount }).map((_, index) => (
        <PosterSkeleton key={`skeleton-${index}`} index={index} />
      ))}

      {/* Actual poster cards */}
      {posters.map((poster, index) => (
        <PosterCard
          key={poster.id}
          poster={poster}
          index={index}
          onPosterClick={onPosterClick}
          onPosterError={onPosterError}
        />
      ))}
    </div>
  );
}

export default PosterGallery;
