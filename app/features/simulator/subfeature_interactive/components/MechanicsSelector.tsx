/**
 * MechanicsSelector - Component for selecting game mechanics template
 *
 * Allows users to choose between different game mechanics types:
 * - Platformer: Side-scrolling with jump physics
 * - Top-Down: 8-directional movement
 * - Puzzle: Physics-based puzzle mechanics
 *
 * Shows a preview of controls and features for each type.
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Gamepad2,
  Move,
  Puzzle,
  Target,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Space,
} from 'lucide-react';
import { GameMechanicsType, MECHANICS_TEMPLATES } from '../lib/mechanicsTemplates';
import { scaleIn, transitions } from '../../lib/motion';
import { semanticColors } from '../../lib/semanticColors';

interface MechanicsSelectorProps {
  /** Currently selected mechanics type */
  selected: GameMechanicsType;
  /** Callback when mechanics type changes */
  onSelect: (type: GameMechanicsType) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Compact mode for smaller UI */
  compact?: boolean;
}

interface MechanicsOption {
  type: GameMechanicsType;
  icon: React.ReactNode;
  label: string;
  description: string;
  controls: string[];
  features: string[];
}

const MECHANICS_OPTIONS: MechanicsOption[] = [
  {
    type: 'platformer',
    icon: <Gamepad2 size={16} />,
    label: 'Platformer',
    description: 'Side-scrolling with jump physics',
    controls: ['Arrow Keys / WASD: Move', 'Space: Jump', 'Double-tap Space: Double Jump'],
    features: ['Gravity physics', 'Platform collision', 'Double jump', 'Wall slide'],
  },
  {
    type: 'top-down',
    icon: <Move size={16} />,
    label: 'Top-Down',
    description: '8-directional movement view',
    controls: ['Arrow Keys / WASD: Move', 'Mouse: Aim direction', 'Click: Interact'],
    features: ['Free movement', 'Push objects', 'Mouse aiming', 'No gravity'],
  },
  {
    type: 'puzzle',
    icon: <Puzzle size={16} />,
    label: 'Puzzle',
    description: 'Physics-based puzzle mechanics',
    controls: ['Arrow Keys / WASD: Move', 'Space: Interact', 'Z: Undo'],
    features: ['Light gravity', 'Push blocks', 'Trigger zones', 'Reset option'],
  },
  {
    type: 'shooter',
    icon: <Target size={16} />,
    label: 'Shooter',
    description: 'Combat with projectile physics',
    controls: ['WASD: Move', 'Mouse: Aim', 'Click: Shoot', 'Space: Dodge'],
    features: ['Projectile physics', 'Mouse aiming', 'Quick movement', 'Combat focus'],
  },
  {
    type: 'fps',
    icon: <Target size={16} />,
    label: 'FPS',
    description: 'First-person shooter style',
    controls: ['WASD: Move', 'Mouse: Look', 'Click: Shoot', 'E: Interact'],
    features: ['WASD strafing', 'Mouse look', 'Cover system', 'Target practice'],
  },
  {
    type: 'third-person',
    icon: <Gamepad2 size={16} />,
    label: 'Third-Person',
    description: 'Third-person camera with character',
    controls: ['WASD / Arrows: Move', 'Space: Jump', 'E: Action', 'Q: Secondary'],
    features: ['Character controller', 'Camera follow', 'Smooth movement', 'Collectibles'],
  },
];

export function MechanicsSelector({
  selected,
  onSelect,
  disabled = false,
  compact = false,
}: MechanicsSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredType, setHoveredType] = useState<GameMechanicsType | null>(null);

  const selectedOption = MECHANICS_OPTIONS.find((opt) => opt.type === selected) || MECHANICS_OPTIONS[0];
  const previewOption = hoveredType
    ? MECHANICS_OPTIONS.find((opt) => opt.type === hoveredType)
    : selectedOption;

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-2 py-1 radius-sm border transition-colors
                     ${semanticColors.primary.bg} ${semanticColors.primary.border}
                     ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-125'}`}
          data-testid="mechanics-selector-btn"
        >
          <span className={semanticColors.primary.text}>{selectedOption.icon}</span>
          <span className={`font-mono type-label ${semanticColors.primary.text} uppercase`}>
            {selectedOption.label}
          </span>
          <ChevronDown
            size={10}
            className={`${semanticColors.primary.text} transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
              <motion.div
                variants={scaleIn}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transitions.fast}
                className="absolute bottom-full left-0 mb-1 p-1 bg-slate-900/95 border border-slate-700 radius-md shadow-elevated min-w-[180px] z-40"
                data-testid="mechanics-dropdown"
              >
                {MECHANICS_OPTIONS.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => {
                      onSelect(option.type);
                      setIsOpen(false);
                    }}
                    className={`w-full px-2 py-1.5 radius-sm flex items-center gap-2 transition-colors
                               ${option.type === selected ? semanticColors.primary.bg : 'hover:bg-slate-800'}`}
                    data-testid={`mechanics-option-${option.type}`}
                  >
                    <span className={option.type === selected ? semanticColors.primary.text : 'text-slate-400'}>
                      {option.icon}
                    </span>
                    <div className="flex-1 text-left">
                      <span className={`font-mono type-body-sm block ${option.type === selected ? semanticColors.primary.text : 'text-slate-300'}`}>
                        {option.label}
                      </span>
                    </div>
                    {option.type === selected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    )}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full mode with preview
  return (
    <div className="space-y-3" data-testid="mechanics-selector">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Gamepad2 size={14} className="text-cyan-400" />
        <span className="font-mono type-label text-cyan-400 uppercase tracking-wider">
          Game Mechanics
        </span>
      </div>

      {/* Options grid */}
      <div className="grid grid-cols-2 gap-2">
        {MECHANICS_OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => !disabled && onSelect(option.type)}
            onMouseEnter={() => setHoveredType(option.type)}
            onMouseLeave={() => setHoveredType(null)}
            disabled={disabled}
            className={`p-3 radius-md border text-left transition-all
                       ${option.type === selected
                         ? `${semanticColors.primary.border} ${semanticColors.primary.bg}`
                         : 'border-slate-700/50 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60'}
                       ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            data-testid={`mechanics-card-${option.type}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={option.type === selected ? semanticColors.primary.text : 'text-slate-400'}>
                {option.icon}
              </span>
              <span className={`font-mono type-body-sm font-medium ${option.type === selected ? semanticColors.primary.text : 'text-slate-200'}`}>
                {option.label}
              </span>
            </div>
            <p className="font-mono type-label text-slate-500 leading-tight">
              {option.description}
            </p>
          </button>
        ))}
      </div>

      {/* Preview panel */}
      {previewOption && (
        <motion.div
          key={previewOption.type}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 radius-md border border-slate-700/50 bg-slate-900/40"
        >
          <div className="flex items-start gap-4">
            {/* Controls */}
            <div className="flex-1">
              <span className="font-mono type-label text-slate-500 uppercase tracking-wider block mb-2">
                Controls
              </span>
              <div className="space-y-1">
                {previewOption.controls.map((control, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <ControlIcon control={control} />
                    <span className="font-mono type-label text-slate-400">{control}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="flex-1">
              <span className="font-mono type-label text-slate-500 uppercase tracking-wider block mb-2">
                Features
              </span>
              <div className="space-y-1">
                {previewOption.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-cyan-500/50" />
                    <span className="font-mono type-label text-slate-400">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Visual control preview */}
          <div className="mt-3 pt-3 border-t border-slate-700/30">
            <ControlsPreview type={previewOption.type} />
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Render appropriate icon for a control
 */
function ControlIcon({ control }: { control: string }) {
  const lower = control.toLowerCase();

  if (lower.includes('arrow') || lower.includes('wasd') || lower.includes('move')) {
    return <Move size={10} className="text-slate-500" />;
  }
  if (lower.includes('space') || lower.includes('jump')) {
    return <ArrowUp size={10} className="text-slate-500" />;
  }
  if (lower.includes('mouse') || lower.includes('click')) {
    return <Target size={10} className="text-slate-500" />;
  }
  return <Gamepad2 size={10} className="text-slate-500" />;
}

/**
 * Visual preview of control layout
 */
function ControlsPreview({ type }: { type: GameMechanicsType }) {
  const showVertical = type === 'top-down' || type === 'puzzle';

  return (
    <div className="flex items-center justify-center gap-6">
      {/* Arrow keys visualization */}
      <div className="flex flex-col items-center gap-1">
        {showVertical && (
          <div className="w-6 h-6 rounded bg-slate-800 border border-slate-600 flex items-center justify-center">
            <ArrowUp size={12} className="text-slate-400" />
          </div>
        )}
        <div className="flex gap-1">
          <div className="w-6 h-6 rounded bg-slate-800 border border-slate-600 flex items-center justify-center">
            <ArrowLeft size={12} className="text-slate-400" />
          </div>
          {showVertical && (
            <div className="w-6 h-6 rounded bg-slate-800 border border-slate-600 flex items-center justify-center">
              <ArrowDown size={12} className="text-slate-400" />
            </div>
          )}
          <div className="w-6 h-6 rounded bg-slate-800 border border-slate-600 flex items-center justify-center">
            <ArrowRight size={12} className="text-slate-400" />
          </div>
        </div>
        <span className="font-mono type-label text-slate-600 mt-1">Move</span>
      </div>

      {/* Action key */}
      {(type === 'platformer' || type === 'puzzle') && (
        <div className="flex flex-col items-center gap-1">
          <div className="w-16 h-6 rounded bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <span className="font-mono type-label text-cyan-400">SPACE</span>
          </div>
          <span className="font-mono type-label text-slate-600 mt-1">
            {type === 'platformer' ? 'Jump' : 'Action'}
          </span>
        </div>
      )}

      {/* Mouse visualization for shooter/top-down */}
      {(type === 'shooter' || type === 'top-down') && (
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-10 rounded-lg bg-slate-800 border border-slate-600 flex flex-col items-center justify-start pt-1 gap-0.5">
            <div className="w-3 h-3 rounded-sm bg-cyan-500/30 border border-cyan-500/50" />
            <div className="w-3 h-3 rounded-sm bg-slate-700" />
          </div>
          <span className="font-mono type-label text-slate-600 mt-1">
            {type === 'shooter' ? 'Aim/Shoot' : 'Interact'}
          </span>
        </div>
      )}
    </div>
  );
}

export default MechanicsSelector;
