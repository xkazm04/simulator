/**
 * useAutosave - Debounced autosave for simulator state
 *
 * Extracted from SimulatorFeature to reduce complexity.
 * Saves dimensions, base prompt, output mode, and feedback
 * with a 300ms debounce.
 *
 * Uses refs to avoid stale closure issues in the debounced callback.
 */

import { useEffect, useRef } from 'react';
import { useProjectContext } from '../contexts';
import { useDimensionsState } from '../subfeature_dimensions';
import { useBrainState } from '../subfeature_brain';

export function useAutosave() {
  const project = useProjectContext();
  const dimensions = useDimensionsState();
  const brain = useBrainState();

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);

  // Use refs to avoid stale closures in the debounced callback
  const brainRef = useRef(brain);
  const dimensionsRef = useRef(dimensions.dimensions);
  const projectRef = useRef(project);

  // Keep refs up to date
  useEffect(() => {
    brainRef.current = brain;
  }, [brain]);

  useEffect(() => {
    dimensionsRef.current = dimensions.dimensions;
  }, [dimensions.dimensions]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    // Skip initial mount to avoid saving empty state
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      console.log('[useAutosave] Skipping initial mount');
      return;
    }

    if (!project.currentProject) {
      console.log('[useAutosave] No current project, skipping save');
      return;
    }

    // Skip saving during project restoration to prevent race conditions
    // where empty/intermediate state gets saved before restoration completes
    if (project.isRestoring) {
      console.log('[useAutosave] Project is restoring, skipping save');
      return;
    }

    console.log('[useAutosave] State changed, scheduling save for project:', project.currentProject.id);

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Debounced save - use refs to get current values
    autosaveTimerRef.current = setTimeout(() => {
      const currentBrain = brainRef.current;
      const currentDimensions = dimensionsRef.current;
      const currentProject = projectRef.current;

      console.log('[useAutosave] Executing debounced save');
      console.log('[useAutosave] Current brain state:', {
        baseImage: currentBrain.baseImage,
        baseImageFile: currentBrain.baseImageFile,
        visionSentence: currentBrain.visionSentence,
        breakdown: currentBrain.breakdown,
        outputMode: currentBrain.outputMode,
        feedback: currentBrain.feedback,
      });
      console.log('[useAutosave] Current dimensions:', currentDimensions);

      const stateToSave: {
        dimensions?: typeof currentDimensions;
        basePrompt?: string;
        baseImageFile?: string | null;
        visionSentence?: string | null;
        breakdown?: typeof currentBrain.breakdown;
        outputMode?: typeof currentBrain.outputMode;
        feedback?: typeof currentBrain.feedback;
      } = {};

      if (currentDimensions.length > 0) {
        stateToSave.dimensions = currentDimensions;
      }
      // Always save basePrompt, even if empty (to allow clearing)
      stateToSave.basePrompt = currentBrain.baseImage;
      stateToSave.baseImageFile = currentBrain.baseImageFile;
      // Save visionSentence (core project identity from smart breakdown)
      stateToSave.visionSentence = currentBrain.visionSentence;
      // Save breakdown (AI-analyzed structure from smart breakdown)
      stateToSave.breakdown = currentBrain.breakdown;
      stateToSave.outputMode = currentBrain.outputMode;
      if (currentBrain.feedback.positive || currentBrain.feedback.negative) {
        stateToSave.feedback = currentBrain.feedback;
      }

      console.log('[useAutosave] State to save:', stateToSave);
      currentProject.saveState(stateToSave);
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
    brain.visionSentence,
    brain.breakdown,
    brain.outputMode,
    brain.feedback.positive,
    brain.feedback.negative,
    project.currentProject?.id,
    project.isRestoring,
  ]);
}
