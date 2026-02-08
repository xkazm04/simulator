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
import { createPortal } from 'react-dom';
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
  Loader2,
  AlertCircle,
  Square,
  RotateCcw,
  Wand2,
  Zap,
  Settings2,
  Crown,
  CheckCircle,
  Sparkles,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Clock,
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
import { fadeIn, modalContent, scaleIn, transitions } from '../../lib/motion';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
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
  /** Shared vision sentence from brain state */
  visionSentence?: string | null;
  /** Update the shared vision sentence in brain state */
  onVisionSentenceChange?: (value: string) => void;
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

  // Step-level tracking (sequential mode)
  currentImageInPhase?: number;
  phaseTarget?: number;
  singlePhaseStatus?: string;
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
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded border text-xs font-medium transition-all
              ${disabled
                ? 'border-slate-800/40 text-slate-700 cursor-not-allowed'
                : isActive
                  ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.1)]'
                  : 'border-slate-800/60 bg-black/20 text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-1.5">
              <span className={isActive ? 'text-cyan-400' : 'text-slate-500'}>{preset.icon}</span>
              {preset.label}
            </div>
            <span className="text-[10px] text-slate-600 font-normal">{preset.description}</span>
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
  visionSentence,
  onVisionSentenceChange,
  isRunning,
  isProcessingBreakdown,
  breakdownError,
  setBreakdownError,
  hasGameplay,
  activePreset,
  onPresetSelect,
}: {
  config: ExtendedAutoplayConfig;
  setConfig: (config: ExtendedAutoplayConfig) => void;
  hasContent: boolean;
  visionSentence: string;
  onVisionSentenceChange: (value: string) => void;
  isRunning: boolean;
  isProcessingBreakdown: boolean;
  breakdownError: string | null;
  setBreakdownError: (error: string | null) => void;
  hasGameplay: boolean;
  activePreset: string | null;
  onPresetSelect: (preset: AutoplayPreset) => void;
}) {
  const hasPromptIdea = Boolean(visionSentence?.trim());

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* Vision Input - prominent header field */}
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-purple-400 uppercase tracking-wider">
          <Sparkles size={10} />
          Vision {!hasContent && !hasPromptIdea && <span className="text-amber-400 normal-case">(Required)</span>}
        </label>
        <textarea
          rows={3}
          value={visionSentence}
          onChange={(e) => {
            onVisionSentenceChange(e.target.value);
            setBreakdownError(null);
          }}
          placeholder="e.g., &quot;Baldur's Gate but in Star Wars with modern graphics&quot;"
          className={`w-full px-3 py-2.5 bg-slate-900/60 border rounded-md text-sm text-slate-200
                    placeholder-slate-500 font-mono
                    focus:outline-none focus:ring-1 transition-all resize-none
                    ${!hasContent && !hasPromptIdea
                      ? 'border-amber-500/40 focus:border-amber-500/50 focus:ring-amber-500/30'
                      : 'border-purple-500/30 focus:border-purple-500/60 focus:ring-purple-500/20'
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

      {/* Preset Selector - larger buttons */}
      <PresetSelector
        activePreset={activePreset}
        onSelect={onPresetSelect}
        disabled={isRunning || isProcessingBreakdown}
      />

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
    </div>
  );
}

/**
 * Saved image data extracted from image events
 */
interface SavedImageInfo {
  imageUrl: string;
  promptText?: string;
  promptId?: string;
  phase?: string;
  score?: number;
  isPolished: boolean;
}

/**
 * Image category filter tabs
 */
type ImageCategory = 'all' | 'sketch' | 'gameplay' | 'polished' | 'rejected';

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
  isExpanded,
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
  isExpanded: boolean;
}) {
  const totalSaved = sketchProgress.saved + gameplayProgress.saved;
  const totalTarget = sketchProgress.target + gameplayProgress.target;
  const rejectedCount = imageEvents.filter(e => e.type === 'image_rejected').length;
  const polishCount = imageEvents.filter(e => e.type === 'image_polished').length;
  const isSuccess = !error && totalSaved >= totalTarget;

  // Duration calculation from events
  const allEvents = [...textEvents, ...imageEvents];
  const firstEvent = allEvents.length > 0 ? allEvents.reduce((a, b) => a.timestamp < b.timestamp ? a : b) : null;
  const lastEvent = allEvents.length > 0 ? allEvents.reduce((a, b) => a.timestamp > b.timestamp ? a : b) : null;
  const durationMs = firstEvent && lastEvent ? lastEvent.timestamp.getTime() - firstEvent.timestamp.getTime() : 0;
  const durationMin = Math.floor(durationMs / 60000);
  const durationSec = Math.floor((durationMs % 60000) / 1000);
  const durationStr = durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`;

  // Extract actually saved images from image_saved events (with URLs)
  const savedImages: SavedImageInfo[] = imageEvents
    .filter(e => e.type === 'image_saved' && e.details?.imageUrl)
    .map(e => {
      const polished = imageEvents.some(
        pe => pe.type === 'image_polished' && pe.details?.promptId === e.details?.promptId
      );
      return {
        imageUrl: e.details!.imageUrl!,
        promptText: e.details?.promptText,
        promptId: e.details?.promptId,
        phase: e.details?.phase,
        score: e.details?.score,
        isPolished: polished,
      };
    });

  // Extract rejected images (no URLs typically, but track for count)
  const rejectedImages: SavedImageInfo[] = imageEvents
    .filter(e => e.type === 'image_rejected')
    .map(e => ({
      imageUrl: '',
      promptText: e.message,
      promptId: e.details?.promptId,
      phase: e.details?.phase,
      score: e.details?.score,
      isPolished: false,
    }));

  // Category filter state
  const [activeCategory, setActiveCategory] = useState<ImageCategory>('all');

  // Filter images by category
  const filteredImages = (() => {
    switch (activeCategory) {
      case 'sketch': return savedImages.filter(img => img.phase === 'sketch');
      case 'gameplay': return savedImages.filter(img => img.phase === 'gameplay');
      case 'polished': return savedImages.filter(img => img.isPolished);
      case 'rejected': return rejectedImages;
      default: return savedImages;
    }
  })();

  // Category tabs config
  const sketchSaved = savedImages.filter(img => img.phase === 'sketch');
  const gameplaySaved = savedImages.filter(img => img.phase === 'gameplay');
  const polishedSaved = savedImages.filter(img => img.isPolished);

  const categories: { id: ImageCategory; label: string; count: number; color: string; activeColor: string }[] = [
    ...(sketchSaved.length > 0 ? [{
      id: 'sketch' as ImageCategory, label: 'Sketches', count: sketchSaved.length,
      color: 'text-blue-400 border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/5',
      activeColor: 'text-blue-300 border-blue-500/50 bg-blue-500/15',
    }] : []),
    ...(gameplaySaved.length > 0 ? [{
      id: 'gameplay' as ImageCategory, label: 'Gameplay', count: gameplaySaved.length,
      color: 'text-purple-400 border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/5',
      activeColor: 'text-purple-300 border-purple-500/50 bg-purple-500/15',
    }] : []),
    ...(polishedSaved.length > 0 ? [{
      id: 'polished' as ImageCategory, label: 'Polished', count: polishedSaved.length,
      color: 'text-amber-400 border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5',
      activeColor: 'text-amber-300 border-amber-500/50 bg-amber-500/15',
    }] : []),
    ...(rejectedCount > 0 ? [{
      id: 'rejected' as ImageCategory, label: 'Rejected', count: rejectedCount,
      color: 'text-red-400 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5',
      activeColor: 'text-red-300 border-red-500/50 bg-red-500/15',
    }] : []),
  ];

  // Lightbox state — track both URL and prompt for copy
  const [lightboxImage, setLightboxImage] = useState<{ url: string; prompt?: string } | null>(null);
  const lightboxCopy = useCopyFeedback();

  const handleCopyLightboxPrompt = useCallback(async () => {
    if (!lightboxImage?.prompt) return;
    try {
      await navigator.clipboard.writeText(lightboxImage.prompt);
      lightboxCopy.triggerCopy();
    } catch {
      // Clipboard API may fail
    }
  }, [lightboxImage, lightboxCopy]);

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
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {/* Row 1: Compact status with inline stats */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
          isSuccess
            ? 'border-green-500/30 bg-green-500/5'
            : error
              ? 'border-red-500/30 bg-red-500/5'
              : 'border-amber-500/30 bg-amber-500/5'
        }`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 20 }}
          className={`relative shrink-0 ${
            isSuccess ? 'text-green-400' : error ? 'text-red-400' : 'text-amber-400'
          }`}
        >
          {isSuccess ? (
            <>
              <CheckCircle size={18} />
              <motion.div
                className="absolute -top-1 -right-1 text-green-400"
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, delay: 0.4, repeat: 2 }}
              >
                <Sparkles size={8} />
              </motion.div>
            </>
          ) : (
            <AlertCircle size={18} />
          )}
        </motion.div>

        <div className="flex-1 min-w-0">
          <span className={`text-xs font-medium ${
            isSuccess ? 'text-green-300' : error ? 'text-red-300' : 'text-amber-300'
          }`}>
            {isSuccess ? 'Autoplay Complete' : error ? 'Stopped with Error' : 'Partially Complete'}
          </span>
          {error && !errorPhase && (
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{error}</p>
          )}
          {error && errorPhase && (
            <p className="text-[10px] text-red-400/70 mt-0.5">
              Failed during <span className="font-mono uppercase">{errorPhase}</span>
              {totalSaved > 0 && ` \u00b7 ${totalSaved} saved before error`}
            </p>
          )}
        </div>

        {/* Inline stats */}
        <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-cyan-400">
            <Image size={10} />
            {totalSaved}/{totalTarget}
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <Clock size={10} />
            {durationStr}
          </span>
        </div>
      </motion.div>

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
                Temporary API error.
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

      {/* Row 2: Category filter tabs */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-all ${
              activeCategory === 'all'
                ? 'text-cyan-300 border-cyan-500/50 bg-cyan-500/15'
                : 'text-slate-400 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
            }`}
          >
            All ({savedImages.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-all ${
                activeCategory === cat.id ? cat.activeColor : cat.color
              }`}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>
      )}

      {/* Image gallery — from actual save events */}
      {filteredImages.length > 0 && filteredImages[0].imageUrl ? (
        <div className={`grid gap-2 ${isExpanded ? 'grid-cols-6' : 'grid-cols-4'}`}>
          {filteredImages.filter(img => img.imageUrl).map((img, i) => (
            <motion.button
              key={`${img.promptId || i}-${i}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setLightboxImage({ url: img.imageUrl, prompt: img.promptText })}
              className="relative aspect-[3/2] rounded-md overflow-hidden border border-slate-700/50 hover:border-cyan-500/50 transition-all group"
            >
              <img src={img.imageUrl} alt={`${img.phase || 'Image'} ${i + 1}`} className="w-full h-full object-cover" />
              {/* Phase badge */}
              {img.phase && (
                <span className={`absolute top-1 left-1 px-1 py-0.5 rounded text-[8px] font-mono uppercase ${
                  img.phase === 'sketch' ? 'bg-blue-500/80 text-white' : 'bg-purple-500/80 text-white'
                }`}>
                  {img.phase.slice(0, 3)}
                </span>
              )}
              {/* Polish indicator */}
              {img.isPolished && (
                <span className="absolute top-1 right-1 px-1 py-0.5 rounded text-[8px] bg-amber-500/80 text-white">
                  <Wand2 size={8} className="inline" />
                </span>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Maximize2 size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </motion.button>
          ))}
        </div>
      ) : activeCategory === 'rejected' && rejectedCount > 0 ? (
        /* Rejected images - no URLs, show as text list */
        <div className="space-y-1">
          {rejectedImages.map((img, i) => (
            <div key={i} className="px-2 py-1.5 rounded bg-red-500/5 border border-red-500/10 text-[10px] text-red-400/80 truncate">
              {img.score !== undefined && <span className="font-mono mr-1.5">Score: {img.score}</span>}
              {img.promptText}
            </div>
          ))}
        </div>
      ) : savedImages.length === 0 && (
        <div className="py-6 text-center text-[11px] text-slate-600">
          No images saved during this session
        </div>
      )}

      {/* Image lightbox with copy prompt */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-8"
            onClick={() => { setLightboxImage(null); lightboxCopy.reset(); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-[85vw] max-h-[85vh] flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage.url}
                alt="Full size"
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
              {/* Prompt + copy below image */}
              {lightboxImage.prompt && (
                <button
                  onClick={handleCopyLightboxPrompt}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-black/60 border border-slate-700/50 hover:border-cyan-500/30 transition-colors max-w-[600px] group"
                  title="Click to copy prompt"
                >
                  <span className="shrink-0">
                    {lightboxCopy.isCopied
                      ? <Check size={12} className="text-green-400" />
                      : <Copy size={12} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                    }
                  </span>
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors truncate text-left">
                    {lightboxCopy.isCopied ? 'Copied to clipboard!' : lightboxImage.prompt}
                  </span>
                </button>
              )}
            </motion.div>
            <button
              onClick={() => { setLightboxImage(null); lightboxCopy.reset(); }}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
  currentImageInPhase,
  phaseTarget,
  singlePhaseStatus,
  isExpanded,
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
  currentImageInPhase?: number;
  phaseTarget?: number;
  singlePhaseStatus?: string;
  isExpanded: boolean;
}) {
  const sidebarClass = isExpanded ? 'w-[280px] shrink-0' : 'w-[200px] shrink-0';

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left Sidebar - Text Events */}
      <div className={sidebarClass}>
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
          currentImageInPhase={currentImageInPhase}
          phaseTarget={phaseTarget}
          singlePhaseStatus={singlePhaseStatus}
          isExpanded={isExpanded}
        />
      </div>

      {/* Right Sidebar - Image Events */}
      <div className={sidebarClass}>
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
  visionSentence: visionSentenceProp,
  onVisionSentenceChange,
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
  // Step-level tracking
  currentImageInPhase,
  phaseTarget,
  singlePhaseStatus,
}: AutoplaySetupModalProps) {
  const [config, setConfig] = useState<ExtendedAutoplayConfig>(() => loadSavedConfig() || DEFAULT_CONFIG);
  const [isProcessingBreakdown, setIsProcessingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  // Local state to track if we just started (forces activity mode)
  const [justStarted, setJustStarted] = useState(false);
  // Expandable full-screen mode
  const [isExpanded, setIsExpanded] = useState(false);

  const totalImages = config.sketchCount + config.gameplayCount;
  const hasGameplay = config.gameplayCount > 0;
  const activePreset = detectActivePreset(config);

  // Derive vision sentence (prop takes priority, fallback to empty string)
  const visionSentence = visionSentenceProp ?? '';

  // Validation: need either existing content OR a vision sentence
  const hasPromptIdea = Boolean(visionSentence.trim());
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
      setIsExpanded(false);
    }
  }, [isOpen]);

  const handleStart = useCallback(async () => {
    setBreakdownError(null);

    // If no content exists but we have a vision sentence, trigger Smart Breakdown first
    if (!hasContent && hasPromptIdea && onSmartBreakdown) {
      setIsProcessingBreakdown(true);
      try {
        const success = await onSmartBreakdown(visionSentence.trim());
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

    // Start autoplay - pass visionSentence as promptIdea for the orchestrator
    onStart({ ...config, promptIdea: visionSentence.trim() });
  }, [config, visionSentence, onStart, hasContent, hasPromptIdea, onSmartBreakdown]);

  if (!isOpen) return null;

  // Modal dimensions based on mode
  const isActivityMode = effectiveMode === 'activity';

  // Guard against SSR — document.body doesn't exist during server rendering
  if (typeof document === 'undefined') return null;

  // Portal to document.body to escape backdrop-filter containing blocks
  // (backdrop-blur on parent CentralBrain creates a new containing block
  // that traps position:fixed elements)
  return createPortal(
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
        {/* Click-away layer (transparent — no overlay shading so side panels stay visible) */}
        <div
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
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
            width: isActivityMode
              ? isExpanded ? '96vw' : 'min(96vw, 960px)'
              : 'min(92vw, 600px)',
            maxWidth: isActivityMode
              ? isExpanded ? 'none' : '960px'
              : '600px',
            height: isActivityMode
              ? isExpanded ? '92vh' : 'min(85vh, 650px)'
              : 'auto',
            maxHeight: isActivityMode
              ? isExpanded ? 'none' : '650px'
              : '85vh',
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
            <div className="flex items-center gap-1">
              {isActivityMode && (
                <button
                  onClick={() => setIsExpanded(prev => !prev)}
                  className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
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
                isExpanded={isExpanded}
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
                currentImageInPhase={currentImageInPhase}
                phaseTarget={phaseTarget}
                singlePhaseStatus={singlePhaseStatus}
                isExpanded={isExpanded}
              />
            )
          ) : (
            <SetupModeContent
              config={config}
              setConfig={setConfig}
              hasContent={hasContent}
              visionSentence={visionSentence}
              onVisionSentenceChange={onVisionSentenceChange ?? (() => {})}
              isRunning={isRunning}
              isProcessingBreakdown={isProcessingBreakdown}
              breakdownError={breakdownError}
              setBreakdownError={setBreakdownError}
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    disabled={isProcessingBreakdown}
                    className="px-3 py-1.5 rounded border text-xs border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <span className="font-mono text-xs text-cyan-400">{totalImages} <span className="text-slate-500">images</span></span>
                </div>

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
    </AnimatePresence>,
    document.body,
  );
}

export default AutoplaySetupModal;
