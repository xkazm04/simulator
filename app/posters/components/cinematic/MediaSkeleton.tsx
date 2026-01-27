/**
 * MediaSkeleton - Loading placeholder with shimmer animation
 * Used to communicate "content incoming" while images/videos load
 */

'use client';

import React from 'react';
import { cn } from '@/app/lib/utils';

interface MediaSkeletonProps {
  className?: string;
  variant?: 'image' | 'video' | 'hero';
}

const variantStyles = {
  image: 'aspect-[4/3] rounded-lg',
  video: 'aspect-video rounded-lg',
  hero: 'aspect-[2/3] rounded-lg',
};

export function MediaSkeleton({ className, variant = 'image' }: MediaSkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-800/80',
        variantStyles[variant],
        className
      )}
    >
      {/* Base pulse animation */}
      <div className="absolute inset-0 animate-pulse bg-slate-700/30" />

      {/* Shimmer overlay - sweeps from left to right */}
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-slate-600/20 to-transparent"
        style={{
          // Inline keyframes for shimmer animation (Tailwind 4 compatible)
          animation: 'shimmer 2s infinite',
        }}
      />

      {/* Inline keyframe definition */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

export default MediaSkeleton;
