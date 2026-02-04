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

import React, { useEffect, useCallback, memo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  GeneratedPrompt,
  GeneratedImage,
  ProjectPoster,
  PanelSlot,
  SavedPanelImage,
} from '../../types';
import { PosterGeneration } from '../../hooks/usePoster';
import { SidePanel, UploadImageModal } from '../../subfeature_panels';
import { Toast, useToast } from '@/app/components/ui';
import { useResponsivePanels } from '../../lib/useResponsivePanels';

// Core view components
import { CmdCore } from './CmdCore';
import { PosterCore } from './PosterCore';
import { WhatifCore } from './WhatifCore';

// Legacy components for poster overlay
import { PosterFullOverlay } from '../../subfeature_brain/components/PosterFullOverlay';

// Context for simulator actions
import { useSimulatorContext } from '../../SimulatorContext';

// Zustand store for view mode
import { useViewModeStore } from '../../stores';

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
  // Get simulator actions from context
  const simulator = useSimulatorContext();

  // Get view mode from Zustand store
  const { viewMode } = useViewModeStore();

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


  return (
    <div className="h-full w-full bg-surface-primary text-slate-200 flex overflow-hidden p-lg gap-lg font-sans selection:bg-amber-900/50 selection:text-amber-100 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/20 via-surface-primary to-surface-primary pointer-events-none" />

      {/* Copy Toast */}
      <Toast {...toastProps} data-testid="copy-toast" />

      {/* Left Border: Image Placeholders - only shown in CMD mode */}
      {viewMode === 'cmd' && (
        <SidePanel
          side="left"
          slots={leftPanelSlots}
          onRemoveImage={onRemovePanelImage}
          onViewImage={onViewPanelImage}
          onEmptySlotClick={handleEmptySlotClick}
        />
      )}

      {/* Main Layout - switches based on view mode */}
      {viewMode === 'cmd' && (
        <CmdCore
          generatedImages={generatedImages}
          isGeneratingImages={isGeneratingImages}
          onStartImage={onStartImage}
          onDeleteImage={onDeleteImage}
          savedPromptIds={savedPromptIds}
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
          onOpenComparison={onOpenComparison}
          onViewPrompt={onViewPrompt}
          leftPanelSlots={leftPanelSlots}
          rightPanelSlots={rightPanelSlots}
          autoplay={autoplay}
          multiPhaseAutoplay={multiPhaseAutoplay}
        />
      )}

      {viewMode === 'poster' && (
        <PosterCore
          projectPoster={projectPoster}
          posterGenerations={posterGenerations}
          selectedPosterIndex={selectedPosterIndex}
          isGeneratingPoster={isGeneratingPoster}
          isSavingPoster={isSavingPoster}
          onSelectPoster={onSelectPoster}
          onSavePoster={onSavePoster}
          onCancelPosterGeneration={onCancelPosterGeneration}
          onUploadPoster={onUploadPoster}
          onGeneratePoster={onGeneratePoster}
        />
      )}

      {viewMode === 'whatif' && (
        <WhatifCore />
      )}

      {/* Poster Overlay - covers center when active (for CMD mode backward compat) */}
      <AnimatePresence>
        {viewMode === 'cmd' && showPosterOverlay && (
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

      {/* Right Border: Image Placeholders - only shown in CMD mode */}
      {viewMode === 'cmd' && (
        <SidePanel
          side="right"
          slots={rightPanelSlots}
          onRemoveImage={onRemovePanelImage}
          onViewImage={onViewPanelImage}
          onEmptySlotClick={handleEmptySlotClick}
        />
      )}

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

  // Compare saved prompt IDs by size first (fast check)
  if (prevProps.savedPromptIds?.size !== nextProps.savedPromptIds?.size) return false;

  // Compare poster by reference
  if (prevProps.projectPoster !== nextProps.projectPoster) return false;

  // Compare autoplay by reference
  if (prevProps.autoplay !== nextProps.autoplay) return false;

  return true;
}

export const OnionLayout = memo(OnionLayoutComponent, arePropsEqual);
