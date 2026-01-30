/**
 * InputMapper - Visual key binding editor component
 *
 * Provides a UI for:
 * - Viewing current key bindings
 * - Remapping keys for actions
 * - Selecting preset control schemes
 * - Importing/exporting bindings
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Keyboard,
  Settings,
  RotateCcw,
  Download,
  Upload,
  Check,
  X,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import {
  InputManager,
  InputAction,
  KeyBinding,
  InputSchemePreset,
  INPUT_SCHEME_PRESETS,
  getKeyDisplayName,
  ACTION_DISPLAY_NAMES,
  getPresetsForGameType,
} from '../subfeature_interactive/lib';
import { scaleIn, transitions } from '../lib/motion';
import { semanticColors } from '../lib/semanticColors';

interface InputMapperProps {
  /** Input manager instance to configure */
  inputManager: InputManager;
  /** Current game type for filtering presets */
  gameType?: 'platformer' | 'top-down' | 'puzzle' | 'shooter' | 'fps' | 'third-person';
  /** Called when bindings change */
  onBindingsChange?: (bindings: KeyBinding[]) => void;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Whether the mapper is disabled */
  disabled?: boolean;
}

type RemapMode = 'idle' | 'listening';

interface RemapState {
  action: InputAction | null;
  keyIndex: number;
  mode: RemapMode;
}

const ALL_ACTIONS: InputAction[] = [
  'moveLeft',
  'moveRight',
  'moveUp',
  'moveDown',
  'jump',
  'action',
  'secondary',
  'pause',
  'reset',
];

export function InputMapper({
  inputManager,
  gameType = 'platformer',
  onBindingsChange,
  compact = false,
  disabled = false,
}: InputMapperProps) {
  const [bindings, setBindings] = useState<KeyBinding[]>([]);
  const [remapState, setRemapState] = useState<RemapState>({
    action: null,
    keyIndex: 0,
    mode: 'idle',
  });
  const [showPresets, setShowPresets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const listeningRef = useRef<boolean>(false);

  // Load current bindings from input manager
  useEffect(() => {
    setBindings(inputManager.getBindings());
  }, [inputManager]);

  // Get relevant presets for current game type
  const relevantPresets = getPresetsForGameType(gameType);

  // Handle key listening for remapping
  useEffect(() => {
    if (remapState.mode !== 'listening') {
      listeningRef.current = false;
      return;
    }

    listeningRef.current = true;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!listeningRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      const keyCode = e.code;

      // Cancel on Escape
      if (keyCode === 'Escape') {
        setRemapState({ action: null, keyIndex: 0, mode: 'idle' });
        return;
      }

      // Check if key is already bound to another action
      const existingAction = inputManager.getActionForKey(keyCode);
      if (existingAction && existingAction !== remapState.action) {
        setError(`Key "${getKeyDisplayName(keyCode)}" is already bound to ${ACTION_DISPLAY_NAMES[existingAction]}`);
        setTimeout(() => setError(null), 3000);
        return;
      }

      // Apply the new binding
      if (remapState.action) {
        const currentBindings = inputManager.getBindings();
        const actionBinding = currentBindings.find(b => b.action === remapState.action);

        if (actionBinding) {
          const newKeys = [...actionBinding.keys];
          if (remapState.keyIndex < newKeys.length) {
            newKeys[remapState.keyIndex] = keyCode;
          } else {
            newKeys.push(keyCode);
          }
          inputManager.remapAction(remapState.action, newKeys);
        } else {
          inputManager.remapAction(remapState.action, [keyCode]);
        }

        const updatedBindings = inputManager.getBindings();
        setBindings(updatedBindings);
        onBindingsChange?.(updatedBindings);

        setSuccess(`Mapped "${getKeyDisplayName(keyCode)}" to ${ACTION_DISPLAY_NAMES[remapState.action]}`);
        setTimeout(() => setSuccess(null), 2000);
      }

      setRemapState({ action: null, keyIndex: 0, mode: 'idle' });
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [remapState, inputManager, onBindingsChange]);

  const handleStartRemap = useCallback((action: InputAction, keyIndex: number) => {
    if (disabled) return;
    setRemapState({ action, keyIndex, mode: 'listening' });
    setError(null);
  }, [disabled]);

  const handleCancelRemap = useCallback(() => {
    setRemapState({ action: null, keyIndex: 0, mode: 'idle' });
  }, []);

  const handleRemoveKey = useCallback((action: InputAction, keyIndex: number) => {
    if (disabled) return;

    const actionBinding = bindings.find(b => b.action === action);
    if (actionBinding && actionBinding.keys.length > 1) {
      const newKeys = actionBinding.keys.filter((_, i) => i !== keyIndex);
      inputManager.remapAction(action, newKeys);
      const updatedBindings = inputManager.getBindings();
      setBindings(updatedBindings);
      onBindingsChange?.(updatedBindings);
    }
  }, [bindings, inputManager, onBindingsChange, disabled]);

  const handleApplyPreset = useCallback((preset: InputSchemePreset) => {
    if (disabled) return;

    inputManager.applyPreset(preset);
    const updatedBindings = inputManager.getBindings();
    setBindings(updatedBindings);
    onBindingsChange?.(updatedBindings);
    setShowPresets(false);

    setSuccess(`Applied "${preset.name}" preset`);
    setTimeout(() => setSuccess(null), 2000);
  }, [inputManager, onBindingsChange, disabled]);

  const handleResetToDefaults = useCallback(() => {
    if (disabled) return;

    inputManager.resetToDefaults(gameType);
    const updatedBindings = inputManager.getBindings();
    setBindings(updatedBindings);
    onBindingsChange?.(updatedBindings);

    setSuccess('Reset to default bindings');
    setTimeout(() => setSuccess(null), 2000);
  }, [inputManager, gameType, onBindingsChange, disabled]);

  const handleExport = useCallback(() => {
    const json = inputManager.exportBindings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keybindings.json';
    a.click();
    URL.revokeObjectURL(url);

    setSuccess('Exported keybindings');
    setTimeout(() => setSuccess(null), 2000);
  }, [inputManager]);

  const handleImport = useCallback(() => {
    if (disabled) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const success = inputManager.importBindings(text);
        if (success) {
          const updatedBindings = inputManager.getBindings();
          setBindings(updatedBindings);
          onBindingsChange?.(updatedBindings);
          setSuccess('Imported keybindings');
        } else {
          setError('Invalid keybindings file');
        }
      } catch {
        setError('Failed to read file');
      }
      setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 3000);
    };
    input.click();
  }, [inputManager, onBindingsChange, disabled]);

  const getKeysForAction = (action: InputAction): string[] => {
    const binding = bindings.find(b => b.action === action);
    return binding?.keys || [];
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => !disabled && setShowPresets(!showPresets)}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-2 py-1 radius-sm border transition-colors
                     ${semanticColors.neutral.bg} ${semanticColors.neutral.border}
                     ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-125'}`}
        >
          <Keyboard size={14} className="text-slate-400" />
          <span className="font-mono type-label text-slate-300">Controls</span>
          <ChevronDown
            size={10}
            className={`text-slate-400 transition-transform ${showPresets ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {showPresets && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowPresets(false)} />
              <motion.div
                variants={scaleIn}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transitions.fast}
                className="absolute bottom-full left-0 mb-1 p-2 bg-slate-900/95 border border-slate-700 radius-md shadow-elevated min-w-[200px] z-40"
              >
                <div className="font-mono type-label text-slate-500 uppercase tracking-wider mb-2">
                  Control Presets
                </div>
                {relevantPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    className="w-full px-2 py-1.5 radius-sm text-left hover:bg-slate-800 transition-colors"
                  >
                    <span className="font-mono type-body-sm text-slate-300 block">
                      {preset.name}
                    </span>
                    <span className="font-mono type-label text-slate-500">
                      {preset.description}
                    </span>
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="input-mapper">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Keyboard size={14} className="text-cyan-400" />
          <span className="font-mono type-label text-cyan-400 uppercase tracking-wider">
            Key Bindings
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Presets dropdown */}
          <div className="relative">
            <button
              onClick={() => !disabled && setShowPresets(!showPresets)}
              disabled={disabled}
              className="flex items-center gap-1 px-2 py-1 radius-sm border border-slate-700
                       bg-slate-800/50 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <Settings size={12} className="text-slate-400" />
              <span className="font-mono type-label text-slate-300">Presets</span>
              <ChevronDown
                size={10}
                className={`text-slate-400 transition-transform ${showPresets ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {showPresets && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowPresets(false)} />
                  <motion.div
                    variants={scaleIn}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={transitions.fast}
                    className="absolute top-full right-0 mt-1 p-2 bg-slate-900/95 border border-slate-700
                             radius-md shadow-elevated min-w-[220px] z-40"
                  >
                    {INPUT_SCHEME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset)}
                        className="w-full px-2 py-1.5 radius-sm text-left hover:bg-slate-800 transition-colors"
                      >
                        <span className="font-mono type-body-sm text-slate-200 block">
                          {preset.name}
                        </span>
                        <span className="font-mono type-label text-slate-500">
                          {preset.description}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Reset */}
          <button
            onClick={handleResetToDefaults}
            disabled={disabled}
            className="p-1.5 radius-sm border border-slate-700 bg-slate-800/50
                     hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Reset to defaults"
          >
            <RotateCcw size={12} className="text-slate-400" />
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="p-1.5 radius-sm border border-slate-700 bg-slate-800/50
                     hover:bg-slate-800 transition-colors"
            title="Export bindings"
          >
            <Download size={12} className="text-slate-400" />
          </button>

          {/* Import */}
          <button
            onClick={handleImport}
            disabled={disabled}
            className="p-1.5 radius-sm border border-slate-700 bg-slate-800/50
                     hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Import bindings"
          >
            <Upload size={12} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Status messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 px-3 py-2 radius-sm bg-red-500/10 border border-red-500/30"
          >
            <AlertCircle size={14} className="text-red-400" />
            <span className="font-mono type-body-sm text-red-300">{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 px-3 py-2 radius-sm bg-green-500/10 border border-green-500/30"
          >
            <Check size={14} className="text-green-400" />
            <span className="font-mono type-body-sm text-green-300">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Listening overlay */}
      <AnimatePresence>
        {remapState.mode === 'listening' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={handleCancelRemap}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="p-6 bg-slate-900 border border-cyan-500/50 radius-lg shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/20
                              flex items-center justify-center animate-pulse">
                  <Keyboard size={32} className="text-cyan-400" />
                </div>
                <h3 className="font-mono type-subtitle text-slate-200 mb-2">
                  Press a key...
                </h3>
                <p className="font-mono type-body-sm text-slate-400 mb-4">
                  Mapping key for <span className="text-cyan-400">
                    {remapState.action && ACTION_DISPLAY_NAMES[remapState.action]}
                  </span>
                </p>
                <button
                  onClick={handleCancelRemap}
                  className="px-4 py-2 radius-sm border border-slate-600
                           hover:bg-slate-800 transition-colors"
                >
                  <span className="font-mono type-body-sm text-slate-300">Cancel (Esc)</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bindings grid */}
      <div className="grid grid-cols-1 gap-2">
        {ALL_ACTIONS.map((action) => {
          const keys = getKeysForAction(action);

          return (
            <div
              key={action}
              className="flex items-center justify-between p-2 radius-sm border border-slate-700/50
                       bg-slate-900/40 hover:bg-slate-900/60 transition-colors"
            >
              {/* Action name */}
              <div className="flex items-center gap-2 min-w-[120px]">
                <span className="font-mono type-body-sm text-slate-300">
                  {ACTION_DISPLAY_NAMES[action]}
                </span>
              </div>

              {/* Key slots */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {keys.map((key, index) => (
                  <div key={`${action}-${index}`} className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleStartRemap(action, index)}
                      disabled={disabled}
                      className={`px-2 py-1 radius-sm border font-mono type-label uppercase
                                transition-all min-w-[40px] text-center
                                ${disabled
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:border-cyan-500/50 hover:bg-cyan-500/10 cursor-pointer'}
                                ${remapState.action === action && remapState.keyIndex === index
                                  ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                                  : 'border-slate-600 bg-slate-800/50 text-slate-300'}`}
                      title={`Click to remap - Current: ${key}`}
                    >
                      {getKeyDisplayName(key)}
                    </button>
                    {keys.length > 1 && (
                      <button
                        onClick={() => handleRemoveKey(action, index)}
                        disabled={disabled}
                        className="p-0.5 radius-sm hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        title="Remove this key"
                      >
                        <X size={10} className="text-slate-500 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Add key button */}
                {keys.length < 3 && (
                  <button
                    onClick={() => handleStartRemap(action, keys.length)}
                    disabled={disabled}
                    className="px-2 py-1 radius-sm border border-dashed border-slate-600
                             hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Add another key"
                  >
                    <span className="font-mono type-label text-slate-500">+</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="pt-2 border-t border-slate-700/30">
        <p className="font-mono type-label text-slate-500">
          Click a key to remap it. Press Escape to cancel. Each action can have up to 3 keys.
        </p>
      </div>
    </div>
  );
}

export default InputMapper;
