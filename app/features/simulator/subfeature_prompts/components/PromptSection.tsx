/**
 * PromptSection - Collapsible prompt output section for top/bottom areas
 *
 * Uses PromptsContext and SimulatorContext to access state and handlers.
 * Displays generated prompts with images in a collapsible panel.
 * Used for both top (prompts 1-2) and bottom (prompts 3-4) sections.
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { GeneratedPrompt, GeneratedImage } from '../../types';
import { PromptOutput } from './PromptOutput';
import { IconButton } from '@/app/components/ui';
import { fadeIn, EASE, DURATION, useReducedMotion, getReducedMotionTransitions } from '../../lib/motion';
import { usePromptsContext } from '../PromptsContext';
import { useSimulatorContext } from '../../SimulatorContext';

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
  /** Set of prompt IDs that have been saved */
  savedPromptIds: Set<string>;
  /** Callback to open comparison view */
  onOpenComparison?: () => void;
  /** Starting slot number for placeholders (1 for top, 3 for bottom) */
  startSlotNumber: number;
  /** Controlled expand state (optional - uses internal state if not provided) */
  isExpanded?: boolean;
  /** Callback when expand state changes (required if isExpanded is provided) */
  onToggleExpand?: () => void;
}

export function PromptSection({
  position,
  prompts,
  onViewPrompt,
  generatedImages,
  onStartImage,
  savedPromptIds,
  onOpenComparison,
  startSlotNumber,
  isExpanded: controlledExpanded,
  onToggleExpand: controlledToggle,
}: PromptSectionProps) {
  // Get handlers from context
  const promptsCtx = usePromptsContext();
  const simulatorCtx = useSimulatorContext();

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

  // Copy handler with toast notification (passed up to OnionLayout for toast)
  const handleCopy = (id: string) => {
    promptsCtx.handleCopy(id);
    // Copy to clipboard
    const prompt = prompts.find(p => p.id === id);
    if (prompt) {
      navigator.clipboard.writeText(prompt.prompt);
    }
  };

  return (
    <motion.div
      className="shrink-0 w-full relative group"
      initial={false}
      animate={{ height: isExpanded ? 180 : 36 }}
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
                  onRate={promptsCtx.handlePromptRate}
                  onLock={promptsCtx.handlePromptLock}
                  onLockElement={promptsCtx.handleElementLock}
                  onAcceptElement={simulatorCtx.onAcceptElement}
                  acceptingElementId={promptsCtx.acceptingElementId}
                  onCopy={handleCopy}
                  onViewPrompt={onViewPrompt}
                  generatedImages={generatedImages}
                  onStartImage={onStartImage}
                  savedPromptIds={savedPromptIds}
                  onOpenComparison={onOpenComparison}
                  isGenerating={simulatorCtx.isGenerating}
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

export default PromptSection;
