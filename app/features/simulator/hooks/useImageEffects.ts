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
import { usePromptsContext } from '../subfeature_prompts';
import { useSimulatorContext } from '../SimulatorContext';
import { useImageGeneration } from './useImageGeneration';

interface UseImageEffectsOptions {
  imageGen: ReturnType<typeof useImageGeneration>;
  submittedForGenerationRef: MutableRefObject<Set<string>>;
  setSavedPromptIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useImageEffects({
  imageGen,
  submittedForGenerationRef,
  setSavedPromptIds,
}: UseImageEffectsOptions) {
  const prompts = usePromptsContext();
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
  useEffect(() => {
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
            negativePrompt: p.negativePrompt,
          }))
        );
      }
    }
  }, [prompts.generatedPrompts, simulator.isGenerating, imageGen, submittedForGenerationRef]);

  // Handle saving an image to panel
  const handleStartImage = useCallback((promptId: string) => {
    const prompt = prompts.generatedPrompts.find((p) => p.id === promptId);
    const promptText = prompt?.prompt || '';
    imageGen.saveImageToPanel(promptId, promptText);
    setSavedPromptIds((prev) => new Set(prev).add(promptId));
  }, [imageGen, prompts.generatedPrompts, setSavedPromptIds]);

  return {
    handleStartImage,
  };
}
