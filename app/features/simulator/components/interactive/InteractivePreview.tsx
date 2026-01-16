/**
 * InteractivePreview - Container component for interactive prototypes
 *
 * Renders the appropriate interactive component based on the prototype mode:
 * - static: Regular image display
 * - webgl: WebGLDemo component
 * - clickable: ClickablePrototype component
 * - trailer: AnimatedTrailer component
 *
 * Also provides the mode selector UI and fullscreen capability.
 */

'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  InteractiveMode,
  InteractivePrototype,
  INTERACTIVE_MODES,
} from '../../types';
import { WebGLDemo } from './WebGLDemo';
import { ClickablePrototype } from './ClickablePrototype';
import { AnimatedTrailer } from './AnimatedTrailer';
import { fadeIn, scaleIn, transitions } from '../../lib/motion';
import { getModeIcon, getModeColors } from '../../lib/interactiveModeHelpers';

interface InteractivePreviewProps {
  /** The generated image URL */
  imageUrl?: string;
  /** Current interactive mode */
  mode: InteractiveMode;
  /** Available modes for this scene type */
  availableModes: InteractiveMode[];
  /** The prototype data (if generated) */
  prototype?: InteractivePrototype;
  /** Whether a prototype is being generated */
  isGenerating?: boolean;
  /** Callback when mode is changed */
  onModeChange?: (mode: InteractiveMode) => void;
  /** Callback to generate prototype */
  onGeneratePrototype?: () => void;
  /** Optional className */
  className?: string;
}

export function InteractivePreview({
  imageUrl,
  mode,
  availableModes,
  prototype,
  isGenerating = false,
  onModeChange,
  onGeneratePrototype,
  className = '',
}: InteractivePreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);

  const currentColors = getModeColors(mode);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleModeSelect = useCallback((newMode: InteractiveMode) => {
    onModeChange?.(newMode);
    setShowModeSelector(false);
  }, [onModeChange]);

  // Render static image view
  const renderStaticImage = () => (
    <div className="relative w-full h-full" data-testid="interactive-preview-static">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt="Generated scene"
          fill
          className="object-contain"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
          <ImageIcon size={32} className="text-slate-600" />
        </div>
      )}
    </div>
  );

  // Render appropriate interactive component
  const renderInteractiveContent = () => {
    // If no prototype yet and not static mode, show generate prompt
    if (mode !== 'static' && !prototype) {
      return (
        <div className="relative w-full h-full" data-testid="interactive-preview-generate-prompt">
          {/* Background image */}
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Generated scene"
              fill
              className="object-contain opacity-40"
              unoptimized
            />
          )}

          {/* Generate overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
            {isGenerating ? (
              <>
                <Loader2 className={`w-10 h-10 ${currentColors.text} animate-spin mb-3`} />
                <span className={`font-mono type-label ${currentColors.text} uppercase tracking-wider`}>
                  Generating {INTERACTIVE_MODES[mode].label}...
                </span>
              </>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onGeneratePrototype}
                  className={`px-4 py-2 radius-md ${currentColors.bg} border ${currentColors.border}
                             hover:brightness-125 transition-all flex items-center gap-2`}
                  data-testid="interactive-preview-generate-btn"
                >
                  <Sparkles size={16} className={currentColors.text} />
                  <span className={`font-mono type-body-sm ${currentColors.text} uppercase tracking-wider`}>
                    Generate {INTERACTIVE_MODES[mode].label}
                  </span>
                </motion.button>
                <p className="mt-3 font-mono type-label text-slate-500 max-w-xs text-center">
                  {INTERACTIVE_MODES[mode].description}
                </p>
              </>
            )}
          </div>
        </div>
      );
    }

    // Render based on mode
    switch (mode) {
      case 'webgl':
        return prototype ? (
          <WebGLDemo
            prototype={prototype}
            imageUrl={imageUrl}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
          />
        ) : null;

      case 'clickable':
        return prototype ? (
          <ClickablePrototype
            prototype={prototype}
            imageUrl={imageUrl}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
          />
        ) : null;

      case 'trailer':
        return prototype ? (
          <AnimatedTrailer
            prototype={prototype}
            imageUrl={imageUrl}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
          />
        ) : null;

      case 'static':
      default:
        return renderStaticImage();
    }
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden radius-md ${className}`}
      data-testid="interactive-preview-container"
    >
      {/* Main content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          className="absolute inset-0"
        >
          {renderInteractiveContent()}
        </motion.div>
      </AnimatePresence>

      {/* Mode selector button */}
      {availableModes.length > 1 && (
        <div className="absolute top-2 right-2 z-20">
          <button
            onClick={() => setShowModeSelector(!showModeSelector)}
            className={`px-2 py-1 radius-sm ${currentColors.bg} border ${currentColors.border}
                       hover:brightness-125 transition-all flex items-center gap-1.5`}
            data-testid="interactive-preview-mode-selector-btn"
          >
            {getModeIcon(mode)}
            <span className={`font-mono type-label ${currentColors.text} uppercase`}>
              {INTERACTIVE_MODES[mode].label}
            </span>
          </button>

          {/* Mode dropdown */}
          <AnimatePresence>
            {showModeSelector && (
              <motion.div
                variants={scaleIn}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transitions.fast}
                className="absolute top-full right-0 mt-1 p-1 bg-slate-900/95 border border-slate-700 radius-md shadow-elevated min-w-[180px]"
                data-testid="interactive-preview-mode-dropdown"
              >
                {availableModes.map((availableMode) => {
                  const colors = getModeColors(availableMode);
                  const isActive = availableMode === mode;

                  return (
                    <button
                      key={availableMode}
                      onClick={() => handleModeSelect(availableMode)}
                      className={`w-full px-3 py-2 radius-sm flex items-center gap-2 transition-colors
                                 ${isActive ? colors.bg : 'hover:bg-slate-800'}`}
                      data-testid={`interactive-mode-option-${availableMode}`}
                    >
                      <span className={isActive ? colors.text : 'text-slate-400'}>
                        {getModeIcon(availableMode)}
                      </span>
                      <div className="flex-1 text-left">
                        <span className={`font-mono type-body-sm block ${isActive ? colors.text : 'text-slate-300'}`}>
                          {INTERACTIVE_MODES[availableMode].label}
                        </span>
                        <span className="font-mono type-label text-slate-500 block">
                          {INTERACTIVE_MODES[availableMode].description}
                        </span>
                      </div>
                      {isActive && (
                        <span className={`w-2 h-2 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-50 bg-black"
          >
            <button
              onClick={handleToggleFullscreen}
              className="absolute top-4 right-4 z-50 p-2 bg-slate-800/80 border border-slate-700 radius-sm hover:bg-slate-700 transition-colors"
              data-testid="interactive-preview-close-fullscreen-btn"
            >
              <X size={20} className="text-white" />
            </button>

            {/* Render content in fullscreen */}
            {renderInteractiveContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InteractivePreview;
