/**
 * ActivityProgressCenter - Central progress display with phase timeline
 *
 * Features:
 * - Horizontal phase timeline with larger animated nodes
 * - Animated ring pulses on active phase
 * - Phase-specific accent colors (sketch=blue, gameplay=cyan/purple, poster=rose, hud=amber)
 * - Percentage inside active node
 * - Heartbeat indicator during AI processing
 * - Compact progress counters
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
  Activity,
} from 'lucide-react';
import { AutoplayPhase, PhaseProgress, GeneratedPrompt, GeneratedImage } from '../../types';

export interface ActivityProgressCenterProps {
  currentPhase: AutoplayPhase;
  sketchProgress: PhaseProgress;
  gameplayProgress: PhaseProgress;
  posterSelected: boolean;
  hudGenerated: number;
  error?: string;
  hudTarget: number;
  currentIteration?: number;
  maxIterations?: number;
  /** Current prompts being generated for (live preview) */
  activePrompts?: GeneratedPrompt[];
  /** Current image generation statuses */
  activeImages?: GeneratedImage[];
}

interface PhaseConfig {
  id: AutoplayPhase;
  label: string;
  icon: React.ReactNode;
  isEnabled: boolean;
  progress?: { current: number; target: number };
}

/** Phase-specific accent colors for visual distinction */
const phaseAccents: Record<string, { gradient: string; ring: string; text: string; glow: string }> = {
  sketch:   { gradient: 'from-blue-400 to-cyan-500',    ring: 'ring-blue-400/40',   text: 'text-blue-400',   glow: 'rgba(59,130,246,0.3)' },
  gameplay: { gradient: 'from-cyan-500 to-purple-500',  ring: 'ring-purple-400/40',  text: 'text-purple-400', glow: 'rgba(168,85,247,0.3)' },
  poster:   { gradient: 'from-rose-400 to-pink-500',    ring: 'ring-rose-400/40',    text: 'text-rose-400',   glow: 'rgba(251,113,133,0.3)' },
  hud:      { gradient: 'from-amber-400 to-orange-500', ring: 'ring-amber-400/40',   text: 'text-amber-400',  glow: 'rgba(251,191,36,0.3)' },
};

function getPhaseAccent(phase: AutoplayPhase) {
  return phaseAccents[phase] || phaseAccents.gameplay;
}

/**
 * Phase Timeline Bar - Larger nodes with animated ring pulses and phase colors
 */
function PhaseTimeline({
  phases,
  currentPhase,
}: {
  phases: PhaseConfig[];
  currentPhase: AutoplayPhase;
}) {
  const enabledPhases = phases.filter(p => p.isEnabled);
  const currentIndex = enabledPhases.findIndex(p => p.id === currentPhase);
  const isComplete = currentPhase === 'complete';
  const isError = currentPhase === 'error';
  const accent = getPhaseAccent(currentPhase);

  return (
    <div className="w-full px-4">
      <div className="flex items-center justify-between relative">
        {/* Connecting line (background) */}
        <div className="absolute left-[16px] right-[16px] top-1/2 h-[2px] bg-slate-800/80 -translate-y-1/2 z-0 rounded-full" />

        {/* Progress line (filled) */}
        {currentIndex >= 0 && (
          <motion.div
            className={`absolute left-[16px] top-1/2 h-[2px] -translate-y-1/2 z-0 rounded-full ${
              isComplete ? 'bg-green-500' : isError ? 'bg-red-500' : `bg-gradient-to-r ${accent.gradient}`
            }`}
            initial={{ width: 0 }}
            animate={{
              width: isComplete
                ? 'calc(100% - 32px)'
                : `${((currentIndex + 0.5) / enabledPhases.length) * 100}%`
            }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          />
        )}

        {/* Phase nodes */}
        {enabledPhases.map((phase, index) => {
          const isPast = index < currentIndex || isComplete;
          const isCurrent = phase.id === currentPhase;
          const nodeAccent = getPhaseAccent(phase.id);
          const pct = phase.progress && phase.progress.target > 0
            ? Math.round((phase.progress.current / phase.progress.target) * 100)
            : 0;

          return (
            <div
              key={phase.id}
              className="relative z-10 flex flex-col items-center"
              style={{ width: `${100 / enabledPhases.length}%` }}
            >
              {/* Pulse ring (active phase only) */}
              {isCurrent && !isError && !isComplete && (
                <motion.div
                  className={`absolute w-10 h-10 rounded-full ${nodeAccent.ring} ring-2`}
                  style={{ top: '-4px' }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Node circle - 32px */}
              <motion.div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 relative ${
                  isPast
                    ? 'bg-green-500 text-white shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                    : isCurrent
                      ? isError
                        ? 'bg-red-500 text-white ring-2 ring-red-400/50 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                        : `bg-gradient-to-br ${nodeAccent.gradient} text-white ring-2 ${nodeAccent.ring}`
                      : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                }`}
                style={isCurrent && !isError ? { boxShadow: `0 0 16px ${nodeAccent.glow}` } : undefined}
                layout
              >
                {isPast ? (
                  <CheckCircle size={14} />
                ) : isCurrent && !isError ? (
                  // Show percentage for phases with progress, spinner otherwise
                  phase.progress && phase.progress.target > 0 && pct > 0 ? (
                    <span className="text-[9px] font-bold font-mono">{pct}%</span>
                  ) : (
                    <Loader2 size={14} className="animate-spin" />
                  )
                ) : isError && isCurrent ? (
                  <AlertCircle size={14} />
                ) : (
                  React.cloneElement(phase.icon as React.ReactElement<{ size?: number }>, { size: 12 })
                )}
              </motion.div>

              {/* Label */}
              <span
                className={`mt-1.5 text-[9px] font-medium uppercase tracking-wide ${
                  isPast
                    ? 'text-green-400'
                    : isCurrent
                      ? isError ? 'text-red-400' : nodeAccent.text
                      : 'text-slate-600'
                }`}
              >
                {phase.label}
              </span>

              {/* Progress counter under current phase */}
              {isCurrent && phase.progress && phase.progress.target > 0 && (
                <span className={`text-[10px] font-mono ${nodeAccent.text}`}>
                  {phase.progress.current}/{phase.progress.target}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact stat display
 */
function StatBadge({
  label,
  value,
  icon,
  color = 'cyan',
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'cyan' | 'purple' | 'green' | 'amber' | 'rose';
}) {
  const colors = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${colors[color]}`}>
      {icon}
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-xs font-mono">{value}</span>
    </div>
  );
}

/**
 * Prompt Preview - shows current prompts being generated with image status
 */
function PromptPreview({
  prompts,
  images,
  phase,
}: {
  prompts: GeneratedPrompt[];
  images: GeneratedImage[];
  phase: AutoplayPhase;
}) {
  if (prompts.length === 0) return null;

  const accent = getPhaseAccent(phase);

  return (
    <div className="space-y-1">
      <span className="text-[9px] text-slate-600 uppercase tracking-wider font-medium">Current Prompts</span>
      <div className="space-y-0.5">
        {prompts.slice(0, 4).map((prompt) => {
          const image = images.find(img => img.promptId === prompt.id);
          const status = image?.status || 'pending';

          return (
            <div
              key={prompt.id}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-black/30 border border-slate-800/40 group"
              title={prompt.prompt}
            >
              {/* Status indicator */}
              <div className="shrink-0">
                {status === 'complete' ? (
                  <CheckCircle size={10} className="text-green-400" />
                ) : status === 'generating' ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 size={10} className={accent.text} />
                  </motion.div>
                ) : status === 'failed' ? (
                  <AlertCircle size={10} className="text-red-400" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-600" />
                )}
              </div>

              {/* Truncated prompt text */}
              <span className={`text-[10px] leading-tight truncate flex-1 ${
                status === 'complete' ? 'text-slate-400' :
                status === 'generating' ? accent.text :
                status === 'failed' ? 'text-red-400/60' :
                'text-slate-500'
              }`}>
                {prompt.prompt.length > 80 ? prompt.prompt.slice(0, 80) + '...' : prompt.prompt}
              </span>

              {/* Scene type badge */}
              <span className="text-[8px] text-slate-600 font-mono shrink-0 uppercase">
                {prompt.sceneType?.slice(0, 6) || ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Heartbeat indicator - shows AI is actively working
 */
function HeartbeatIndicator({ phase }: { phase: AutoplayPhase }) {
  const isActive = phase !== 'idle' && phase !== 'complete' && phase !== 'error';
  if (!isActive) return null;

  const accent = getPhaseAccent(phase);

  return (
    <div className="flex items-center gap-1.5">
      <motion.div
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Activity size={10} className={accent.text} />
      </motion.div>
      <span className={`text-[9px] ${accent.text} font-medium`}>Processing</span>
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
  activePrompts = [],
  activeImages = [],
}: ActivityProgressCenterProps) {
  const posterPhaseActive = currentPhase === 'poster' || posterSelected;
  const accent = getPhaseAccent(currentPhase);

  const phases: PhaseConfig[] = [
    {
      id: 'sketch',
      label: 'Sketch',
      icon: <Image size={12} />,
      isEnabled: sketchProgress.target > 0,
      progress: { current: sketchProgress.saved, target: sketchProgress.target },
    },
    {
      id: 'gameplay',
      label: 'Gameplay',
      icon: <Gamepad2 size={12} />,
      isEnabled: gameplayProgress.target > 0,
      progress: { current: gameplayProgress.saved, target: gameplayProgress.target },
    },
    {
      id: 'poster',
      label: 'Poster',
      icon: <Frame size={12} />,
      isEnabled: posterPhaseActive,
      progress: posterSelected ? { current: 1, target: 1 } : { current: 0, target: 1 },
    },
    {
      id: 'hud',
      label: 'HUD',
      icon: <Layers size={12} />,
      isEnabled: hudTarget > 0,
      progress: { current: hudGenerated, target: hudTarget },
    },
  ];

  const totalSaved = sketchProgress.saved + gameplayProgress.saved;
  const totalTarget = sketchProgress.target + gameplayProgress.target;
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Phase Timeline */}
      <PhaseTimeline phases={phases} currentPhase={currentPhase} />

      {/* Error display */}
      {error && (
        <div className="px-2 py-1.5 rounded border border-red-500/30 bg-red-500/10">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={10} className="text-red-400 shrink-0" />
            <p className="text-[10px] text-red-300 leading-tight">{error}</p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <StatBadge
          label="Total"
          value={`${totalSaved}/${totalTarget}`}
          icon={<CheckCircle size={10} />}
          color="cyan"
        />
        {currentIteration !== undefined && currentIteration > 0 && (
          <StatBadge
            label="Iter"
            value={maxIterations ? `${currentIteration}/${maxIterations}` : currentIteration}
            icon={<Loader2 size={10} />}
            color="purple"
          />
        )}
      </div>

      {/* Live prompt preview */}
      {activePrompts.length > 0 && currentPhase !== 'complete' && currentPhase !== 'error' && (
        <PromptPreview prompts={activePrompts} images={activeImages} phase={currentPhase} />
      )}

      {/* Overall progress bar + heartbeat */}
      {totalTarget > 0 && (
        <div className="mt-auto space-y-1.5">
          <div className="flex items-center justify-between">
            <HeartbeatIndicator phase={currentPhase} />
            <span className={`text-[11px] font-mono font-bold ${
              currentPhase === 'complete' ? 'text-green-400' :
              currentPhase === 'error' ? 'text-red-400' :
              accent.text
            }`}>
              {overallPct}%
            </span>
          </div>
          <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                currentPhase === 'complete'
                  ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                  : currentPhase === 'error'
                    ? 'bg-red-500'
                    : `bg-gradient-to-r ${accent.gradient} shadow-[0_0_8px_${accent.glow}]`
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, overallPct)}%` }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityProgressCenter;
