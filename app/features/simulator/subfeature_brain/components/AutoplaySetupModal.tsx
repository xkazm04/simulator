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

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Sparkles,
  Image,
  Gamepad2,
  Frame,
  Layers,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Lightbulb,
  Loader2,
  AlertCircle,
  Square,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import {
  ExtendedAutoplayConfig,
  AutoplayPhase,
  PhaseProgress,
  AutoplayLogEntry,
  DEFAULT_POLISH_CONFIG,
  PolishConfig,
} from '../../types';
import { fadeIn, modalContent, transitions } from '../../lib/motion';
import { semanticColors } from '../../lib/semanticColors';
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
  conceptProgress?: PhaseProgress;
  gameplayProgress?: PhaseProgress;
  posterSelected?: boolean;
  hudGenerated?: number;
  hudTarget?: number;
  error?: string;
  textEvents?: AutoplayLogEntry[];
  imageEvents?: AutoplayLogEntry[];
  onStop?: () => void;
  onReset?: () => void;
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
    <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800 radius-md">
      <div className="flex items-center gap-3">
        <div className={`p-2 radius-sm ${semanticColors.primary.bg}`}>
          {icon}
        </div>
        <div>
          <div className="font-medium text-slate-200">{label}</div>
          <div className="type-label text-slate-500">{description}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
          className={`p-1.5 radius-sm border transition-colors
            ${disabled || value <= min
              ? 'border-slate-800 text-slate-700 cursor-not-allowed'
              : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="font-mono text-lg w-8 text-center text-slate-200">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
          className={`p-1.5 radius-sm border transition-colors
            ${disabled || value >= max
              ? 'border-slate-800 text-slate-700 cursor-not-allowed'
              : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
        >
          <ChevronRight size={16} />
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
      className={`w-full flex items-center justify-between p-3 radius-md border transition-colors text-left
        ${disabled
          ? 'border-slate-800/50 bg-slate-900/30 cursor-not-allowed opacity-50'
          : enabled
            ? `${semanticColors.success.border} ${semanticColors.success.bg}`
            : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 radius-sm ${enabled ? semanticColors.success.bg : 'bg-slate-800'}`}>
          {icon}
        </div>
        <div>
          <div className={`font-medium ${enabled ? 'text-green-400' : 'text-slate-300'}`}>{label}</div>
          <div className="type-label text-slate-500">{description}</div>
        </div>
      </div>
      {enabled ? (
        <ToggleRight size={24} className="text-green-400" />
      ) : (
        <ToggleLeft size={24} className="text-slate-600" />
      )}
    </button>
  );
}

/**
 * Setup Mode Content - Configuration form
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
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Prompt Idea Input */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Lightbulb size={14} className={!hasContent ? semanticColors.warning.text : 'text-slate-400'} />
          Core Idea {!hasContent && <span className={semanticColors.warning.text}>(Required)</span>}
        </label>
        <textarea
          value={config.promptIdea || ''}
          onChange={(e) => {
            setConfig({ ...config, promptIdea: e.target.value });
            setBreakdownError(null);
          }}
          placeholder="Describe your vision... (e.g., 'Dark Souls meets Studio Ghibli in a cyberpunk world')"
          className={`w-full h-20 bg-slate-900/50 border radius-md p-3 text-sm placeholder-slate-600 resize-none
                    focus:outline-none focus:ring-1 transition-all
                    ${!hasContent && !hasPromptIdea
                      ? 'border-amber-500/50 focus:border-amber-500/50 focus:ring-amber-500/50'
                      : 'border-slate-800 focus:border-cyan-500/50 focus:ring-cyan-500/50'
                    }`}
          disabled={isRunning || isProcessingBreakdown}
        />
        {!hasContent ? (
          <p className={`type-label ${hasPromptIdea ? 'text-slate-500' : semanticColors.warning.text}`}>
            {hasPromptIdea
              ? 'Will run Smart Breakdown to generate base image and dimensions.'
              : 'Enter a vision to generate content via Smart Breakdown.'}
          </p>
        ) : (
          <p className="type-label text-slate-600">
            Optional - will update existing content via Smart Breakdown if provided.
          </p>
        )}
        {breakdownError && (
          <p className={`type-label ${semanticColors.error.text} flex items-center gap-1`}>
            <AlertCircle size={12} />
            {breakdownError}
          </p>
        )}
      </div>

      {/* Image Counts Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Image Generation</h3>

        <Counter
          value={config.sketchCount}
          min={0}
          max={4}
          onChange={(v) => setConfig({ ...config, sketchCount: v })}
          disabled={isRunning}
          label="Concept Images"
          icon={<Image size={16} className={semanticColors.primary.text} />}
          description="Clean concept art without UI"
        />

        <Counter
          value={config.gameplayCount}
          min={0}
          max={4}
          onChange={(v) => setConfig({ ...config, gameplayCount: v })}
          disabled={isRunning}
          label="Gameplay Images"
          icon={<Gamepad2 size={16} className={semanticColors.primary.text} />}
          description="Screenshots with game UI"
        />

        <Counter
          value={config.maxIterationsPerImage}
          min={1}
          max={3}
          onChange={(v) => setConfig({ ...config, maxIterationsPerImage: v })}
          disabled={isRunning}
          label="Max Iterations"
          icon={<RefreshCw size={14} className={semanticColors.primary.text} />}
          description="Refinement attempts per image"
        />
      </div>

      {/* Image Enhancement Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Image Enhancement</h3>

        <Toggle
          enabled={config.polish?.rescueEnabled ?? true}
          onChange={(v) => setConfig({
            ...config,
            polish: { ...config.polish, rescueEnabled: v }
          })}
          disabled={isRunning}
          label="Gemini Polish"
          icon={<Wand2 size={16} className={config.polish?.rescueEnabled ? 'text-green-400' : 'text-slate-400'} />}
          description="Polish near-approval images (50-69 score) via Gemini"
        />

        {config.polish?.rescueEnabled && (
          <div className="ml-4 p-3 bg-slate-900/30 border border-slate-800/50 radius-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Polish Threshold</span>
              <span className="font-mono text-xs text-cyan-400">
                {config.polish?.rescueFloor ?? 50}+
              </span>
            </div>
            <input
              type="range"
              min={40}
              max={65}
              value={config.polish?.rescueFloor ?? 50}
              onChange={(e) => setConfig({
                ...config,
                polish: { ...config.polish, rescueFloor: parseInt(e.target.value) }
              })}
              disabled={isRunning}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400
                [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
            />
            <p className="type-label text-slate-600">
              Images scoring {config.polish?.rescueFloor ?? 50}-69 will be polished before rejection
            </p>
          </div>
        )}
      </div>

      {/* Optional Features Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Optional Features</h3>

        <Toggle
          enabled={config.posterEnabled}
          onChange={(v) => setConfig({ ...config, posterEnabled: v })}
          disabled={isRunning}
          label="Auto Poster Selection"
          icon={<Frame size={16} className={config.posterEnabled ? 'text-green-400' : 'text-slate-400'} />}
          description="Generate poster variations, LLM picks best"
        />

        <Toggle
          enabled={config.hudEnabled && hasGameplay}
          onChange={(v) => setConfig({ ...config, hudEnabled: v })}
          disabled={isRunning || !hasGameplay}
          label="Auto HUD Generation"
          icon={<Layers size={16} className={config.hudEnabled && hasGameplay ? 'text-green-400' : 'text-slate-400'} />}
          description={hasGameplay ? 'Add HUD overlays to gameplay images' : 'Requires gameplay images > 0'}
        />
      </div>

      {/* Summary */}
      <div className={`p-3 radius-md border ${semanticColors.primary.border} ${semanticColors.primary.bg}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Total Images to Generate:</span>
          <span className={`font-mono text-lg ${semanticColors.primary.text}`}>{totalImages}</span>
        </div>
        {totalImages === 0 && (
          <p className={`type-label ${semanticColors.warning.text} mt-2`}>
            Set at least one concept or gameplay image count.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Activity Mode Content - Real-time monitoring
 */
function ActivityModeContent({
  currentPhase,
  conceptProgress,
  gameplayProgress,
  posterSelected,
  hudGenerated,
  hudTarget,
  error,
  textEvents,
  imageEvents,
}: {
  currentPhase: AutoplayPhase;
  conceptProgress: PhaseProgress;
  gameplayProgress: PhaseProgress;
  posterSelected: boolean;
  hudGenerated: number;
  hudTarget: number;
  error?: string;
  textEvents: AutoplayLogEntry[];
  imageEvents: AutoplayLogEntry[];
}) {
  return (
    <div className="flex-1 flex min-h-0">
      {/* Left Sidebar - Text Events */}
      <div className="w-1/4 min-w-[180px]">
        <ActivityLogSidebar
          title="Text Changes"
          events={textEvents}
          side="left"
          emptyMessage="Prompt and dimension changes will appear here"
        />
      </div>

      {/* Center - Progress */}
      <div className="flex-1 border-x border-slate-800">
        <ActivityProgressCenter
          currentPhase={currentPhase}
          conceptProgress={conceptProgress}
          gameplayProgress={gameplayProgress}
          posterSelected={posterSelected}
          hudGenerated={hudGenerated}
          hudTarget={hudTarget}
          error={error}
        />
      </div>

      {/* Right Sidebar - Image Events */}
      <div className="w-1/4 min-w-[180px]">
        <ActivityLogSidebar
          title="Image Events"
          events={imageEvents}
          side="right"
          emptyMessage="Image generation events will appear here"
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
  conceptProgress = { saved: 0, target: 0 },
  gameplayProgress = { saved: 0, target: 0 },
  posterSelected = false,
  hudGenerated = 0,
  hudTarget = 0,
  error,
  textEvents = [],
  imageEvents = [],
  onStop,
  onReset,
}: AutoplaySetupModalProps) {
  const [config, setConfig] = useState<ExtendedAutoplayConfig>(DEFAULT_CONFIG);
  const [isProcessingBreakdown, setIsProcessingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  const totalImages = config.sketchCount + config.gameplayCount;
  const hasGameplay = config.gameplayCount > 0;

  // Validation: need either existing content OR a prompt idea
  const hasPromptIdea = Boolean(config.promptIdea?.trim());
  const canProceed = hasContent || hasPromptIdea;

  // Determine effective mode - switch to activity when running
  const effectiveMode: AutoplayModalMode = isRunning ? 'activity' : mode;

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

    // Now start autoplay - don't close modal, let it switch to activity mode
    onStart(config);
  }, [config, onStart, hasContent, hasPromptIdea, onSmartBreakdown]);

  if (!isOpen) return null;

  // Modal dimensions based on mode
  const isActivityMode = effectiveMode === 'activity';
  const modalWidth = isActivityMode ? 'min(95vw, 900px)' : 'min(80vw, 32rem)';
  const modalMaxWidth = isActivityMode ? '900px' : '32rem';
  const modalHeight = isActivityMode ? 'min(90vh, 700px)' : '90vh';

  return (
    <AnimatePresence>
      {/* Use inline styles for portal-safe rendering */}
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
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
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
            width: '100%',
            minWidth: modalWidth,
            maxWidth: modalMaxWidth,
            height: isActivityMode ? modalHeight : 'auto',
            maxHeight: modalHeight,
            background: '#0f172a',
            border: '1px solid rgba(51, 65, 85, 1)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className={isActivityMode ? semanticColors.processing.text : semanticColors.primary.text} />
              <span className="font-medium text-slate-200">
                {isActivityMode ? 'Autoplay Activity' : 'Autoplay Setup'}
              </span>
              {isActivityMode && currentPhase !== 'idle' && (
                <span className={`ml-2 px-2 py-0.5 radius-sm text-xs font-mono ${
                  currentPhase === 'complete'
                    ? `${semanticColors.success.bg} ${semanticColors.success.text}`
                    : currentPhase === 'error'
                      ? `${semanticColors.error.bg} ${semanticColors.error.text}`
                      : `${semanticColors.processing.bg} ${semanticColors.processing.text}`
                }`}>
                  {currentPhase.toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 radius-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body - switches based on mode */}
          {isActivityMode ? (
            <ActivityModeContent
              currentPhase={currentPhase}
              conceptProgress={conceptProgress}
              gameplayProgress={gameplayProgress}
              posterSelected={posterSelected}
              hudGenerated={hudGenerated}
              hudTarget={hudTarget}
              error={error}
              textEvents={textEvents}
              imageEvents={imageEvents}
            />
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
            />
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
            {isActivityMode ? (
              <>
                {/* Activity mode footer */}
                <div className="flex items-center gap-2">
                  {onStop && isRunning && currentPhase !== 'complete' && currentPhase !== 'error' && (
                    <button
                      onClick={onStop}
                      className={`flex items-center gap-2 px-4 py-2 radius-md border transition-colors
                        ${semanticColors.error.border} ${semanticColors.error.bg} ${semanticColors.error.text}
                        hover:brightness-125`}
                    >
                      <Square size={14} />
                      Stop Autoplay
                    </button>
                  )}
                  {onReset && (currentPhase === 'complete' || currentPhase === 'error') && (
                    <button
                      onClick={onReset}
                      className="flex items-center gap-2 px-4 py-2 radius-md border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                      <RotateCcw size={14} />
                      Reset
                    </button>
                  )}
                </div>
                <div className="text-sm text-slate-500 font-mono">
                  Phase: {conceptProgress.saved + gameplayProgress.saved}/{conceptProgress.target + gameplayProgress.target} saved
                </div>
              </>
            ) : (
              <>
                {/* Setup mode footer */}
                <button
                  onClick={onClose}
                  disabled={isProcessingBreakdown}
                  className="px-4 py-2 radius-md border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-50"
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
                  className={`flex items-center gap-2 px-5 py-2 radius-md font-medium transition-colors
                    ${!canStart || totalImages === 0 || isRunning || isProcessingBreakdown || !canProceed
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : `${semanticColors.primary.bg} ${semanticColors.primary.border} border ${semanticColors.primary.text} hover:brightness-125`
                    }`}
                >
                  {isProcessingBreakdown ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      {!hasContent && hasPromptIdea ? 'Analyze & Start' : 'Start Autoplay'}
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
