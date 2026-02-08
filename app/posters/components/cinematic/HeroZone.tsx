/**
 * HeroZone - Large ambient poster display with glow effects
 * The visual anchor of the cinematic showcase
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Maximize2, Sparkles, AlertTriangle } from 'lucide-react';
import { scaleIn, transitions } from '@/app/features/simulator/lib/motion';
import { MediaSkeleton } from './MediaSkeleton';
import { cn } from '@/app/lib/utils';

interface HeroZoneProps {
  imageUrl?: string;
  imageId?: string;
  projectName: string;
  onImageClick?: () => void;
  onImageError?: (imageId: string) => void;
}

export function HeroZone({ imageUrl, imageId, projectName, onImageClick, onImageError }: HeroZoneProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);

  // Reset loading/error state when image URL changes (render-time adjustment)
  if (prevImageUrl !== imageUrl) {
    setPrevImageUrl(imageUrl);
    setIsLoaded(false);
    setHasError(false);
  }

  if (!imageUrl) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="p-6 rounded-full bg-slate-800/30 border border-slate-700/30 mx-auto w-fit mb-4">
            <Sparkles size={48} className="text-slate-600" />
          </div>
          <p className="text-lg text-slate-500 font-mono">No poster available</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="flex-1 relative flex items-center justify-center p-8 lg:p-16"
      variants={scaleIn}
      initial="initial"
      animate="animate"
      transition={transitions.slow}
    >
      {/* Glow effect behind image */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={{
          opacity: isHovered ? 0.6 : 0.3,
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative w-3/4 max-w-2xl aspect-[2/3]">
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-cover blur-3xl scale-110 opacity-50"
            sizes="50vw"
          />
        </div>
      </motion.div>

      {/* Main poster image */}
      <motion.div
        className="relative cursor-pointer group"
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={onImageClick}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.3 }}
      >
        {/* Animated border glow */}
        <motion.div
          className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-rose-500/30 blur-sm"
          animate={{
            opacity: isHovered ? 1 : 0.5,
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Image container */}
        <div className="relative w-64 sm:w-72 lg:w-80 xl:w-96 aspect-[2/3] rounded-lg overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
          {/* Skeleton - fades out when loaded */}
          <div className={cn(
            "absolute inset-0 z-10 transition-opacity duration-500",
            isLoaded && !hasError ? "opacity-0 pointer-events-none" : "opacity-100"
          )}>
            {hasError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-800/80">
                <AlertTriangle size={24} className="text-slate-500" />
                <span className="text-xs font-mono text-slate-500">Image unavailable</span>
              </div>
            ) : (
              <MediaSkeleton variant="hero" className="w-full h-full" />
            )}
          </div>

          {/* Main image */}
          <Image
            src={imageUrl}
            alt={projectName}
            fill
            className={cn(
              "object-cover transition-opacity duration-500",
              isLoaded && !hasError ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setIsLoaded(true)}
            onError={() => { setHasError(true); if (imageId && onImageError) onImageError(imageId); }}
            sizes="(max-width: 640px) 256px, (max-width: 1024px) 288px, (max-width: 1280px) 320px, 384px"
            priority
          />

          {/* Hover overlay */}
          <motion.div
            className="absolute inset-0 bg-black/0 flex items-center justify-center"
            animate={{
              backgroundColor: isHovered ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0)',
            }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: isHovered ? 1 : 0,
                scale: isHovered ? 1 : 0.8,
              }}
              transition={{ duration: 0.2 }}
            >
              <Maximize2 size={24} className="text-white" />
            </motion.div>
          </motion.div>

          {/* Corner accents */}
          <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-white/20 rounded-tl" />
          <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-white/20 rounded-tr" />
          <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-white/20 rounded-bl" />
          <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-white/20 rounded-br" />
        </div>

        {/* Label */}
        <motion.div
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Project Poster
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default HeroZone;
