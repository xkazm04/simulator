/**
 * SimulatorFeature - "What if" image visualization module
 *
 * Logic extracted into hooks: useProjectManager, usePosterHandlers, useImageEffects, useAutosave
 */

'use client';

import React, { useState, useCallback, lazy, Suspense } from 'react';
import { GeneratedPrompt, SavedPanelImage, InteractiveMode } from './types';
import { useImageGeneration } from './hooks/useImageGeneration';
import { useInteractivePrototype } from './hooks/useInteractivePrototype';
import { useProjectManager } from './hooks/useProjectManager';
import { usePosterHandlers } from './hooks/usePosterHandlers';
import { useImageEffects } from './hooks/useImageEffects';
import { useAutosave } from './hooks/useAutosave';
import { useAutoplayOrchestrator } from './hooks/useAutoplayOrchestrator';
import { useMultiPhaseAutoplay } from './hooks/useMultiPhaseAutoplay';
import { useAutoplayEventLog } from './hooks/useAutoplayEventLog';
import { OnionLayout } from './components/variants/OnionLayout';
import { ModalLoadingFallback } from './components/ModalLoadingFallback';
import { Toast, useToast } from '@/app/components/ui';
import { DimensionsProvider, useDimensionsContext } from './subfeature_dimensions';
import { BrainProvider, useBrainContext } from './subfeature_brain';
import { PromptsProvider, usePromptsContext } from './subfeature_prompts';
import { SimulatorProvider, useSimulatorContext } from './SimulatorContext';
import { SimulatorHeader } from './subfeature_project';

const PromptDetailModal = lazy(() => import('./subfeature_prompts').then(m => ({ default: m.PromptDetailModal })));
const SavedImageModal = lazy(() => import('./subfeature_panels').then(m => ({ default: m.SavedImageModal })));
const InteractivePreviewModal = lazy(() => import('./subfeature_interactive').then(m => ({ default: m.InteractivePreviewModal })));
const ComparisonModal = lazy(() => import('./subfeature_comparison').then(m => ({ default: m.ComparisonModal })));

function SimulatorContent() {
  const [selectedPrompt, setSelectedPrompt] = useState<GeneratedPrompt | null>(null);
  const [selectedPanelImage, setSelectedPanelImage] = useState<SavedPanelImage | null>(null);
  const [interactivePreviewPromptId, setInteractivePreviewPromptId] = useState<string | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const dimensions = useDimensionsContext();
  const brain = useBrainContext();
  const prompts = usePromptsContext();
  const simulator = useSimulatorContext();
  const interactive = useInteractivePrototype();
  const { showToast, toastProps } = useToast();

  // Track current project for image generation (will be set by projectManager)
  const [currentProjectId, setCurrentProjectId] = React.useState<string | null>(null);

  // Callback to sync saved images to database
  const handleImageSaved = useCallback(async (info: { side: 'left' | 'right'; slotIndex: number; imageUrl: string; prompt: string }) => {
    if (!currentProjectId) return;

    try {
      await fetch(`/api/projects/${currentProjectId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: info.side,
          slotIndex: info.slotIndex,
          imageUrl: info.imageUrl,
          prompt: info.prompt,
        }),
      });
    } catch (error) {
      console.error('Failed to sync image to database:', error);
    }
  }, [currentProjectId]);

  const imageGen = useImageGeneration({
    projectId: currentProjectId,
    onImageSaved: handleImageSaved,
  });

  const pm = useProjectManager({ imageGen, onProjectChange: setCurrentProjectId });
  const ph = usePosterHandlers({
    setShowPosterOverlay: pm.setShowPosterOverlay,
    poster: pm.poster,
    currentProject: pm.project.currentProject,
  });

  // Event log for autoplay activity monitoring
  const eventLog = useAutoplayEventLog();

  // Autoplay orchestrator - wires together state machine with image generation
  // NOTE: Must be defined BEFORE useImageEffects so we can pass isRunning to prevent race conditions
  const autoplayOrchestrator = useAutoplayOrchestrator({
    generatedImages: imageGen.generatedImages,
    isGeneratingImages: imageGen.isGeneratingImages,
    generateImagesFromPrompts: imageGen.generateImagesFromPrompts,
    saveImageToPanel: imageGen.saveImageToPanel,
    setFeedback: brain.setFeedback,
    generatedPrompts: prompts.generatedPrompts,
    outputMode: brain.outputMode,
    dimensions: dimensions.dimensions,
    baseImage: brain.baseImage,
    visionSentence: brain.visionSentence,
    breakdown: brain.breakdown,
    onRegeneratePrompts: simulator.handleGenerate,
    onLogEvent: eventLog.addEvent,
  });

  // Multi-phase autoplay - orchestrates concept, gameplay, poster, and HUD phases
  const multiPhaseAutoplay = useMultiPhaseAutoplay({
    generatedImages: imageGen.generatedImages,
    isGeneratingImages: imageGen.isGeneratingImages,
    generateImagesFromPrompts: imageGen.generateImagesFromPrompts,
    saveImageToPanel: imageGen.saveImageToPanel,
    leftPanelSlots: imageGen.leftPanelSlots,
    rightPanelSlots: imageGen.rightPanelSlots,
    setFeedback: brain.setFeedback,
    setOutputMode: brain.setOutputMode,
    baseImage: brain.baseImage,
    visionSentence: brain.visionSentence,
    breakdown: brain.breakdown,
    generatedPrompts: prompts.generatedPrompts,
    dimensions: dimensions.dimensions,
    outputMode: brain.outputMode,
    generatePosters: ph.poster.generatePosters,
    posterGenerations: ph.poster.posterGenerations,
    selectPoster: ph.handleSelectPoster,
    savePoster: ph.handleSavePoster,
    isGeneratingPoster: ph.poster.isGenerating,
    currentProjectId,
    currentProjectName: pm.project.currentProject?.name || 'Untitled',
    onRegeneratePrompts: simulator.handleGenerate,
    onLogEvent: eventLog.addEvent,
  });

  // Image effects - skip auto-generation during autoplay (orchestrator controls flow)
  const ie = useImageEffects({
    imageGen,
    submittedForGenerationRef: pm.submittedForGenerationRef,
    setSavedPromptIds: pm.setSavedPromptIds,
    isAutoplayRunning: autoplayOrchestrator.isRunning || multiPhaseAutoplay.isRunning,
  });
  useAutosave();

  // Create autoplay props object to pass down through layouts (legacy single-mode)
  const autoplayProps = {
    isRunning: autoplayOrchestrator.isRunning,
    canStart: autoplayOrchestrator.canStart,
    canStartReason: autoplayOrchestrator.canStartReason,
    status: autoplayOrchestrator.status,
    currentIteration: autoplayOrchestrator.currentIteration,
    maxIterations: autoplayOrchestrator.maxIterations,
    totalSaved: autoplayOrchestrator.totalSaved,
    targetSaved: autoplayOrchestrator.targetSaved,
    completionReason: autoplayOrchestrator.completionReason,
    error: autoplayOrchestrator.error,
    onStart: autoplayOrchestrator.startAutoplay,
    onStop: autoplayOrchestrator.abortAutoplay,
    onReset: autoplayOrchestrator.resetAutoplay,
  };

  // Create multi-phase autoplay props
  const multiPhaseAutoplayProps = {
    isRunning: multiPhaseAutoplay.isRunning,
    canStart: multiPhaseAutoplay.canStart,
    canStartReason: multiPhaseAutoplay.canStartReason,
    hasContent: multiPhaseAutoplay.hasContent,
    phase: multiPhaseAutoplay.phase,
    conceptProgress: multiPhaseAutoplay.conceptProgress,
    gameplayProgress: multiPhaseAutoplay.gameplayProgress,
    posterSelected: multiPhaseAutoplay.posterSelected,
    hudGenerated: multiPhaseAutoplay.hudGenerated,
    error: multiPhaseAutoplay.error,
    onStart: multiPhaseAutoplay.startMultiPhase,
    onStop: multiPhaseAutoplay.abort,
    onReset: multiPhaseAutoplay.reset,
    // Event log for activity modal
    eventLog: {
      textEvents: eventLog.textEvents,
      imageEvents: eventLog.imageEvents,
      clearEvents: eventLog.clearEvents,
    },
  };

  const selectedPromptImage = selectedPrompt ? imageGen.generatedImages.find(img => img.promptId === selectedPrompt.id) : undefined;

  const availableInteractiveModes = useCallback((): InteractiveMode[] => {
    const sceneTypes = prompts.generatedPrompts.map(p => p.sceneType);
    if (sceneTypes.length === 0) return ['static'];
    const modes = new Set<InteractiveMode>(['static']);
    sceneTypes.forEach(st => interactive.getAvailableModes(st).forEach(m => modes.add(m)));
    return Array.from(modes);
  }, [prompts.generatedPrompts, interactive]);

  const handleCopyWithToast = useCallback(() => showToast('Prompt copied to clipboard', 'success'), [showToast]);

  const interactiveModalPrompt = interactivePreviewPromptId ? prompts.generatedPrompts.find(p => p.id === interactivePreviewPromptId) : undefined;
  const interactiveModalImage = interactivePreviewPromptId ? imageGen.generatedImages.find(img => img.promptId === interactivePreviewPromptId) : undefined;
  const interactiveModalPrototype = interactivePreviewPromptId ? interactive.getPrototype(interactivePreviewPromptId) : undefined;

  const handleGeneratePrototype = useCallback(async () => {
    if (!interactivePreviewPromptId || !interactiveModalPrompt) return;
    await interactive.generatePrototype({
      promptId: interactivePreviewPromptId,
      imageUrl: interactiveModalImage?.url ?? undefined,
      prompt: interactiveModalPrompt.prompt,
      sceneType: interactiveModalPrompt.sceneType,
      dimensions: dimensions.dimensions.map(d => ({ type: d.type, reference: d.reference })),
    });
  }, [interactivePreviewPromptId, interactiveModalPrompt, interactiveModalImage, dimensions.dimensions, interactive]);

  return (
    <div className="h-full w-full flex flex-col ms-surface font-sans">
      <SimulatorHeader
        projects={pm.project.projects}
        currentProject={pm.project.currentProject}
        isLoadingProjects={pm.project.isLoading}
        saveStatus={pm.project.saveStatus}
        lastSavedAt={pm.project.lastSavedAt}
        onProjectSelect={pm.handleProjectSelect}
        onProjectCreate={pm.handleProjectCreate}
        onProjectDelete={pm.project.deleteProject}
        onProjectRename={pm.project.renameProject}
        onProjectDuplicate={pm.project.duplicateProject}
        onLoadExample={simulator.handleLoadExample}
        onReset={pm.handleResetProject}
      />

      <div className="flex-1 overflow-hidden relative bg-surface-primary">
        <OnionLayout
          leftPanelSlots={imageGen.leftPanelSlots}
          rightPanelSlots={imageGen.rightPanelSlots}
          onRemovePanelImage={imageGen.removePanelImage}
          onViewPanelImage={setSelectedPanelImage}
          generatedImages={imageGen.generatedImages}
          isGeneratingImages={imageGen.isGeneratingImages}
          onStartImage={ie.handleStartImage}
          onDeleteImage={imageGen.deleteGeneration}
          savedPromptIds={pm.savedPromptIds}
          onDeleteGenerations={imageGen.deleteAllGenerations}
          projectPoster={ph.poster.poster}
          showPosterOverlay={pm.showPosterOverlay}
          onTogglePosterOverlay={() => pm.setShowPosterOverlay(!pm.showPosterOverlay)}
          isGeneratingPoster={ph.poster.isGenerating}
          onUploadPoster={ph.handleUploadPoster}
          onGeneratePoster={ph.handleGeneratePoster}
          posterGenerations={ph.poster.posterGenerations}
          selectedPosterIndex={ph.poster.selectedIndex}
          isSavingPoster={ph.isSavingPoster}
          onSelectPoster={ph.handleSelectPoster}
          onSavePoster={ph.handleSavePoster}
          onCancelPosterGeneration={ph.handleCancelPosterGeneration}
          interactiveMode={interactive.interactiveMode}
          availableInteractiveModes={availableInteractiveModes()}
          onInteractiveModeChange={interactive.setInteractiveMode}
          onOpenComparison={() => setShowComparisonModal(true)}
          onViewPrompt={setSelectedPrompt}
          onUploadImageToPanel={imageGen.uploadImageToPanel}
          autoplay={autoplayProps}
          multiPhaseAutoplay={multiPhaseAutoplayProps}
        />

        {selectedPrompt && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <PromptDetailModal
              prompt={selectedPrompt}
              isOpen={!!selectedPrompt}
              onClose={() => setSelectedPrompt(null)}
              onRate={prompts.handlePromptRate}
              onLock={prompts.handlePromptLock}
              onLockElement={prompts.handleElementLock}
              onAcceptElement={simulator.onAcceptElement}
              acceptingElementId={prompts.acceptingElementId}
              generatedImage={selectedPromptImage}
              onStartImage={ie.handleStartImage}
              isSavedToPanel={selectedPrompt ? pm.savedPromptIds.has(selectedPrompt.id) : false}
              onCopy={handleCopyWithToast}
            />
          </Suspense>
        )}

        {selectedPanelImage && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <SavedImageModal
              image={selectedPanelImage}
              isOpen={!!selectedPanelImage}
              onClose={() => setSelectedPanelImage(null)}
              onRemove={imageGen.removePanelImage}
              onUpdateImage={imageGen.updatePanelImage}
              onUpdateImageVideo={imageGen.updatePanelImageVideo}
              gameUIDimension={dimensions.dimensions.find(d => d.type === 'gameUI')?.reference}
              onCopy={handleCopyWithToast}
            />
          </Suspense>
        )}

        <Toast {...toastProps} data-testid="simulator-toast" />

        {interactivePreviewPromptId && interactive.interactiveMode !== 'static' && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <InteractivePreviewModal
              isOpen={true}
              onClose={() => setInteractivePreviewPromptId(null)}
              prompt={interactiveModalPrompt}
              generatedImage={interactiveModalImage}
              prototype={interactiveModalPrototype}
              mode={interactive.interactiveMode}
              onGeneratePrototype={handleGeneratePrototype}
            />
          </Suspense>
        )}

        {showComparisonModal && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <ComparisonModal
              isOpen={showComparisonModal}
              onClose={() => setShowComparisonModal(false)}
              allPrompts={prompts.generatedPrompts}
              allImages={imageGen.generatedImages}
              dimensions={dimensions.dimensions}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export function SimulatorFeature() {
  return (
    <DimensionsProvider>
      <BrainProvider>
        <PromptsProvider>
          <SimulatorProvider>
            <SimulatorContent />
          </SimulatorProvider>
        </PromptsProvider>
      </BrainProvider>
    </DimensionsProvider>
  );
}

export default SimulatorFeature;
