/**
 * SimulatorContext - Root coordinator for cross-subfeature communication
 *
 * Provides:
 * - Shared generation state (isGenerating, canGenerate)
 * - Cross-cutting actions (handleGenerate, handleReset, handleLoadExample)
 * - Bidirectional flow callbacks (element-to-dimension conversion)
 */

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { Dimension, DimensionType, GeneratedPrompt, OutputMode, PromptElement } from './types';
import { useDimensionsContext } from './subfeature_dimensions';
import { useBrainContext } from './subfeature_brain';
import { usePromptsContext } from './subfeature_prompts';
import { generateWithFeedback } from './subfeature_brain/lib/simulatorAI';
import { EXAMPLE_SIMULATIONS } from './subfeature_dimensions/lib/defaultDimensions';
import {
  startGenerationSession,
  recordGenerationIteration,
  getActiveSession,
  learnDimensionCombinations,
} from './lib/preferenceEngine';

/**
 * Optional overrides for handleGenerate - used when refinement has just completed
 * and state hasn't updated yet (React state updates are async)
 */
export interface GenerateOverrides {
  baseImage?: string;
  dimensions?: Array<{ type: DimensionType; label: string; reference: string }>;
}

export interface SimulatorContextValue {
  // Shared state
  isGenerating: boolean;
  canGenerate: boolean;

  // Cross-subfeature actions
  handleGenerate: (overrides?: GenerateOverrides) => Promise<void>;
  handleReset: () => void;
  handleLoadExample: (index: number) => void;

  // Bidirectional flow callbacks
  onConvertElementsToDimensions: (dimensions: Dimension[]) => void;
  onDropElementOnDimension: (element: PromptElement, dimensionId: string) => void;
  onAcceptElement: (element: PromptElement) => Promise<void>;
}

const SimulatorContext = createContext<SimulatorContextValue | null>(null);

export interface SimulatorProviderProps {
  children: ReactNode;
}

/**
 * SimulatorProvider - Must be nested inside all subfeature providers
 * It reads from subfeature contexts and orchestrates their interactions
 */
export function SimulatorProvider({ children }: SimulatorProviderProps) {
  const dimensions = useDimensionsContext();
  const brain = useBrainContext();
  const prompts = usePromptsContext();

  const [isGenerating, setIsGenerating] = useState(false);

  // Derived state - can generate if base image exists
  const canGenerate = brain.baseImage.trim().length > 0;

  // Main generation handler - orchestrates all subfeatures
  // Accepts optional overrides for when refinement just completed (state not yet updated)
  const handleGenerate = useCallback(async (overrides?: GenerateOverrides) => {
    if (!canGenerate) return;

    setIsGenerating(true);

    // Use overrides if provided, otherwise use current state
    const effectiveBaseImage = overrides?.baseImage ?? brain.baseImage;
    const effectiveDimensions = overrides?.dimensions ?? dimensions.dimensions.map((d) => ({
      type: d.type,
      label: d.label,
      reference: d.reference,
    }));

    // Start or continue a generation session for learning
    const existingSession = getActiveSession();
    if (!existingSession) {
      startGenerationSession(dimensions.dimensions, effectiveBaseImage, brain.outputMode);
    }

    try {
      // Single atomic API call: feedback → dimension adjustment → prompt generation
      const result = await generateWithFeedback(
        effectiveBaseImage,
        effectiveDimensions,
        brain.feedback,
        brain.outputMode,
        prompts.lockedElements
      );

      if (result.success) {
        // Apply adjusted dimensions to state
        if (result.adjustedDimensions.length > 0) {
          dimensions.setDimensions(
            dimensions.dimensions.map((dim) => {
              const adjustment = result.adjustedDimensions.find((a) => a.type === dim.type);
              return adjustment && adjustment.wasModified
                ? { ...dim, reference: adjustment.newValue }
                : dim;
            })
          );
        }

        // Set generated prompts
        const generatedPrompts: GeneratedPrompt[] = result.prompts.map((p) => ({
          id: p.id,
          sceneNumber: p.sceneNumber,
          sceneType: p.sceneType,
          prompt: p.prompt,
          negativePrompt: p.negativePrompt,
          copied: false,
          rating: null,
          locked: false,
          elements: p.elements,
        }));
        prompts.setGeneratedPrompts(generatedPrompts);
        prompts.pushToHistory(generatedPrompts);

        // Record this generation iteration for learning
        recordGenerationIteration(generatedPrompts.map((p) => p.id));

        // Learn dimension combinations asynchronously
        learnDimensionCombinations().catch(console.error);

        // Clear feedback after successful generation
        brain.clearFeedback();
      } else {
        console.error('Generation failed:', result.error);
        // Fallback to client-side generation
        const fallbackPrompts = prompts.generateFallbackPrompts(
          brain.baseImage,
          dimensions.dimensions,
          brain.outputMode
        );
        prompts.setGeneratedPrompts(fallbackPrompts);
        prompts.pushToHistory(fallbackPrompts);
        brain.clearFeedback();
      }
    } catch (err) {
      console.error('Generation error:', err);
      // Fallback to client-side generation on error
      const fallbackPrompts = prompts.generateFallbackPrompts(
        brain.baseImage,
        dimensions.dimensions,
        brain.outputMode
      );
      prompts.setGeneratedPrompts(fallbackPrompts);
      prompts.pushToHistory(fallbackPrompts);
      brain.clearFeedback();
    } finally {
      setIsGenerating(false);
    }
  }, [canGenerate, brain, dimensions, prompts]);

  // Reset all subfeatures
  const handleReset = useCallback(() => {
    dimensions.resetDimensions();
    brain.resetBrain();
    prompts.clearPrompts();
  }, [dimensions, brain, prompts]);

  // Load example simulation
  const handleLoadExample = useCallback((index: number) => {
    const example = EXAMPLE_SIMULATIONS[index];
    if (!example) return;

    // Set base image
    brain.setBaseImage(example.baseImage);
    brain.setBaseImageFile(null);

    // Load dimensions
    dimensions.loadExampleDimensions(index);

    // Clear prompts
    prompts.clearPrompts();

    // Clear feedback
    brain.clearFeedback();
  }, [brain, dimensions, prompts]);

  // Bidirectional flow: Convert locked elements to dimensions
  const onConvertElementsToDimensions = useCallback((newDimensions: Dimension[]) => {
    dimensions.handleConvertElementsToDimensions(newDimensions);
  }, [dimensions]);

  // Bidirectional flow: Drop element on dimension
  const onDropElementOnDimension = useCallback((element: PromptElement, dimensionId: string) => {
    dimensions.handleDropElementOnDimension(element, dimensionId);
  }, [dimensions]);

  // Bidirectional flow: Accept element (refine dimensions via AI)
  const onAcceptElement = useCallback(async (element: PromptElement) => {
    await prompts.handleAcceptElement(
      element,
      dimensions.dimensions,
      (updater) => {
        const newDimensions = updater(dimensions.dimensions);
        dimensions.setDimensions(newDimensions);
      },
      (change) => {
        // This would need to be wired to dimensions.setPendingDimensionChange
        // For now, the dimensions context handles this internally
      }
    );
  }, [prompts, dimensions]);

  const value = useMemo<SimulatorContextValue>(() => ({
    isGenerating,
    canGenerate,
    handleGenerate,
    handleReset,
    handleLoadExample,
    onConvertElementsToDimensions,
    onDropElementOnDimension,
    onAcceptElement,
  }), [
    isGenerating,
    canGenerate,
    handleGenerate,
    handleReset,
    handleLoadExample,
    onConvertElementsToDimensions,
    onDropElementOnDimension,
    onAcceptElement,
  ]);

  return (
    <SimulatorContext.Provider value={value}>
      {children}
    </SimulatorContext.Provider>
  );
}

export function useSimulatorContext(): SimulatorContextValue {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error('useSimulatorContext must be used within a SimulatorProvider');
  }
  return context;
}
