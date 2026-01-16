/**
 * InteractivePreviewModal - Full-screen modal for interactive prototype viewing
 *
 * Opens when user clicks the interactive button on a PromptCard.
 * Shows the appropriate interactive component based on prototype mode.
 */

'use client';

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gamepad2, MousePointer2, Film, Image as ImageIcon, Loader2 } from 'lucide-react';
import {
  InteractivePrototype,
  InteractiveMode,
  GeneratedPrompt,
  GeneratedImage,
  INTERACTIVE_MODES,
} from '../types';
import { GenerationProgress } from '../hooks/useInteractivePrototype';
import { WebGLDemo, ClickablePrototype, AnimatedTrailer } from './interactive';
import { fadeIn, scaleIn, transitions } from '../lib/motion';

interface InteractivePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt?: GeneratedPrompt;
  generatedImage?: GeneratedImage;
  prototype?: InteractivePrototype;
  mode: InteractiveMode;
  onGeneratePrototype?: () => void;
  /** Generation progress (if currently generating) */
  progress?: GenerationProgress | null;
}

/**
 * Get icon for mode
 */
function getModeIcon(mode: InteractiveMode): React.ReactNode {
  switch (mode) {
    case 'webgl':
      return <Gamepad2 size={16} />;
    case 'clickable':
      return <MousePointer2 size={16} />;
    case 'trailer':
      return <Film size={16} />;
    default:
      return <ImageIcon size={16} />;
  }
}

/**
 * Get mode color classes
 */
function getModeColors(mode: InteractiveMode): { bg: string; border: string; text: string } {
  switch (mode) {
    case 'webgl':
      return { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400' };
    case 'clickable':
      return { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' };
    case 'trailer':
      return { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' };
    default:
      return { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400' };
  }
}

export function InteractivePreviewModal({
  isOpen,
  onClose,
  prompt,
  generatedImage,
  prototype,
  mode,
  onGeneratePrototype,
  progress,
}: InteractivePreviewModalProps) {
  const colors = getModeColors(mode);
  const imageUrl = generatedImage?.url ?? undefined;

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const renderContent = () => {
    // If no prototype yet, show generate prompt
    if (!prototype) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center" data-testid="interactive-modal-generate-prompt">
          {/* Background image preview */}
          {imageUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20 blur-sm"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          )}

          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full ${colors.bg} border ${colors.border}`}>
              {getModeIcon(mode)}
            </div>
            <h2 className="text-xl font-mono text-white">
              Generate {INTERACTIVE_MODES[mode].label}
            </h2>
            <p className="font-mono type-body-sm text-slate-400 max-w-md text-center">
              {INTERACTIVE_MODES[mode].description}
            </p>
            {onGeneratePrototype && (
              <button
                onClick={onGeneratePrototype}
                className={`px-6 py-2 radius-md ${colors.bg} border ${colors.border}
                           hover:brightness-125 transition-all flex items-center gap-2 mt-4`}
                data-testid="interactive-modal-generate-btn"
              >
                <span className={colors.text}>{getModeIcon(mode)}</span>
                <span className={`font-mono type-body-sm ${colors.text} uppercase tracking-wider`}>
                  Generate Now
                </span>
              </button>
            )}
          </div>
        </div>
      );
    }

    // If generating, show loading with progress
    if (prototype.status === 'generating') {
      const currentProgress = progress ?? { percent: 0, stage: 'analyzing', message: 'Starting...', estimatedTimeRemaining: null };
      const stageColors = {
        analyzing: { bar: 'bg-amber-500', text: 'text-amber-400' },
        generating: { bar: 'bg-purple-500', text: 'text-purple-400' },
        rendering: { bar: 'bg-cyan-500', text: 'text-cyan-400' },
        complete: { bar: 'bg-green-500', text: 'text-green-400' },
      };
      const stageColor = stageColors[currentProgress.stage] || stageColors.analyzing;

      return (
        <div className="w-full h-full flex flex-col items-center justify-center px-8" data-testid="interactive-modal-loading">
          {/* Animated spinner */}
          <div className="relative mb-6">
            <Loader2 className={`w-16 h-16 ${colors.text} animate-spin`} />
            <div className={`absolute inset-0 flex items-center justify-center`}>
              <span className={`font-mono text-lg font-bold ${colors.text}`}>
                {Math.round(currentProgress.percent)}%
              </span>
            </div>
          </div>

          {/* Stage label */}
          <span className={`font-mono type-label ${stageColor.text} uppercase tracking-wider mb-2`}>
            {currentProgress.stage === 'complete' ? 'Complete!' : currentProgress.stage}
          </span>

          {/* Progress message */}
          <span className="font-mono type-body-sm text-slate-400 mb-4 text-center max-w-md">
            {currentProgress.message}
          </span>

          {/* Progress bar */}
          <div className="w-full max-w-md h-2 bg-slate-800 radius-full overflow-hidden mb-3">
            <motion.div
              className={`h-full ${stageColor.bar} radius-full`}
              initial={{ width: 0 }}
              animate={{ width: `${currentProgress.percent}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Stage indicators */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className={currentProgress.stage === 'analyzing' ? stageColors.analyzing.text : currentProgress.percent > 30 ? 'text-slate-500' : 'text-slate-600'}>
              Analyzing
            </span>
            <span className="text-slate-700">→</span>
            <span className={currentProgress.stage === 'generating' ? stageColors.generating.text : currentProgress.percent > 80 ? 'text-slate-500' : 'text-slate-600'}>
              Generating
            </span>
            <span className="text-slate-700">→</span>
            <span className={currentProgress.stage === 'rendering' || currentProgress.stage === 'complete' ? stageColors.rendering.text : 'text-slate-600'}>
              Rendering
            </span>
          </div>

          {/* Estimated time remaining */}
          {currentProgress.estimatedTimeRemaining !== null && currentProgress.estimatedTimeRemaining > 0 && (
            <span className="font-mono type-label text-slate-500 mt-4">
              ~{Math.ceil(currentProgress.estimatedTimeRemaining)}s remaining
            </span>
          )}
        </div>
      );
    }

    // If failed, show error
    if (prototype.status === 'failed') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center" data-testid="interactive-modal-error">
          <div className={`p-4 rounded-full bg-red-500/10 border border-red-500/30 mb-4`}>
            <X size={24} className="text-red-400" />
          </div>
          <span className="font-mono type-label text-red-400 uppercase tracking-wider">
            {prototype.error || 'Failed to generate'}
          </span>
          {onGeneratePrototype && (
            <button
              onClick={onGeneratePrototype}
              className="mt-4 px-4 py-2 radius-md bg-slate-800 border border-slate-700 text-slate-300
                         hover:bg-slate-700 transition-colors font-mono type-body-sm"
              data-testid="interactive-modal-retry-btn"
            >
              Try Again
            </button>
          )}
        </div>
      );
    }

    // Render the appropriate interactive component
    switch (mode) {
      case 'webgl':
        return (
          <WebGLDemo
            prototype={prototype}
            imageUrl={imageUrl}
            isFullscreen={false}
          />
        );
      case 'clickable':
        return (
          <ClickablePrototype
            prototype={prototype}
            imageUrl={imageUrl}
            isFullscreen={false}
          />
        );
      case 'trailer':
        return (
          <AnimatedTrailer
            prototype={prototype}
            imageUrl={imageUrl}
            isFullscreen={false}
          />
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={handleBackdropClick}
          data-testid="interactive-preview-modal"
        >
          {/* Modal content */}
          <motion.div
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.normal}
            className="relative w-full max-w-5xl h-[80vh] bg-slate-900 radius-lg border border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
              {/* Mode indicator */}
              <div className={`flex items-center gap-2 px-3 py-1 radius-md ${colors.bg} border ${colors.border}`}>
                <span className={colors.text}>{getModeIcon(mode)}</span>
                <span className={`font-mono type-body-sm ${colors.text} uppercase tracking-wider`}>
                  {INTERACTIVE_MODES[mode].label}
                </span>
              </div>

              {/* Prompt info */}
              {prompt && (
                <div className="flex-1 mx-4">
                  <span className="font-mono type-label text-slate-400 uppercase">
                    {prompt.sceneType} • Scene #{prompt.sceneNumber}
                  </span>
                </div>
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 radius-sm bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition-colors"
                data-testid="interactive-modal-close-btn"
              >
                <X size={16} className="text-slate-300" />
              </button>
            </div>

            {/* Content area */}
            <div className="absolute inset-0 pt-16">
              {renderContent()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default InteractivePreviewModal;
