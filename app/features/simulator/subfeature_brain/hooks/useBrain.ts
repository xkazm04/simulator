/**
 * useBrain - Hook for managing the central brain state
 *
 * Manages:
 * - Base image (text description + optional image file)
 * - Feedback (positive/negative)
 * - Output mode (gameplay/concept/poster)
 * - Image parsing state
 *
 * Uses the unified UndoStack pattern for undo operations.
 */

'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Dimension,
  DimensionType,
  OutputMode,
  SmartBreakdownPersisted,
  createDimensionWithDefaults,
} from '../../types';
import { describeImage, ImageDescriptionResult } from '../lib/simulatorAI';
import { DEFAULT_DIMENSIONS } from '../../subfeature_dimensions/lib/defaultDimensions';
import { useUndoStack, UNDO_TAGS } from '../../hooks/useUndoStack';

/**
 * Snapshot of state before image parse - used for undo
 * Now uses the unified UndoStack pattern
 */
export interface PreParseSnapshot {
  baseImage: string;
  visionSentence: string | null;
  outputMode: OutputMode;
  /** Dimensions are stored externally, so we capture them separately */
  dimensions: Dimension[];
}

export interface BrainState {
  baseImage: string;
  baseImageFile: string | null;
  /** The original vision sentence (e.g., "Baldur's Gate in Star Wars") - core project identity */
  visionSentence: string | null;
  /** Persisted Smart Breakdown result (format, keyElements, reasoning) */
  breakdown: SmartBreakdownPersisted | null;
  feedback: { positive: string; negative: string };
  outputMode: OutputMode;
  isParsingImage: boolean;
  imageParseError: string | null;
  parsedImageDescription: ImageDescriptionResult['description'] | null;
  /** Snapshot of state before last parse - enables undo */
  preParseSnapshot: PreParseSnapshot | null;
  /** Whether undo is available */
  canUndoParse: boolean;
}

export interface BrainActions {
  setBaseImage: (value: string) => void;
  setBaseImageFile: (value: string | null) => void;
  setVisionSentence: (value: string | null) => void;
  setBreakdown: (value: SmartBreakdownPersisted | null) => void;
  setFeedback: (value: { positive: string; negative: string }) => void;
  setOutputMode: (value: OutputMode) => void;
  handleImageParse: (
    imageDataUrl: string,
    currentDimensions: Dimension[],
    onDimensionsUpdate?: (updater: (prev: Dimension[]) => Dimension[]) => void
  ) => Promise<void>;
  /** Undo the last image parse, restoring previous state */
  undoImageParse: (onDimensionsRestore: (dimensions: Dimension[]) => void) => void;
  /** Clear the undo snapshot (e.g., after user makes manual changes) */
  clearUndoSnapshot: () => void;
  handleSmartBreakdownApply: (
    visionSentence: string,
    baseImage: string,
    dimensions: Dimension[],
    outputMode: OutputMode,
    onDimensionsSet: (dimensions: Dimension[]) => void,
    breakdownResult: { baseImage: { format: string; keyElements: string[] }; reasoning: string }
  ) => void;
  resetBrain: () => void;
  clearFeedback: () => void;
}

export function useBrain(): BrainState & BrainActions {
  const [baseImage, setBaseImageState] = useState('');
  const [baseImageFile, setBaseImageFileState] = useState<string | null>(null);
  const [visionSentence, setVisionSentenceState] = useState<string | null>(null);
  const [breakdown, setBreakdownState] = useState<SmartBreakdownPersisted | null>(null);
  const [feedback, setFeedbackState] = useState({ positive: '', negative: '' });
  const [outputMode, setOutputModeState] = useState<OutputMode>('gameplay');
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [imageParseError, setImageParseError] = useState<string | null>(null);
  const [parsedImageDescription, setParsedImageDescription] = useState<ImageDescriptionResult['description'] | null>(null);

  // Unified undo stack for brain state operations
  const undoStack = useUndoStack<PreParseSnapshot>({ maxSize: 5 });

  // Derive preParseSnapshot from undo stack for backwards compatibility
  const preParseSnapshot = undoStack.peek()?.state ?? null;
  const canUndoParse = undoStack.canUndo;

  const setBaseImage = useCallback((value: string) => {
    setBaseImageState(value);
  }, []);

  const setBaseImageFile = useCallback((value: string | null) => {
    setBaseImageFileState(value);
  }, []);

  const setVisionSentence = useCallback((value: string | null) => {
    setVisionSentenceState(value);
  }, []);

  const setBreakdown = useCallback((value: SmartBreakdownPersisted | null) => {
    setBreakdownState(value);
  }, []);

  const setFeedback = useCallback((value: { positive: string; negative: string }) => {
    setFeedbackState(value);
  }, []);

  const setOutputMode = useCallback((value: OutputMode) => {
    setOutputModeState(value);
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedbackState({ positive: '', negative: '' });
  }, []);

  // Image parsing with AI vision
  const handleImageParse = useCallback(async (
    imageDataUrl: string,
    currentDimensions: Dimension[],
    onDimensionsUpdate?: (updater: (prev: Dimension[]) => Dimension[]) => void
  ) => {
    if (isParsingImage) return;

    // Push snapshot to undo stack before parsing (unified pattern)
    undoStack.pushSnapshot(
      {
        baseImage: baseImage,
        visionSentence: visionSentence,
        outputMode: outputMode,
        dimensions: [...currentDimensions],
      },
      UNDO_TAGS.IMAGE_PARSE,
      'Pre-image parse state'
    );

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
        setBaseImageState(desc.suggestedBaseDescription);

        // Set output mode based on AI suggestion
        setOutputModeState(desc.suggestedOutputMode);

        // Optionally populate dimensions from swappable content
        if (onDimensionsUpdate) {
          onDimensionsUpdate((prev) => {
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
        }
      } else {
        // API returned error - pop snapshot since parse failed
        undoStack.undo();
        setImageParseError(result.error || 'Failed to analyze image');
      }
    } catch (err) {
      console.error('Failed to parse image:', err);
      // Pop snapshot since parse failed
      undoStack.undo();
      setImageParseError(err instanceof Error ? err.message : 'Failed to analyze image');
    } finally {
      setIsParsingImage(false);
    }
  }, [isParsingImage, baseImage, visionSentence, outputMode, undoStack]);

  // Undo the last image parse using unified undo stack
  const undoImageParse = useCallback((onDimensionsRestore: (dimensions: Dimension[]) => void) => {
    const snapshot = undoStack.undo();
    if (!snapshot) return;

    // Restore previous state from snapshot
    setBaseImageState(snapshot.state.baseImage);
    setVisionSentenceState(snapshot.state.visionSentence);
    setOutputModeState(snapshot.state.outputMode);
    onDimensionsRestore(snapshot.state.dimensions);

    // Clear parsed description
    setParsedImageDescription(null);
  }, [undoStack]);

  // Clear the undo stack manually
  const clearUndoSnapshot = useCallback(() => {
    undoStack.clear();
  }, [undoStack]);

  // Smart breakdown apply - sets vision sentence, base image and triggers dimension update
  const handleSmartBreakdownApply = useCallback((
    newVisionSentence: string,
    newBaseImage: string,
    newDimensions: Dimension[],
    newOutputMode: OutputMode,
    onDimensionsSet: (dimensions: Dimension[]) => void,
    breakdownResult: { baseImage: { format: string; keyElements: string[] }; reasoning: string }
  ) => {
    setVisionSentenceState(newVisionSentence);
    setBaseImageState(newBaseImage);
    setBaseImageFileState(null);

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

    onDimensionsSet(mergedDimensions);
    setOutputModeState(newOutputMode);
    setFeedbackState({ positive: '', negative: '' });

    // Persist breakdown result
    setBreakdownState({
      baseImage: {
        format: breakdownResult.baseImage.format,
        keyElements: breakdownResult.baseImage.keyElements,
      },
      reasoning: breakdownResult.reasoning,
    });
  }, []);

  const resetBrain = useCallback(() => {
    setBaseImageState('');
    setBaseImageFileState(null);
    setVisionSentenceState(null);
    setBreakdownState(null);
    setFeedbackState({ positive: '', negative: '' });
    setParsedImageDescription(null);
    setImageParseError(null);
    undoStack.clear();
  }, [undoStack]);

  return {
    // State
    baseImage,
    baseImageFile,
    visionSentence,
    breakdown,
    feedback,
    outputMode,
    isParsingImage,
    imageParseError,
    parsedImageDescription,
    preParseSnapshot,
    canUndoParse,
    // Actions
    setBaseImage,
    setBaseImageFile,
    setVisionSentence,
    setBreakdown,
    setFeedback,
    setOutputMode,
    handleImageParse,
    undoImageParse,
    clearUndoSnapshot,
    handleSmartBreakdownApply,
    resetBrain,
    clearFeedback,
  };
}
