/**
 * PromptOutput - Display generated scene prompts with elements
 * Design: Clean Manuscript style
 */


'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { GitCompare } from 'lucide-react';
import { GeneratedPrompt, PromptElement, GeneratedImage, InteractiveMode, InteractivePrototype } from '../types';
import { PromptCard, SkeletonPromptCard } from './PromptCard';

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
  savedPromptIds?: Set<string>;  // IDs of prompts that have been saved to panel
  // Interactive prototype props
  interactiveMode?: InteractiveMode;
  interactivePrototypes?: Map<string, InteractivePrototype>;
  onInteractiveClick?: (promptId: string) => void;
  // Comparison props
  onOpenComparison?: () => void;
  // Loading state
  isGenerating?: boolean;
  skeletonCount?: number;  // Number of skeleton cards to show during generation
}

export function PromptOutput({
  prompts,
  onRate,
  onLock,
  onLockElement,
  onAcceptElement,
  acceptingElementId,
  onCopy,
  onViewPrompt,
  generatedImages = [],
  onStartImage,
  savedPromptIds = new Set(),
  interactiveMode = 'static',
  interactivePrototypes,
  onInteractiveClick,
  onOpenComparison,
  isGenerating = false,
  skeletonCount = 4,
}: PromptOutputProps) {
  const lockedPromptCount = prompts.filter((p) => p.locked).length;

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
            const generatedImage = generatedImages.find((img) => img.promptId === prompt.id);
            const isSavedToPanel = savedPromptIds.has(prompt.id);

            const interactivePrototype = interactivePrototypes?.get(prompt.id);

            return (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onRate={onRate}
                onLock={() => onLock(prompt.id, !prompt.locked)}
                onLockElement={onLockElement}
                onAcceptElement={onAcceptElement}
                acceptingElementId={acceptingElementId}
                onCopy={onCopy}
                onView={onViewPrompt}
                index={index}
                generatedImage={generatedImage}
                onStartImage={onStartImage}
                isSavedToPanel={isSavedToPanel}
                interactiveMode={interactiveMode}
                interactivePrototype={interactivePrototype}
                onInteractiveClick={onInteractiveClick}
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

export default PromptOutput;

