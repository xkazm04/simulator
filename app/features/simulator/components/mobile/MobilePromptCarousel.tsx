/**
 * MobilePromptCarousel - Swipeable carousel for prompt cards on mobile
 *
 * Features:
 * - Horizontal swipe navigation between prompts
 * - Snap-to-card behavior
 * - Pagination indicators
 * - Touch-optimized interactions
 * - Haptic feedback on swipe
 */

'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GeneratedPrompt, GeneratedImage, InteractiveMode, InteractivePrototype } from '../../types';
import { PromptCard, SkeletonPromptCard } from '../../subfeature_prompts/components/PromptCard';
import { useHapticFeedback } from '../../hooks/useResponsive';
import { snapToNearest, GESTURE_PRESETS } from '../../lib/gestureController';
import { semanticColors } from '../../lib/semanticColors';

interface MobilePromptCarouselProps {
  prompts: GeneratedPrompt[];
  onViewPrompt: (prompt: GeneratedPrompt) => void;
  onRate: (id: string, rating: 'up' | 'down' | null) => void;
  onLock: (id: string) => void;
  onLockElement: (promptId: string, elementId: string) => void;
  onCopy: (id: string) => void;
  generatedImages?: GeneratedImage[];
  onStartImage?: (promptId: string) => void;
  savedPromptIds?: Set<string>;
  interactiveMode?: InteractiveMode;
  interactivePrototypes?: Map<string, InteractivePrototype>;
  onInteractiveClick?: (promptId: string) => void;
  isGenerating?: boolean;
  skeletonCount?: number;
}

export function MobilePromptCarousel({
  prompts,
  onViewPrompt,
  onRate,
  onLock,
  onLockElement,
  onCopy,
  generatedImages = [],
  onStartImage,
  savedPromptIds = new Set(),
  interactiveMode = 'static',
  interactivePrototypes,
  onInteractiveClick,
  isGenerating = false,
  skeletonCount = 2,
}: MobilePromptCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { trigger: haptic } = useHapticFeedback();

  // Get container width for snap calculations
  const getCardWidth = useCallback(() => {
    if (!containerRef.current) return 300;
    return containerRef.current.offsetWidth - 32; // Account for padding
  }, []);

  // Calculate snap points based on number of prompts
  const snapPoints = useMemo(() => {
    const cardWidth = getCardWidth();
    const total = isGenerating && prompts.length === 0 ? skeletonCount : prompts.length;
    return Array.from({ length: total }, (_, i) => -i * (cardWidth + 16)); // 16px gap
  }, [prompts.length, isGenerating, skeletonCount, getCardWidth]);

  // Drag state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Handle drag gestures
  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], active, last }) => {
      setIsDragging(active);

      if (active) {
        // During drag, show live movement
        setDragOffset(mx);
      }

      if (last) {
        // On release, snap to nearest card
        const cardWidth = getCardWidth();
        const currentOffset = -currentIndex * (cardWidth + 16);
        const targetOffset = currentOffset + mx;

        // Use velocity for flick detection
        const snappedOffset = snapToNearest(
          targetOffset,
          snapPoints,
          vx * dx,
          GESTURE_PRESETS.carousel.swipeVelocityThreshold
        );

        const newIndex = snapPoints.indexOf(snappedOffset);
        const clampedIndex = Math.max(0, Math.min(newIndex, snapPoints.length - 1));

        if (clampedIndex !== currentIndex) {
          haptic('light');
        }

        setCurrentIndex(clampedIndex);
        setDragOffset(0);
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      rubberband: true,
      bounds: {
        left: snapPoints[snapPoints.length - 1] - 50,
        right: 50,
      },
    }
  );

  // Calculate current transform
  const cardWidth = getCardWidth();
  const baseOffset = -currentIndex * (cardWidth + 16);
  const transform = baseOffset + dragOffset;

  // Navigation buttons
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      haptic('light');
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex, haptic]);

  const handleNext = useCallback(() => {
    const total = isGenerating && prompts.length === 0 ? skeletonCount : prompts.length;
    if (currentIndex < total - 1) {
      haptic('light');
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, prompts.length, isGenerating, skeletonCount, haptic]);

  // Get image for prompt
  const getImageForPrompt = useCallback(
    (promptId: string) => generatedImages.find((img) => img.promptId === promptId),
    [generatedImages]
  );

  const total = isGenerating && prompts.length === 0 ? skeletonCount : prompts.length;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500">
        <span className="font-mono type-body-sm">No prompts generated yet</span>
      </div>
    );
  }

  return (
    <div className="relative" data-testid="mobile-prompt-carousel">
      {/* Carousel container */}
      <div
        ref={containerRef}
        className="overflow-hidden px-4 py-2 touch-pan-y"
        {...bind()}
      >
        <motion.div
          className="flex gap-4"
          animate={{
            x: transform,
          }}
          transition={
            isDragging
              ? { type: 'tween', duration: 0 }
              : { type: 'spring', stiffness: 300, damping: 30 }
          }
          style={{ touchAction: 'pan-y' }}
        >
          {isGenerating && prompts.length === 0
            ? // Show skeletons while generating
              Array.from({ length: skeletonCount }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="flex-shrink-0"
                  style={{ width: cardWidth }}
                >
                  <div className="h-44">
                    <SkeletonPromptCard index={index} />
                  </div>
                </div>
              ))
            : // Show actual prompts
              prompts.map((prompt, index) => (
                <div
                  key={prompt.id}
                  className="flex-shrink-0"
                  style={{ width: cardWidth }}
                >
                  <div className="h-44">
                    <PromptCard
                      prompt={prompt}
                      onRate={onRate}
                      onLock={onLock}
                      onLockElement={onLockElement}
                      onCopy={onCopy}
                      onView={onViewPrompt}
                      index={index}
                      generatedImage={getImageForPrompt(prompt.id)}
                      onStartImage={onStartImage}
                      isSavedToPanel={savedPromptIds.has(prompt.id)}
                      interactiveMode={interactiveMode}
                      interactivePrototype={interactivePrototypes?.get(prompt.id)}
                      onInteractiveClick={onInteractiveClick}
                    />
                  </div>
                </div>
              ))}
        </motion.div>
      </div>

      {/* Navigation buttons (visible on larger phones) */}
      <AnimatePresence>
        {currentIndex > 0 && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={handlePrev}
            className={`absolute left-1 top-1/2 -translate-y-1/2 p-2 radius-full
                       ${semanticColors.primary.bg} ${semanticColors.primary.border} border
                       shadow-lg backdrop-blur-sm`}
            data-testid="carousel-prev"
          >
            <ChevronLeft size={20} className={semanticColors.primary.text} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {currentIndex < total - 1 && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onClick={handleNext}
            className={`absolute right-1 top-1/2 -translate-y-1/2 p-2 radius-full
                       ${semanticColors.primary.bg} ${semanticColors.primary.border} border
                       shadow-lg backdrop-blur-sm`}
            data-testid="carousel-next"
          >
            <ChevronRight size={20} className={semanticColors.primary.text} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Pagination dots */}
      <div className="flex justify-center gap-2 mt-3" data-testid="carousel-dots">
        {Array.from({ length: total }).map((_, index) => (
          <button
            key={index}
            onClick={() => {
              haptic('light');
              setCurrentIndex(index);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              index === currentIndex
                ? 'w-6 bg-cyan-400'
                : 'bg-slate-600 hover:bg-slate-500'
            }`}
            data-testid={`carousel-dot-${index}`}
          />
        ))}
      </div>

      {/* Current position indicator */}
      <div className="flex justify-center mt-2">
        <span className="font-mono type-label text-slate-500">
          {currentIndex + 1} / {total}
        </span>
      </div>
    </div>
  );
}

export default MobilePromptCarousel;
