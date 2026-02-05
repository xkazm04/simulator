/**
 * CentralBrain - Central control area with source analysis and director control
 *
 * Uses BrainContext, PromptsContext, DimensionsContext, and SimulatorContext
 * to access state and handlers.
 *
 * Contains:
 * - Source Analysis section (SmartBreakdown + BaseImageInput)
 * - Director Control section (extracted to DirectorControl component)
 * - Tab switcher for Command/Poster/WhatIf views
 */

'use client';

import React, { useCallback, memo, useState, useEffect } from 'react';
import {
  GeneratedImage,
  ProjectPoster,
} from '../../types';
import { PosterGeneration } from '../../hooks/usePoster';
import { BaseImageInput } from './BaseImageInput';
import { SmartBreakdown } from './SmartBreakdown';
import { DirectorControl } from './DirectorControl';
import { BrainTabSwitcher, BrainTab } from './BrainTabSwitcher';
import { WhatIfPanel } from './WhatIfPanel';
import { useBrainContext } from '../BrainContext';
import { useDimensionsContext } from '../../subfeature_dimensions/DimensionsContext';
import { useSimulatorContext } from '../../SimulatorContext';
import { useProjectContext } from '../../contexts';

export interface CentralBrainProps {
  // Image generation (external to subfeatures)
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  onDeleteGenerations?: () => void;

  // Poster mode toggle (actual poster display handled by PosterFullOverlay in OnionLayout)
  projectPoster?: ProjectPoster | null;
  showPosterOverlay: boolean;
  onTogglePosterOverlay?: () => void;
  isGeneratingPoster: boolean;
  onUploadPoster?: (imageDataUrl: string) => void;
  onGeneratePoster?: () => Promise<void>;

  // Poster generation state (passed through for OnionLayout compatibility)
  posterGenerations?: PosterGeneration[];
  selectedPosterIndex?: number | null;
  isSavingPoster?: boolean;
  onSelectPoster?: (index: number) => void;
  onSavePoster?: () => void;
  onCancelPosterGeneration?: () => void;

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
    onStart: (config: import('../../types').ExtendedAutoplayConfig) => void;
    onStop: () => void;
    onReset: () => void;
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
  showPosterOverlay,
  onTogglePosterOverlay,
  isGeneratingPoster,
  onGeneratePoster,
  autoplay,
  multiPhaseAutoplay,
}: CentralBrainProps) {
  // Get state and handlers from contexts
  const brain = useBrainContext();
  const dimensions = useDimensionsContext();
  const simulator = useSimulatorContext();
  const project = useProjectContext();

  // Derive autoplay lock state from multi-phase autoplay
  const isAutoplayLocked = multiPhaseAutoplay?.isRunning ?? false;

  // Content mode: 'command' (default) or 'whatif' (replaces Source Analysis section only)
  // Poster is handled as an overlay, not a content mode
  const [contentMode, setContentMode] = useState<'command' | 'whatif'>('command');

  // Derive active tab from contentMode and showPosterOverlay
  const activeTab: BrainTab = showPosterOverlay ? 'poster' : contentMode;

  // Handle tab changes
  const handleTabChange = useCallback((tab: BrainTab) => {
    if (tab === 'poster') {
      // Poster shows as overlay on top of current content
      if (!showPosterOverlay && onTogglePosterOverlay) {
        onTogglePosterOverlay();
      }
    } else {
      // Close poster overlay if open
      if (showPosterOverlay && onTogglePosterOverlay) {
        onTogglePosterOverlay();
      }
      // Switch content mode
      setContentMode(tab as 'command' | 'whatif');
    }
  }, [showPosterOverlay, onTogglePosterOverlay]);

  // Smart breakdown handler - bridges brain to dimensions (memoized)
  const handleSmartBreakdownApply = useCallback(
    (
      visionSentence: string,
      baseImage: string,
      newDimensions: typeof dimensions.dimensions,
      outputMode: typeof brain.outputMode,
      breakdown: { baseImage: { format: string; keyElements: string[] }; reasoning: string }
    ) => {
      brain.handleSmartBreakdownApply(visionSentence, baseImage, newDimensions, outputMode, dimensions.setDimensions, breakdown);
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
      // Pass current dimensions for snapshot before parsing
      brain.handleImageParse(imageDataUrl, dimensions.dimensions, onDimensionsUpdate);
    },
    [brain.handleImageParse, dimensions.dimensions, dimensions.setDimensions]
  );

  // Undo parse handler - restores previous state
  const handleUndoParse = useCallback(() => {
    brain.undoImageParse(dimensions.setDimensions);
  }, [brain.undoImageParse, dimensions.setDimensions]);

  return (
    <div className="flex-1 relative group flex flex-col w-full min-w-0">
      {/* Animated border gradient */}
      <div
        className={`absolute -inset-[2px] bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-amber-500/30 radius-lg blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-1000 ${simulator.isGenerating ? 'animate-pulse' : ''
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
          {/* Header */}
          <div className="mb-md flex items-center justify-between gap-4">
            <span className="text-md uppercase tracking-widest text-white font-medium flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
              {contentMode === 'command' && 'Source Analysis'}
              {contentMode === 'whatif' && 'What If'}
            </span>

            {/* Tab Switcher */}
            <BrainTabSwitcher
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </div>

          {/* Content Area - always shows based on contentMode (poster is overlay) */}
          {contentMode === 'command' && (
            <>
              {/* Source Analysis Content */}
              <SmartBreakdown
                onApply={handleSmartBreakdownApply}
                initialVisionSentence={brain.visionSentence}
                isDisabled={simulator.isGenerating || isAutoplayLocked}
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
                  canUndoParse={brain.canUndoParse}
                  onUndoParse={handleUndoParse}
                />
              </div>
            </>
          )}

          {contentMode === 'whatif' && (
            <WhatIfPanel projectId={project.currentProject?.id || null} />
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-800/50 w-full shrink-0" />

        {/* Bottom Half: Director Control */}
        <DirectorControl
          generatedImages={generatedImages}
          isGeneratingImages={isGeneratingImages}
          onDeleteGenerations={onDeleteGenerations}
          isGeneratingPoster={isGeneratingPoster}
          onGeneratePoster={onGeneratePoster}
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
  if (prevProps.showPosterOverlay !== nextProps.showPosterOverlay) return false;
  if (prevProps.isSavingPoster !== nextProps.isSavingPoster) return false;

  // Compare poster by reference
  if (prevProps.projectPoster !== nextProps.projectPoster) return false;

  // Compare poster generations by reference
  if (prevProps.posterGenerations !== nextProps.posterGenerations) return false;
  if (prevProps.selectedPosterIndex !== nextProps.selectedPosterIndex) return false;

  // Compare autoplay by reference
  if (prevProps.autoplay !== nextProps.autoplay) return false;

  // Compare multiPhaseAutoplay by reference
  if (prevProps.multiPhaseAutoplay !== nextProps.multiPhaseAutoplay) return false;

  return true;
}

export const CentralBrain = memo(CentralBrainComponent, arePropsEqual);
export default CentralBrain;
