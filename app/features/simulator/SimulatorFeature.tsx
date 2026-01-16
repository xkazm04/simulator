/**
 * SimulatorFeature - "What if" image visualization module
 *
 * A tool for combining cultural references (games, movies, art) to generate
 * unique image generation prompts. Uses content-swap transformation approach.
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

import { GeneratedPrompt, Dimension, OutputMode, SavedPanelImage, InteractiveMode } from './types';
import { useSimulator } from './hooks/useSimulator';
import { useProject } from './hooks/useProject';
import { useImageGeneration } from './hooks/useImageGeneration';
import { usePoster } from './hooks/usePoster';
import { useInteractivePrototype } from './hooks/useInteractivePrototype';
import { OnionLayout } from './components/variants/OnionLayout';
import { PromptDetailModal } from './components/PromptDetailModal';
import { SavedImageModal } from './components/SavedImageModal';
import { InteractivePreviewModal } from './components/InteractivePreviewModal';
import { ComparisonModal } from './components/ComparisonModal';
import { SimulatorHeader } from './components/SimulatorHeader';
import { Toast, useToast } from '@/app/components/ui';

export function SimulatorFeature() {
  const [selectedPrompt, setSelectedPrompt] = useState<GeneratedPrompt | null>(null);
  const [selectedPanelImage, setSelectedPanelImage] = useState<SavedPanelImage | null>(null);
  const [showPosterOverlay, setShowPosterOverlay] = useState(false);
  const [interactivePreviewPromptId, setInteractivePreviewPromptId] = useState<string | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const simulator = useSimulator();
  const project = useProject();
  const imageGen = useImageGeneration();
  const poster = usePoster();
  const interactive = useInteractivePrototype();
  const { showToast, toastProps } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  const [savedPromptIds, setSavedPromptIds] = useState<Set<string>>(new Set());

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
        // Use poster from projectWithState (already included in single API call)
        poster.setPoster(projectWithState?.poster || null);
      }
    };
    selectFirstProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, project.projects.length, project.currentProject?.id, project.isLoading]);

  // Helper to restore project state to simulator
  const restoreProjectState = useCallback((state: {
    basePrompt: string;
    baseImageFile: string | null;
    outputMode: OutputMode;
    dimensions: Dimension[];
    feedback: { positive: string; negative: string };
  }) => {
    simulator.handleReset(); // Clear current state first
    if (state.basePrompt) {
      simulator.setBaseImage(state.basePrompt);
    }
    if (state.baseImageFile) {
      simulator.setBaseImageFile(state.baseImageFile);
    }
    if (state.outputMode) {
      simulator.setOutputMode(state.outputMode);
    }
    if (state.dimensions?.length > 0) {
      simulator.handleConvertElementsToDimensions(state.dimensions);
    }
    if (state.feedback) {
      simulator.setFeedback(state.feedback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulator.handleReset, simulator.setBaseImage, simulator.setBaseImageFile, simulator.setOutputMode, simulator.handleConvertElementsToDimensions, simulator.setFeedback]);

  // Handle project selection - load existing project state
  const handleProjectSelect = useCallback(async (projectId: string) => {
    const projectWithState = await project.selectProject(projectId);
    if (projectWithState?.state) {
      restoreProjectState(projectWithState.state);
    } else {
      // New project or no state - reset to blank
      simulator.handleReset();
    }
    // Use poster from projectWithState (already included in single API call)
    poster.setPoster(projectWithState?.poster || null);
    setShowPosterOverlay(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.selectProject, simulator.handleReset, restoreProjectState, poster.setPoster]);

  // Handle new project creation - save current, create new with blank state
  const handleProjectCreate = useCallback(async (name: string) => {
    const newProject = await project.createProject(name);
    if (newProject) {
      // Reset simulator for new project
      simulator.handleReset();
      imageGen.clearGeneratedImages();
      setSavedPromptIds(new Set());
      poster.setPoster(null);
      setShowPosterOverlay(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.createProject, simulator.handleReset, imageGen.clearGeneratedImages, poster.setPoster]);

  // Handle reset - clears all data in current project
  const handleResetProject = useCallback(async () => {
    // Reset local simulator state
    simulator.handleReset();
    imageGen.clearGeneratedImages();
    setSavedPromptIds(new Set());
    poster.setPoster(null);
    setShowPosterOverlay(false);

    // Save cleared state to current project
    if (project.currentProject) {
      project.saveState({
        basePrompt: '',
        baseImageFile: null,
        outputMode: 'gameplay',
        dimensions: [],
        feedback: { positive: '', negative: '' },
      });
      // Delete poster from database
      await poster.deletePoster(project.currentProject.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulator.handleReset, imageGen.clearGeneratedImages, project.currentProject?.id, project.saveState, poster.setPoster, poster.deletePoster]);

  // Wrapped generate handler that also triggers image generation
  const handleGenerateWithImages = useCallback(async () => {
    if (simulator.outputMode === 'poster') {
      // Poster mode: generate single poster image
      if (project.currentProject) {
        // Show overlay immediately to display loading state
        setShowPosterOverlay(true);
        await poster.generatePoster(
          project.currentProject.id,
          simulator.dimensions,
          simulator.baseImage
        );
        // Keep overlay showing after generation completes
      }
    } else {
      // Normal mode: generate 4 scene prompts + images
      await simulator.handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulator.outputMode, simulator.dimensions, simulator.baseImage, simulator.handleGenerate, project.currentProject?.id, poster.generatePoster]);

  // Trigger image generation when new prompts are generated
  useEffect(() => {
    if (simulator.generatedPrompts.length > 0 && !simulator.isGenerating) {
      // Check if we haven't already generated images for these prompts
      const promptsNeedingImages = simulator.generatedPrompts.filter(
        (p) => !imageGen.generatedImages.some((img) => img.promptId === p.id)
      );

      if (promptsNeedingImages.length > 0) {
        imageGen.generateImagesFromPrompts(
          promptsNeedingImages.map((p) => ({ id: p.id, prompt: p.prompt }))
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulator.generatedPrompts.length, simulator.isGenerating, imageGen.generatedImages.length, imageGen.generateImagesFromPrompts]);

  // Handle saving an image to panel
  const handleStartImage = useCallback((promptId: string) => {
    // Find the prompt text from generated prompts
    const prompt = simulator.generatedPrompts.find((p) => p.id === promptId);
    const promptText = prompt?.prompt || '';

    imageGen.saveImageToPanel(promptId, promptText);
    setSavedPromptIds((prev) => new Set(prev).add(promptId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageGen.saveImageToPanel, simulator.generatedPrompts]);

  // Get generated image for selected prompt (for modal)
  const selectedPromptImage = selectedPrompt
    ? imageGen.generatedImages.find((img) => img.promptId === selectedPrompt.id)
    : undefined;

  // Calculate available interactive modes based on current scene types
  const availableInteractiveModes = useCallback((): InteractiveMode[] => {
    // Get unique scene types from generated prompts
    const sceneTypes = simulator.generatedPrompts.map(p => p.sceneType);
    if (sceneTypes.length === 0) {
      return ['static'];
    }
    // Get modes available for all scene types
    const allModes = new Set<InteractiveMode>(['static']);
    sceneTypes.forEach(sceneType => {
      interactive.getAvailableModes(sceneType).forEach(mode => allModes.add(mode));
    });
    return Array.from(allModes);
  }, [simulator.generatedPrompts, interactive.getAvailableModes]);

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

  // Handle interactive prototype generation
  const handleGeneratePrototype = useCallback(async () => {
    if (!interactivePreviewPromptId) return;

    const prompt = simulator.generatedPrompts.find(p => p.id === interactivePreviewPromptId);
    if (!prompt) return;

    const generatedImage = imageGen.generatedImages.find(img => img.promptId === interactivePreviewPromptId);

    await interactive.generatePrototype({
      promptId: interactivePreviewPromptId,
      imageUrl: generatedImage?.url ?? undefined,
      prompt: prompt.prompt,
      sceneType: prompt.sceneType,
      dimensions: simulator.dimensions.map(d => ({ type: d.type, reference: d.reference })),
    });
  }, [interactivePreviewPromptId, simulator.generatedPrompts, simulator.dimensions, imageGen.generatedImages, interactive.generatePrototype]);

  // Get data for interactive modal
  const interactiveModalPrompt = interactivePreviewPromptId
    ? simulator.generatedPrompts.find(p => p.id === interactivePreviewPromptId)
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
    // Skip autosave on initial mount to prevent saving default/loaded state
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // Skip if no project is selected
    if (!project.currentProject) {
      return;
    }

    // Clear any pending autosave
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Debounce the save operation (300ms delay)
    autosaveTimerRef.current = setTimeout(() => {
      const stateToSave: {
        dimensions?: typeof simulator.dimensions;
        basePrompt?: string;
        baseImageFile?: string | null;
        outputMode?: typeof simulator.outputMode;
        feedback?: typeof simulator.feedback;
      } = {};

      // Only include non-empty values to avoid overwriting with defaults
      if (simulator.dimensions.length > 0) {
        stateToSave.dimensions = simulator.dimensions;
      }
      if (simulator.baseImage) {
        stateToSave.basePrompt = simulator.baseImage;
      }
      // Always save baseImageFile (can be null to clear it)
      stateToSave.baseImageFile = simulator.baseImageFile;
      stateToSave.outputMode = simulator.outputMode;
      if (simulator.feedback.positive || simulator.feedback.negative) {
        stateToSave.feedback = simulator.feedback;
      }

      // Batch save all state in single operation
      project.saveState(stateToSave);
    }, 300);

    // Cleanup on unmount or before next effect run
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    simulator.dimensions,
    simulator.baseImage,
    simulator.baseImageFile,
    simulator.outputMode,
    simulator.feedback.positive,
    simulator.feedback.negative,
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
        onProjectSelect={handleProjectSelect}
        onProjectCreate={handleProjectCreate}
        onProjectDelete={project.deleteProject}
        onLoadExample={simulator.handleLoadExample}
        onReset={handleResetProject}
      />

      {/* Content */}
      <div className="flex-1 overflow-hidden relative bg-surface-primary">
        <OnionLayout
          baseImage={simulator.baseImage}
          setBaseImage={simulator.setBaseImage}
          baseImageFile={simulator.baseImageFile}
          setBaseImageFile={simulator.setBaseImageFile}
          handleImageParse={simulator.handleImageParse}
          isParsingImage={simulator.isParsingImage}
          imageParseError={simulator.imageParseError}
          dimensions={simulator.dimensions}
          handleDimensionChange={simulator.handleDimensionChange}
          handleDimensionWeightChange={simulator.handleDimensionWeightChange}
          handleDimensionFilterModeChange={simulator.handleDimensionFilterModeChange}
          handleDimensionTransformModeChange={simulator.handleDimensionTransformModeChange}
          handleDimensionRemove={simulator.handleDimensionRemove}
          handleDimensionAdd={simulator.handleDimensionAdd}
          handleDimensionReorder={simulator.handleDimensionReorder}
          generatedPrompts={simulator.generatedPrompts}
          handlePromptRate={simulator.handlePromptRate}
          handlePromptLock={simulator.handlePromptLock}
          handleElementLock={simulator.handleElementLock}
          handleCopy={simulator.handleCopy}
          handleAcceptElement={simulator.handleAcceptElement}
          acceptingElementId={simulator.acceptingElementId}
          handleDropElementOnDimension={simulator.handleDropElementOnDimension}
          feedback={simulator.feedback}
          setFeedback={simulator.setFeedback}
          isGenerating={simulator.isGenerating}
          handleGenerate={handleGenerateWithImages}
          canGenerate={simulator.canGenerate}
          outputMode={simulator.outputMode}
          setOutputMode={simulator.setOutputMode}
          handleSmartBreakdownApply={simulator.handleSmartBreakdownApply}
          pendingDimensionChange={simulator.pendingDimensionChange}
          handleUndoDimensionChange={simulator.handleUndoDimensionChange}
          onConvertElementsToDimensions={simulator.handleConvertElementsToDimensions}
          onViewPrompt={setSelectedPrompt}
          // Image generation props
          leftPanelSlots={imageGen.leftPanelSlots}
          rightPanelSlots={imageGen.rightPanelSlots}
          onRemovePanelImage={imageGen.removePanelImage}
          onViewPanelImage={setSelectedPanelImage}
          generatedImages={imageGen.generatedImages}
          isGeneratingImages={imageGen.isGeneratingImages}
          onStartImage={handleStartImage}
          savedPromptIds={savedPromptIds}
          // Poster props
          projectPoster={poster.poster}
          showPosterOverlay={showPosterOverlay}
          onTogglePosterOverlay={() => setShowPosterOverlay(!showPosterOverlay)}
          isGeneratingPoster={poster.isGenerating}
          // Delete generations
          onDeleteGenerations={imageGen.deleteAllGenerations}
          // Interactive prototype props
          interactiveMode={interactive.interactiveMode}
          availableInteractiveModes={availableInteractiveModes()}
          onInteractiveModeChange={interactive.setInteractiveMode}
          interactivePrototypes={interactive.prototypes}
          isGeneratingPrototype={interactive.isGenerating}
          onGeneratePrototype={handleInteractiveClick}
          onViewInteractivePrototype={handleInteractiveClick}
          // Comparison props
          onOpenComparison={handleOpenComparison}
          // Negative prompt props
          negativePrompts={simulator.negativePrompts}
          onNegativePromptsChange={simulator.setNegativePrompts}
          // Prompt history props
          promptHistory={simulator.promptHistory}
          onPromptUndo={simulator.handlePromptUndo}
          onPromptRedo={simulator.handlePromptRedo}
        />

        <PromptDetailModal
          prompt={selectedPrompt}
          isOpen={!!selectedPrompt}
          onClose={() => setSelectedPrompt(null)}
          onRate={simulator.handlePromptRate}
          onLock={simulator.handlePromptLock}
          onLockElement={simulator.handleElementLock}
          onAcceptElement={simulator.handleAcceptElement}
          acceptingElementId={simulator.acceptingElementId}
          generatedImage={selectedPromptImage}
          onStartImage={handleStartImage}
          isSavedToPanel={selectedPrompt ? savedPromptIds.has(selectedPrompt.id) : false}
          onCopy={handleCopyWithToast}
        />

        <SavedImageModal
          image={selectedPanelImage}
          isOpen={!!selectedPanelImage}
          onClose={() => setSelectedPanelImage(null)}
          onRemove={imageGen.removePanelImage}
          onUpdateImage={imageGen.updatePanelImage}
          gameUIDimension={simulator.dimensions.find(d => d.type === 'gameUI')?.reference}
          onCopy={handleCopyWithToast}
        />

        {/* Global Toast for copy notifications from modals */}
        <Toast {...toastProps} data-testid="simulator-toast" />

        <InteractivePreviewModal
          isOpen={!!interactivePreviewPromptId && interactive.interactiveMode !== 'static'}
          onClose={() => setInteractivePreviewPromptId(null)}
          prompt={interactiveModalPrompt}
          generatedImage={interactiveModalImage}
          prototype={interactiveModalPrototype}
          mode={interactive.interactiveMode}
          onGeneratePrototype={handleGeneratePrototype}
        />

        <ComparisonModal
          isOpen={showComparisonModal}
          onClose={() => setShowComparisonModal(false)}
          allPrompts={simulator.generatedPrompts}
          allImages={imageGen.generatedImages}
          dimensions={simulator.dimensions}
        />
      </div>
    </div>
  );
}

export default SimulatorFeature;
