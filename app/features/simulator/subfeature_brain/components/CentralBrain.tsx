/**
 * CentralBrain - Central control area with source analysis and director control
 *
 * Uses BrainContext, PromptsContext, DimensionsContext, and SimulatorContext
 * to access state and handlers. Always shows Source Analysis + Director Control.
 * View-mode overlays (Poster, WhatIf) are rendered at the OnionLayout level.
 *
 * Contains:
 * - Source Analysis section (SmartBreakdown + BaseImageInput)
 * - Director Control section (extracted to DirectorControl component)
 */

'use client';

import React, { useCallback, memo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sliders } from 'lucide-react';
import {
  GeneratedImage,
} from '../../types';
import { BaseImageInput } from './BaseImageInput';
import { SmartBreakdown } from './SmartBreakdown';
import { DirectorControl } from './DirectorControl';
import { PersistentActionBar } from './PersistentActionBar';
import { useBrainState, useBrainActions } from '../BrainContext';
import { useDimensionsState, useDimensionsActions } from '../../subfeature_dimensions/DimensionsContext';
import { useSimulatorContext } from '../../SimulatorContext';

export interface CentralBrainProps {
  // Image generation (external to subfeatures)
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  onDeleteGenerations?: () => void;

  // Poster generation (for DirectorControl)
  isGeneratingPoster: boolean;
  onGeneratePoster?: () => Promise<void>;

  // Autoplay orchestrator props (legacy single-mode)
  autoplay?: {
    isRunning: boolean;
    canStart: boolean;
    canStartReason: string | null;
    status: string;
    currentIteration: number;
    maxIterations: number;
    totalSaved: number;
    targetSaved: number;
    completionReason: string | null;
    error: string | undefined;
    onStart: (config: { targetSavedCount: number; maxIterations: number }) => void;
    onStop: () => void;
    onReset: () => void;
  };

  // Multi-phase autoplay props
  multiPhaseAutoplay?: {
    isRunning: boolean;
    canStart: boolean;
    canStartReason: string | null;
    hasContent: boolean;
    phase: string;
    sketchProgress: { saved: number; target: number };
    gameplayProgress: { saved: number; target: number };
    posterSelected: boolean;
    hudGenerated: number;
    error?: string;
    errorPhase?: string;
    onStart: (config: import('../../types').ExtendedAutoplayConfig) => void;
    onStop: () => void;
    onReset: () => void;
    onRetry?: () => void;
    currentIteration?: number;
    maxIterations?: number;
    currentImageInPhase?: number;
    phaseTarget?: number;
    singlePhaseStatus?: string;
    // Event log for activity modal
    eventLog?: {
      textEvents: import('../../types').AutoplayLogEntry[];
      imageEvents: import('../../types').AutoplayLogEntry[];
      clearEvents: () => void;
    };
  };
}

function CentralBrainComponent({
  generatedImages,
  isGeneratingImages,
  onDeleteGenerations,
  isGeneratingPoster,
  onGeneratePoster,
  autoplay,
  multiPhaseAutoplay,
}: CentralBrainProps) {
  // Get state and handlers from fine-grained contexts
  const brainState = useBrainState();
  const brainActions = useBrainActions();
  const dimensionsState = useDimensionsState();
  const dimensionsActions = useDimensionsActions();
  const simulator = useSimulatorContext();

  // Derive autoplay lock state from multi-phase autoplay
  const isAutoplayLocked = multiPhaseAutoplay?.isRunning ?? false;

  // Smart breakdown handler - bridges brain to dimensions (memoized)
  const handleSmartBreakdownApply = useCallback(
    (
      visionSentence: string,
      baseImage: string,
      newDimensions: typeof dimensionsState.dimensions,
      outputMode: typeof brainState.outputMode,
      breakdown: { baseImage: { format: string; keyElements: string[] }; reasoning: string }
    ) => {
      brainActions.handleSmartBreakdownApply(visionSentence, baseImage, newDimensions, outputMode, dimensionsActions.setDimensions, breakdown);
    },
    [brainActions.handleSmartBreakdownApply, dimensionsActions.setDimensions]
  );

  // Image parse handler - bridges brain to dimensions (memoized)
  const handleImageParse = useCallback(
    (imageDataUrl: string) => {
      const onDimensionsUpdate = (updater: (prev: typeof dimensionsState.dimensions) => typeof dimensionsState.dimensions) => {
        const updated = updater(dimensionsState.dimensions);
        dimensionsActions.setDimensions(updated);
      };
      // Pass current dimensions for snapshot before parsing
      brainActions.handleImageParse(imageDataUrl, dimensionsState.dimensions, onDimensionsUpdate);
    },
    [brainActions.handleImageParse, dimensionsState.dimensions, dimensionsActions.setDimensions]
  );

  // Undo parse handler - restores previous state
  const handleUndoParse = useCallback(() => {
    brainActions.undoImageParse(dimensionsActions.setDimensions);
  }, [brainActions.undoImageParse, dimensionsActions.setDimensions]);

  // Tab state with directional tracking for slide animations
  const [activeTab, setActiveTab] = useState<'source' | 'director'>('source');
  const tabDirection = useRef(1);

  const handleTabSwitch = useCallback((tab: 'source' | 'director') => {
    tabDirection.current = tab === 'director' ? 1 : -1;
    setActiveTab(tab);
  }, []);

  // Status indicators for tab dots
  const sourceActive = brainState.isParsingImage;
  const directorActive = simulator.isGenerating || isAutoplayLocked;

  // Accent colors per tab
  const isSource = activeTab === 'source';
  const accentColor = isSource ? 'cyan' : 'amber';

  // Directional content slide variants
  const contentVariants = {
    initial: (dir: number) => ({ opacity: 0, x: dir * 40 }),
    animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const } },
    exit: (dir: number) => ({ opacity: 0, x: dir * -40, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const } }),
  };

  return (
    <div className="flex-1 relative group flex flex-col w-full min-w-0">
      {/* Animated border gradient — shifts hue toward active tab accent */}
      <motion.div
        className={`absolute -inset-[2px] radius-lg blur-md ${simulator.isGenerating || isAutoplayLocked ? 'animate-pulse' : ''}`}
        animate={{
          opacity: simulator.isGenerating ? 0.9 : 0.5,
          background: isSource
            ? 'linear-gradient(to right, rgba(6,182,212,0.35), rgba(168,85,247,0.25), rgba(6,182,212,0.15))'
            : 'linear-gradient(to right, rgba(245,158,11,0.15), rgba(168,85,247,0.25), rgba(245,158,11,0.35))',
        }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        style={{ willChange: 'opacity, background' }}
      />
      {/* Outer glow — color-shifts with active tab */}
      <motion.div
        className="absolute -inset-4 radius-lg blur-xl pointer-events-none"
        animate={{
          opacity: simulator.isGenerating ? 0.6 : 0.3,
          background: isSource
            ? 'linear-gradient(to right, rgba(6,182,212,0.12), rgba(168,85,247,0.08), rgba(6,182,212,0.06))'
            : 'linear-gradient(to right, rgba(245,158,11,0.06), rgba(168,85,247,0.08), rgba(245,158,11,0.12))',
        }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      />

      <div className="relative flex-1 bg-gradient-to-b from-slate-950/95 via-[#0a0a0a]/95 to-slate-950/98 backdrop-blur-xl radius-lg border border-white/10 flex flex-col shadow-floating overflow-hidden">

        {/* Corner accent marks — viewfinder frame */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/[0.06] rounded-tl-lg pointer-events-none z-10" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-white/[0.06] rounded-tr-lg pointer-events-none z-10" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-white/[0.06] rounded-bl-lg pointer-events-none z-10" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/[0.06] rounded-br-lg pointer-events-none z-10" />

        {/* Top edge accent — animated color based on active tab */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px] z-50"
          animate={{
            background: isSource
              ? 'linear-gradient(to right, transparent, rgba(6,182,212,0.6), transparent)'
              : 'linear-gradient(to right, transparent, rgba(245,158,11,0.6), transparent)',
          }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        />

        {/* ═══ SPLIT TAB BAR ═══ */}
        <div className="relative shrink-0">
          <div className="flex">
            {/* Source tab */}
            <motion.button
              onClick={() => handleTabSwitch('source')}
              whileHover={{ backgroundColor: isSource ? undefined : 'rgba(255,255,255,0.03)' }}
              whileTap={{ scale: 0.98 }}
              className={`w-1/2 flex items-center justify-center gap-2 py-3 font-mono text-sm uppercase tracking-[0.2em] transition-colors duration-200 relative
                ${isSource
                  ? 'text-cyan-400'
                  : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <Search size={14} />
              <span>Source</span>
              {/* Status dot */}
              <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                sourceActive
                  ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)] animate-pulse'
                  : isSource
                    ? 'bg-cyan-500/40'
                    : 'bg-slate-700'
              }`} />
            </motion.button>

            {/* Director tab */}
            <motion.button
              onClick={() => handleTabSwitch('director')}
              whileHover={{ backgroundColor: !isSource ? undefined : 'rgba(255,255,255,0.03)' }}
              whileTap={{ scale: 0.98 }}
              className={`w-1/2 flex items-center justify-center gap-2 py-3 font-mono text-sm uppercase tracking-[0.2em] transition-colors duration-200 relative
                ${!isSource
                  ? 'text-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <Sliders size={14} />
              <span>Director</span>
              {/* Status dot */}
              <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                directorActive
                  ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)] animate-pulse'
                  : !isSource
                    ? 'bg-amber-500/40'
                    : 'bg-slate-700'
              }`} />
            </motion.button>
          </div>

          {/* Sliding underline indicator */}
          <div className="relative h-[3px]">
            <motion.div
              className="absolute top-0 h-full w-1/2 rounded-full"
              animate={{
                left: isSource ? '0%' : '50%',
                background: isSource
                  ? 'linear-gradient(to right, transparent, rgba(6,182,212,0.8), transparent)'
                  : 'linear-gradient(to right, transparent, rgba(245,158,11,0.8), transparent)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            />
          </div>

          {/* Separator line — accent-colored gradient */}
          <motion.div
            className="h-px w-full"
            animate={{
              background: isSource
                ? 'linear-gradient(to right, transparent, rgba(6,182,212,0.2), transparent)'
                : 'linear-gradient(to right, transparent, rgba(245,158,11,0.2), transparent)',
            }}
            transition={{ duration: 0.5 }}
          />

          {/* Glow bleed below active tab */}
          <motion.div
            className="absolute -bottom-8 left-0 right-0 h-10 pointer-events-none"
            animate={{
              background: isSource
                ? 'radial-gradient(ellipse at 25% 0%, rgba(6,182,212,0.08) 0%, transparent 70%)'
                : 'radial-gradient(ellipse at 75% 0%, rgba(245,158,11,0.08) 0%, transparent 70%)',
            }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* ═══ ANIMATED CONTENT AREA ═══ */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait" custom={tabDirection.current}>
            <motion.div
              key={activeTab}
              custom={tabDirection.current}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className={`h-full ${activeTab === 'source' ? 'overflow-y-auto p-lg custom-scrollbar' : 'overflow-y-auto custom-scrollbar'}`}
            >
              {activeTab === 'source' ? (
                <>
                  <SmartBreakdown
                    onApply={handleSmartBreakdownApply}
                    initialVisionSentence={brainState.visionSentence}
                    onInputChange={brainActions.setVisionSentence}
                    isDisabled={simulator.isGenerating || isAutoplayLocked}
                  />
                  <div className="mt-lg">
                    <BaseImageInput
                      value={brainState.baseImage}
                      onChange={brainActions.setBaseImage}
                      imageFile={brainState.baseImageFile}
                      onImageChange={brainActions.setBaseImageFile}
                      onImageParse={handleImageParse}
                      isParsingImage={brainState.isParsingImage}
                      parseError={brainState.imageParseError}
                      canUndoParse={brainState.canUndoParse}
                      onUndoParse={handleUndoParse}
                    />
                  </div>
                </>
              ) : (
                <DirectorControl
                  generatedImages={generatedImages}
                  isGeneratingImages={isGeneratingImages}
                  onDeleteGenerations={onDeleteGenerations}
                  isGeneratingPoster={isGeneratingPoster}
                  multiPhaseAutoplay={multiPhaseAutoplay}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ═══ PERSISTENT ACTION BAR — always visible across tabs ═══ */}
        <PersistentActionBar
          isGeneratingPoster={isGeneratingPoster}
          onGeneratePoster={onGeneratePoster}
          generatedImages={generatedImages}
          multiPhaseAutoplay={multiPhaseAutoplay}
          eventLog={multiPhaseAutoplay?.eventLog}
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
  // Compare generated images by reference
  if (prevProps.generatedImages !== nextProps.generatedImages) return false;

  // Compare boolean flags
  if (prevProps.isGeneratingImages !== nextProps.isGeneratingImages) return false;
  if (prevProps.isGeneratingPoster !== nextProps.isGeneratingPoster) return false;

  // Compare autoplay by reference
  if (prevProps.autoplay !== nextProps.autoplay) return false;

  // Compare multiPhaseAutoplay by reference
  if (prevProps.multiPhaseAutoplay !== nextProps.multiPhaseAutoplay) return false;

  return true;
}

export const CentralBrain = memo(CentralBrainComponent, arePropsEqual);
export default CentralBrain;
