/**
 * DirectorControl - Feedback and advanced options panel
 *
 * Contains:
 * - Change input (feedback for what to modify)
 * - Smart suggestions (expandable)
 * - Delete images action
 *
 * Mode selector + Generate/Auto/Undo-Redo buttons are in PersistentActionBar.
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { GeneratedImage, OutputMode } from '../../types';
import { SmartSuggestionPanel } from '../../components/SmartSuggestionPanel';
import { useBrainState, useBrainActions } from '../BrainContext';
import { DEFAULT_DIMENSIONS, EXTRA_DIMENSIONS } from '../../subfeature_dimensions/lib/defaultDimensions';
import { createDimensionWithDefaults, DimensionType, DimensionPreset } from '../../types';
import { useDimensionsState, useDimensionsActions } from '../../subfeature_dimensions/DimensionsContext';
import { useSimulatorContext } from '../../SimulatorContext';
import { semanticColors } from '../../lib/semanticColors';

export interface DirectorControlProps {
  generatedImages: GeneratedImage[];
  isGeneratingImages: boolean;
  onDeleteGenerations?: () => void;
  isGeneratingPoster: boolean;
  multiPhaseAutoplay?: {
    isRunning: boolean;
  };
}

export function DirectorControl({
  generatedImages,
  isGeneratingImages,
  onDeleteGenerations,
  isGeneratingPoster,
  multiPhaseAutoplay,
}: DirectorControlProps) {
  const brainState = useBrainState();
  const brainActions = useBrainActions();
  const dimensionsState = useDimensionsState();
  const dimensionsActions = useDimensionsActions();
  const simulator = useSimulatorContext();

  // Debounced feedback: local draft avoids re-renders during typing
  const [feedbackDraft, setFeedbackDraft] = useState(brainState.feedback.negative || '');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync draft from context when context changes externally (e.g. after refinement clears it)
  useEffect(() => {
    setFeedbackDraft(brainState.feedback.negative || '');
  }, [brainState.feedback.negative]);

  const handleFeedbackChange = useCallback((value: string) => {
    setFeedbackDraft(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      brainActions.setFeedback({ ...brainState.feedback, negative: value });
    }, 300);
  }, [brainActions, brainState.feedback]);

  // Derive autoplay lock state from multi-phase autoplay
  const isAutoplayLocked = multiPhaseAutoplay?.isRunning ?? false;

  const isAnyGenerating = simulator.isGenerating || isGeneratingPoster || isAutoplayLocked;

  // Smart suggestion handlers
  const handleAcceptDimensionSuggestion = useCallback((dimensionType: DimensionType, weight?: number) => {
    // Find preset for this dimension type in all available presets
    const allPresets: DimensionPreset[] = [...DEFAULT_DIMENSIONS, ...EXTRA_DIMENSIONS];
    const preset = allPresets.find(p => p.type === dimensionType);
    if (preset) {
      const baseDimension = createDimensionWithDefaults({
        ...preset,
        id: `${dimensionType}-${Date.now()}`,
        reference: '',
      });
      // Apply suggested weight if provided
      const newDimension = weight != null
        ? { ...baseDimension, weight }
        : baseDimension;
      dimensionsActions.setDimensions([...dimensionsState.dimensions, newDimension]);
    }
  }, [dimensionsState.dimensions, dimensionsActions]);

  const handleAcceptWeightSuggestion = useCallback((dimensionType: DimensionType, weight: number) => {
    const updated = dimensionsState.dimensions.map(d =>
      d.type === dimensionType ? { ...d, weight } : d
    );
    dimensionsActions.setDimensions(updated);
  }, [dimensionsState.dimensions, dimensionsActions]);

  const handleAcceptOutputMode = useCallback((mode: OutputMode) => {
    brainActions.setOutputMode(mode);
  }, [brainActions]);

  return (
    <div className="p-lg bg-black/20 shrink-0 relative z-20">
      {/* Dev-only actions */}
      {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && generatedImages.length > 0 && onDeleteGenerations && (
        <div className="mb-md flex items-center justify-end gap-2 relative z-30">
          <button
            onClick={onDeleteGenerations}
            disabled={isGeneratingImages}
            data-testid="delete-images-btn"
            className="text-md text-red-400/80 font-mono flex items-center gap-1.5 border border-red-900/50 radius-sm px-3 py-1 hover:bg-red-950/30 hover:border-red-800/50 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <Trash2 size={12} /> <span>DELETE IMAGES</span>
          </button>
        </div>
      )}

      {/* Change Input - Always visible when base prompt exists */}
      {brainState.baseImage && (
        <div className="space-y-2 mb-md">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
              <RefreshCw size={12} className={semanticColors.warning.text} />
              What to Change
            </label>
            {feedbackDraft && (
              <span className="type-label text-amber-400 flex items-center gap-1">
                <Sparkles size={10} />
                Will refine on generate
              </span>
            )}
          </div>
          <textarea
            value={feedbackDraft}
            onChange={(e) => handleFeedbackChange(e.target.value)}
            placeholder="Describe what should be different... (e.g. 'make it darker', 'change the mood to mysterious', 'add rain effects')"
            className={`w-full h-20 bg-slate-900/50 border radius-md p-3 text-sm placeholder-slate-600 resize-none
                        focus:outline-none focus:ring-1 transition-all
                        ${feedbackDraft ? 'border-amber-500/30 ring-amber-500/30' : 'border-slate-800 focus:border-amber-500/50 focus:ring-amber-500/50'}`}
            disabled={isAnyGenerating}
          />
          <p className="font-mono type-label text-slate-600">
            LLM will analyze your feedback and update the base prompt and dimensions accordingly before generating.
          </p>
        </div>
      )}

      {/* Smart Suggestions Panel */}
      <SmartSuggestionPanel
        dimensions={dimensionsState.dimensions}
        baseImageDescription={brainState.baseImage}
        onAcceptDimensionSuggestion={handleAcceptDimensionSuggestion}
        onAcceptWeightSuggestion={handleAcceptWeightSuggestion}
        onAcceptOutputMode={handleAcceptOutputMode}
        isGenerating={isAnyGenerating}
      />

    </div>
  );
}

export default DirectorControl;
