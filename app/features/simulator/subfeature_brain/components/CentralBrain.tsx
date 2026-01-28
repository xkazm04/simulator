/**
 * CentralBrain - Central control area with source analysis and director control
 *
 * Uses BrainContext, PromptsContext, DimensionsContext, and SimulatorContext
 * to access state and handlers.
 *
 * Contains:
 * - Source Analysis section (SmartBreakdown + BaseImageInput)
 * - Director Control section (extracted to DirectorControl component)
 * - Poster mode toggle (actual poster display handled by PosterFullOverlay in OnionLayout)
 */

'use client';

import React, { useCallback, memo } from 'react';
import { Film } from 'lucide-react';
import {
  InteractiveMode,
  GeneratedImage,
  ProjectPoster,
} from '../../types';
import { PosterGeneration } from '../../hooks/usePoster';
import { BaseImageInput } from './BaseImageInput';
import { SmartBreakdown } from './SmartBreakdown';
import { DirectorControl } from './DirectorControl';
import { useBrainContext } from '../BrainContext';
import { useDimensionsContext } from '../../subfeature_dimensions/DimensionsContext';
import { useSimulatorContext } from '../../SimulatorContext';

export interface CentralBrainProps {
  // Interactive mode props (passed from layout since they're project-level concerns)
  interactiveMode: InteractiveMode;
  availableInteractiveModes: InteractiveMode[];
  onInteractiveModeChange?: (mode: InteractiveMode) => void;

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

  // Autoplay orchestrator props
  autoplay?: {
    isRunning: boolean;
    canStart: boolean;
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
}

function CentralBrainComponent({
  interactiveMode,
  availableInteractiveModes,
  onInteractiveModeChange,
  generatedImages,
  isGeneratingImages,
  onDeleteGenerations,
  showPosterOverlay,
  onTogglePosterOverlay,
  isGeneratingPoster,
  onGeneratePoster,
  autoplay,
}: CentralBrainProps) {
  // Get state and handlers from contexts
  const brain = useBrainContext();
  const dimensions = useDimensionsContext();
  const simulator = useSimulatorContext();

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
              Source Analysis
            </span>

            {/* Poster toggle button - always visible */}
            {onTogglePosterOverlay && (
              <button
                onClick={onTogglePosterOverlay}
                data-testid="poster-toggle-btn"
                className={`px-6 py-1.5 text-md font-mono radius-sm transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 min-w-[140px] justify-center ${showPosterOverlay
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600'
                  }`}
              >
                <Film size={14} />
                {showPosterOverlay ? 'INPUTS' : 'POSTER'}
              </button>
            )}
          </div>

          {/* Source Analysis Content - always visible */}
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
              canUndoParse={brain.canUndoParse}
              onUndoParse={handleUndoParse}
            />
          </div>
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
          autoplay={autoplay}
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
  if (prevProps.isSavingPoster !== nextProps.isSavingPoster) return false;

  // Compare poster by reference
  if (prevProps.projectPoster !== nextProps.projectPoster) return false;

  // Compare poster generations by reference
  if (prevProps.posterGenerations !== nextProps.posterGenerations) return false;
  if (prevProps.selectedPosterIndex !== nextProps.selectedPosterIndex) return false;

  // Compare autoplay by reference
  if (prevProps.autoplay !== nextProps.autoplay) return false;

  return true;
}

export const CentralBrain = memo(CentralBrainComponent, arePropsEqual);
export default CentralBrain;
