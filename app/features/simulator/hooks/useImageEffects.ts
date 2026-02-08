/**
 * useImageEffects - Image generation side effects
 *
 * Extracted from SimulatorFeature to reduce complexity.
 * Handles:
 * - Clear images when generation starts
 * - Trigger image generation when new prompts arrive
 * - Save image to panel
 */

import { useEffect, useRef, useCallback, MutableRefObject } from 'react';
import { usePromptsState } from '../subfeature_prompts';
import { useSimulatorContext } from '../SimulatorContext';
import { useImageGeneration } from './useImageGeneration';

interface UseImageEffectsOptions {
  imageGen: ReturnType<typeof useImageGeneration>;
  submittedForGenerationRef: MutableRefObject<Set<string>>;
  setSavedPromptIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** When true, skip auto-generation - orchestrator controls the flow */
  isAutoplayRunning?: boolean;
}

export function useImageEffects({
  imageGen,
  submittedForGenerationRef,
  setSavedPromptIds,
  isAutoplayRunning = false,
}: UseImageEffectsOptions) {
  const prompts = usePromptsState();
  const simulator = useSimulatorContext();

  // Track generation state for clearing images
  const wasGeneratingRef = useRef(false);

  // Clear images when generation starts
  useEffect(() => {
    if (simulator.isGenerating && !wasGeneratingRef.current) {
      imageGen.deleteAllGenerations();
      submittedForGenerationRef.current.clear();
    }
    wasGeneratingRef.current = simulator.isGenerating;
  }, [simulator.isGenerating, imageGen.deleteAllGenerations, submittedForGenerationRef]);

  // Trigger image generation when new prompts arrive
  // Skip during autoplay - the orchestrator controls generation flow
  useEffect(() => {
    // During autoplay, the orchestrator controls when images are generated
    if (isAutoplayRunning) return;

    if (prompts.generatedPrompts.length > 0 && !simulator.isGenerating) {
      const promptsNeedingImages = prompts.generatedPrompts.filter(
        (p) => !submittedForGenerationRef.current.has(p.id)
      );

      if (promptsNeedingImages.length > 0) {
        promptsNeedingImages.forEach((p) => submittedForGenerationRef.current.add(p.id));
        imageGen.generateImagesFromPrompts(
          promptsNeedingImages.map((p) => ({
            id: p.id,
            prompt: p.prompt,
          }))
        );
      }
    }
  }, [prompts.generatedPrompts, simulator.isGenerating, imageGen, submittedForGenerationRef, isAutoplayRunning]);

  // Handle saving an image to panel
  const handleStartImage = useCallback((promptId: string) => {
    console.log('[handleStartImage] Called with promptId:', promptId);
    const prompt = prompts.generatedPrompts.find((p) => p.id === promptId);
    const promptText = prompt?.prompt || '';
    console.log('[handleStartImage] Found prompt:', !!prompt, 'text length:', promptText.length);
    imageGen.saveImageToPanel(promptId, promptText);
    setSavedPromptIds((prev) => new Set(prev).add(promptId));
  }, [imageGen, prompts.generatedPrompts, setSavedPromptIds]);

  return {
    handleStartImage,
  };
}
