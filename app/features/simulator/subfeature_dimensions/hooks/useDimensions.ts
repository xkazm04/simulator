/**
 * useDimensions - Hook for managing dimension state
 *
 * Dimensions are transformation lenses with:
 * - Filter mode: what to preserve from base image
 * - Transform mode: how to apply the reference
 * - Weight: intensity 0-100
 */

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Dimension,
  DimensionPreset,
  DimensionFilterMode,
  DimensionTransformMode,
  PromptElement,
  createDimensionWithDefaults,
} from '../../types';
import { DEFAULT_DIMENSIONS, getDimensionPreset, EXAMPLE_SIMULATIONS } from '../lib/defaultDimensions';
import { applyElementToDimensionById } from '../lib/concept';

export interface DimensionsState {
  dimensions: Dimension[];
  pendingDimensionChange: { element: PromptElement; previousDimensions: Dimension[] } | null;
}

export interface DimensionsActions {
  handleDimensionChange: (id: string, reference: string) => void;
  handleDimensionWeightChange: (id: string, weight: number) => void;
  handleDimensionFilterModeChange: (id: string, filterMode: DimensionFilterMode) => void;
  handleDimensionTransformModeChange: (id: string, transformMode: DimensionTransformMode) => void;
  handleDimensionReferenceImageChange: (id: string, imageDataUrl: string | null) => void;
  handleDimensionRemove: (id: string) => void;
  handleDimensionAdd: (preset: DimensionPreset) => void;
  handleDimensionReorder: (reorderedDimensions: Dimension[]) => void;
  handleDropElementOnDimension: (element: PromptElement, dimensionId: string) => void;
  handleUndoDimensionChange: () => void;
  handleConvertElementsToDimensions: (dimensions: Dimension[]) => void;
  setDimensions: (dimensions: Dimension[]) => void;
  resetDimensions: () => void;
  loadExampleDimensions: (exampleIndex: number) => void;
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

export function useDimensions(): DimensionsState & DimensionsActions {
  const [dimensions, setDimensionsState] = useState<Dimension[]>(createDefaultDimensions);
  const [pendingDimensionChange, setPendingDimensionChange] = useState<{
    element: PromptElement;
    previousDimensions: Dimension[];
  } | null>(null);

  // Basic dimension handlers
  const handleDimensionChange = useCallback((id: string, reference: string) => {
    setDimensionsState((prev) => prev.map((d) => (d.id === id ? { ...d, reference } : d)));
  }, []);

  const handleDimensionWeightChange = useCallback((id: string, weight: number) => {
    setDimensionsState((prev) =>
      prev.map((d) => (d.id === id ? { ...d, weight: Math.max(0, Math.min(100, weight)) } : d))
    );
  }, []);

  const handleDimensionFilterModeChange = useCallback((id: string, filterMode: DimensionFilterMode) => {
    setDimensionsState((prev) => prev.map((d) => (d.id === id ? { ...d, filterMode } : d)));
  }, []);

  const handleDimensionTransformModeChange = useCallback((id: string, transformMode: DimensionTransformMode) => {
    setDimensionsState((prev) => prev.map((d) => (d.id === id ? { ...d, transformMode } : d)));
  }, []);

  const handleDimensionReferenceImageChange = useCallback((id: string, imageDataUrl: string | null) => {
    setDimensionsState((prev) =>
      prev.map((d) => (d.id === id ? { ...d, referenceImage: imageDataUrl ?? undefined } : d))
    );
  }, []);

  const handleDimensionRemove = useCallback((id: string) => {
    setDimensionsState((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleDimensionAdd = useCallback((preset: DimensionPreset) => {
    setDimensionsState((prev) => [
      ...prev,
      createDimensionWithDefaults({
        id: uuidv4(),
        type: preset.type,
        label: preset.label,
        icon: preset.icon,
        placeholder: preset.placeholder,
        reference: '',
      }),
    ]);
  }, []);

  const handleDimensionReorder = useCallback((reorderedDimensions: Dimension[]) => {
    setDimensionsState(reorderedDimensions);
  }, []);

  // Element-to-dimension flow
  const handleDropElementOnDimension = useCallback(
    (element: PromptElement, dimensionId: string) => {
      setPendingDimensionChange({ element, previousDimensions: [...dimensions] });
      setDimensionsState((prev) => applyElementToDimensionById(element, dimensionId, prev));
    },
    [dimensions]
  );

  const handleUndoDimensionChange = useCallback(() => {
    if (pendingDimensionChange) {
      setDimensionsState(pendingDimensionChange.previousDimensions);
      setPendingDimensionChange(null);
    }
  }, [pendingDimensionChange]);

  // Convert elements to dimensions (merge into existing)
  const handleConvertElementsToDimensions = useCallback((newDimensions: Dimension[]) => {
    setDimensionsState((prev) => {
      const updated = [...prev];
      newDimensions.forEach((newDim) => {
        const existingIndex = updated.findIndex((d) => d.type === newDim.type);
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            reference: newDim.reference || updated[existingIndex].reference,
          };
        } else {
          updated.push(newDim);
        }
      });
      return updated;
    });
  }, []);

  // Direct setter for restoration
  const setDimensions = useCallback((newDimensions: Dimension[]) => {
    setDimensionsState(newDimensions);
  }, []);

  // Reset to defaults
  const resetDimensions = useCallback(() => {
    setDimensionsState(createDefaultDimensions());
    setPendingDimensionChange(null);
  }, []);

  // Load example dimensions
  const loadExampleDimensions = useCallback((exampleIndex: number) => {
    const example = EXAMPLE_SIMULATIONS[exampleIndex];
    if (!example) return;

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
          newDimensions.push(
            createDimensionWithDefaults({
              id: uuidv4(),
              type: preset.type,
              label: preset.label,
              icon: preset.icon,
              placeholder: preset.placeholder,
              reference: exDim.reference,
            })
          );
        }
      }
    });

    setDimensionsState(newDimensions);
  }, []);

  return {
    // State
    dimensions,
    pendingDimensionChange,
    // Actions
    handleDimensionChange,
    handleDimensionWeightChange,
    handleDimensionFilterModeChange,
    handleDimensionTransformModeChange,
    handleDimensionReferenceImageChange,
    handleDimensionRemove,
    handleDimensionAdd,
    handleDimensionReorder,
    handleDropElementOnDimension,
    handleUndoDimensionChange,
    handleConvertElementsToDimensions,
    setDimensions,
    resetDimensions,
    loadExampleDimensions,
  };
}
