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

      {/* Shimmer overlay - uses global skeleton-shimmer class from globals.css */}
      <div className="absolute inset-0 skeleton-shimmer" />
    </div>
  );
}

export default MediaSkeleton;
