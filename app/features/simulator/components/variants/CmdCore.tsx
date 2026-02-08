/**
 * CmdCore - Command mode core layout (bridge component)
 *
 * Reads fine-grained context hooks and distributes handlers as props
 * to leaf components (DimensionColumn, PromptSection).
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
  PanelSlot,
} from '../../types';
import { useResponsivePanels } from '../../lib/useResponsivePanels';

// Props-only leaf components from subfeatures
import { DimensionColumn } from '../../subfeature_dimensions/components/DimensionColumn';
import { CentralBrain } from '../../subfeature_brain/components/CentralBrain';
import { PromptSection } from '../../subfeature_prompts/components/PromptSection';

// Fine-grained context hooks
import { useDimensionsState, useDimensionsActions } from '../../subfeature_dimensions/DimensionsContext';
import { usePromptsState, usePromptsActions } from '../../subfeature_prompts/PromptsContext';
import { useSimulatorContext } from '../../SimulatorContext';

export interface CmdCoreProps {
  // Image generation props
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  onStartImage?: (promptId: string) => void;
  onDeleteImage?: (promptId: string) => void;
  savedPromptIds: Set<string>;
  onDeleteGenerations?: () => void;

  // Poster generation (for DirectorControl via CentralBrain)
  isGeneratingPoster: boolean;
  onGeneratePoster?: () => Promise<void>;

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
    errorPhase?: string;
    onStart: (config: import('../../types').ExtendedAutoplayConfig) => void;
    onStop: () => void;
    onReset: () => void;
    onRetry?: () => void;
    currentIteration?: number;
    maxIterations?: number;
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
  isGeneratingPoster,
  onGeneratePoster,
  onOpenComparison,
  onViewPrompt,
  leftPanelSlots,
  rightPanelSlots,
  autoplay,
  multiPhaseAutoplay,
}: CmdCoreProps) {
  // Fine-grained context hooks
  const dimensionsState = useDimensionsState();
  const dimensionsActions = useDimensionsActions();
  const promptsState = usePromptsState();
  const promptsActions = usePromptsActions();
  const simulator = useSimulatorContext();
  const panels = useResponsivePanels();

  // Derive autoplay lock state from multi-phase autoplay
  const isAutoplayLocked = multiPhaseAutoplay?.isRunning ?? false;

  // Memoize dimension splitting
  const { leftDimensions, rightDimensions } = useMemo(() => {
    const midPoint = Math.ceil(dimensionsState.dimensions.length / 2);
    return {
      leftDimensions: dimensionsState.dimensions.slice(0, midPoint),
      rightDimensions: dimensionsState.dimensions.slice(midPoint),
    };
  }, [dimensionsState.dimensions]);

  // Memoize reorder handlers
  const handleLeftReorder = useCallback((reorderedLeft: typeof leftDimensions) => {
    const currentMidPoint = Math.ceil(dimensionsState.dimensions.length / 2);
    const currentRight = dimensionsState.dimensions.slice(currentMidPoint);
    dimensionsActions.handleDimensionReorder([...reorderedLeft, ...currentRight]);
  }, [dimensionsState.dimensions, dimensionsActions.handleDimensionReorder]);

  const handleRightReorder = useCallback((reorderedRight: typeof rightDimensions) => {
    const currentMidPoint = Math.ceil(dimensionsState.dimensions.length / 2);
    const currentLeft = dimensionsState.dimensions.slice(0, currentMidPoint);
    dimensionsActions.handleDimensionReorder([...currentLeft, ...reorderedRight]);
  }, [dimensionsState.dimensions, dimensionsActions.handleDimensionReorder]);

  // Copy handler with clipboard - bridges prompts context to leaf components
  const handleCopy = useCallback((id: string) => {
    promptsActions.handleCopy(id);
    const prompt = promptsState.generatedPrompts.find(p => p.id === id);
    if (prompt) {
      navigator.clipboard.writeText(prompt.prompt);
    }
  }, [promptsActions.handleCopy, promptsState.generatedPrompts]);

  // Memoize prompt splitting
  const { topPrompts, bottomPrompts } = useMemo(() => ({
    topPrompts: promptsState.generatedPrompts.slice(0, 2),
    bottomPrompts: promptsState.generatedPrompts.slice(2),
  }), [promptsState.generatedPrompts]);

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
        onRate={promptsActions.handlePromptRate}
        onLock={promptsActions.handlePromptLock}
        onLockElement={promptsActions.handleElementLock}
        onAcceptElement={simulator.onAcceptElement}
        acceptingElementId={promptsState.acceptingElementId}
        onCopy={handleCopy}
        isGenerating={simulator.isGenerating}
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
          onChange={dimensionsActions.handleDimensionChange}
          onWeightChange={dimensionsActions.handleDimensionWeightChange}
          onFilterModeChange={dimensionsActions.handleDimensionFilterModeChange}
          onTransformModeChange={dimensionsActions.handleDimensionTransformModeChange}
          onReferenceImageChange={dimensionsActions.handleDimensionReferenceImageChange}
          onRemove={dimensionsActions.handleDimensionRemove}
          onAdd={dimensionsActions.handleDimensionAdd}
          onDropElement={simulator.onDropElementOnDimension}
          isExpanded={panels.sidebarsExpanded}
          onToggleExpand={panels.toggleSidebars}
          disabled={isAutoplayLocked}
        />

        {/* Center Core: Brain (Breakdown + Feedback) */}
        <CentralBrain
          generatedImages={generatedImages}
          isGeneratingImages={isGeneratingImages}
          onDeleteGenerations={onDeleteGenerations}
          isGeneratingPoster={isGeneratingPoster}
          onGeneratePoster={onGeneratePoster}
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
          onChange={dimensionsActions.handleDimensionChange}
          onWeightChange={dimensionsActions.handleDimensionWeightChange}
          onFilterModeChange={dimensionsActions.handleDimensionFilterModeChange}
          onTransformModeChange={dimensionsActions.handleDimensionTransformModeChange}
          onReferenceImageChange={dimensionsActions.handleDimensionReferenceImageChange}
          onRemove={dimensionsActions.handleDimensionRemove}
          onAdd={dimensionsActions.handleDimensionAdd}
          onDropElement={simulator.onDropElementOnDimension}
          isExpanded={panels.sidebarsExpanded}
          onToggleExpand={panels.toggleSidebars}
          disabled={isAutoplayLocked}
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
        onRate={promptsActions.handlePromptRate}
        onLock={promptsActions.handlePromptLock}
        onLockElement={promptsActions.handleElementLock}
        onAcceptElement={simulator.onAcceptElement}
        acceptingElementId={promptsState.acceptingElementId}
        onCopy={handleCopy}
        isGenerating={simulator.isGenerating}
      />
    </div>
  );
}

export const CmdCore = memo(CmdCoreComponent);
export default CmdCore;
