/**
 * CmdCore - Command mode core layout
 *
 * Main prompt generation workflow:
 * - Top/Bottom prompt sections
 * - Left/Right dimension columns
 * - Central brain (source analysis + director control)
 */

'use client';

import React, { useCallback, useMemo, memo } from 'react';
import {
  GeneratedPrompt,
  GeneratedImage,
  ProjectPoster,
  InteractiveMode,
  PanelSlot,
} from '../../types';
import { PosterGeneration } from '../../hooks/usePoster';
import { useResponsivePanels } from '../../lib/useResponsivePanels';

// Context-aware components from subfeatures
import { DimensionColumn } from '../../subfeature_dimensions/components/DimensionColumn';
import { CentralBrain } from '../../subfeature_brain/components/CentralBrain';
import { PromptSection } from '../../subfeature_prompts/components/PromptSection';

// Contexts
import { useDimensionsContext } from '../../subfeature_dimensions/DimensionsContext';
import { usePromptsContext } from '../../subfeature_prompts/PromptsContext';

export interface CmdCoreProps {
  // Image generation props
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  onStartImage?: (promptId: string) => void;
  onDeleteImage?: (promptId: string) => void;
  savedPromptIds: Set<string>;
  onDeleteGenerations?: () => void;

  // Poster props (for CentralBrain)
  projectPoster?: ProjectPoster | null;
  showPosterOverlay: boolean;
  onTogglePosterOverlay?: () => void;
  isGeneratingPoster: boolean;
  onUploadPoster?: (imageDataUrl: string) => void;
  onGeneratePoster?: () => Promise<void>;
  posterGenerations?: PosterGeneration[];
  selectedPosterIndex?: number | null;
  isSavingPoster?: boolean;
  onSelectPoster?: (index: number) => void;
  onSavePoster?: () => void;
  onCancelPosterGeneration?: () => void;

  // Interactive prototype props
  interactiveMode: InteractiveMode;
  availableInteractiveModes: InteractiveMode[];
  onInteractiveModeChange?: (mode: InteractiveMode) => void;

  // Comparison props
  onOpenComparison?: () => void;

  // Modal handlers
  onViewPrompt: (prompt: GeneratedPrompt) => void;

  // Panel slot info for full detection
  leftPanelSlots: PanelSlot[];
  rightPanelSlots: PanelSlot[];

  // Autoplay props
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
    eventLog?: {
      textEvents: import('../../types').AutoplayLogEntry[];
      imageEvents: import('../../types').AutoplayLogEntry[];
      clearEvents: () => void;
    };
  };
}

function CmdCoreComponent({
  generatedImages,
  isGeneratingImages,
  onStartImage,
  onDeleteImage,
  savedPromptIds,
  onDeleteGenerations,
  projectPoster,
  showPosterOverlay,
  onTogglePosterOverlay,
  isGeneratingPoster,
  onUploadPoster,
  onGeneratePoster,
  posterGenerations,
  selectedPosterIndex,
  isSavingPoster,
  onSelectPoster,
  onSavePoster,
  onCancelPosterGeneration,
  interactiveMode,
  availableInteractiveModes,
  onInteractiveModeChange,
  onOpenComparison,
  onViewPrompt,
  leftPanelSlots,
  rightPanelSlots,
  autoplay,
  multiPhaseAutoplay,
}: CmdCoreProps) {
  const dimensions = useDimensionsContext();
  const prompts = usePromptsContext();
  const panels = useResponsivePanels();

  // Memoize dimension splitting
  const { leftDimensions, rightDimensions } = useMemo(() => {
    const midPoint = Math.ceil(dimensions.dimensions.length / 2);
    return {
      leftDimensions: dimensions.dimensions.slice(0, midPoint),
      rightDimensions: dimensions.dimensions.slice(midPoint),
    };
  }, [dimensions.dimensions]);

  // Memoize reorder handlers
  const handleLeftReorder = useCallback((reorderedLeft: typeof leftDimensions) => {
    const currentMidPoint = Math.ceil(dimensions.dimensions.length / 2);
    const currentRight = dimensions.dimensions.slice(currentMidPoint);
    dimensions.handleDimensionReorder([...reorderedLeft, ...currentRight]);
  }, [dimensions.dimensions, dimensions.handleDimensionReorder]);

  const handleRightReorder = useCallback((reorderedRight: typeof rightDimensions) => {
    const currentMidPoint = Math.ceil(dimensions.dimensions.length / 2);
    const currentLeft = dimensions.dimensions.slice(0, currentMidPoint);
    dimensions.handleDimensionReorder([...currentLeft, ...reorderedRight]);
  }, [dimensions.dimensions, dimensions.handleDimensionReorder]);

  // Memoize prompt splitting
  const { topPrompts, bottomPrompts } = useMemo(() => ({
    topPrompts: prompts.generatedPrompts.slice(0, 2),
    bottomPrompts: prompts.generatedPrompts.slice(2),
  }), [prompts.generatedPrompts]);

  // Compute if all panel slots are full
  const allSlotsFull = useMemo(() => {
    const allSlots = [...leftPanelSlots, ...rightPanelSlots];
    return allSlots.length > 0 && allSlots.every(slot => !!slot.image);
  }, [leftPanelSlots, rightPanelSlots]);

  return (
    <div className="flex-1 flex flex-col h-full gap-md overflow-hidden z-10 w-full max-w-7xl mx-auto">
      {/* Top Generated Prompts */}
      <PromptSection
        position="top"
        prompts={topPrompts}
        onViewPrompt={onViewPrompt}
        generatedImages={generatedImages}
        onStartImage={onStartImage}
        onDeleteImage={onDeleteImage}
        savedPromptIds={savedPromptIds}
        allSlotsFull={allSlotsFull}
        onOpenComparison={onOpenComparison}
        startSlotNumber={1}
        isExpanded={panels.topBarExpanded}
        onToggleExpand={panels.toggleTopBar}
      />

      {/* Middle Layer: Dimensions - Center Brain - Dimensions */}
      <div className="flex-1 flex gap-lg min-h-0 items-stretch relative">
        {/* Left Dimensions Column */}
        <DimensionColumn
          side="left"
          label="Parameters A"
          collapsedLabel="PARAMS A"
          dimensions={leftDimensions}
          onReorder={handleLeftReorder}
          isExpanded={panels.sidebarsExpanded}
          onToggleExpand={panels.toggleSidebars}
        />

        {/* Center Core: Brain (Breakdown + Feedback) */}
        <CentralBrain
          interactiveMode={interactiveMode}
          availableInteractiveModes={availableInteractiveModes}
          onInteractiveModeChange={onInteractiveModeChange}
          generatedImages={generatedImages}
          isGeneratingImages={isGeneratingImages}
          onDeleteGenerations={onDeleteGenerations}
          projectPoster={projectPoster}
          showPosterOverlay={showPosterOverlay}
          onTogglePosterOverlay={onTogglePosterOverlay}
          isGeneratingPoster={isGeneratingPoster}
          onUploadPoster={onUploadPoster}
          onGeneratePoster={onGeneratePoster}
          posterGenerations={posterGenerations}
          selectedPosterIndex={selectedPosterIndex}
          isSavingPoster={isSavingPoster}
          onSelectPoster={onSelectPoster}
          onSavePoster={onSavePoster}
          onCancelPosterGeneration={onCancelPosterGeneration}
          autoplay={autoplay}
          multiPhaseAutoplay={multiPhaseAutoplay}
        />

        {/* Right Dimensions Column */}
        <DimensionColumn
          side="right"
          label="Parameters B"
          collapsedLabel="PARAMS B"
          dimensions={rightDimensions}
          onReorder={handleRightReorder}
          isExpanded={panels.sidebarsExpanded}
          onToggleExpand={panels.toggleSidebars}
        />
      </div>

      {/* Bottom Generated Prompts */}
      <PromptSection
        position="bottom"
        prompts={bottomPrompts}
        onViewPrompt={onViewPrompt}
        generatedImages={generatedImages}
        onStartImage={onStartImage}
        onDeleteImage={onDeleteImage}
        savedPromptIds={savedPromptIds}
        allSlotsFull={allSlotsFull}
        onOpenComparison={onOpenComparison}
        startSlotNumber={3}
        isExpanded={panels.bottomBarExpanded}
        onToggleExpand={panels.toggleBottomBar}
      />
    </div>
  );
}

export const CmdCore = memo(CmdCoreComponent);
export default CmdCore;
