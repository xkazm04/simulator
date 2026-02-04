/**
 * useDimensions - Hook for managing dimension state
 *
 * Dimensions are transformation lenses with:
 * - Filter mode: what to preserve from base image
 * - Transform mode: how to apply the reference
 * - Weight: intensity 0-100
 *
 * Uses the unified UndoStack pattern for undo operations across
 * dimension changes, element drops, and other modifications.
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
import { useUndoStack, UNDO_TAGS, UndoTag } from '../../hooks/useUndoStack';

/**
 * Dimension snapshot for undo operations
 */
interface DimensionSnapshot {
  dimensions: Dimension[];
  /** Element that triggered the change (for element-to-dimension flow) */
  element?: PromptElement;
}

export interface DimensionsState {
  dimensions: Dimension[];
  /** @deprecated Use canUndo from undo stack instead. Kept for backwards compatibility. */
  pendingDimensionChange: { element: PromptElement; previousDimensions: Dimension[] } | null;
  /** Whether undo is available for dimension changes */
  canUndoDimension: boolean;
  /** Number of undo operations available */
  undoStackSize: number;
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
  /** Undo the last dimension change */
  handleUndoDimensionChange: () => void;
  /** Undo a specific type of dimension change by tag */
  handleUndoDimensionChangeByTag: (tag: UndoTag) => void;
  handleConvertElementsToDimensions: (dimensions: Dimension[]) => void;
  setDimensions: (dimensions: Dimension[]) => void;
  /** Set dimensions with undo support (pushes current state to undo stack) */
  setDimensionsWithUndo: (dimensions: Dimension[], tag?: UndoTag, description?: string) => void;
  resetDimensions: () => void;
  loadExampleDimensions: (exampleIndex: number) => void;
  /** Clear the dimension undo stack */
  clearDimensionUndoStack: () => void;
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

  // Unified undo stack for dimension operations
  const undoStack = useUndoStack<DimensionSnapshot>({ maxSize: 20 });

  // Derive pendingDimensionChange from undo stack for backwards compatibility
  const lastSnapshot = undoStack.peek();
  const pendingDimensionChange = lastSnapshot?.state.element
    ? { element: lastSnapshot.state.element, previousDimensions: lastSnapshot.state.dimensions }
    : null;

  const canUndoDimension = undoStack.canUndo;
  const undoStackSize = undoStack.stackSize;

  /**
   * Helper to push current dimensions to undo stack before a change
   */
  const pushUndoSnapshot = useCallback(
    (tag?: UndoTag, description?: string, element?: PromptElement) => {
      undoStack.pushSnapshot(
        { dimensions: [...dimensions], element },
        tag,
        description
      );
    },
    [dimensions, undoStack]
  );

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

  // Element-to-dimension flow with unified undo stack
  const handleDropElementOnDimension = useCallback(
    (element: PromptElement, dimensionId: string) => {
      // Push to unified undo stack with element context
      pushUndoSnapshot(UNDO_TAGS.ELEMENT_LOCK, `Element "${element.text}" dropped`, element);
      setDimensionsState((prev) => applyElementToDimensionById(element, dimensionId, prev));
    },
    [pushUndoSnapshot]
  );

  // Undo the last dimension change using unified undo stack
  const handleUndoDimensionChange = useCallback(() => {
    const snapshot = undoStack.undo();
    if (snapshot) {
      setDimensionsState(snapshot.state.dimensions);
    }
  }, [undoStack]);

  // Undo a specific type of dimension change by tag
  const handleUndoDimensionChangeByTag = useCallback(
    (tag: UndoTag) => {
      const snapshot = undoStack.undoByTag(tag);
      if (snapshot) {
        setDimensionsState(snapshot.state.dimensions);
      }
    },
    [undoStack]
  );

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

  // Direct setter for restoration (without undo support)
  const setDimensions = useCallback((newDimensions: Dimension[]) => {
    setDimensionsState(newDimensions);
  }, []);

  // Setter with undo support
  const setDimensionsWithUndo = useCallback(
    (newDimensions: Dimension[], tag?: UndoTag, description?: string) => {
      pushUndoSnapshot(tag || UNDO_TAGS.DIMENSION_CHANGE, description || 'Dimension change');
      setDimensionsState(newDimensions);
    },
    [pushUndoSnapshot]
  );

  // Reset to defaults (clears undo stack)
  const resetDimensions = useCallback(() => {
    setDimensionsState(createDefaultDimensions());
    undoStack.clear();
  }, [undoStack]);

  // Clear the undo stack manually
  const clearDimensionUndoStack = useCallback(() => {
    undoStack.clear();
  }, [undoStack]);

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
    canUndoDimension,
    undoStackSize,
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
    handleUndoDimensionChangeByTag,
    handleConvertElementsToDimensions,
    setDimensions,
    setDimensionsWithUndo,
    resetDimensions,
    loadExampleDimensions,
    clearDimensionUndoStack,
  };
}
