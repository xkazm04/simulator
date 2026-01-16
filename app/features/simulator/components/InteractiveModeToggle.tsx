/**
 * InteractiveModeToggle - Toggle button for interactive prototype modes
 *
 * A compact toggle button that appears in the FeedbackPanel to switch between
 * static image output and interactive prototype modes.
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles } from 'lucide-react';
import { InteractiveMode, INTERACTIVE_MODES } from '../types';
import { scaleIn, transitions } from '../lib/motion';
import { getModeIcon, getModeColors } from '../lib/interactiveModeHelpers';

interface InteractiveModeToggleProps {
  /** Current interactive mode */
  mode: InteractiveMode;
  /** Available modes for current scene type */
  availableModes: InteractiveMode[];
  /** Callback when mode changes */
  onModeChange: (mode: InteractiveMode) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
}

export function InteractiveModeToggle({
  mode,
  availableModes,
  onModeChange,
  disabled = false,
}: InteractiveModeToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = getModeColors(mode);
  const isInteractive = mode !== 'static';

  // If only static mode available, don't show toggle
  if (availableModes.length <= 1 && availableModes[0] === 'static') {
    return null;
  }

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2 py-1 radius-sm border transition-colors
                   ${colors.bg} ${colors.border} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-125'}`}
        data-testid="interactive-mode-toggle-btn"
      >
        {isInteractive && (
          <Sparkles size={10} className={colors.text} />
        )}
        <span className={colors.text}>
          {getModeIcon(mode, 12)}
        </span>
        <span className={`font-mono type-label ${colors.text} uppercase`}>
          {mode === 'static' ? 'Static' : INTERACTIVE_MODES[mode].label.split(' ')[0]}
        </span>
        <ChevronDown
          size={10}
          className={`${colors.text} transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <motion.div
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitions.fast}
              className="absolute bottom-full left-0 mb-1 p-1 bg-slate-900/95 border border-slate-700 radius-md shadow-elevated min-w-[200px] z-40"
              data-testid="interactive-mode-dropdown"
            >
              <div className="px-2 py-1 mb-1 border-b border-slate-800">
                <span className="font-mono type-label text-slate-500 uppercase">Output Mode</span>
              </div>

              {availableModes.map((availableMode) => {
                const modeColors = getModeColors(availableMode);
                const isActive = availableMode === mode;

                return (
                  <button
                    key={availableMode}
                    onClick={() => {
                      onModeChange(availableMode);
                      setIsOpen(false);
                    }}
                    className={`w-full px-2 py-1.5 radius-sm flex items-center gap-2 transition-colors
                               ${isActive ? modeColors.activeBg : 'hover:bg-slate-800'}`}
                    data-testid={`interactive-mode-option-${availableMode}`}
                  >
                    <span className={isActive ? modeColors.text : 'text-slate-400'}>
                      {getModeIcon(availableMode, 12)}
                    </span>
                    <div className="flex-1 text-left">
                      <span className={`font-mono type-body-sm block ${isActive ? modeColors.text : 'text-slate-300'}`}>
                        {INTERACTIVE_MODES[availableMode].label}
                      </span>
                      <span className="font-mono type-label text-slate-600 block leading-tight">
                        {INTERACTIVE_MODES[availableMode].description}
                      </span>
                    </div>
                    {isActive && (
                      <span className={`w-1.5 h-1.5 rounded-full ${modeColors.text.replace('text-', 'bg-')}`} />
                    )}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InteractiveModeToggle;
