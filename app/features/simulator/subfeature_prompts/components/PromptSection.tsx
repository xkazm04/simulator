/**
 * PromptSection - Collapsible prompt output section for top/bottom areas
 *
 * Props-only leaf component (no context reads).
 * Displays generated prompts with images in a collapsible panel.
 * Used for both top (prompts 1-2) and bottom (prompts 3-4) sections.
 */

'use client';

import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { GeneratedPrompt, GeneratedImage, PromptElement } from '../../types';
import { PromptOutput } from './PromptOutput';
import { IconButton } from '@/app/components/ui';
import { fadeIn, EASE, DURATION, useReducedMotion, getReducedMotionTransitions } from '../../lib/motion';

export interface PromptSectionProps {
  /** Position of the section */
  position: 'top' | 'bottom';
  /** Array of prompts to display (subset of all generated prompts) */
  prompts: GeneratedPrompt[];
  /** Callback when user views full prompt */
  onViewPrompt: (prompt: GeneratedPrompt) => void;
  /** Generated images for prompts */
  generatedImages: GeneratedImage[];
  /** Callback to start generating an image */
  onStartImage?: (promptId: string) => void;
  /** Callback to delete a generated image */
  onDeleteImage?: (promptId: string) => void;
  /** Set of prompt IDs that have been saved */
  savedPromptIds: Set<string>;
  /** Whether all panel slots are full */
  allSlotsFull?: boolean;
  /** Callback to open comparison view */
  onOpenComparison?: () => void;
  /** Starting slot number for placeholders (1 for top, 3 for bottom) */
  startSlotNumber: number;
  /** Controlled expand state (optional - uses internal state if not provided) */
  isExpanded?: boolean;
  /** Callback when expand state changes (required if isExpanded is provided) */
  onToggleExpand?: () => void;
  /** Handler for prompt rating */
  onRate: (id: string, rating: 'up' | 'down' | null) => void;
  /** Handler for prompt lock toggle */
  onLock: (id: string, isLocked: boolean) => void;
  /** Handler for element lock toggle */
  onLockElement: (promptId: string, elementId: string) => void;
  /** Handler for accepting an element */
  onAcceptElement?: (element: PromptElement) => void;
  /** ID of the element currently being accepted */
  acceptingElementId?: string | null;
  /** Handler for copying a prompt (includes clipboard + state update) */
  onCopy: (id: string) => void;
  /** Whether prompts are currently being generated */
  isGenerating?: boolean;
}

function PromptSectionComponent({
  position,
  prompts,
  onViewPrompt,
  generatedImages,
  onStartImage,
  onDeleteImage,
  savedPromptIds,
  allSlotsFull,
  onOpenComparison,
  startSlotNumber,
  isExpanded: controlledExpanded,
  onToggleExpand: controlledToggle,
  onRate,
  onLock,
  onLockElement,
  onAcceptElement,
  acceptingElementId,
  onCopy,
  isGenerating,
}: PromptSectionProps) {
  // Local expand state (used if not controlled)
  const [internalExpanded, setInternalExpanded] = useState(true);

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  // Reduced motion support for accessibility
  const prefersReducedMotion = useReducedMotion();
  const motionTransitions = getReducedMotionTransitions(prefersReducedMotion);
  const panelDuration = prefersReducedMotion ? 0 : DURATION.panel;

  const ChevronIcon = position === 'top' ? ChevronUp : ChevronDown;
  const collapsedLabel = position === 'top' ? 'Generated Images (1-2)' : 'Generated Images (3-4)';
  const testIdPrefix = position === 'top' ? 'top-prompts' : 'bottom-prompts';

  const onToggleExpand = () => {
    if (isControlled && controlledToggle) {
      controlledToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  return (
    <motion.div
      className="shrink-0 w-full relative group"
      initial={false}
      animate={{ height: isExpanded ? 200 : 36 }}
      transition={{ duration: panelDuration, ease: EASE.default }}
    >
      <div className="absolute inset-0 bg-surface-primary/50 radius-lg border border-slate-700/60 overflow-hidden backdrop-blur-sm">
        {/* Collapse toggle */}
        <IconButton
          size="xs"
          variant="solid"
          colorScheme="default"
          onClick={onToggleExpand}
          data-testid={`${testIdPrefix}-collapse-btn`}
          label={isExpanded ? `Collapse ${position} prompts` : `Expand ${position} prompts`}
          className="absolute top-sm right-sm z-20"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 0 : 180 }}
            transition={motionTransitions.normal}
          >
            <ChevronIcon size={14} />
          </motion.div>
        </IconButton>

        {/* Section label when collapsed */}
        <AnimatePresence>
          {!isExpanded && (
            <motion.div
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="font-mono type-label text-slate-600 uppercase tracking-wider">
                {collapsedLabel}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content - only render when expanded */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={motionTransitions.normal}
              className="relative h-full"
            >
              {/* Placeholder Background (Visible when empty) */}
              {prompts.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="flex gap-4">
                    {[0, 1].map(i => (
                      <div
                        key={i}
                        className="w-64 h-32 border-2 border-dashed border-slate-700/50 radius-lg flex items-center justify-center"
                      >
                        <span className="font-mono type-label text-slate-500">
                          RESERVED_SLOT_0{startSlotNumber + i}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="relative h-full p-3">
                <PromptOutput
                  prompts={prompts}
                  onRate={onRate}
                  onLock={onLock}
                  onLockElement={onLockElement}
                  onAcceptElement={onAcceptElement}
                  acceptingElementId={acceptingElementId}
                  onCopy={onCopy}
                  onViewPrompt={onViewPrompt}
                  generatedImages={generatedImages}
                  onStartImage={onStartImage}
                  onDeleteImage={onDeleteImage}
                  savedPromptIds={savedPromptIds}
                  allSlotsFull={allSlotsFull}
                  onOpenComparison={onOpenComparison}
                  isGenerating={isGenerating}
                  skeletonCount={2}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export const PromptSection = memo(PromptSectionComponent);
export default PromptSection;
