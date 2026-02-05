/**
 * ActivityProgressCenter - Central progress display for autoplay activity
 *
 * Shows:
 * - Current phase indicator
 * - Phase progress bars (concept X/Y, gameplay X/Y)
 * - Current iteration number
 * - Total saved count
 * - Error messages if any
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Image,
  Gamepad2,
  Frame,
  Layers,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { AutoplayPhase, PhaseProgress } from '../../types';
import { semanticColors } from '../../lib/semanticColors';

export interface ActivityProgressCenterProps {
  currentPhase: AutoplayPhase;
  sketchProgress: PhaseProgress;
  gameplayProgress: PhaseProgress;
  posterSelected: boolean;
  hudGenerated: number;
  error?: string;
  /** Target number of HUDs (equal to gameplay count if HUD enabled) */
  hudTarget: number;
  /** Current iteration number (1-based) */
  currentIteration?: number;
  /** Total iterations configured */
  maxIterations?: number;
}

/**
 * Get display info for a phase
 */
function getPhaseInfo(phase: AutoplayPhase): {
  label: string;
  icon: React.ReactNode;
  color: string;
} {
  switch (phase) {
    case 'sketch':
      return {
        label: 'Sketch Art',
        icon: <Image size={16} />,
        color: semanticColors.primary.text,
      };
    case 'gameplay':
      return {
        label: 'Gameplay',
        icon: <Gamepad2 size={16} />,
        color: semanticColors.processing.text,
      };
    case 'poster':
      return {
        label: 'Poster Selection',
        icon: <Frame size={16} />,
        color: semanticColors.warning.text,
      };
    case 'hud':
      return {
        label: 'HUD Generation',
        icon: <Layers size={16} />,
        color: semanticColors.success.text,
      };
    case 'complete':
      return {
        label: 'Complete',
        icon: <CheckCircle size={16} />,
        color: semanticColors.success.text,
      };
    case 'error':
      return {
        label: 'Error',
        icon: <AlertCircle size={16} />,
        color: semanticColors.error.text,
      };
    default:
      return {
        label: 'Idle',
        icon: <Loader2 size={16} />,
        color: 'text-slate-400',
      };
  }
}

/**
 * Progress bar component
 */
function ProgressBar({
  label,
  icon,
  progress,
  isActive,
  isComplete,
}: {
  label: string;
  icon: React.ReactNode;
  progress: PhaseProgress;
  isActive: boolean;
  isComplete: boolean;
}) {
  const percentage = progress.target > 0
    ? Math.min(100, (progress.saved / progress.target) * 100)
    : 0;

  return (
    <div className={`p-3 radius-md border transition-colors ${
      isActive
        ? `${semanticColors.primary.border} ${semanticColors.primary.bg}`
        : isComplete
          ? `${semanticColors.success.border} ${semanticColors.success.bg}`
          : 'border-slate-800 bg-slate-900/50'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 ${isActive ? semanticColors.primary.text : isComplete ? semanticColors.success.text : 'text-slate-400'}`}>
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="font-mono text-sm text-slate-300">
          {progress.saved}/{progress.target}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-800 radius-sm overflow-hidden">
        <motion.div
          className={`h-full ${
            isComplete
              ? 'bg-green-500'
              : isActive
                ? 'bg-cyan-500'
                : 'bg-slate-600'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

/**
 * Status indicator for optional phases
 */
function StatusIndicator({
  label,
  icon,
  isActive,
  isComplete,
  isSkipped,
}: {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  isComplete: boolean;
  isSkipped: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 p-2 radius-sm border ${
      isComplete
        ? `${semanticColors.success.border} ${semanticColors.success.bg}`
        : isActive
          ? `${semanticColors.processing.border} ${semanticColors.processing.bg}`
          : isSkipped
            ? 'border-slate-800/50 bg-slate-900/30 opacity-50'
            : 'border-slate-800 bg-slate-900/50'
    }`}>
      <span className={
        isComplete
          ? semanticColors.success.text
          : isActive
            ? semanticColors.processing.text
            : 'text-slate-500'
      }>
        {isComplete ? <CheckCircle size={14} /> : isActive ? <Loader2 size={14} className="animate-spin" /> : icon}
      </span>
      <span className={`text-xs ${
        isComplete
          ? 'text-green-300'
          : isActive
            ? 'text-purple-300'
            : 'text-slate-500'
      }`}>
        {label}
      </span>
    </div>
  );
}

export function ActivityProgressCenter({
  currentPhase,
  sketchProgress,
  gameplayProgress,
  posterSelected,
  hudGenerated,
  error,
  hudTarget,
  currentIteration,
  maxIterations,
}: ActivityProgressCenterProps) {
  const phaseInfo = getPhaseInfo(currentPhase);

  const totalSaved = sketchProgress.saved + gameplayProgress.saved;
  const totalTarget = sketchProgress.target + gameplayProgress.target;

  // Determine phase states
  const sketchComplete = sketchProgress.saved >= sketchProgress.target && sketchProgress.target > 0;
  const gameplayComplete = gameplayProgress.saved >= gameplayProgress.target && gameplayProgress.target > 0;

  return (
    <div className="flex flex-col h-full p-4">
      {/* Current Phase Header */}
      <div className="text-center mb-6">
        <div className={`inline-flex items-center gap-2 px-4 py-2 radius-md border ${
          currentPhase === 'error'
            ? `${semanticColors.error.border} ${semanticColors.error.bg}`
            : currentPhase === 'complete'
              ? `${semanticColors.success.border} ${semanticColors.success.bg}`
              : `${semanticColors.processing.border} ${semanticColors.processing.bg}`
        }`}>
          <span className={phaseInfo.color}>{phaseInfo.icon}</span>
          <span className={`font-medium ${
            currentPhase === 'error'
              ? 'text-red-300'
              : currentPhase === 'complete'
                ? 'text-green-300'
                : 'text-purple-300'
          }`}>
            {phaseInfo.label}
          </span>
        </div>

        {/* Iteration Counter */}
        {currentIteration !== undefined && currentIteration > 0 && (
          <div className="mt-2">
            <span className="font-mono text-sm text-cyan-400">
              Iteration {currentIteration}
              {maxIterations !== undefined && maxIterations > 0 && (
                <span className="text-slate-500"> of {maxIterations}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className={`mb-4 p-3 radius-md border ${semanticColors.error.border} ${semanticColors.error.bg}`}>
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className={semanticColors.error.text} />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Progress Bars */}
      <div className="space-y-3 flex-1">
        {sketchProgress.target > 0 && (
          <ProgressBar
            label="Sketch Images"
            icon={<Image size={14} />}
            progress={sketchProgress}
            isActive={currentPhase === 'sketch'}
            isComplete={sketchComplete}
          />
        )}

        {gameplayProgress.target > 0 && (
          <ProgressBar
            label="Gameplay Images"
            icon={<Gamepad2 size={14} />}
            progress={gameplayProgress}
            isActive={currentPhase === 'gameplay'}
            isComplete={gameplayComplete}
          />
        )}

        {/* Optional phases status */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <StatusIndicator
            label="Poster"
            icon={<Frame size={14} />}
            isActive={currentPhase === 'poster'}
            isComplete={posterSelected}
            isSkipped={currentPhase === 'complete' && !posterSelected && sketchComplete && gameplayComplete}
          />
          <StatusIndicator
            label={`HUD (${hudGenerated}/${hudTarget})`}
            icon={<Layers size={14} />}
            isActive={currentPhase === 'hud'}
            isComplete={hudTarget > 0 && hudGenerated >= hudTarget}
            isSkipped={hudTarget === 0}
          />
        </div>
      </div>

      {/* Total Progress Summary */}
      <div className={`mt-4 p-4 radius-md border ${semanticColors.primary.border} ${semanticColors.primary.bg}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Total Images Saved:</span>
          <span className={`font-mono text-xl ${semanticColors.primary.text}`}>
            {totalSaved}/{totalTarget}
          </span>
        </div>
        {totalTarget > 0 && (
          <div className="h-1.5 bg-slate-800 radius-sm overflow-hidden mt-2">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (totalSaved / totalTarget) * 100)}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityProgressCenter;
