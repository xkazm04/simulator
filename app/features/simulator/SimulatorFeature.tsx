/**
 * SimulatorFeature - "What if" image visualization module
 *
 * A tool for combining cultural references (games, movies, art) to generate
 * unique image generation prompts. Uses content-swap transformation approach.
 *
 * Uses React Context for state management via provider hierarchy:
 * - DimensionsProvider: Dimension state and handlers
 * - BrainProvider: Base image, feedback, output mode
 * - PromptsProvider: Generated prompts, elements, history
 * - SimulatorProvider: Cross-subfeature coordination
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';

import { GeneratedPrompt, Dimension, OutputMode, SavedPanelImage, InteractiveMode } from './types';
import { useProject } from './hooks/useProject';
import { useImageGeneration } from './hooks/useImageGeneration';
import { usePoster } from './hooks/usePoster';
import { useInteractivePrototype } from './hooks/useInteractivePrototype';
import { OnionLayout } from './components/variants/OnionLayout';
import { Toast, useToast } from '@/app/components/ui';

// Subfeature providers, contexts, and components
import { DimensionsProvider, useDimensionsContext } from './subfeature_dimensions';
import { BrainProvider, useBrainContext } from './subfeature_brain';
import { PromptsProvider, usePromptsContext } from './subfeature_prompts';
import { SimulatorProvider, useSimulatorContext } from './SimulatorContext';
import { SimulatorHeader } from './subfeature_project';

// Lazy load modal components for performance
// These are only loaded when needed (when the modal opens)
const PromptDetailModal = lazy(() =>
  import('./subfeature_prompts').then(mod => ({ default: mod.PromptDetailModal }))
);
const SavedImageModal = lazy(() =>
  import('./subfeature_panels').then(mod => ({ default: mod.SavedImageModal }))
);
const InteractivePreviewModal = lazy(() =>
  import('./subfeature_interactive').then(mod => ({ default: mod.InteractivePreviewModal }))
);
const ComparisonModal = lazy(() =>
  import('./subfeature_comparison').then(mod => ({ default: mod.ComparisonModal }))
);

/**
 * Loading fallback for lazy-loaded modals
 * Shows a minimal loading state while the modal component loads
 */
function ModalLoadingFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-6 py-4 bg-slate-800 rounded-lg border border-slate-700">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-sm text-slate-300">Loading...</span>
      </div>
    </div>
  );
}

/**
 * SimulatorContent - Inner component that uses contexts
 * Must be wrapped by all providers
 */
function SimulatorContent() {
  const [selectedPrompt, setSelectedPrompt] = useState<GeneratedPrompt | null>(null);
  const [selectedPanelImage, setSelectedPanelImage] = useState<SavedPanelImage | null>(null);
  const [showPosterOverlay, setShowPosterOverlay] = useState(false);
  const [interactivePreviewPromptId, setInteractivePreviewPromptId] = useState<string | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Get state from contexts
  const dimensions = useDimensionsContext();
  const brain = useBrainContext();
  const prompts = usePromptsContext();
  const simulator = useSimulatorContext();

  // External hooks (not part of subfeatures)
  const project = useProject();
  const imageGen = useImageGeneration({ projectId: project.currentProject?.id ?? null });
  const poster = usePoster();
  const interactive = useInteractivePrototype();
  const { showToast, toastProps } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  const [savedPromptIds, setSavedPromptIds] = useState<Set<string>>(new Set());

  // Track which prompt IDs have been submitted for image generation
  // This prevents re-generation when images are deleted
  const submittedForGenerationRef = useRef<Set<string>>(new Set());

  // Load projects on mount and create default Demo project if needed
  useEffect(() => {
    const initializeProjects = async () => {
      await project.loadProjects();
      setIsInitialized(true);
    };
    initializeProjects();
  }, [project.loadProjects]);

  // Create default Demo project if no projects exist after loading
  useEffect(() => {
    const createDefaultProject = async () => {
      if (isInitialized && project.projects.length === 0 && !project.isLoading) {
        await project.createProject('Demo');
      }
    };
    createDefaultProject();
  }, [isInitialized, project.projects.length, project.isLoading, project.createProject]);

  // Auto-select first project if none selected
  useEffect(() => {
    const selectFirstProject = async () => {
      if (isInitialized && project.projects.length > 0 && !project.currentProject && !project.isLoading) {
        const projectWithState = await project.selectProject(project.projects[0].id);
        if (projectWithState?.state) {
          restoreProjectState(projectWithState.state);
        }
        poster.setPoster(projectWithState?.poster || null);
      }
    };
    selectFirstProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, project.projects.length, project.currentProject?.id, project.isLoading]);

  // Helper to restore project state to simulator contexts
  const restoreProjectState = useCallback((state: {
    basePrompt: string;
    baseImageFile: string | null;
    outputMode: OutputMode;
    dimensions: Dimension[];
    feedback: { positive: string; negative: string };
  }) => {
    simulator.handleReset(); // Clear current state first
    if (state.basePrompt) {
      brain.setBaseImage(state.basePrompt);
    }
    if (state.baseImageFile) {
      brain.setBaseImageFile(state.baseImageFile);
    }
    if (state.outputMode) {
      brain.setOutputMode(state.outputMode);
    }
    if (state.dimensions?.length > 0) {
      dimensions.setDimensions(state.dimensions);
    }
    if (state.feedback) {
      brain.setFeedback(state.feedback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulator.handleReset, brain.setBaseImage, brain.setBaseImageFile, brain.setOutputMode, dimensions.setDimensions, brain.setFeedback]);

  // Handle project selection - load existing project state
  const handleProjectSelect = useCallback(async (projectId: string) => {
    const projectWithState = await project.selectProject(projectId);
    if (projectWithState?.state) {
      restoreProjectState(projectWithState.state);
    } else {
      simulator.handleReset();
    }
    // Clear image generation tracking for new project
    imageGen.clearGeneratedImages();
    setSavedPromptIds(new Set());
    submittedForGenerationRef.current.clear();
    poster.setPoster(projectWithState?.poster || null);
    setShowPosterOverlay(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.selectProject, simulator.handleReset, restoreProjectState, imageGen.clearGeneratedImages, poster.setPoster]);

  // Handle new project creation - save current, create new with blank state
  const handleProjectCreate = useCallback(async (name: string) => {
    const newProject = await project.createProject(name);
    if (newProject) {
      simulator.handleReset();
      imageGen.clearGeneratedImages();
      setSavedPromptIds(new Set());
      submittedForGenerationRef.current.clear(); // Clear submitted tracking
      poster.setPoster(null);
      setShowPosterOverlay(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.createProject, simulator.handleReset, imageGen.clearGeneratedImages, poster.setPoster]);

  // Handle reset - clears all data in current project
  const handleResetProject = useCallback(async () => {
    simulator.handleReset();
    imageGen.clearGeneratedImages();
    setSavedPromptIds(new Set());
    submittedForGenerationRef.current.clear(); // Clear submitted tracking
    poster.setPoster(null);
    setShowPosterOverlay(false);

    if (project.currentProject) {
      project.saveState({
        basePrompt: '',
        baseImageFile: null,
        outputMode: 'gameplay',
        dimensions: [],
        feedback: { positive: '', negative: '' },
      });
      await poster.deletePoster(project.currentProject.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulator.handleReset, imageGen.clearGeneratedImages, project.currentProject?.id, project.saveState, poster.setPoster, poster.deletePoster]);

  // State for poster saving animation
  const [isSavingPoster, setIsSavingPoster] = useState(false);

  // Handler specifically for poster generation (called from DirectorControl when in poster mode)
  // Now generates 4 poster variations
  const handleGeneratePoster = useCallback(async () => {
    if (project.currentProject) {
      setShowPosterOverlay(true);
      await poster.generatePosters(
        project.currentProject.id,
        dimensions.dimensions,
        brain.baseImage
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions.dimensions, brain.baseImage, project.currentProject?.id, poster.generatePosters]);

  // Handler for selecting a poster from the grid
  const handleSelectPoster = useCallback((index: number) => {
    poster.selectPoster(index);
  }, [poster]);

  // Handler for saving the selected poster
  const handleSavePoster = useCallback(async () => {
    if (!project.currentProject) return;

    setIsSavingPoster(true);
    const savedPoster = await poster.savePoster(project.currentProject.id);
    setIsSavingPoster(false);

    if (savedPoster) {
      // Poster saved successfully, stay in poster overlay to show it
      poster.setPoster(savedPoster);
    }
  }, [project.currentProject, poster]);

  // Handler for canceling poster generation
  const handleCancelPosterGeneration = useCallback(async () => {
    await poster.cancelGeneration();
  }, [poster]);

  // Wrapped generate handler that also triggers image generation (legacy, kept for backwards compatibility)
  const handleGenerateWithImages = useCallback(async () => {
    if (brain.outputMode === 'poster') {
      await handleGeneratePoster();
    } else {
      await simulator.handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brain.outputMode, handleGeneratePoster, simulator.handleGenerate]);

  // Clear generated images when generation starts (before new prompts arrive)
  // This ensures UI shows loading state immediately, not old images
  const wasGeneratingRef = useRef(false);
  useEffect(() => {
    if (simulator.isGenerating && !wasGeneratingRef.current) {
      // Generation just started - clear old images and delete from Leonardo
      imageGen.deleteAllGenerations();
      submittedForGenerationRef.current.clear();
    }
    wasGeneratingRef.current = simulator.isGenerating;
  }, [simulator.isGenerating, imageGen.deleteAllGenerations]);

  // Trigger image generation when new prompts are generated
  // Uses ref to track submitted prompts and prevent re-generation after deletion
  useEffect(() => {
    if (prompts.generatedPrompts.length > 0 && !simulator.isGenerating) {
      // Filter prompts that haven't been submitted for generation yet
      const promptsNeedingImages = prompts.generatedPrompts.filter(
        (p) => !submittedForGenerationRef.current.has(p.id)
      );

      if (promptsNeedingImages.length > 0) {
        // Mark these prompts as submitted before starting generation
        promptsNeedingImages.forEach((p) => submittedForGenerationRef.current.add(p.id));

        imageGen.generateImagesFromPrompts(
          promptsNeedingImages.map((p) => ({
            id: p.id,
            prompt: p.prompt,
            negativePrompt: p.negativePrompt,
          }))
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts.generatedPrompts.length, simulator.isGenerating, imageGen.generateImagesFromPrompts]);

  // Handle saving an image to panel
  const handleStartImage = useCallback((promptId: string) => {
    const prompt = prompts.generatedPrompts.find((p) => p.id === promptId);
    const promptText = prompt?.prompt || '';

    imageGen.saveImageToPanel(promptId, promptText);
    setSavedPromptIds((prev) => new Set(prev).add(promptId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageGen.saveImageToPanel, prompts.generatedPrompts]);

  // Get generated image for selected prompt (for modal)
  const selectedPromptImage = selectedPrompt
    ? imageGen.generatedImages.find((img) => img.promptId === selectedPrompt.id)
    : undefined;

  // Calculate available interactive modes based on current scene types
  const availableInteractiveModes = useCallback((): InteractiveMode[] => {
    const sceneTypes = prompts.generatedPrompts.map(p => p.sceneType);
    if (sceneTypes.length === 0) {
      return ['static'];
    }
    const allModes = new Set<InteractiveMode>(['static']);
    sceneTypes.forEach(sceneType => {
      interactive.getAvailableModes(sceneType).forEach(mode => allModes.add(mode));
    });
    return Array.from(allModes);
  }, [prompts.generatedPrompts, interactive.getAvailableModes]);

  // Handle interactive prototype click from PromptCard
  const handleInteractiveClick = useCallback((promptId: string) => {
    setInteractivePreviewPromptId(promptId);
  }, []);

  // Copy handler for modals - shows toast notification
  const handleCopyWithToast = useCallback(() => {
    showToast('Prompt copied to clipboard', 'success');
  }, [showToast]);

  // Open comparison modal
  const handleOpenComparison = useCallback(() => {
    setShowComparisonModal(true);
  }, []);

  // Handle poster upload from local file
  const handleUploadPoster = useCallback(async (imageDataUrl: string) => {
    if (!project.currentProject) return;

    try {
      // Save uploaded poster to API
      const response = await fetch(`/api/projects/${project.currentProject.id}/poster`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageDataUrl,
          prompt: 'Uploaded poster',
          dimensionsJson: JSON.stringify(dimensions.dimensions),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.poster) {
          poster.setPoster({
            id: data.poster.id,
            projectId: data.poster.project_id,
            imageUrl: data.poster.image_url,
            prompt: data.poster.prompt || 'Uploaded poster',
            dimensionsJson: data.poster.dimensions_json || '',
            createdAt: data.poster.created_at,
          });
          setShowPosterOverlay(true);
        }
      }
    } catch (err) {
      console.error('Failed to upload poster:', err);
    }
  }, [project.currentProject, dimensions.dimensions, poster]);

  // Handle interactive prototype generation
  const handleGeneratePrototype = useCallback(async () => {
    if (!interactivePreviewPromptId) return;

    const prompt = prompts.generatedPrompts.find(p => p.id === interactivePreviewPromptId);
    if (!prompt) return;

    const generatedImage = imageGen.generatedImages.find(img => img.promptId === interactivePreviewPromptId);

    await interactive.generatePrototype({
      promptId: interactivePreviewPromptId,
      imageUrl: generatedImage?.url ?? undefined,
      prompt: prompt.prompt,
      sceneType: prompt.sceneType,
      dimensions: dimensions.dimensions.map(d => ({ type: d.type, reference: d.reference })),
    });
  }, [interactivePreviewPromptId, prompts.generatedPrompts, dimensions.dimensions, imageGen.generatedImages, interactive.generatePrototype]);

  // Get data for interactive modal
  const interactiveModalPrompt = interactivePreviewPromptId
    ? prompts.generatedPrompts.find(p => p.id === interactivePreviewPromptId)
    : undefined;
  const interactiveModalImage = interactivePreviewPromptId
    ? imageGen.generatedImages.find(img => img.promptId === interactivePreviewPromptId)
    : undefined;
  const interactiveModalPrototype = interactivePreviewPromptId
    ? interactive.getPrototype(interactivePreviewPromptId)
    : undefined;

  // Consolidated debounced autosave for all state changes
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (!project.currentProject) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      const stateToSave: {
        dimensions?: typeof dimensions.dimensions;
        basePrompt?: string;
        baseImageFile?: string | null;
        outputMode?: typeof brain.outputMode;
        feedback?: typeof brain.feedback;
      } = {};

      if (dimensions.dimensions.length > 0) {
        stateToSave.dimensions = dimensions.dimensions;
      }
      if (brain.baseImage) {
        stateToSave.basePrompt = brain.baseImage;
      }
      stateToSave.baseImageFile = brain.baseImageFile;
      stateToSave.outputMode = brain.outputMode;
      if (brain.feedback.positive || brain.feedback.negative) {
        stateToSave.feedback = brain.feedback;
      }

      project.saveState(stateToSave);
    }, 300);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dimensions.dimensions,
    brain.baseImage,
    brain.baseImageFile,
    brain.outputMode,
    brain.feedback.positive,
    brain.feedback.negative,
    project.currentProject?.id,
    project.saveState,
  ]);

  return (
    <div className="h-full w-full flex flex-col ms-surface font-sans">
      {/* Header */}
      <SimulatorHeader
        projects={project.projects}
        currentProject={project.currentProject}
        isLoadingProjects={project.isLoading}
        saveStatus={project.saveStatus}
        lastSavedAt={project.lastSavedAt}
        onProjectSelect={handleProjectSelect}
        onProjectCreate={handleProjectCreate}
        onProjectDelete={project.deleteProject}
        onProjectRename={project.renameProject}
        onProjectDuplicate={project.duplicateProject}
        onLoadExample={simulator.handleLoadExample}
        onReset={handleResetProject}
      />

      {/* Content */}
      <div className="flex-1 overflow-hidden relative bg-surface-primary">
        <OnionLayout
          // Side panel props
          leftPanelSlots={imageGen.leftPanelSlots}
          rightPanelSlots={imageGen.rightPanelSlots}
          onRemovePanelImage={imageGen.removePanelImage}
          onViewPanelImage={setSelectedPanelImage}
          // Image generation props
          generatedImages={imageGen.generatedImages}
          isGeneratingImages={imageGen.isGeneratingImages}
          onStartImage={handleStartImage}
          savedPromptIds={savedPromptIds}
          onDeleteGenerations={imageGen.deleteAllGenerations}
          // Poster props
          projectPoster={poster.poster}
          showPosterOverlay={showPosterOverlay}
          onTogglePosterOverlay={() => setShowPosterOverlay(!showPosterOverlay)}
          isGeneratingPoster={poster.isGenerating}
          onUploadPoster={handleUploadPoster}
          onGeneratePoster={handleGeneratePoster}
          // Poster generation state
          posterGenerations={poster.posterGenerations}
          selectedPosterIndex={poster.selectedIndex}
          isSavingPoster={isSavingPoster}
          onSelectPoster={handleSelectPoster}
          onSavePoster={handleSavePoster}
          onCancelPosterGeneration={handleCancelPosterGeneration}
          // Interactive prototype props
          interactiveMode={interactive.interactiveMode}
          availableInteractiveModes={availableInteractiveModes()}
          onInteractiveModeChange={interactive.setInteractiveMode}
          // Comparison props
          onOpenComparison={handleOpenComparison}
          // Modal handlers
          onViewPrompt={setSelectedPrompt}
        />

        {/* Lazy-loaded modals with Suspense boundaries */}
        {/* Only render when open to trigger lazy loading */}
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
              onStartImage={handleStartImage}
              isSavedToPanel={selectedPrompt ? savedPromptIds.has(selectedPrompt.id) : false}
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
              gameUIDimension={dimensions.dimensions.find(d => d.type === 'gameUI')?.reference}
              onCopy={handleCopyWithToast}
            />
          </Suspense>
        )}

        {/* Global Toast for copy notifications from modals */}
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

/**
 * SimulatorFeature - Root component with provider hierarchy
 */
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
