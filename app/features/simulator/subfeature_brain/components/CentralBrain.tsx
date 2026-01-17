/**
 * CentralBrain - Central control area with source analysis and director control
 *
 * Uses BrainContext, PromptsContext, DimensionsContext, and SimulatorContext
 * to access state and handlers.
 *
 * Contains:
 * - Source Analysis section (SmartBreakdown + BaseImageInput)
 * - Director Control section (extracted to DirectorControl component)
 * - Poster overlay toggle
 */

'use client';

import React, { useState, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Upload } from 'lucide-react';
import {
  InteractiveMode,
  GeneratedImage,
  ProjectPoster,
} from '../../types';
import { BaseImageInput } from './BaseImageInput';
import { SmartBreakdown } from './SmartBreakdown';
import { PosterOverlay } from './PosterOverlay';
import { DirectorControl } from './DirectorControl';
import { slideDown, useReducedMotion, getReducedMotionTransitions } from '../../lib/motion';
import { useBrainContext } from '../BrainContext';
import { useDimensionsContext } from '../../subfeature_dimensions/DimensionsContext';
import { useSimulatorContext } from '../../SimulatorContext';

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for posters
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];

export interface CentralBrainProps {
  // Interactive mode props (passed from layout since they're project-level concerns)
  interactiveMode: InteractiveMode;
  availableInteractiveModes: InteractiveMode[];
  onInteractiveModeChange?: (mode: InteractiveMode) => void;

  // Image generation (external to subfeatures)
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  onDeleteGenerations?: () => void;

  // Poster props (project-level)
  projectPoster?: ProjectPoster | null;
  showPosterOverlay: boolean;
  onTogglePosterOverlay?: () => void;
  isGeneratingPoster: boolean;
  onUploadPoster?: (imageDataUrl: string) => void;
  onGeneratePoster?: () => Promise<void>;
}

function CentralBrainComponent({
  interactiveMode,
  availableInteractiveModes,
  onInteractiveModeChange,
  generatedImages,
  isGeneratingImages,
  onDeleteGenerations,
  projectPoster,
  showPosterOverlay,
  onTogglePosterOverlay,
  isGeneratingPoster,
  onUploadPoster,
  onGeneratePoster,
}: CentralBrainProps) {
  // Get state and handlers from contexts
  const brain = useBrainContext();
  const dimensions = useDimensionsContext();
  const simulator = useSimulatorContext();

  // Local state for poster upload
  const posterInputRef = useRef<HTMLInputElement>(null);
  const [posterUploadError, setPosterUploadError] = useState<string | null>(null);

  // Reduced motion support for accessibility
  const prefersReducedMotion = useReducedMotion();
  const motionTransitions = useMemo(
    () => getReducedMotionTransitions(prefersReducedMotion),
    [prefersReducedMotion]
  );

  // Smart breakdown handler - bridges brain to dimensions (memoized)
  const handleSmartBreakdownApply = useCallback(
    (baseImage: string, newDimensions: typeof dimensions.dimensions, outputMode: typeof brain.outputMode) => {
      brain.handleSmartBreakdownApply(baseImage, newDimensions, outputMode, dimensions.setDimensions);
    },
    [brain.handleSmartBreakdownApply, dimensions.setDimensions]
  );

  // Image parse handler - bridges brain to dimensions (memoized)
  const handleImageParse = useCallback(
    (imageDataUrl: string) => {
      const onDimensionsUpdate = (updater: (prev: typeof dimensions.dimensions) => typeof dimensions.dimensions) => {
        const updated = updater(dimensions.dimensions);
        dimensions.setDimensions(updated);
      };
      brain.handleImageParse(imageDataUrl, onDimensionsUpdate);
    },
    [brain.handleImageParse, dimensions.dimensions, dimensions.setDimensions]
  );

  // Poster upload handler
  const handlePosterUploadClick = useCallback(() => {
    posterInputRef.current?.click();
  }, []);

  const handlePosterFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPosterUploadError(null);

    if (!SUPPORTED_FORMATS.includes(file.type)) {
      setPosterUploadError('Use JPEG, PNG, or WebP');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setPosterUploadError('Max size is 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onUploadPoster?.(dataUrl);
    };
    reader.onerror = () => {
      setPosterUploadError('Failed to read file');
    };
    reader.readAsDataURL(file);

    if (posterInputRef.current) {
      posterInputRef.current.value = '';
    }
  }, [onUploadPoster]);

  return (
    <div className="flex-1 relative group flex flex-col w-full min-w-0">
      {/* Animated border gradient */}
      <div
        className={`absolute -inset-[2px] bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-amber-500/30 radius-lg blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-1000 ${
          simulator.isGenerating ? 'animate-pulse' : ''
        }`}
      />
      {/* Outer glow shadow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-amber-500/10 radius-lg blur-xl opacity-40 pointer-events-none" />

      <div className="relative flex-1 bg-surface-primary/95 backdrop-blur-xl radius-lg border border-white/10 flex flex-col shadow-floating overflow-hidden">
        {/* Status Glow Indicator */}
        {simulator.isGenerating && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-shimmer z-50" />
        )}

        {/* Top Half: Input & Analysis */}
        <div className="flex-1 overflow-y-auto p-lg custom-scrollbar">
          {/* Header - improved typography and wider tab switcher */}
          <div className="mb-md flex items-center justify-between gap-4">
            <span className="text-md uppercase tracking-widest text-white font-medium flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
              Source Analysis
            </span>

            {/* Tab Switcher - doubled width */}
            <div className="flex items-center gap-2">
              {/* Upload poster button */}
              {showPosterOverlay && onUploadPoster && (
                <>
                  <input
                    ref={posterInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={handlePosterFileSelect}
                    className="hidden"
                    data-testid="poster-upload-input"
                  />
                  <button
                    onClick={handlePosterUploadClick}
                    data-testid="poster-upload-btn"
                    className="px-4 py-1.5 text-md font-mono radius-sm transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20"
                  >
                    <Upload size={14} />
                    Upload Poster
                  </button>
                </>
              )}

              {/* Poster toggle button - wider */}
              {(projectPoster || isGeneratingPoster) && onTogglePosterOverlay && (
                <button
                  onClick={onTogglePosterOverlay}
                  data-testid="poster-toggle-btn"
                  className={`px-6 py-1.5 text-md font-mono radius-sm transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 min-w-[160px] justify-center ${
                    showPosterOverlay
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Film size={14} />
                  {showPosterOverlay ? 'SHOW INPUTS' : 'VIEW POSTER'}
                </button>
              )}
            </div>
          </div>

          {/* Poster upload error */}
          {posterUploadError && (
            <div className="mb-md px-3 py-2 bg-red-500/10 border border-red-500/30 radius-md">
              <p className="font-mono text-sm text-red-400">// {posterUploadError}</p>
            </div>
          )}

          {/* Poster overlay or regular content */}
          <AnimatePresence mode="wait">
            {showPosterOverlay ? (
              <motion.div
                key="poster"
                variants={slideDown}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={motionTransitions.normal}
                className="h-full min-h-[300px]"
              >
                <PosterOverlay poster={projectPoster || null} isGenerating={isGeneratingPoster} />
              </motion.div>
            ) : (
              <motion.div
                key="inputs"
                variants={slideDown}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={motionTransitions.normal}
              >
                <SmartBreakdown
                  onApply={handleSmartBreakdownApply}
                  isDisabled={simulator.isGenerating}
                />

                <div className="mt-lg">
                  <BaseImageInput
                    value={brain.baseImage}
                    onChange={brain.setBaseImage}
                    imageFile={brain.baseImageFile}
                    onImageChange={brain.setBaseImageFile}
                    onImageParse={handleImageParse}
                    isParsingImage={brain.isParsingImage}
                    parseError={brain.imageParseError}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-800/50 w-full shrink-0" />

        {/* Bottom Half: Director Control */}
        <DirectorControl
          interactiveMode={interactiveMode}
          availableInteractiveModes={availableInteractiveModes}
          onInteractiveModeChange={onInteractiveModeChange}
          generatedImages={generatedImages}
          isGeneratingImages={isGeneratingImages}
          onDeleteGenerations={onDeleteGenerations}
          isGeneratingPoster={isGeneratingPoster}
          onGeneratePoster={onGeneratePoster}
        />
      </div>
    </div>
  );
}

/**
 * Custom comparison function for React.memo
 * Only re-render when significant props change
 */
function arePropsEqual(
  prevProps: CentralBrainProps,
  nextProps: CentralBrainProps
): boolean {
  // Compare interactive mode
  if (prevProps.interactiveMode !== nextProps.interactiveMode) return false;

  // Compare available modes by reference
  if (prevProps.availableInteractiveModes !== nextProps.availableInteractiveModes) return false;

  // Compare generated images by reference
  if (prevProps.generatedImages !== nextProps.generatedImages) return false;

  // Compare boolean flags
  if (prevProps.isGeneratingImages !== nextProps.isGeneratingImages) return false;
  if (prevProps.isGeneratingPoster !== nextProps.isGeneratingPoster) return false;
  if (prevProps.showPosterOverlay !== nextProps.showPosterOverlay) return false;

  // Compare poster by reference
  if (prevProps.projectPoster !== nextProps.projectPoster) return false;

  return true;
}

export const CentralBrain = memo(CentralBrainComponent, arePropsEqual);
export default CentralBrain;
