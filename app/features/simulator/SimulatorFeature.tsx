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
  const imageGen = useImageGeneration({ projectId: null });
  const interactive = useInteractivePrototype();
  const { showToast, toastProps } = useToast();

  const pm = useProjectManager({ imageGen });
  const ph = usePosterHandlers({ setShowPosterOverlay: pm.setShowPosterOverlay, poster: pm.poster });
  const ie = useImageEffects({ imageGen, submittedForGenerationRef: pm.submittedForGenerationRef, setSavedPromptIds: pm.setSavedPromptIds });
  useAutosave();

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
