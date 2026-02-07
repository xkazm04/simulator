/**
 * AutoplaySetupModal - Configuration and activity modal for multi-phase autoplay
 *
 * Two modes:
 * 1. Setup Mode (default): Configuration form for setting up autoplay
 * 2. Activity Mode: Real-time activity monitor showing logs and progress
 *
 * Provides user interface for configuring:
 * - Prompt idea (REQUIRED if no content exists - triggers Smart Breakdown)
 * - Concept image count (1-4)
 * - Gameplay image count (1-4)
 * - Poster generation toggle
 * - HUD overlay toggle (enabled when gameplay > 0)
 * - Max iterations per image
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Image,
  Gamepad2,
  Frame,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Lightbulb,
  Loader2,
  AlertCircle,
  Square,
  RotateCcw,
  Wand2,
  Zap,
  Settings2,
  Crown,
  CheckCircle,
} from 'lucide-react';
import {
  ExtendedAutoplayConfig,
  AutoplayPhase,
  PhaseProgress,
  AutoplayLogEntry,
  GeneratedPrompt,
  GeneratedImage,
  DEFAULT_POLISH_CONFIG,
} from '../../types';
import { fadeIn, modalContent, transitions } from '../../lib/motion';
import { ActivityLogSidebar } from './ActivityLogSidebar';
import { ActivityProgressCenter } from './ActivityProgressCenter';

export type AutoplayModalMode = 'setup' | 'activity';

export interface AutoplaySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: ExtendedAutoplayConfig) => void;
  /** Whether we have content ready (baseImage or prompts) */
  hasContent: boolean;
  /** Callback to trigger Smart Breakdown with the prompt idea */
  onSmartBreakdown?: (visionSentence: string) => Promise<boolean>;
  canStart: boolean;
  canStartReason: string | null;
  isRunning: boolean;

  // Activity mode props (optional - only needed when mode='activity')
  mode?: AutoplayModalMode;
  currentPhase?: AutoplayPhase;
  sketchProgress?: PhaseProgress;
  gameplayProgress?: PhaseProgress;
  posterSelected?: boolean;
  hudGenerated?: number;
  hudTarget?: number;
  error?: string;
  textEvents?: AutoplayLogEntry[];
  imageEvents?: AutoplayLogEntry[];
  onStop?: () => void;
  onReset?: () => void;
  /** Retry from the errored phase, preserving progress */
  onRetry?: () => void;
  /** Which phase errored (for retry display) */
  errorPhase?: string;

  // Iteration tracking (optional)
  /** Current iteration number (1-based) */
  currentIteration?: number;
  /** Max iterations configured */
  maxIterations?: number;

  // Live preview props (optional)
  /** Current prompts being worked on */
  activePrompts?: GeneratedPrompt[];
  /** Current image generation statuses */
  activeImages?: GeneratedImage[];
}

const DEFAULT_CONFIG: ExtendedAutoplayConfig = {
  sketchCount: 2,
  gameplayCount: 2,
  posterEnabled: false,
  hudEnabled: false,
  maxIterationsPerImage: 2,
  promptIdea: '',
  polish: {
    rescueEnabled: DEFAULT_POLISH_CONFIG.rescueEnabled,
    rescueFloor: DEFAULT_POLISH_CONFIG.rescueFloor,
  },
};

// ============================================================================
// PRESETS
// ============================================================================

const STORAGE_KEY = 'simulator-autoplay-last-config';

interface AutoplayPreset {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  config: Omit<ExtendedAutoplayConfig, 'promptIdea'>;
}

const AUTOPLAY_PRESETS: AutoplayPreset[] = [
  {
    id: 'quick',
    label: 'Quick',
    description: '2 gameplay, fast results',
    icon: <Zap size={12} />,
    config: {
      sketchCount: 0,
      gameplayCount: 2,
      posterEnabled: false,
      hudEnabled: false,
      maxIterationsPerImage: 2,
      polish: { rescueEnabled: true, rescueFloor: DEFAULT_POLISH_CONFIG.rescueFloor },
    },
  },
  {
    id: 'standard',
    label: 'Standard',
    description: '2 sketch + 3 gameplay + poster',
    icon: <Settings2 size={12} />,
    config: {
      sketchCount: 2,
      gameplayCount: 3,
      posterEnabled: true,
      hudEnabled: false,
      maxIterationsPerImage: 2,
      polish: { rescueEnabled: true, rescueFloor: DEFAULT_POLISH_CONFIG.rescueFloor },
    },
  },
  {
    id: 'full',
    label: 'Full Suite',
    description: 'Everything enabled',
    icon: <Crown size={12} />,
    config: {
      sketchCount: 2,
      gameplayCount: 4,
      posterEnabled: true,
      hudEnabled: true,
      maxIterationsPerImage: 3,
      polish: { rescueEnabled: true, rescueFloor: DEFAULT_POLISH_CONFIG.rescueFloor },
    },
  },
];

function loadSavedConfig(): ExtendedAutoplayConfig | null {
  try {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    // Validate shape
    if (typeof parsed.sketchCount === 'number' && typeof parsed.gameplayCount === 'number') {
      return { ...DEFAULT_CONFIG, ...parsed, promptIdea: '' };
    }
    return null;
  } catch {
    return null;
  }
}

function saveConfigToStorage(config: ExtendedAutoplayConfig) {
  try {
    if (typeof window === 'undefined') return;
    // Save without promptIdea (it's session-specific)
    const { promptIdea, ...rest } = config;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    // Ignore storage errors
  }
}

function detectActivePreset(config: ExtendedAutoplayConfig): string | null {
  for (const preset of AUTOPLAY_PRESETS) {
    const p = preset.config;
    if (
      config.sketchCount === p.sketchCount &&
      config.gameplayCount === p.gameplayCount &&
      config.posterEnabled === p.posterEnabled &&
      config.hudEnabled === p.hudEnabled &&
      config.maxIterationsPerImage === p.maxIterationsPerImage
    ) {
      return preset.id;
    }
  }
  return null;
}

interface CounterProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
  icon: React.ReactNode;
  description: string;
}

function Counter({ value, min, max, onChange, disabled, label, icon, description }: CounterProps) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 bg-black/30 border border-slate-800/60 rounded">
      <div className="flex items-center gap-2">
        <div className="p-1 rounded bg-cyan-500/10 text-cyan-400">
          {icon}
        </div>
        <div>
          <div className="text-xs font-medium text-slate-200">{label}</div>
          <div className="text-[10px] text-slate-500">{description}</div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
          className={`p-1 rounded border transition-colors
            ${disabled || value <= min
              ? 'border-slate-800 text-slate-700 cursor-not-allowed'
              : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-cyan-400'
            }`}
        >
          <ChevronLeft size={12} />
        </button>
        <span className="font-mono text-sm w-6 text-center text-cyan-400">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
          className={`p-1 rounded border transition-colors
            ${disabled || value >= max
              ? 'border-slate-800 text-slate-700 cursor-not-allowed'
              : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-cyan-400'
            }`}
        >
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  label: string;
  icon: React.ReactNode;
  description: string;
}

function Toggle({ enabled, onChange, disabled, label, icon, description }: ToggleProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`w-full flex items-center justify-between py-1.5 px-2 rounded border transition-all text-left
        ${disabled
          ? 'border-slate-800/40 bg-black/20 cursor-not-allowed opacity-40'
          : enabled
            ? 'border-purple-500/40 bg-purple-500/10'
            : 'border-slate-800/60 bg-black/30 hover:border-slate-700'
        }`}
    >
      <div className="flex items-center gap-2">
        <div className={`p-1 rounded ${enabled ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800/50 text-slate-500'}`}>
          {icon}
        </div>
        <div>
          <div className={`text-xs font-medium ${enabled ? 'text-purple-300' : 'text-slate-300'}`}>{label}</div>
          <div className="text-[10px] text-slate-500">{description}</div>
        </div>
      </div>
      <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${enabled ? 'bg-purple-500' : 'bg-slate-700'}`}>
        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}

/**
 * Preset Selector - Quick configuration buttons
 */
function PresetSelector({
  activePreset,
  onSelect,
  disabled,
}: {
  activePreset: string | null;
  onSelect: (preset: AutoplayPreset) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {AUTOPLAY_PRESETS.map((preset) => {
        const isActive = activePreset === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            disabled={disabled}
            title={preset.description}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded border text-[10px] font-medium transition-all
              ${disabled
                ? 'border-slate-800/40 text-slate-700 cursor-not-allowed'
                : isActive
                  ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.1)]'
                  : 'border-slate-800/60 bg-black/20 text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
          >
            <span className={isActive ? 'text-cyan-400' : 'text-slate-500'}>{preset.icon}</span>
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Setup Mode Content - Configuration form (compact)
 */
function SetupModeContent({
  config,
  setConfig,
  hasContent,
  hasPromptIdea,
  isRunning,
  isProcessingBreakdown,
  breakdownError,
  setBreakdownError,
  totalImages,
  hasGameplay,
  activePreset,
  onPresetSelect,
}: {
  config: ExtendedAutoplayConfig;
  setConfig: (config: ExtendedAutoplayConfig) => void;
  hasContent: boolean;
  hasPromptIdea: boolean;
  isRunning: boolean;
  isProcessingBreakdown: boolean;
  breakdownError: string | null;
  setBreakdownError: (error: string | null) => void;
  totalImages: number;
  hasGameplay: boolean;
  activePreset: string | null;
  onPresetSelect: (preset: AutoplayPreset) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* Preset Selector */}
      <PresetSelector
        activePreset={activePreset}
        onSelect={onPresetSelect}
        disabled={isRunning || isProcessingBreakdown}
      />

      {/* Prompt Idea Input */}
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          <Lightbulb size={10} className={!hasContent ? 'text-amber-400' : 'text-slate-500'} />
          Core Idea {!hasContent && <span className="text-amber-400 normal-case">(Required)</span>}
        </label>
        <textarea
          value={config.promptIdea || ''}
          onChange={(e) => {
            setConfig({ ...config, promptIdea: e.target.value });
            setBreakdownError(null);
          }}
          placeholder="e.g., 'Dark Souls meets Studio Ghibli in a cyberpunk world'"
          className={`w-full h-14 bg-black/40 border rounded p-2 text-xs placeholder-slate-600 resize-none
                    focus:outline-none focus:ring-1 transition-all
                    ${!hasContent && !hasPromptIdea
                      ? 'border-amber-500/40 focus:border-amber-500/50 focus:ring-amber-500/30'
                      : 'border-slate-800 focus:border-cyan-500/50 focus:ring-cyan-500/30'
                    }`}
          disabled={isRunning || isProcessingBreakdown}
        />
        {breakdownError && (
          <p className="text-[10px] text-red-400 flex items-center gap-1">
            <AlertCircle size={10} />
            {breakdownError}
          </p>
        )}
      </div>

      {/* Two-column layout for counts and toggles */}
      <div className="grid grid-cols-2 gap-2">
        {/* Left column: Image counts */}
        <div className="space-y-1.5">
          <h3 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Generation</h3>
          <Counter
            value={config.sketchCount}
            min={0}
            max={4}
            onChange={(v) => setConfig({ ...config, sketchCount: v })}
            disabled={isRunning}
            label="Sketches"
            icon={<Image size={12} />}
            description="Concept art"
          />
          <Counter
            value={config.gameplayCount}
            min={0}
            max={4}
            onChange={(v) => setConfig({ ...config, gameplayCount: v })}
            disabled={isRunning}
            label="Gameplay"
            icon={<Gamepad2 size={12} />}
            description="With UI"
          />
          <Counter
            value={config.maxIterationsPerImage}
            min={1}
            max={3}
            onChange={(v) => setConfig({ ...config, maxIterationsPerImage: v })}
            disabled={isRunning}
            label="Iterations"
            icon={<RefreshCw size={12} />}
            description="Per image"
          />
        </div>

        {/* Right column: Toggles */}
        <div className="space-y-1.5">
          <h3 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Options</h3>
          <Toggle
            enabled={config.polish?.rescueEnabled ?? true}
            onChange={(v) => setConfig({
              ...config,
              polish: { ...config.polish, rescueEnabled: v }
            })}
            disabled={isRunning}
            label="AI Polish"
            icon={<Wand2 size={12} />}
            description="Improve borderline images"
          />
          <Toggle
            enabled={config.posterEnabled}
            onChange={(v) => setConfig({ ...config, posterEnabled: v })}
            disabled={isRunning}
            label="Auto Poster"
            icon={<Frame size={12} />}
            description="Generate & select"
          />
          <Toggle
            enabled={config.hudEnabled && hasGameplay}
            onChange={(v) => setConfig({ ...config, hudEnabled: v })}
            disabled={isRunning || !hasGameplay}
            label="Auto HUD"
            icon={<Layers size={12} />}
            description={hasGameplay ? 'Add overlays' : 'Need gameplay'}
          />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between py-1.5 px-2 rounded border border-cyan-500/20 bg-cyan-500/5">
        <span className="text-[10px] text-slate-400">Total images:</span>
        <span className="font-mono text-sm text-cyan-400">{totalImages}</span>
      </div>
    </div>
  );
}

/**
 * Completion Summary - Shows results when autoplay finishes
 */
function CompletionSummary({
  sketchProgress,
  gameplayProgress,
  posterSelected,
  hudGenerated,
  hudTarget,
  error,
  errorPhase,
  textEvents,
  imageEvents,
  onRetry,
}: {
  sketchProgress: PhaseProgress;
  gameplayProgress: PhaseProgress;
  posterSelected: boolean;
  hudGenerated: number;
  hudTarget: number;
  error?: string;
  errorPhase?: string;
  textEvents: AutoplayLogEntry[];
  imageEvents: AutoplayLogEntry[];
  onRetry?: () => void;
}) {
  const totalSaved = sketchProgress.saved + gameplayProgress.saved;
  const totalTarget = sketchProgress.target + gameplayProgress.target;
  const totalGenerated = imageEvents.filter(e =>
    e.type === 'image_complete' || e.type === 'image_approved' || e.type === 'image_rejected'
  ).length;
  const approvedCount = imageEvents.filter(e => e.type === 'image_approved' || e.type === 'image_saved').length;
  const rejectedCount = imageEvents.filter(e => e.type === 'image_rejected').length;
  const polishCount = imageEvents.filter(e => e.type === 'image_polished').length;
  const approvalRate = totalGenerated > 0 ? Math.round((approvedCount / totalGenerated) * 100) : 0;
  const isSuccess = !error && totalSaved >= totalTarget;

  // Detect API-related errors for auto-retry
  const isApiError = error && (
    /rate.?limit/i.test(error) ||
    /timeout/i.test(error) ||
    /429/i.test(error) ||
    /503/i.test(error) ||
    /network/i.test(error)
  );

  // Auto-retry countdown for API errors
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback((seconds: number) => {
    setCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          onRetry?.();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onRetry]);

  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setCountdown(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Status banner */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${
        isSuccess
          ? 'border-green-500/30 bg-green-500/10'
          : error
            ? 'border-red-500/30 bg-red-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
      }`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isSuccess
            ? 'bg-green-500/20 text-green-400'
            : error
              ? 'bg-red-500/20 text-red-400'
              : 'bg-amber-500/20 text-amber-400'
        }`}>
          {isSuccess ? (
            <CheckCircle size={20} />
          ) : error ? (
            <AlertCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium ${
            isSuccess ? 'text-green-300' : error ? 'text-red-300' : 'text-amber-300'
          }`}>
            {isSuccess ? 'Autoplay Complete' : error ? 'Stopped with Error' : 'Partially Complete'}
          </h3>
          <p className="text-[11px] text-slate-400">
            {isSuccess
              ? `Successfully generated ${totalSaved} images`
              : error
                ? error
                : `Generated ${totalSaved}/${totalTarget} target images`
            }
          </p>
          {error && errorPhase && (
            <p className="text-[10px] text-red-400/70 mt-0.5">
              Failed during: <span className="font-mono uppercase">{errorPhase}</span> phase
              {totalSaved > 0 && ` (${totalSaved} images saved before error)`}
            </p>
          )}
        </div>
      </div>

      {/* Auto-retry for API errors */}
      {isApiError && onRetry && (
        <div className="flex items-center gap-2 p-2 rounded border border-amber-500/20 bg-amber-500/5">
          {countdown !== null ? (
            <>
              <Loader2 size={12} className="text-amber-400 animate-spin" />
              <span className="text-[11px] text-amber-300 flex-1">
                Auto-retrying in {countdown}s...
              </span>
              <button
                onClick={cancelCountdown}
                className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <RefreshCw size={12} className="text-amber-400" />
              <span className="text-[11px] text-amber-300 flex-1">
                This looks like a temporary API error.
              </span>
              <button
                onClick={() => startCountdown(10)}
                className="text-[10px] text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 hover:bg-amber-500/10 transition-colors"
              >
                Auto-retry (10s)
              </button>
            </>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Images Saved" value={totalSaved} total={totalTarget} color="cyan" />
        <StatCard label="Approval Rate" value={`${approvalRate}%`} color={approvalRate >= 70 ? 'green' : approvalRate >= 40 ? 'amber' : 'red'} />
        {sketchProgress.target > 0 && (
          <StatCard label="Sketches" value={sketchProgress.saved} total={sketchProgress.target} color="blue" />
        )}
        {gameplayProgress.target > 0 && (
          <StatCard label="Gameplay" value={gameplayProgress.saved} total={gameplayProgress.target} color="purple" />
        )}
        {polishCount > 0 && (
          <StatCard label="Polished" value={polishCount} color="amber" />
        )}
        {rejectedCount > 0 && (
          <StatCard label="Rejected" value={rejectedCount} color="red" />
        )}
      </div>

      {/* Phases completed */}
      <div className="flex items-center gap-2 text-[11px]">
        {sketchProgress.target > 0 && (
          <span className={`px-2 py-0.5 rounded border ${
            sketchProgress.saved >= sketchProgress.target
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-slate-700 text-slate-500'
          }`}>
            Sketch {sketchProgress.saved >= sketchProgress.target ? '\u2713' : `${sketchProgress.saved}/${sketchProgress.target}`}
          </span>
        )}
        {gameplayProgress.target > 0 && (
          <span className={`px-2 py-0.5 rounded border ${
            gameplayProgress.saved >= gameplayProgress.target
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-slate-700 text-slate-500'
          }`}>
            Gameplay {gameplayProgress.saved >= gameplayProgress.target ? '\u2713' : `${gameplayProgress.saved}/${gameplayProgress.target}`}
          </span>
        )}
        {posterSelected && (
          <span className="px-2 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-400">
            Poster {'\u2713'}
          </span>
        )}
        {hudTarget > 0 && (
          <span className={`px-2 py-0.5 rounded border ${
            hudGenerated >= hudTarget
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-slate-700 text-slate-500'
          }`}>
            HUD {hudGenerated >= hudTarget ? '\u2713' : `${hudGenerated}/${hudTarget}`}
          </span>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: string | number;
  total?: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    cyan: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5',
    green: 'text-green-400 border-green-500/20 bg-green-500/5',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    red: 'text-red-400 border-red-500/20 bg-red-500/5',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/5',
    blue: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
  };

  return (
    <div className={`px-3 py-2 rounded border ${colorMap[color] || colorMap.cyan}`}>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-mono font-bold mt-0.5">
        {value}{total !== undefined && <span className="text-xs text-slate-600">/{total}</span>}
      </div>
    </div>
  );
}

/**
 * Activity Mode Content - Real-time monitoring (compact layout)
 */
function ActivityModeContent({
  currentPhase,
  sketchProgress,
  gameplayProgress,
  posterSelected,
  hudGenerated,
  hudTarget,
  error,
  textEvents,
  imageEvents,
  currentIteration,
  maxIterations,
  activePrompts,
  activeImages,
}: {
  currentPhase: AutoplayPhase;
  sketchProgress: PhaseProgress;
  gameplayProgress: PhaseProgress;
  posterSelected: boolean;
  hudGenerated: number;
  hudTarget: number;
  error?: string;
  textEvents: AutoplayLogEntry[];
  imageEvents: AutoplayLogEntry[];
  currentIteration?: number;
  maxIterations?: number;
  activePrompts?: GeneratedPrompt[];
  activeImages?: GeneratedImage[];
}) {
  return (
    <div className="flex-1 flex min-h-0">
      {/* Left Sidebar - Text Events */}
      <div className="w-[160px] shrink-0">
        <ActivityLogSidebar
          title="Text"
          events={textEvents}
          side="left"
          emptyMessage="Changes here"
        />
      </div>

      {/* Center - Progress Timeline */}
      <div className="flex-1 border-x border-slate-800/50 min-w-[200px]">
        <ActivityProgressCenter
          currentPhase={currentPhase}
          sketchProgress={sketchProgress}
          gameplayProgress={gameplayProgress}
          posterSelected={posterSelected}
          hudGenerated={hudGenerated}
          hudTarget={hudTarget}
          error={error}
          currentIteration={currentIteration}
          maxIterations={maxIterations}
          activePrompts={activePrompts}
          activeImages={activeImages}
        />
      </div>

      {/* Right Sidebar - Image Events */}
      <div className="w-[160px] shrink-0">
        <ActivityLogSidebar
          title="Images"
          events={imageEvents}
          side="right"
          emptyMessage="Events here"
        />
      </div>
    </div>
  );
}

export function AutoplaySetupModal({
  isOpen,
  onClose,
  onStart,
  hasContent,
  onSmartBreakdown,
  canStart,
  canStartReason,
  isRunning,
  // Activity mode props
  mode = 'setup',
  currentPhase = 'idle',
  sketchProgress = { saved: 0, target: 0 },
  gameplayProgress = { saved: 0, target: 0 },
  posterSelected = false,
  hudGenerated = 0,
  hudTarget = 0,
  error,
  textEvents = [],
  imageEvents = [],
  onStop,
  onReset,
  onRetry,
  errorPhase,
  // Iteration tracking
  currentIteration,
  maxIterations,
  // Live preview
  activePrompts,
  activeImages,
}: AutoplaySetupModalProps) {
  const [config, setConfig] = useState<ExtendedAutoplayConfig>(() => loadSavedConfig() || DEFAULT_CONFIG);
  const [isProcessingBreakdown, setIsProcessingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  // Local state to track if we just started (forces activity mode)
  const [justStarted, setJustStarted] = useState(false);

  const totalImages = config.sketchCount + config.gameplayCount;
  const hasGameplay = config.gameplayCount > 0;
  const activePreset = detectActivePreset(config);

  // Validation: need either existing content OR a prompt idea
  const hasPromptIdea = Boolean(config.promptIdea?.trim());
  const canProceed = hasContent || hasPromptIdea;

  // Apply a preset (preserves promptIdea)
  const handlePresetSelect = useCallback((preset: AutoplayPreset) => {
    setConfig(prev => ({ ...preset.config, promptIdea: prev.promptIdea }));
  }, []);

  // Determine effective mode - switch to activity when running OR just started
  const effectiveMode: AutoplayModalMode = (isRunning || justStarted) ? 'activity' : mode;

  // Reset justStarted when modal is closed (isOpen becomes false)
  // This ensures fresh state when modal is reopened
  useEffect(() => {
    if (!isOpen) {
      setJustStarted(false);
    }
  }, [isOpen]);

  const handleStart = useCallback(async () => {
    setBreakdownError(null);

    // If no content exists but we have a prompt idea, trigger Smart Breakdown first
    if (!hasContent && hasPromptIdea && onSmartBreakdown) {
      setIsProcessingBreakdown(true);
      try {
        const success = await onSmartBreakdown(config.promptIdea!.trim());
        if (!success) {
          setBreakdownError('Smart Breakdown failed. Please try a different idea or add content manually.');
          setIsProcessingBreakdown(false);
          return;
        }
      } catch (err) {
        console.error('[AutoplayModal] Smart Breakdown error:', err);
        setBreakdownError('An error occurred during Smart Breakdown.');
        setIsProcessingBreakdown(false);
        return;
      }
      setIsProcessingBreakdown(false);
    }

    // Persist config for next session
    saveConfigToStorage(config);

    // Set local flag to switch to activity mode immediately
    setJustStarted(true);

    // Start autoplay - modal stays open in activity mode
    onStart(config);
  }, [config, onStart, hasContent, hasPromptIdea, onSmartBreakdown]);

  if (!isOpen) return null;

  // Modal dimensions based on mode
  const isActivityMode = effectiveMode === 'activity';

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        {/* Backdrop */}
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
          }}
        />

        {/* Modal Content */}
        <motion.div
          variants={modalContent}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          layout
          style={{
            position: 'relative',
            width: isActivityMode ? 'min(92vw, 700px)' : 'min(90vw, 360px)',
            maxWidth: isActivityMode ? '700px' : '360px',
            height: isActivityMode ? 'min(75vh, 380px)' : 'auto',
            maxHeight: isActivityMode ? '380px' : '80vh',
            background: 'linear-gradient(180deg, #0c0c14 0%, #080810 100%)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
            borderRadius: '0.375rem',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 30px rgba(0, 0, 0, 0.5), 0 0 60px rgba(56, 189, 248, 0.05)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - with phase-colored accent */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/50 bg-black/40 shrink-0 relative overflow-hidden">
            {/* Phase-colored top edge glow */}
            {isActivityMode && currentPhase !== 'idle' && currentPhase !== 'complete' && currentPhase !== 'error' && (
              <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${
                currentPhase === 'sketch' ? 'from-blue-400 to-cyan-500' :
                currentPhase === 'poster' ? 'from-rose-400 to-pink-500' :
                currentPhase === 'hud' ? 'from-amber-400 to-orange-500' :
                'from-cyan-500 to-purple-500'
              }`} />
            )}
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isActivityMode ? 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.6)]' : 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.6)]'}`} />
              <span className="text-xs uppercase tracking-widest text-white font-medium">
                {isActivityMode ? 'Activity' : 'Autoplay'}
              </span>
              {isActivityMode && currentPhase !== 'idle' && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  currentPhase === 'complete'
                    ? 'bg-green-500/20 text-green-400'
                    : currentPhase === 'error'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {currentPhase.toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body - switches based on mode */}
          {isActivityMode ? (
            (currentPhase === 'complete' || currentPhase === 'error') && !isRunning ? (
              <CompletionSummary
                sketchProgress={sketchProgress}
                gameplayProgress={gameplayProgress}
                posterSelected={posterSelected}
                hudGenerated={hudGenerated}
                hudTarget={hudTarget}
                error={error}
                errorPhase={errorPhase}
                textEvents={textEvents}
                imageEvents={imageEvents}
                onRetry={onRetry}
              />
            ) : (
              <ActivityModeContent
                currentPhase={currentPhase}
                sketchProgress={sketchProgress}
                gameplayProgress={gameplayProgress}
                posterSelected={posterSelected}
                hudGenerated={hudGenerated}
                hudTarget={hudTarget}
                error={error}
                textEvents={textEvents}
                imageEvents={imageEvents}
                currentIteration={currentIteration}
                maxIterations={maxIterations}
                activePrompts={activePrompts}
                activeImages={activeImages}
              />
            )
          ) : (
            <SetupModeContent
              config={config}
              setConfig={setConfig}
              hasContent={hasContent}
              hasPromptIdea={hasPromptIdea}
              isRunning={isRunning}
              isProcessingBreakdown={isProcessingBreakdown}
              breakdownError={breakdownError}
              setBreakdownError={setBreakdownError}
              totalImages={totalImages}
              hasGameplay={hasGameplay}
              activePreset={activePreset}
              onPresetSelect={handlePresetSelect}
            />
          )}

          {/* Footer - compact */}
          <div className="px-3 py-2 border-t border-slate-800/50 bg-black/40 flex items-center justify-between shrink-0">
            {isActivityMode ? (
              <>
                <div className="flex items-center gap-2">
                  {onStop && isRunning && currentPhase !== 'complete' && currentPhase !== 'error' && (
                    <button
                      onClick={onStop}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs
                        border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <Square size={10} />
                      Stop
                    </button>
                  )}
                  {(currentPhase === 'complete' || currentPhase === 'error') && (
                    <>
                      {onRetry && currentPhase === 'error' && (
                        <button
                          onClick={onRetry}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs
                            border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                        >
                          <RotateCcw size={10} />
                          Retry from {errorPhase || 'here'}
                        </button>
                      )}
                      {onReset && (
                        <button
                          onClick={() => {
                            onReset();
                            setJustStarted(false);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs
                            border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                        >
                          <Play size={10} />
                          Run Again
                        </button>
                      )}
                      <button
                        onClick={onClose}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs
                          border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
                      >
                        Close
                      </button>
                    </>
                  )}
                </div>
                {isRunning && (
                  <div className="text-[10px] text-slate-500 font-mono">
                    {sketchProgress.saved + gameplayProgress.saved}/{sketchProgress.target + gameplayProgress.target} saved
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  disabled={isProcessingBreakdown}
                  className="px-3 py-1.5 rounded border text-xs border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleStart}
                  disabled={!canStart || totalImages === 0 || isRunning || isProcessingBreakdown || !canProceed}
                  title={
                    !canStart && canStartReason ? canStartReason :
                    totalImages === 0 ? 'Add at least one image' :
                    !canProceed ? 'Enter a core idea to start' :
                    undefined
                  }
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all
                    ${!canStart || totalImages === 0 || isRunning || isProcessingBreakdown || !canProceed
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:brightness-110 shadow-lg shadow-cyan-500/20'
                    }`}
                >
                  {isProcessingBreakdown ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play size={12} />
                      {!hasContent && hasPromptIdea ? 'Analyze & Start' : 'Start'}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default AutoplaySetupModal;
