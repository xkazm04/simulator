/**
 * useBrain - Hook for managing the central brain state
 *
 * Manages:
 * - Base image (text description + optional image file)
 * - Feedback (positive/negative)
 * - Output mode (gameplay/concept/poster)
 * - Image parsing state
 */

'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Dimension,
  DimensionType,
  OutputMode,
  createDimensionWithDefaults,
} from '../../types';
import { describeImage, ImageDescriptionResult } from '../lib/simulatorAI';
import { DEFAULT_DIMENSIONS } from '../../subfeature_dimensions/lib/defaultDimensions';

export interface BrainState {
  baseImage: string;
  baseImageFile: string | null;
  feedback: { positive: string; negative: string };
  outputMode: OutputMode;
  isParsingImage: boolean;
  imageParseError: string | null;
  parsedImageDescription: ImageDescriptionResult['description'] | null;
}

export interface BrainActions {
  setBaseImage: (value: string) => void;
  setBaseImageFile: (value: string | null) => void;
  setFeedback: (value: { positive: string; negative: string }) => void;
  setOutputMode: (value: OutputMode) => void;
  handleImageParse: (imageDataUrl: string, onDimensionsUpdate?: (updater: (prev: Dimension[]) => Dimension[]) => void) => Promise<void>;
  handleSmartBreakdownApply: (
    baseImage: string,
    dimensions: Dimension[],
    outputMode: OutputMode,
    onDimensionsSet: (dimensions: Dimension[]) => void
  ) => void;
  resetBrain: () => void;
  clearFeedback: () => void;
}

export function useBrain(): BrainState & BrainActions {
  const [baseImage, setBaseImageState] = useState('');
  const [baseImageFile, setBaseImageFileState] = useState<string | null>(null);
  const [feedback, setFeedbackState] = useState({ positive: '', negative: '' });
  const [outputMode, setOutputModeState] = useState<OutputMode>('gameplay');
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [imageParseError, setImageParseError] = useState<string | null>(null);
  const [parsedImageDescription, setParsedImageDescription] = useState<ImageDescriptionResult['description'] | null>(null);

  const setBaseImage = useCallback((value: string) => {
    setBaseImageState(value);
  }, []);

  const setBaseImageFile = useCallback((value: string | null) => {
    setBaseImageFileState(value);
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
    onDimensionsUpdate?: (updater: (prev: Dimension[]) => Dimension[]) => void
  ) => {
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

  // Smart breakdown apply - sets base image and triggers dimension update
  const handleSmartBreakdownApply = useCallback((
    newBaseImage: string,
    newDimensions: Dimension[],
    newOutputMode: OutputMode,
    onDimensionsSet: (dimensions: Dimension[]) => void
  ) => {
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
  }, []);

  const resetBrain = useCallback(() => {
    setBaseImageState('');
    setBaseImageFileState(null);
    setFeedbackState({ positive: '', negative: '' });
    setParsedImageDescription(null);
    setImageParseError(null);
  }, []);

  return {
    // State
    baseImage,
    baseImageFile,
    feedback,
    outputMode,
    isParsingImage,
    imageParseError,
    parsedImageDescription,
    // Actions
    setBaseImage,
    setBaseImageFile,
    setFeedback,
    setOutputMode,
    handleImageParse,
    handleSmartBreakdownApply,
    resetBrain,
    clearFeedback,
  };
}
