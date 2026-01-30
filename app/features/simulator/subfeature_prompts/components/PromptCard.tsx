/**
 * PromptCard - Image placeholder style card for generated prompts
 * Design: Visual placeholder that represents a generated scene
 *
 * States:
 * 1. No image yet → Gradient placeholder
 * 2. Generating → Loading spinner overlay, pulsing border (cyan - primary action)
 * 3. Complete → Image as background
 *
 * Semantic Colors:
 * - cyan: Primary action, generating state, copy success
 * - green: Locked/saved state
 * - red: Failed/error state
 *
 * Click to expand modal with full prompt and elements
 */

'use client';

import React, { useCallback, memo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Lock, Eye, Image as ImageIcon, Sparkles, Loader2, CheckCircle, Gamepad2, MousePointer2, Trash2 } from 'lucide-react';
import { GeneratedPrompt, PromptElement, GeneratedImage, InteractiveMode, InteractivePrototype } from '../../types';
import { semanticColors } from '../../lib/semanticColors';
import { scaleIn, useReducedMotion, getReducedMotionStaggeredTransition } from '../../lib/motion';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';

/**
 * SkeletonPromptCard - Loading placeholder for prompt cards during generation
 * Shows pulsing animation to indicate loading state
 */
interface SkeletonPromptCardProps {
  index: number;
}

export function SkeletonPromptCard({ index }: SkeletonPromptCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={getReducedMotionStaggeredTransition(index, prefersReducedMotion)}
      data-testid={`prompt-skeleton-${index}`}
      className="group relative h-full min-h-[70px] radius-md overflow-hidden animate-pulse"
    >
      {/* Background - Gradient placeholder with subtle shimmer */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800/60 via-slate-900/80 to-slate-800/40" />

      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shimmer" />

      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(circle_at_100%_100%,rgba(6,182,212,0.15)_0%,transparent_60%)]" />
      </div>

      {/* Center loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="p-2 rounded-full bg-cyan-500/20 text-cyan-400">
          <Loader2 size={18} className="animate-spin" />
        </div>
      </div>

      {/* Top bar - Skeleton scene info */}
      <div className="absolute top-0 left-0 right-0 p-sm bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 bg-slate-700/50 rounded" />
          <div className="h-3 w-8 bg-slate-700/50 rounded" />
        </div>
      </div>

      {/* Bottom bar - Skeleton actions */}
      <div className="absolute bottom-0 left-0 right-0 p-sm bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <div className="h-3 w-6 bg-slate-700/50 rounded" />
          <div className="flex items-center gap-1">
            <div className="h-5 w-5 bg-slate-700/50 rounded" />
            <div className="h-5 w-5 bg-slate-700/50 rounded" />
            <div className="h-5 w-5 bg-slate-700/50 rounded" />
          </div>
        </div>
      </div>

      {/* Generating status label */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <span className="font-mono type-label text-cyan-400/70 bg-black/60 px-2 py-0.5 radius-sm">
          generating...
        </span>
      </div>
    </motion.div>
  );
}

interface PromptCardProps {
  prompt: GeneratedPrompt;
  onRate: (id: string, rating: 'up' | 'down' | null) => void;
  onLock: (id: string) => void;
  onLockElement: (promptId: string, elementId: string) => void;
  onAcceptElement?: (element: PromptElement) => void;
  acceptingElementId?: string | null;
  onCopy: (id: string) => void;
  onView: (prompt: GeneratedPrompt) => void;
  index: number;
  // Image generation props
  generatedImage?: GeneratedImage;
  onStartImage?: (promptId: string) => void;
  onDeleteImage?: (promptId: string) => void;
  isSavedToPanel?: boolean;
  allSlotsFull?: boolean;  // All panel slots are occupied
  // Interactive prototype props
  interactiveMode?: InteractiveMode;
  interactivePrototype?: InteractivePrototype;
  onInteractiveClick?: (promptId: string) => void;
}

/**
 * Get icon and colors for interactive mode
 */
function getInteractiveModeDisplay(mode: InteractiveMode): { icon: React.ReactNode; color: string; bgColor: string } {
  switch (mode) {
    case 'webgl':
      return { icon: <Gamepad2 size={10} />, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' };
    case 'clickable':
      return { icon: <MousePointer2 size={10} />, color: 'text-purple-400', bgColor: 'bg-purple-500/20' };
    default:
      return { icon: null, color: '', bgColor: '' };
  }
}

/**
 * PromptCard component - Memoized to prevent unnecessary re-renders
 * Re-renders only when prompt data, image status, or interactive state changes
 */
function PromptCardComponent({
  prompt,
  onLock,
  onCopy,
  onView,
  index,
  generatedImage,
  onStartImage,
  onDeleteImage,
  isSavedToPanel = false,
  allSlotsFull = false,
  interactiveMode = 'static',
  interactivePrototype,
  onInteractiveClick,
}: PromptCardProps) {
  // Copy feedback hook with 2-second auto-reset
  const { isCopied: justCopied, triggerCopy } = useCopyFeedback({
    resetDelay: 2000,
  });

  // Reduced motion support for accessibility (WCAG 2.1 Level AAA)
  const prefersReducedMotion = useReducedMotion();

  // Image generation state
  const isGenerating = generatedImage?.status === 'pending' || generatedImage?.status === 'generating';
  const isComplete = generatedImage?.status === 'complete' && generatedImage?.url;
  const isFailed = generatedImage?.status === 'failed';

  // Memoized copy handler using the useCopyFeedback hook
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      triggerCopy();
      onCopy(prompt.id);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [prompt.prompt, prompt.id, onCopy, triggerCopy]);

  // Memoized lock handler - also saves image to panel when locking (if image exists and not already saved)
  const handleLockWithSave = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onLock(prompt.id);
    // Save to panel when locking if image exists and not already saved
    if (!prompt.locked && isComplete && !isSavedToPanel && onStartImage) {
      onStartImage(prompt.id);
    }
  }, [prompt.id, prompt.locked, isComplete, isSavedToPanel, onLock, onStartImage]);

  // Memoized delete handler for individual image deletion
  const handleDeleteImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteImage?.(prompt.id);
  }, [prompt.id, onDeleteImage]);

  const lockedElementCount = prompt.elements.filter((e) => e.locked).length;

  // Determine ring style based on state
  // - cyan: Primary/generating state, copy success
  // - green: Locked/saved state
  const getRingClass = () => {
    if (justCopied) return 'ring-2 ring-cyan-400/50 ring-offset-1 ring-offset-surface-primary';
    if (isGenerating) return 'ring-2 ring-accent-primary/30 ring-offset-1 ring-offset-surface-primary animate-pulse';
    if (isSavedToPanel) return 'ring-2 ring-accent-success/30 ring-offset-1 ring-offset-surface-primary';
    if (prompt.locked) return 'ring-2 ring-accent-success/30 ring-offset-1 ring-offset-surface-primary';
    return 'hover:ring-1 hover:ring-accent-primary/30';
  };

  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={getReducedMotionStaggeredTransition(index, prefersReducedMotion)}
      onClick={() => onView(prompt)}
      data-testid={`prompt-card-${prompt.id}`}
      className={`group relative h-full min-h-[70px] radius-md overflow-hidden cursor-pointer transition-all duration-200 shadow-subtle
                  ${getRingClass()}`}
    >
      {/* Background - Generated image or gradient placeholder */}
      {isComplete && generatedImage?.url ? (
        <Image
          src={generatedImage.url}
          alt={prompt.sceneType}
          fill
          className="object-cover object-center"
          unoptimized // Leonardo URLs may not be optimizable
        />
      ) : (
        <>
          <div className={`absolute inset-0 ${prompt.locked
            ? 'bg-gradient-to-br from-green-950/80 via-slate-900/90 to-green-950/60'
            : 'bg-gradient-to-br from-slate-800/80 via-slate-900/90 to-slate-800/60'}`}
          />
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
            <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(circle_at_100%_100%,rgba(6,182,212,0.15)_0%,transparent_60%)]" />
          </div>
        </>
      )}

      {/* Center icon/loading state - semantic colors for each state */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isGenerating ? (
          <div className={`p-2 rounded-full ${semanticColors.primary.bgHover} ${semanticColors.primary.text}`}>
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : isFailed ? (
          <div className={`p-2 rounded-full ${semanticColors.error.bgHover} ${semanticColors.error.text}`}>
            <span className="font-mono type-label">FAILED</span>
          </div>
        ) : !isComplete ? (
          <div className={`p-2 rounded-full transition-all duration-200
                          ${prompt.locked
                            ? `${semanticColors.success.bgHover} ${semanticColors.success.text}`
                            : 'bg-slate-800/60 text-slate-500 group-hover:bg-cyan-500/20 group-hover:text-cyan-400'}`}>
            <ImageIcon size={18} className="opacity-60" />
          </div>
        ) : null}
      </div>

      {/* Top bar - Scene info */}
      <div className="absolute top-0 left-0 right-0 p-sm bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <span className="font-mono type-label text-white/70 uppercase tracking-wider">
            {prompt.sceneType}
          </span>
          <div className="flex items-center gap-1">
            {lockedElementCount > 0 && (
              <span className="flex items-center gap-0.5 px-1 py-0.5 radius-sm bg-cyan-500/20 type-label font-mono text-cyan-400">
                <Lock size={8} /> {lockedElementCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar - Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-sm bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          {/* Scene number */}
          <span className={`font-mono text-xs font-medium ${prompt.locked ? 'text-green-400' : 'text-white/80'}`}>
            #{prompt.sceneNumber}
          </span>

          {/* Action buttons - semantic colors: green=locked, cyan=primary */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Lock & Save button - green for locked/saved, red for slots full */}
            <button
              onClick={handleLockWithSave}
              data-testid={`prompt-lock-${prompt.id}`}
              className={`p-1 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${
                prompt.locked || isSavedToPanel
                  ? `${semanticColors.success.bgHover} ${semanticColors.success.text}`
                  : allSlotsFull && isComplete && !isSavedToPanel
                    ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
                    : 'bg-slate-800/80 text-slate-400 hover:text-green-400'
              }`}
              title={
                isSavedToPanel ? 'Saved'
                  : prompt.locked ? 'Unlock'
                  : allSlotsFull && isComplete ? 'All slots full'
                  : isComplete ? 'Lock & Save'
                  : 'Lock'
              }
              disabled={allSlotsFull && isComplete && !isSavedToPanel && !prompt.locked}
            >
              <Lock size={12} />
            </button>

            {/* Copy button - cyan for primary action success with animation */}
            <button
              onClick={handleCopy}
              data-testid={`prompt-copy-${prompt.id}`}
              className={`p-1 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${justCopied
                ? `${semanticColors.primary.bgHover} ${semanticColors.primary.text}`
                : 'bg-slate-800/80 text-slate-400 hover:text-white'}`}
              title={justCopied ? 'Copied!' : 'Copy prompt'}
            >
              <AnimatePresence mode="wait" initial={false}>
                {justCopied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Check size={12} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Copy size={12} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            {/* View button */}
            <button
              onClick={(e) => { e.stopPropagation(); onView(prompt); }}
              data-testid={`prompt-view-${prompt.id}`}
              className="p-1 radius-sm bg-slate-800/80 text-slate-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
              title="View details"
            >
              <Eye size={12} />
            </button>

            {/* Delete button - only show when image exists */}
            {generatedImage && onDeleteImage && (
              <button
                onClick={handleDeleteImage}
                data-testid={`prompt-delete-${prompt.id}`}
                className="p-1 radius-sm bg-slate-800/80 text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
                title="Delete image"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status indicators - green for success/locked state */}
      {isSavedToPanel ? (
        <div className="absolute top-sm right-sm">
          <div className={`p-1 rounded-full ${semanticColors.success.bgHover}`}>
            <CheckCircle size={10} className={semanticColors.success.text} />
          </div>
        </div>
      ) : prompt.locked && (
        <div className="absolute top-sm right-sm">
          <div className={`p-1 rounded-full ${semanticColors.success.bgHover}`}>
            <Sparkles size={10} className={semanticColors.success.text} />
          </div>
        </div>
      )}

      {/* Generating status label */}
      {isGenerating && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <span className="font-mono type-label text-cyan-400 bg-black/60 px-2 py-0.5 radius-sm">
            generating...
          </span>
        </div>
      )}

      {/* Copy success feedback - "Copied!" text with animation */}
      <AnimatePresence>
        {justCopied && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <motion.div
              initial={{ boxShadow: '0 0 0 0 rgba(34, 211, 238, 0)' }}
              animate={{ boxShadow: '0 0 20px 4px rgba(34, 211, 238, 0.3)' }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/90 rounded-lg"
            >
              <Check size={14} className="text-white" />
              <span className="font-mono text-sm font-medium text-white">
                Copied!
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive mode indicator */}
      {interactiveMode !== 'static' && isComplete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInteractiveClick?.(prompt.id);
          }}
          className={`absolute bottom-8 right-sm flex items-center gap-1 px-1.5 py-0.5 radius-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900
                     ${getInteractiveModeDisplay(interactiveMode).bgColor} border border-white/10
                     opacity-0 group-hover:opacity-100 transition-opacity hover:brightness-125`}
          data-testid={`prompt-interactive-${prompt.id}`}
          title={`Open ${interactiveMode} preview`}
        >
          <span className={getInteractiveModeDisplay(interactiveMode).color}>
            {getInteractiveModeDisplay(interactiveMode).icon}
          </span>
          <span className={`font-mono type-label uppercase ${getInteractiveModeDisplay(interactiveMode).color}`}>
            {interactiveMode === 'webgl' ? 'Play' : interactiveMode === 'clickable' ? 'Try' : 'Watch'}
          </span>
          {interactivePrototype?.status === 'generating' && (
            <Loader2 size={8} className="animate-spin" />
          )}
        </button>
      )}
    </motion.div>
  );
}

/**
 * Custom comparison function for React.memo
 * Only re-render when meaningful props change
 */
function arePropsEqual(prevProps: PromptCardProps, nextProps: PromptCardProps): boolean {
  // Check prompt data - most important for re-render decisions
  if (prevProps.prompt.id !== nextProps.prompt.id) return false;
  if (prevProps.prompt.locked !== nextProps.prompt.locked) return false;
  if (prevProps.prompt.prompt !== nextProps.prompt.prompt) return false;
  if (prevProps.prompt.sceneType !== nextProps.prompt.sceneType) return false;
  if (prevProps.prompt.sceneNumber !== nextProps.prompt.sceneNumber) return false;

  // Check locked elements count (shallow comparison is sufficient)
  const prevLockedCount = prevProps.prompt.elements.filter(e => e.locked).length;
  const nextLockedCount = nextProps.prompt.elements.filter(e => e.locked).length;
  if (prevLockedCount !== nextLockedCount) return false;

  // Check image generation state
  if (prevProps.generatedImage?.status !== nextProps.generatedImage?.status) return false;
  if (prevProps.generatedImage?.url !== nextProps.generatedImage?.url) return false;

  // Check other state flags
  if (prevProps.isSavedToPanel !== nextProps.isSavedToPanel) return false;
  if (prevProps.allSlotsFull !== nextProps.allSlotsFull) return false;
  if (prevProps.interactiveMode !== nextProps.interactiveMode) return false;
  if (prevProps.interactivePrototype?.status !== nextProps.interactivePrototype?.status) return false;
  if (prevProps.index !== nextProps.index) return false;

  // Callbacks are assumed stable (should be memoized by parent)
  return true;
}

/**
 * Memoized PromptCard - Prevents re-renders when other cards change
 */
export const PromptCard = memo(PromptCardComponent, arePropsEqual);

export default PromptCard;
