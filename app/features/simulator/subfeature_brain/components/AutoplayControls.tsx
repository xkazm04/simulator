/**
 * AutoplayControls - User-facing controls for autoplay functionality
 *
 * Provides:
 * - Target picker dropdown (1-4 images)
 * - Start/Stop buttons
 * - Progress indicator with phase colors and iteration count
 * - Completion summary with auto-reset
 *
 * Integrates with useAutoplayOrchestrator return values.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Square,
  Loader2,
  ChevronDown,
  Target,
  CheckCircle2,
} from 'lucide-react';
import { scaleIn, transitions } from '../../lib/motion';
import { semanticColors } from '../../lib/semanticColors';

/**
 * Props interface matching useAutoplayOrchestrator return type
 */
export interface AutoplayControlsProps {
  // State from orchestrator
  isRunning: boolean;
  canStart: boolean;
  status: string; // 'idle' | 'generating' | 'evaluating' | 'refining' | 'complete' | 'error'
  currentIteration: number;
  maxIterations: number;
  totalSaved: number;
  targetSaved: number;
  completionReason: string | null;
  error: string | undefined;

  // Actions
  onStart: (config: { targetSavedCount: number; maxIterations: number }) => void;
  onStop: () => void;
  onReset: () => void;

  // Parent state
  disabled?: boolean; // Additional disable flag from parent (e.g., poster mode)
}

/**
 * Phase configuration for status display
 */
const PHASE_CONFIG: Record<string, { label: string; color: typeof semanticColors.primary }> = {
  idle: { label: 'Ready', color: semanticColors.primary },
  generating: { label: 'Generating', color: semanticColors.primary },
  evaluating: { label: 'Evaluating', color: semanticColors.processing },
  refining: { label: 'Refining', color: semanticColors.warning },
  complete: { label: 'Complete', color: semanticColors.success },
  error: { label: 'Error', color: semanticColors.error },
};

/**
 * Target count options (1-4 images)
 */
const TARGET_OPTIONS = [1, 2, 3, 4] as const;

export function AutoplayControls({
  isRunning,
  canStart,
  status,
  currentIteration,
  maxIterations,
  totalSaved,
  targetSaved,
  completionReason,
  error,
  onStart,
  onStop,
  onReset,
  disabled = false,
}: AutoplayControlsProps) {
  // Local state
  const [targetCount, setTargetCount] = useState<number>(2);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Derived state
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const phaseConfig = PHASE_CONFIG[status] || PHASE_CONFIG.idle;

  // Auto-reset after completion (3 seconds) or on user interaction
  useEffect(() => {
    if (isComplete || isError) {
      const timer = setTimeout(() => {
        onReset();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isComplete, isError, onReset]);

  // Reset on user interaction when complete
  const handleInteraction = useCallback(() => {
    if (isComplete || isError) {
      onReset();
    }
  }, [isComplete, isError, onReset]);

  // Handle start button click
  const handleStart = useCallback(() => {
    onStart({
      targetSavedCount: targetCount,
      maxIterations: 3, // Fixed at 3 per reducer constraint
    });
  }, [onStart, targetCount]);

  // Handle target selection
  const handleTargetSelect = useCallback((count: number) => {
    setTargetCount(count);
    setIsPickerOpen(false);
  }, []);

  // Render idle state (target picker + start button)
  if (!isRunning && !isComplete && !isError) {
    return (
      <div className="flex items-center gap-2">
        {/* Target Picker Dropdown */}
        <div className="relative">
          <button
            onClick={() => !disabled && setIsPickerOpen(!isPickerOpen)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-2 py-1 radius-sm border transition-colors
                       bg-slate-900/50 border-slate-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-600'}`}
            data-testid="autoplay-target-picker-btn"
          >
            <Target size={12} className="text-slate-400" />
            <span className="font-mono type-label text-slate-300">
              {targetCount}
            </span>
            <ChevronDown
              size={10}
              className={`text-slate-500 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {isPickerOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsPickerOpen(false)}
                />

                {/* Menu */}
                <motion.div
                  variants={scaleIn}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transitions.fast}
                  className="absolute bottom-full left-0 mb-1 p-1 bg-slate-900/95 border border-slate-700 radius-md shadow-elevated min-w-[120px] z-40"
                  data-testid="autoplay-target-dropdown"
                >
                  <div className="px-2 py-1 mb-1 border-b border-slate-800">
                    <span className="font-mono type-label text-slate-500 uppercase">Target Images</span>
                  </div>

                  {TARGET_OPTIONS.map((count) => {
                    const isActive = count === targetCount;
                    return (
                      <button
                        key={count}
                        onClick={() => handleTargetSelect(count)}
                        className={`w-full px-2 py-1.5 radius-sm flex items-center justify-between transition-colors
                                   ${isActive ? 'bg-cyan-500/10' : 'hover:bg-slate-800'}`}
                        data-testid={`autoplay-target-option-${count}`}
                      >
                        <span className={`font-mono type-body-sm ${isActive ? 'text-cyan-400' : 'text-slate-300'}`}>
                          {count} {count === 1 ? 'image' : 'images'}
                        </span>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!canStart || disabled}
          className={`flex items-center gap-1.5 px-3 py-1 radius-sm border transition-colors
                     ${!canStart || disabled
                       ? 'bg-slate-900/50 border-slate-700 text-slate-600 cursor-not-allowed opacity-50'
                       : `${semanticColors.primary.bg} ${semanticColors.primary.border} ${semanticColors.primary.text} hover:brightness-125`
                     }`}
          data-testid="autoplay-start-btn"
        >
          <Play size={12} />
          <span className="font-mono type-label uppercase">Auto</span>
        </button>
      </div>
    );
  }

  // Render running state (progress + stop button)
  if (isRunning) {
    return (
      <div
        className="flex items-center gap-2"
        onClick={handleInteraction}
        role="status"
        aria-live="polite"
      >
        {/* Progress Indicator */}
        <div
          className={`flex items-center gap-2 px-2 py-1 radius-sm border ${phaseConfig.color.bg} ${phaseConfig.color.border}`}
        >
          <Loader2 size={12} className={`animate-spin ${phaseConfig.color.text}`} />
          <span className={`font-mono type-label ${phaseConfig.color.text}`}>
            {phaseConfig.label}
          </span>
          <span className="font-mono type-label text-slate-500">
            {currentIteration}/{maxIterations}
          </span>
          {totalSaved > 0 && (
            <span className={`font-mono type-label ${semanticColors.success.text}`}>
              ({totalSaved}/{targetSaved})
            </span>
          )}
        </div>

        {/* Stop Button */}
        <button
          onClick={onStop}
          className={`flex items-center gap-1.5 px-2 py-1 radius-sm border transition-colors
                     ${semanticColors.error.bg} ${semanticColors.error.border} ${semanticColors.error.text} hover:brightness-125`}
          data-testid="autoplay-stop-btn"
          aria-label="Stop autoplay"
        >
          <Square size={12} />
          <span className="font-mono type-label uppercase">Stop</span>
        </button>
      </div>
    );
  }

  // Render completion state (summary with auto-reset)
  if (isComplete || isError) {
    return (
      <div
        className={`flex items-center gap-2 px-2 py-1 radius-sm border cursor-pointer transition-colors
                   ${isError ? `${semanticColors.error.bg} ${semanticColors.error.border}` : `${semanticColors.success.bg} ${semanticColors.success.border}`}
                   hover:brightness-110`}
        onClick={handleInteraction}
        role="status"
        aria-live="polite"
        data-testid="autoplay-completion-summary"
      >
        {isError ? (
          <>
            <span className={`font-mono type-label ${semanticColors.error.text}`}>
              Error: {error || 'Unknown error'}
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 size={12} className={semanticColors.success.text} />
            <span className={`font-mono type-label ${semanticColors.success.text}`}>
              Saved {totalSaved}/{targetSaved}
            </span>
            {completionReason && (
              <span className="font-mono type-label text-slate-500">
                ({completionReason})
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  // Fallback (should not reach here)
  return null;
}

export default AutoplayControls;
