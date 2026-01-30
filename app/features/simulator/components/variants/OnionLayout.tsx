/**
 * OnionLayout - Main simulator layout composition
 *
 * Uses React Context for state management, dramatically reducing props.
 * Composes the simulator UI from smaller focused components:
 * - PromptSection: Top/bottom prompt grids (from subfeature_prompts)
 * - DimensionColumn: Left/right dimension parameters (from subfeature_dimensions)
 * - CentralBrain: Source analysis + director control (from subfeature_brain)
 * - SidePanel: Left/right image panels
 */

'use client';

import React, { useEffect, useCallback, useMemo, memo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  GeneratedPrompt,
  GeneratedImage,
  ProjectPoster,
  InteractiveMode,
  PanelSlot,
  SavedPanelImage,
} from '../../types';
import { PosterGeneration } from '../../hooks/usePoster';
import { SidePanel, UploadImageModal } from '../../subfeature_panels';
import { Toast, useToast } from '@/app/components/ui';
import { useResponsivePanels } from '../../lib/useResponsivePanels';

// Context-aware components from subfeatures
import { DimensionColumn } from '../../subfeature_dimensions/components/DimensionColumn';
import { CentralBrain } from '../../subfeature_brain/components/CentralBrain';
import { PosterFullOverlay } from '../../subfeature_brain/components/PosterFullOverlay';
import { PromptSection } from '../../subfeature_prompts/components/PromptSection';

// Contexts
import { useDimensionsContext } from '../../subfeature_dimensions/DimensionsContext';
import { usePromptsContext } from '../../subfeature_prompts/PromptsContext';
import { useSimulatorContext } from '../../SimulatorContext';

export interface OnionLayoutProps {
  // Side panel props (external to subfeatures)
  leftPanelSlots?: PanelSlot[];
  rightPanelSlots?: PanelSlot[];
  onRemovePanelImage?: (imageId: string) => void;
  onViewPanelImage?: (image: SavedPanelImage) => void;

  // Image generation props (external service)
  generatedImages?: GeneratedImage[];
  isGeneratingImages?: boolean;
  onStartImage?: (promptId: string) => void;
  onDeleteImage?: (promptId: string) => void;
  savedPromptIds?: Set<string>;
  onDeleteGenerations?: () => void;

  // Poster props (project-level)
  projectPoster?: ProjectPoster | null;
  showPosterOverlay?: boolean;
  onTogglePosterOverlay?: () => void;
  isGeneratingPoster?: boolean;
  onUploadPoster?: (imageDataUrl: string) => void;
  onGeneratePoster?: () => Promise<void>;

  // Poster generation state (for 2x2 grid selection)
  posterGenerations?: PosterGeneration[];
  selectedPosterIndex?: number | null;
  isSavingPoster?: boolean;
  onSelectPoster?: (index: number) => void;
  onSavePoster?: () => void;
  onCancelPosterGeneration?: () => void;

  // Interactive prototype props (project-level)
  interactiveMode?: InteractiveMode;
  availableInteractiveModes?: InteractiveMode[];
  onInteractiveModeChange?: (mode: InteractiveMode) => void;

  // Comparison props
  onOpenComparison?: () => void;

  // Modal handlers
  onViewPrompt: (prompt: GeneratedPrompt) => void;

  // Upload image to panel
  onUploadImageToPanel?: (side: 'left' | 'right', slotIndex: number, imageUrl: string, prompt?: string) => void;

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
    conceptProgress: { saved: number; target: number };
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

function OnionLayoutComponent({
  // Side panel props
  leftPanelSlots = [],
  rightPanelSlots = [],
  onRemovePanelImage,
  onViewPanelImage,
  // Image generation props
  generatedImages = [],
  isGeneratingImages = false,
  onStartImage,
  onDeleteImage,
  savedPromptIds = new Set(),
  onDeleteGenerations,
  // Poster props
  projectPoster,
  showPosterOverlay = false,
  onTogglePosterOverlay,
  isGeneratingPoster = false,
  onUploadPoster,
  onGeneratePoster,
  // Poster generation state
  posterGenerations = [],
  selectedPosterIndex = null,
  isSavingPoster = false,
  onSelectPoster,
  onSavePoster,
  onCancelPosterGeneration,
  // Interactive prototype props
  interactiveMode = 'static',
  availableInteractiveModes = ['static'],
  onInteractiveModeChange,
  // Comparison props
  onOpenComparison,
  // Modal handlers
  onViewPrompt,
  // Upload image to panel
  onUploadImageToPanel,
  // Autoplay props
  autoplay,
  // Multi-phase autoplay props
  multiPhaseAutoplay,
}: OnionLayoutProps) {
  // Get state from contexts
  const dimensions = useDimensionsContext();
  const prompts = usePromptsContext();
  const simulator = useSimulatorContext();

  // Responsive panel management
  const panels = useResponsivePanels();

  // Toast for copy confirmation
  const { showToast, toastProps } = useToast();

  // Upload modal state
  const [uploadModalState, setUploadModalState] = useState<{
    isOpen: boolean;
    side: 'left' | 'right';
    slotIndex: number;
  }>({ isOpen: false, side: 'left', slotIndex: 0 });

  // Handle empty slot click - opens upload modal
  const handleEmptySlotClick = useCallback((side: 'left' | 'right', slotIndex: number) => {
    setUploadModalState({ isOpen: true, side, slotIndex });
  }, []);

  // Handle upload from modal
  const handleUploadImage = useCallback((imageUrl: string) => {
    if (onUploadImageToPanel) {
      onUploadImageToPanel(
        uploadModalState.side,
        uploadModalState.slotIndex,
        imageUrl,
        'Uploaded image'
      );
    }
  }, [onUploadImageToPanel, uploadModalState.side, uploadModalState.slotIndex]);

  // Close upload modal
  const closeUploadModal = useCallback(() => {
    setUploadModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Auto-expand prompt bars when images are generated
  useEffect(() => {
    if (generatedImages.length > 0 && !isGeneratingImages) {
      panels.expandPromptBars();
    }
  }, [generatedImages.length, isGeneratingImages, panels.expandPromptBars]);

  // Keyboard shortcut (Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && simulator.canGenerate && !simulator.isGenerating && !isGeneratingPoster) {
        simulator.handleGenerate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [simulator.canGenerate, simulator.isGenerating, isGeneratingPoster, simulator.handleGenerate]);

  // Copy handler with toast notification
  const handleCopyWithToast = useCallback((id: string) => {
    const prompt = prompts.generatedPrompts.find(p => p.id === id);
    if (prompt) {
      navigator.clipboard.writeText(prompt.prompt);
      prompts.handleCopy(id);
      showToast('Prompt copied to clipboard', 'success');
    }
  }, [prompts, showToast]);

  // Memoize dimension splitting to avoid recalculation on each render
  const { leftDimensions, rightDimensions } = useMemo(() => {
    const midPoint = Math.ceil(dimensions.dimensions.length / 2);
    return {
      leftDimensions: dimensions.dimensions.slice(0, midPoint),
      rightDimensions: dimensions.dimensions.slice(midPoint),
    };
  }, [dimensions.dimensions]);

  // Memoize reorder handlers - these need stable references
  const handleLeftReorder = useCallback((reorderedLeft: typeof leftDimensions) => {
    // Get current right dimensions at call time to avoid stale closure
    const currentMidPoint = Math.ceil(dimensions.dimensions.length / 2);
    const currentRight = dimensions.dimensions.slice(currentMidPoint);
    dimensions.handleDimensionReorder([...reorderedLeft, ...currentRight]);
  }, [dimensions.dimensions, dimensions.handleDimensionReorder]);

  const handleRightReorder = useCallback((reorderedRight: typeof rightDimensions) => {
    // Get current left dimensions at call time to avoid stale closure
    const currentMidPoint = Math.ceil(dimensions.dimensions.length / 2);
    const currentLeft = dimensions.dimensions.slice(0, currentMidPoint);
    dimensions.handleDimensionReorder([...currentLeft, ...reorderedRight]);
  }, [dimensions.dimensions, dimensions.handleDimensionReorder]);

  // Memoize prompt splitting
  const { topPrompts, bottomPrompts } = useMemo(() => ({
    topPrompts: prompts.generatedPrompts.slice(0, 2),
    bottomPrompts: prompts.generatedPrompts.slice(2),
  }), [prompts.generatedPrompts]);

  // Compute if all panel slots are full (for disabling lock when no room)
  const allSlotsFull = useMemo(() => {
    const allSlots = [...leftPanelSlots, ...rightPanelSlots];
    // Use !! to handle both null and undefined cases
    return allSlots.length > 0 && allSlots.every(slot => !!slot.image);
  }, [leftPanelSlots, rightPanelSlots]);

  return (
    <div className="h-full w-full bg-surface-primary text-slate-200 flex overflow-hidden p-lg gap-lg font-sans selection:bg-amber-900/50 selection:text-amber-100 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/20 via-surface-primary to-surface-primary pointer-events-none" />

      {/* Copy Toast */}
      <Toast {...toastProps} data-testid="copy-toast" />

      {/* Left Border: Image Placeholders */}
      <SidePanel
        side="left"
        slots={leftPanelSlots}
        onRemoveImage={onRemovePanelImage}
        onViewImage={onViewPanelImage}
        onEmptySlotClick={handleEmptySlotClick}
      />

      {/* Main Layout */}
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

          {/* Poster Overlay - covers center when active */}
          <AnimatePresence>
            {showPosterOverlay && (
              <PosterFullOverlay
                isOpen={showPosterOverlay}
                onClose={onTogglePosterOverlay}
                poster={projectPoster || null}
                posterGenerations={posterGenerations}
                selectedIndex={selectedPosterIndex}
                isGenerating={isGeneratingPoster}
                isSaving={isSavingPoster}
                onSelect={onSelectPoster || (() => {})}
                onSave={onSavePoster || (() => {})}
                onCancel={onCancelPosterGeneration || (() => {})}
                onUpload={onUploadPoster}
              />
            )}
          </AnimatePresence>
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

      {/* Right Border: Image Placeholders */}
      <SidePanel
        side="right"
        slots={rightPanelSlots}
        onRemoveImage={onRemovePanelImage}
        onViewImage={onViewPanelImage}
        onEmptySlotClick={handleEmptySlotClick}
      />

      {/* Upload Image Modal */}
      <UploadImageModal
        isOpen={uploadModalState.isOpen}
        onClose={closeUploadModal}
        onUpload={handleUploadImage}
        side={uploadModalState.side}
        slotIndex={uploadModalState.slotIndex}
      />
    </div>
  );
}

/**
 * Custom comparison function for React.memo
 * Only re-render when significant props change
 */
function arePropsEqual(
  prevProps: OnionLayoutProps,
  nextProps: OnionLayoutProps
): boolean {
  // Compare panel slots by reference
  if (prevProps.leftPanelSlots !== nextProps.leftPanelSlots) return false;
  if (prevProps.rightPanelSlots !== nextProps.rightPanelSlots) return false;

  // Compare generated images by reference
  if (prevProps.generatedImages !== nextProps.generatedImages) return false;

  // Compare boolean flags
  if (prevProps.isGeneratingImages !== nextProps.isGeneratingImages) return false;
  if (prevProps.isGeneratingPoster !== nextProps.isGeneratingPoster) return false;
  if (prevProps.showPosterOverlay !== nextProps.showPosterOverlay) return false;

  // Compare interactive mode
  if (prevProps.interactiveMode !== nextProps.interactiveMode) return false;

  // Compare saved prompt IDs by size first (fast check)
  if (prevProps.savedPromptIds?.size !== nextProps.savedPromptIds?.size) return false;

  // Compare poster by reference
  if (prevProps.projectPoster !== nextProps.projectPoster) return false;

  // Compare available modes array by reference
  if (prevProps.availableInteractiveModes !== nextProps.availableInteractiveModes) return false;

  // Compare autoplay by reference
  if (prevProps.autoplay !== nextProps.autoplay) return false;

  return true;
}

export const OnionLayout = memo(OnionLayoutComponent, arePropsEqual);
