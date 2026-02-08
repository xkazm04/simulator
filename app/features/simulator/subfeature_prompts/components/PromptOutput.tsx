/**
 * PromptOutput - Display generated scene prompts with elements
 * Design: Clean Manuscript style
 */


'use client';

import React, { memo, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { GitCompare } from 'lucide-react';
import { GeneratedPrompt, PromptElement, GeneratedImage } from '../../types';
import { PromptCard, SkeletonPromptCard } from './PromptCard';

// Module-level constants to avoid creating new objects on every render
const EMPTY_IMAGES: GeneratedImage[] = [];
const EMPTY_SET = new Set<string>();

interface PromptOutputProps {
  prompts: GeneratedPrompt[];
  onRate: (id: string, rating: 'up' | 'down' | null) => void;
  onLock: (id: string, islocked: boolean) => void;
  onLockElement: (promptId: string, elementId: string) => void;
  onAcceptElement?: (element: PromptElement) => void;
  acceptingElementId?: string | null;
  onCopy: (id: string) => void;
  onViewPrompt: (prompt: GeneratedPrompt) => void;
  // Image generation props
  generatedImages?: GeneratedImage[];
  onStartImage?: (promptId: string) => void;
  onDeleteImage?: (promptId: string) => void;
  savedPromptIds?: Set<string>;  // IDs of prompts that have been saved to panel
  allSlotsFull?: boolean;  // All panel slots are occupied
  // Comparison props
  onOpenComparison?: () => void;
  // Loading state
  isGenerating?: boolean;
  skeletonCount?: number;  // Number of skeleton cards to show during generation
}

function PromptOutputComponent({
  prompts,
  onRate,
  onLock,
  onLockElement,
  onAcceptElement,
  acceptingElementId,
  onCopy,
  onViewPrompt,
  generatedImages = EMPTY_IMAGES,
  onStartImage,
  onDeleteImage,
  savedPromptIds = EMPTY_SET,
  allSlotsFull = false,
  onOpenComparison,
  isGenerating = false,
  skeletonCount = 4,
}: PromptOutputProps) {
  // Memoize derived values
  const lockedPromptCount = useMemo(
    () => prompts.filter((p) => p.locked).length,
    [prompts]
  );

  // Memoize generated images lookup map for O(1) access
  const generatedImagesByPromptId = useMemo(() => {
    const map = new Map<string, GeneratedImage>();
    generatedImages.forEach((img) => {
      map.set(img.promptId, img);
    });
    return map;
  }, [generatedImages]);

  // Stable callback for lock toggle (passes promptId to parent handler)
  const handleLockToggle = useCallback(
    (promptId: string, isLocked: boolean) => {
      onLock(promptId, !isLocked);
    },
    [onLock]
  );

  // Show nothing if no prompts and not generating
  if (prompts.length === 0 && !isGenerating) return null;

  // Calculate how many skeleton placeholders to show
  // Show skeletons for remaining slots when generating
  const remainingSkeletons = isGenerating ? Math.max(0, skeletonCount - prompts.length) : 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <span className="font-mono type-label uppercase tracking-wider text-slate-400">
          // generated_scenes
        </span>
        <div className="flex-1 h-px bg-slate-800/30" />
        {lockedPromptCount > 0 && (
          <span className="font-mono type-label text-green-500/80">{lockedPromptCount} locked</span>
        )}
        {/* Compare button - show when at least 2 prompts exist */}
        {prompts.length >= 2 && onOpenComparison && (
          <button
            onClick={onOpenComparison}
            className="flex items-center gap-1 px-2 py-1 radius-sm border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/40 transition-colors font-mono type-label uppercase"
            data-testid="open-comparison-btn"
            title="Compare generations side by side"
          >
            <GitCompare size={10} />
            Compare
          </button>
        )}
      </div>

      {/* Prompt Grid - Scrollable with custom scrollbar */}
      <div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar" data-testid="prompt-output-grid">
        <AnimatePresence mode="popLayout">
          {/* Real prompt cards */}
          {prompts.map((prompt, index) => {
            // Use memoized map lookup instead of .find() on each render
            const generatedImage = generatedImagesByPromptId.get(prompt.id);
            const isSavedToPanel = savedPromptIds.has(prompt.id);

            return (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onRate={onRate}
                onLock={() => handleLockToggle(prompt.id, prompt.locked)}
                onLockElement={onLockElement}
                onAcceptElement={onAcceptElement}
                acceptingElementId={acceptingElementId}
                onCopy={onCopy}
                onView={onViewPrompt}
                index={index}
                generatedImage={generatedImage}
                onStartImage={onStartImage}
                onDeleteImage={onDeleteImage}
                isSavedToPanel={isSavedToPanel}
                allSlotsFull={allSlotsFull}
              />
            );
          })}

          {/* Skeleton placeholders for remaining slots during generation */}
          {Array.from({ length: remainingSkeletons }).map((_, index) => (
            <SkeletonPromptCard
              key={`skeleton-${index}`}
              index={prompts.length + index}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Custom comparison function for React.memo
 * Only re-render when relevant props change
 */
function arePropsEqual(
  prevProps: PromptOutputProps,
  nextProps: PromptOutputProps
): boolean {
  // Compare prompts array by reference first (fast path)
  if (prevProps.prompts !== nextProps.prompts) {
    // If reference changed, check if content actually changed
    if (prevProps.prompts.length !== nextProps.prompts.length) return false;
    // Deep comparison could be done here but reference check is usually enough
    // if parent properly memoizes the prompts array
    return false;
  }

  // Compare state flags
  if (prevProps.isGenerating !== nextProps.isGenerating) return false;
  if (prevProps.skeletonCount !== nextProps.skeletonCount) return false;
  if (prevProps.acceptingElementId !== nextProps.acceptingElementId) return false;

  // Compare generated images by reference
  if (prevProps.generatedImages !== nextProps.generatedImages) return false;

  // Compare savedPromptIds set by size first (fast check)
  if (prevProps.savedPromptIds?.size !== nextProps.savedPromptIds?.size) return false;

  // Compare allSlotsFull flag
  if (prevProps.allSlotsFull !== nextProps.allSlotsFull) return false;

  return true;
}

export const PromptOutput = memo(PromptOutputComponent, arePropsEqual);
export default PromptOutput;

