/**
 * useAutosave - Debounced autosave for simulator state
 *
 * Extracted from SimulatorFeature to reduce complexity.
 * Saves dimensions, base prompt, output mode, and feedback
 * with a 300ms debounce.
 */

import { useEffect, useRef } from 'react';
import { useProject } from './useProject';
import { useDimensionsContext } from '../subfeature_dimensions';
import { useBrainContext } from '../subfeature_brain';

export function useAutosave() {
  const project = useProject();
  const dimensions = useDimensionsContext();
  const brain = useBrainContext();

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    // Skip initial mount to avoid saving empty state
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (!project.currentProject) {
      return;
    }

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Debounced save
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
}
