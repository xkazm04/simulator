/**
 * useSimulator - Main state management hook for the simulator
 *
 * Manages all simulation state including dimensions, prompts,
 * feedback, and various user interactions.
 */

import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Dimension,
  DimensionPreset,
  DimensionType,
  DimensionFilterMode,
  DimensionTransformMode,
  GeneratedPrompt,
  PromptElement,
  OutputMode,
  SCENE_TYPES,
  Concept,
  elementToConcept,
  createDimensionWithDefaults,
  NegativePromptItem,
} from '../types';
import { DEFAULT_DIMENSIONS, EXAMPLE_SIMULATIONS, getDimensionPreset } from '../lib/defaultDimensions';
import { labelToDimension, describeImage, generateWithFeedback, ImageDescriptionResult } from '../lib/simulatorAI';
import { buildMockPromptWithElements } from '../lib/promptBuilder';
import {
  applyConceptToDimensions,
  applyElementToDimensionById,
} from '../lib/concept';
import { usePromptHistory, PromptHistoryState } from './usePromptHistory';

export interface SimulatorState {
  baseImage: string;
  baseImageFile: string | null;
  dimensions: Dimension[];
  generatedPrompts: GeneratedPrompt[];
  isGenerating: boolean;
  isParsingImage: boolean;
  imageParseError: string | null;
  feedback: { positive: string; negative: string };
  outputMode: OutputMode;
  acceptingElementId: string | null;
  pendingDimensionChange: { element: PromptElement; previousDimensions: Dimension[] } | null;
  parsedImageDescription: ImageDescriptionResult['description'] | null;
  canGenerate: boolean;
  hasLockedPrompts: boolean;
  lockedElements: PromptElement[];
  negativePrompts: NegativePromptItem[];
  // Prompt history state
  promptHistory: Pick<PromptHistoryState, 'canUndo' | 'canRedo' | 'historyLength' | 'positionLabel'>;
}

export interface SimulatorActions {
  setBaseImage: (value: string) => void;
  setBaseImageFile: (value: string | null) => void;
  setFeedback: (value: { positive: string; negative: string }) => void;
  setOutputMode: (value: OutputMode) => void;
  handleDimensionChange: (id: string, reference: string) => void;
  handleDimensionWeightChange: (id: string, weight: number) => void;
  handleDimensionFilterModeChange: (id: string, filterMode: DimensionFilterMode) => void;
  handleDimensionTransformModeChange: (id: string, transformMode: DimensionTransformMode) => void;
  handleDimensionReferenceImageChange: (id: string, imageDataUrl: string | null) => void;
  handleDimensionRemove: (id: string) => void;
  handleDimensionAdd: (preset: DimensionPreset) => void;
  handleDimensionReorder: (reorderedDimensions: Dimension[]) => void;
  handleSmartBreakdownApply: (baseImage: string, dimensions: Dimension[], outputMode: OutputMode) => void;
  handleImageParse: (imageDataUrl: string) => Promise<void>;
  handleReset: () => void;
  handleLoadExample: (index: number) => void;
  handlePromptRate: (id: string, rating: 'up' | 'down' | null) => void;
  handlePromptLock: (id: string) => void;
  handleElementLock: (promptId: string, elementId: string) => void;
  handleCopy: (id: string) => void;
  handleConvertElementsToDimensions: (dimensions: Dimension[]) => void;
  handleAcceptElement: (element: PromptElement) => Promise<void>;
  handleUndoDimensionChange: () => void;
  handleGenerate: () => Promise<void>;
  // Concept-based bidirectional flow handlers
  handleDropElementOnDimension: (element: PromptElement, dimensionId: string) => void;
  handleElementToConcept: (element: PromptElement) => Concept;
  handleApplyConceptAsDimension: (concept: Concept) => void;
  // Negative prompt handlers
  setNegativePrompts: (negatives: NegativePromptItem[]) => void;
  // Prompt history handlers
  handlePromptUndo: () => void;
  handlePromptRedo: () => void;
}

function createDefaultDimensions(): Dimension[] {
  return DEFAULT_DIMENSIONS.map((preset) =>
    createDimensionWithDefaults({
      id: uuidv4(),
      type: preset.type,
      label: preset.label,
      icon: preset.icon,
      placeholder: preset.placeholder,
      reference: '',
    })
  );
}

export function useSimulator(): SimulatorState & SimulatorActions {
  // Core state
  const [baseImage, setBaseImage] = useState('');
  const [baseImageFile, setBaseImageFile] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[]>(createDefaultDimensions);
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPrompt[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [imageParseError, setImageParseError] = useState<string | null>(null);
  const [parsedImageDescription, setParsedImageDescription] = useState<ImageDescriptionResult['description'] | null>(null);
  const [feedback, setFeedback] = useState({ positive: '', negative: '' });
  const [outputMode, setOutputMode] = useState<OutputMode>('gameplay');
  const [negativePrompts, setNegativePrompts] = useState<NegativePromptItem[]>([]);

  // Prompt history
  const promptHistoryHook = usePromptHistory();

  // Accept element state
  const [acceptingElementId, setAcceptingElementId] = useState<string | null>(null);
  const [pendingDimensionChange, setPendingDimensionChange] = useState<{
    element: PromptElement;
    previousDimensions: Dimension[];
  } | null>(null);

  // Derived state
  const canGenerate = baseImage.trim().length > 0;
  const hasLockedPrompts = generatedPrompts.some((p) => p.locked);
  const lockedElements = useMemo(
    () => generatedPrompts.flatMap((p) => p.elements.filter((e) => e.locked)),
    [generatedPrompts]
  );

  // Dimension handlers
  const handleDimensionChange = useCallback((id: string, reference: string) => {
    setDimensions((prev) => prev.map((d) => (d.id === id ? { ...d, reference } : d)));
  }, []);

  /**
   * Update dimension weight (0-100) for graduated transformations
   * Enables effects like "50% Star Wars, 50% Ghibli"
   */
  const handleDimensionWeightChange = useCallback((id: string, weight: number) => {
    setDimensions((prev) => prev.map((d) => (d.id === id ? { ...d, weight: Math.max(0, Math.min(100, weight)) } : d)));
  }, []);

  /**
   * Update dimension filter mode - what to preserve from base image
   */
  const handleDimensionFilterModeChange = useCallback((id: string, filterMode: DimensionFilterMode) => {
    setDimensions((prev) => prev.map((d) => (d.id === id ? { ...d, filterMode } : d)));
  }, []);

  /**
   * Update dimension transform mode - how to apply the reference content
   */
  const handleDimensionTransformModeChange = useCallback((id: string, transformMode: DimensionTransformMode) => {
    setDimensions((prev) => prev.map((d) => (d.id === id ? { ...d, transformMode } : d)));
  }, []);

  /**
   * Update dimension reference image for visual style matching
   */
  const handleDimensionReferenceImageChange = useCallback((id: string, imageDataUrl: string | null) => {
    setDimensions((prev) => prev.map((d) => (d.id === id ? { ...d, referenceImage: imageDataUrl ?? undefined } : d)));
  }, []);

  const handleDimensionRemove = useCallback((id: string) => {
    setDimensions((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleDimensionAdd = useCallback((preset: DimensionPreset) => {
    setDimensions((prev) => [...prev, createDimensionWithDefaults({
      id: uuidv4(),
      type: preset.type,
      label: preset.label,
      icon: preset.icon,
      placeholder: preset.placeholder,
      reference: '',
    })]);
  }, []);

  const handleDimensionReorder = useCallback((reorderedDimensions: Dimension[]) => {
    setDimensions(reorderedDimensions);
  }, []);

  // Smart breakdown apply
  const handleSmartBreakdownApply = useCallback((
    newBaseImage: string,
    newDimensions: Dimension[],
    newOutputMode: OutputMode
  ) => {
    setBaseImage(newBaseImage);
    setBaseImageFile(null);

    const mergedDimensions: Dimension[] = DEFAULT_DIMENSIONS.map((preset) => {
      const fromResult = newDimensions.find((d) => d.type === preset.type);
      return fromResult || createDimensionWithDefaults({
        id: uuidv4(),
        type: preset.type,
        label: preset.label,
        icon: preset.icon,
        placeholder: preset.placeholder,
        reference: '',
      });
    });

    newDimensions.forEach((dim) => {
      if (!DEFAULT_DIMENSIONS.some((d) => d.type === dim.type)) {
        mergedDimensions.push(dim);
      }
    });

    setDimensions(mergedDimensions);
    setOutputMode(newOutputMode);
    setGeneratedPrompts([]);
    setFeedback({ positive: '', negative: '' });
  }, []);

  // Image parsing
  const handleImageParse = useCallback(async (imageDataUrl: string) => {
    if (isParsingImage) return;

    setIsParsingImage(true);
    setParsedImageDescription(null);
    setImageParseError(null);

    try {
      const result = await describeImage(imageDataUrl);

      if (result.success && result.description) {
        const desc = result.description;
        setParsedImageDescription(desc);
        setImageParseError(null);

        // Set the base image description
        setBaseImage(desc.suggestedBaseDescription);

        // Set output mode based on AI suggestion
        setOutputMode(desc.suggestedOutputMode);

        // Optionally populate dimensions from swappable content
        setDimensions((prev) => {
          const updated = [...prev];
          const contentMappings: Array<{ type: DimensionType; value: string }> = [
            { type: 'environment', value: desc.swappableContent.environment },
            { type: 'characters', value: desc.swappableContent.characters },
            { type: 'technology', value: desc.swappableContent.technology },
            { type: 'mood', value: desc.swappableContent.mood },
            { type: 'artStyle', value: desc.swappableContent.style },
          ];

          contentMappings.forEach(({ type, value }) => {
            if (value && value.trim()) {
              const existingIndex = updated.findIndex((d) => d.type === type);
              if (existingIndex >= 0 && !updated[existingIndex].reference.trim()) {
                // Only populate if dimension is empty
                updated[existingIndex] = { ...updated[existingIndex], reference: value };
              }
            }
          });

          return updated;
        });

        // Clear previous prompts since base changed
        setGeneratedPrompts([]);
      } else {
        // API returned error
        setImageParseError(result.error || 'Failed to analyze image');
      }
    } catch (err) {
      console.error('Failed to parse image:', err);
      setImageParseError(err instanceof Error ? err.message : 'Failed to analyze image');
    } finally {
      setIsParsingImage(false);
    }
  }, [isParsingImage]);

  // Reset
  const handleReset = useCallback(() => {
    setBaseImage('');
    setBaseImageFile(null);
    setDimensions(createDefaultDimensions());
    setGeneratedPrompts([]);
    setFeedback({ positive: '', negative: '' });
    setParsedImageDescription(null);
    setImageParseError(null);
    setNegativePrompts([]);
  }, []);

  // Load example
  const handleLoadExample = useCallback((exampleIndex: number) => {
    const example = EXAMPLE_SIMULATIONS[exampleIndex];
    if (!example) return;

    setBaseImage(example.baseImage);
    setBaseImageFile(null);

    const newDimensions: Dimension[] = DEFAULT_DIMENSIONS.map((preset) => {
      const exDim = example.dimensions.find((d) => d.type === preset.type);
      return createDimensionWithDefaults({
        id: uuidv4(),
        type: preset.type,
        label: preset.label,
        icon: preset.icon,
        placeholder: preset.placeholder,
        reference: exDim?.reference || '',
      });
    });

    example.dimensions.forEach((exDim) => {
      if (!DEFAULT_DIMENSIONS.some((d) => d.type === exDim.type)) {
        const preset = getDimensionPreset(exDim.type);
        if (preset) {
          newDimensions.push(createDimensionWithDefaults({
            id: uuidv4(),
            type: preset.type,
            label: preset.label,
            icon: preset.icon,
            placeholder: preset.placeholder,
            reference: exDim.reference,
          }));
        }
      }
    });

    setDimensions(newDimensions);
    setGeneratedPrompts([]);
    setFeedback({ positive: '', negative: '' });
  }, []);

  // Prompt handlers
  const handlePromptRate = useCallback((id: string, rating: 'up' | 'down' | null) => {
    setGeneratedPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, rating } : p)));
  }, []);

  const handlePromptLock = useCallback((id: string) => {
    setGeneratedPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, locked: !p.locked } : p)));
  }, []);

  const handleElementLock = useCallback((promptId: string, elementId: string) => {
    setGeneratedPrompts((prev) =>
      prev.map((p) =>
        p.id === promptId
          ? { ...p, elements: p.elements.map((e) => (e.id === elementId ? { ...e, locked: !e.locked } : e)) }
          : p
      )
    );
  }, []);

  const handleCopy = useCallback((id: string) => {
    setGeneratedPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, copied: true } : p)));
  }, []);

  // Element to dimension converter
  const handleConvertElementsToDimensions = useCallback((newDimensions: Dimension[]) => {
    setDimensions((prev) => {
      const updated = [...prev];
      newDimensions.forEach((newDim) => {
        const existingIndex = updated.findIndex((d) => d.type === newDim.type);
        if (existingIndex >= 0) {
          updated[existingIndex] = { ...updated[existingIndex], reference: newDim.reference || updated[existingIndex].reference };
        } else {
          updated.push(newDim);
        }
      });
      return updated;
    });
  }, []);

  // Accept element
  const handleAcceptElement = useCallback(async (element: PromptElement) => {
    if (acceptingElementId || dimensions.length === 0) return;

    setAcceptingElementId(element.id);

    try {
      const dimensionsForApi = dimensions.filter((d) => d.reference.trim()).map((d) => ({ type: d.type, reference: d.reference }));
      if (dimensionsForApi.length === 0) {
        setAcceptingElementId(null);
        return;
      }

      const result = await labelToDimension({ text: element.text, category: element.category }, dimensionsForApi);

      if (result.affectedDimensions.length > 0) {
        setPendingDimensionChange({ element, previousDimensions: [...dimensions] });
        setDimensions((prev) =>
          prev.map((dim) => {
            const change = result.affectedDimensions.find((c) => c.type === dim.type);
            return change ? { ...dim, reference: change.newValue } : dim;
          })
        );
      }
    } catch (err) {
      console.error('Failed to refine dimensions:', err);
    } finally {
      setAcceptingElementId(null);
    }
  }, [acceptingElementId, dimensions]);

  // Undo dimension change
  const handleUndoDimensionChange = useCallback(() => {
    if (pendingDimensionChange) {
      setDimensions(pendingDimensionChange.previousDimensions);
      setPendingDimensionChange(null);
    }
  }, [pendingDimensionChange]);

  // ============================================
  // Concept-based bidirectional flow handlers
  // ============================================

  /**
   * Drop an element directly onto a dimension (drag-and-drop)
   * This is the simplest form of output→input transformation
   */
  const handleDropElementOnDimension = useCallback((element: PromptElement, dimensionId: string) => {
    setPendingDimensionChange({ element, previousDimensions: [...dimensions] });
    setDimensions((prev) => applyElementToDimensionById(element, dimensionId, prev));
  }, [dimensions]);

  /**
   * Convert an element to a concept (for inspection/transformation)
   * Returns the concept representation without modifying state
   */
  const handleElementToConcept = useCallback((element: PromptElement): Concept => {
    return elementToConcept(element);
  }, []);

  /**
   * Apply a concept as a dimension constraint
   * Uses semantic mapping to find the best matching dimension type
   */
  const handleApplyConceptAsDimension = useCallback((concept: Concept) => {
    const { updatedDimensions, wasApplied } = applyConceptToDimensions(concept, dimensions);

    if (wasApplied) {
      // Store previous state for undo
      const previousElement: PromptElement = {
        id: concept.id,
        text: concept.value,
        category: concept.category,
        locked: concept.locked,
      };
      setPendingDimensionChange({ element: previousElement, previousDimensions: [...dimensions] });
      setDimensions(updatedDimensions);
    }
  }, [dimensions]);

  // Generate prompts - Unified API call that handles feedback→dimension→prompt in one atomic operation
  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setIsGenerating(true);

    try {
      // Prepare dimensions for API
      const dimensionsForApi = dimensions.map((d) => ({
        type: d.type,
        label: d.label,
        reference: d.reference,
      }));

      // Single atomic API call: feedback → dimension adjustment → prompt generation
      const result = await generateWithFeedback(
        baseImage,
        dimensionsForApi,
        feedback,
        outputMode,
        lockedElements
      );

      if (result.success) {
        // Apply adjusted dimensions to state
        if (result.adjustedDimensions.length > 0) {
          setDimensions((prev) =>
            prev.map((dim) => {
              const adjustment = result.adjustedDimensions.find((a) => a.type === dim.type);
              return adjustment && adjustment.wasModified
                ? { ...dim, reference: adjustment.newValue }
                : dim;
            })
          );
        }

        // Set generated prompts
        const prompts: GeneratedPrompt[] = result.prompts.map((p) => ({
          id: p.id,
          sceneNumber: p.sceneNumber,
          sceneType: p.sceneType,
          prompt: p.prompt,
          copied: false,
          rating: null,
          locked: false,
          elements: p.elements,
        }));
        setGeneratedPrompts(prompts);
        promptHistoryHook.push(prompts);

        // Clear feedback after successful generation
        setFeedback({ positive: '', negative: '' });
      } else {
        console.error('Generation failed:', result.error);
        // Fallback to client-side generation
        const filledDimensions = dimensions.filter((d) => d.reference.trim());
        const selectedScenes = SCENE_TYPES.slice(0, 4);

        const fallbackPrompts: GeneratedPrompt[] = selectedScenes.map((sceneType, index) => {
          const promptId = uuidv4();
          const { prompt, negativePrompt, elements } = buildMockPromptWithElements(
            baseImage, filledDimensions, sceneType, index, lockedElements, outputMode, negativePrompts, promptId
          );
          return { id: promptId, sceneNumber: index + 1, sceneType, prompt, negativePrompt, copied: false, rating: null, locked: false, elements };
        });
        setGeneratedPrompts(fallbackPrompts);
        promptHistoryHook.push(fallbackPrompts);
        setFeedback({ positive: '', negative: '' });
      }
    } catch (err) {
      console.error('Generation error:', err);
      // Fallback to client-side generation on error
      const filledDimensions = dimensions.filter((d) => d.reference.trim());
      const selectedScenes = SCENE_TYPES.slice(0, 4);

      const fallbackPrompts: GeneratedPrompt[] = selectedScenes.map((sceneType, index) => {
        const promptId = uuidv4();
        const { prompt, negativePrompt, elements } = buildMockPromptWithElements(
          baseImage, filledDimensions, sceneType, index, lockedElements, outputMode, negativePrompts, promptId
        );
        return { id: promptId, sceneNumber: index + 1, sceneType, prompt, negativePrompt, copied: false, rating: null, locked: false, elements };
      });
      setGeneratedPrompts(fallbackPrompts);
      promptHistoryHook.push(fallbackPrompts);
      setFeedback({ positive: '', negative: '' });
    } finally {
      setIsGenerating(false);
    }
  }, [baseImage, dimensions, canGenerate, lockedElements, outputMode, feedback, negativePrompts, promptHistoryHook]);

  // Prompt history handlers
  const handlePromptUndo = useCallback(() => {
    const previousPrompts = promptHistoryHook.undo();
    if (previousPrompts) {
      setGeneratedPrompts(previousPrompts);
    }
  }, [promptHistoryHook]);

  const handlePromptRedo = useCallback(() => {
    const nextPrompts = promptHistoryHook.redo();
    if (nextPrompts) {
      setGeneratedPrompts(nextPrompts);
    }
  }, [promptHistoryHook]);

  // Prompt history state
  const promptHistory = useMemo(() => ({
    canUndo: promptHistoryHook.canUndo,
    canRedo: promptHistoryHook.canRedo,
    historyLength: promptHistoryHook.historyLength,
    positionLabel: promptHistoryHook.positionLabel,
  }), [promptHistoryHook.canUndo, promptHistoryHook.canRedo, promptHistoryHook.historyLength, promptHistoryHook.positionLabel]);

  return {
    // State
    baseImage, baseImageFile, dimensions, generatedPrompts, isGenerating,
    isParsingImage, imageParseError, parsedImageDescription,
    feedback, outputMode, acceptingElementId, pendingDimensionChange,
    canGenerate, hasLockedPrompts, lockedElements, negativePrompts,
    promptHistory,
    // Actions
    setBaseImage, setBaseImageFile, setFeedback, setOutputMode,
    handleDimensionChange, handleDimensionWeightChange,
    handleDimensionFilterModeChange, handleDimensionTransformModeChange,
    handleDimensionReferenceImageChange,
    handleDimensionRemove, handleDimensionAdd, handleDimensionReorder,
    handleSmartBreakdownApply, handleImageParse, handleReset, handleLoadExample,
    handlePromptRate, handlePromptLock, handleElementLock, handleCopy,
    handleConvertElementsToDimensions, handleAcceptElement, handleUndoDimensionChange,
    handleGenerate,
    // Concept-based bidirectional flow
    handleDropElementOnDimension, handleElementToConcept, handleApplyConceptAsDimension,
    // Negative prompts
    setNegativePrompts,
    // Prompt history
    handlePromptUndo, handlePromptRedo,
  };
}
