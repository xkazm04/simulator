/**
 * CameraPresetBar - Cinematic camera preset controls
 *
 * Provides quick-access buttons for common cinematic camera shots.
 * Supports auto-play mode to cycle through presets automatically.
 *
 * Features:
 * - Preset buttons with icons
 * - Active preset indicator
 * - Auto-play toggle
 * - Smooth animated transitions
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  Focus,
  ZoomIn,
  Maximize,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Play,
  Pause,
  Camera,
} from 'lucide-react';
import {
  CameraPreset,
  CameraPresetId,
  CAMERA_PRESETS,
  getPreset,
  applyPresetToCamera,
  CameraAutoPlayer,
  DEFAULT_AUTOPLAY_CONFIG,
} from '../lib/cameraPresets';
import { CameraController } from '../lib/cameraController';
import { fadeIn, scaleIn, transitions } from '../../lib/motion';

interface CameraPresetBarProps {
  /** Camera controller instance */
  camera: CameraController | null;
  /** World bounds for coordinate conversion */
  worldBounds: { width: number; height: number };
  /** Currently active preset */
  activePreset?: CameraPresetId;
  /** Callback when preset changes */
  onPresetChange?: (presetId: CameraPresetId) => void;
  /** Show auto-play controls */
  showAutoPlay?: boolean;
  /** Compact mode (icons only) */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Map preset icon strings to Lucide components
 */
const ICON_MAP: Record<string, React.ElementType> = {
  RotateCcw,
  Focus,
  ZoomIn,
  Maximize,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
};

export function CameraPresetBar({
  camera,
  worldBounds,
  activePreset = 'default',
  onPresetChange,
  showAutoPlay = true,
  compact = false,
  disabled = false,
}: CameraPresetBarProps) {
  const [currentPreset, setCurrentPreset] = useState<CameraPresetId>(activePreset);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoPlayerRef = useRef<CameraAutoPlayer | null>(null);

  // Handle preset selection
  const handlePresetClick = useCallback((presetId: CameraPresetId) => {
    if (disabled || !camera || isTransitioning) return;

    // Stop auto-play if running
    if (autoPlayerRef.current?.isActive()) {
      autoPlayerRef.current.stop();
      setIsAutoPlaying(false);
    }

    const preset = getPreset(presetId);
    if (!preset) return;

    setIsTransitioning(true);
    setCurrentPreset(presetId);
    onPresetChange?.(presetId);

    applyPresetToCamera(camera, preset, worldBounds);

    // Reset transitioning state after animation
    setTimeout(() => {
      setIsTransitioning(false);
    }, preset.duration * 1000);
  }, [camera, worldBounds, disabled, isTransitioning, onPresetChange]);

  // Handle auto-play toggle
  const handleAutoPlayToggle = useCallback(() => {
    if (disabled || !camera) return;

    if (isAutoPlaying) {
      autoPlayerRef.current?.stop();
      setIsAutoPlaying(false);
    } else {
      // Create new auto-player if needed
      if (!autoPlayerRef.current) {
        autoPlayerRef.current = new CameraAutoPlayer(
          camera,
          worldBounds,
          DEFAULT_AUTOPLAY_CONFIG,
          (presetId) => {
            setCurrentPreset(presetId);
            onPresetChange?.(presetId);
          }
        );
      }
      autoPlayerRef.current.start();
      setIsAutoPlaying(true);
    }
  }, [camera, worldBounds, disabled, isAutoPlaying, onPresetChange]);

  // Cleanup auto-player on unmount
  useEffect(() => {
    return () => {
      autoPlayerRef.current?.dispose();
    };
  }, []);

  // Update auto-player when camera changes
  useEffect(() => {
    if (autoPlayerRef.current && camera) {
      // Dispose old and create new with updated camera
      autoPlayerRef.current.dispose();
      autoPlayerRef.current = new CameraAutoPlayer(
        camera,
        worldBounds,
        DEFAULT_AUTOPLAY_CONFIG,
        (presetId) => {
          setCurrentPreset(presetId);
          onPresetChange?.(presetId);
        }
      );
    }
  }, [camera, worldBounds, onPresetChange]);

  // Filter out 'default' from main presets (it's handled separately as reset)
  const displayPresets = CAMERA_PRESETS.filter(p => p.id !== 'default');
  const defaultPreset = CAMERA_PRESETS.find(p => p.id === 'default');

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {/* Reset button */}
        {defaultPreset && (
          <button
            onClick={() => handlePresetClick('default')}
            disabled={disabled}
            className={`p-1.5 rounded transition-colors ${
              currentPreset === 'default'
                ? 'bg-cyan-500/30 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={defaultPreset.description}
          >
            <RotateCcw size={14} />
          </button>
        )}

        <div className="w-px h-4 bg-slate-600 mx-1" />

        {/* Camera icon indicator */}
        <Camera size={12} className="text-slate-500" />

        {/* Preset buttons */}
        {displayPresets.slice(0, 4).map(preset => {
          const Icon = ICON_MAP[preset.icon] || Focus;
          const isActive = currentPreset === preset.id;

          return (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset.id)}
              disabled={disabled}
              className={`p-1.5 rounded transition-colors ${
                isActive
                  ? 'bg-cyan-500/30 text-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={preset.description}
            >
              <Icon size={14} />
            </button>
          );
        })}

        {/* Auto-play toggle */}
        {showAutoPlay && (
          <>
            <div className="w-px h-4 bg-slate-600 mx-1" />
            <button
              onClick={handleAutoPlayToggle}
              disabled={disabled}
              className={`p-1.5 rounded transition-colors ${
                isAutoPlaying
                  ? 'bg-purple-500/30 text-purple-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isAutoPlaying ? 'Stop auto-play' : 'Start auto-play'}
            >
              {isAutoPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      className="flex flex-col gap-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-slate-400" />
          <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">
            Camera Presets
          </span>
        </div>
        {showAutoPlay && (
          <button
            onClick={handleAutoPlayToggle}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
              isAutoPlaying
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700 border border-transparent'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isAutoPlaying ? <Pause size={12} /> : <Play size={12} />}
            {isAutoPlaying ? 'Stop' : 'Auto'}
          </button>
        )}
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-4 gap-2">
        {displayPresets.map(preset => {
          const Icon = ICON_MAP[preset.icon] || Focus;
          const isActive = currentPreset === preset.id;

          return (
            <motion.button
              key={preset.id}
              onClick={() => handlePresetClick(preset.id)}
              disabled={disabled}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                isActive
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              whileHover={!disabled ? { scale: 1.02 } : undefined}
              whileTap={!disabled ? { scale: 0.98 } : undefined}
              title={preset.description}
            >
              <Icon size={18} />
              <span className="font-mono text-[10px] uppercase tracking-wider">
                {preset.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Reset button */}
      {defaultPreset && (
        <button
          onClick={() => handlePresetClick('default')}
          disabled={disabled}
          className={`flex items-center justify-center gap-2 p-2 rounded border transition-colors ${
            currentPreset === 'default'
              ? 'bg-slate-700/50 border-slate-600 text-white'
              : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RotateCcw size={14} />
          <span className="font-mono text-xs uppercase tracking-wider">
            Reset View
          </span>
        </button>
      )}

      {/* Transition indicator */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.fast}
            className="flex items-center justify-center gap-2 py-1 text-cyan-400"
          >
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-xs">Transitioning...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default CameraPresetBar;
