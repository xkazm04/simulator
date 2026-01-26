/**
 * WeightIndicator - Visual weight indicator with presets for dimension cards
 *
 * Displays dimension weight as:
 * - Colored intensity bar (gray→amber→cyan based on weight)
 * - Weight percentage label
 * - Tooltip describing weight effect
 * - Quick preset buttons (Subtle, Balanced, Strong)
 *
 * Color scale:
 * - 0-25%: Gray (minimal influence)
 * - 26-50%: Amber (subtle influence)
 * - 51-75%: Amber to cyan (balanced)
 * - 76-100%: Cyan (strong influence)
 */

'use client';

import React, { useCallback, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Weight presets with values and descriptions */
export const WEIGHT_PRESETS = [
  {
    id: 'subtle',
    label: 'Subtle',
    value: 25,
    description: 'Gentle hint - barely noticeable influence',
    shortDescription: 'Minimal impact',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    value: 60,
    description: 'Moderate blend - noticeable but not dominant',
    shortDescription: 'Moderate impact',
  },
  {
    id: 'strong',
    label: 'Strong',
    value: 90,
    description: 'Heavy influence - this dimension dominates',
    shortDescription: 'Major impact',
  },
] as const;

export type WeightPresetId = typeof WEIGHT_PRESETS[number]['id'];

/**
 * Get weight description based on value
 */
export function getWeightDescription(weight: number): string {
  if (weight <= 10) return 'Negligible - almost no effect';
  if (weight <= 25) return 'Subtle hint - barely visible influence';
  if (weight <= 40) return 'Light touch - noticeable but gentle';
  if (weight <= 60) return 'Balanced - clear but not dominant';
  if (weight <= 75) return 'Prominent - significant visual impact';
  if (weight <= 90) return 'Strong - this dimension leads';
  return 'Dominant - full transformation power';
}

/**
 * Get color classes based on weight value
 * 0-25: slate/gray, 26-60: amber, 61-100: cyan
 */
export function getWeightColorClasses(weight: number): {
  bar: string;
  text: string;
  bg: string;
  border: string;
} {
  if (weight <= 25) {
    return {
      bar: 'bg-slate-500',
      text: 'text-slate-400',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
    };
  }
  if (weight <= 60) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
    };
  }
  return {
    bar: 'bg-cyan-400',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
  };
}

interface WeightIndicatorProps {
  /** Current weight value (0-100) */
  weight: number;
  /** Callback when weight changes */
  onChange?: (weight: number) => void;
  /** Show preset buttons */
  showPresets?: boolean;
  /** Compact mode (no label text) */
  compact?: boolean;
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

function WeightIndicatorComponent({
  weight,
  onChange,
  showPresets = true,
  compact = false,
  showTooltip = true,
  disabled = false,
}: WeightIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);
  const colors = getWeightColorClasses(weight);
  const description = getWeightDescription(weight);

  const handlePresetClick = useCallback((presetValue: number) => {
    if (!disabled && onChange) {
      onChange(presetValue);
    }
  }, [disabled, onChange]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main container */}
      <div className={`flex items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
        {/* Weight bar container */}
        <div className="flex-1 min-w-0">
          {/* Label row (if not compact) */}
          {!compact && (
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Weight
              </span>
              <span className={`font-mono text-xs font-medium ${colors.text}`}>
                {weight}%
              </span>
            </div>
          )}

          {/* Bar */}
          <div className="relative h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${colors.bar}`}
              initial={false}
              animate={{ width: `${weight}%` }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            />
            {/* Gradient overlay for visual interest */}
            <div
              className="absolute inset-0 rounded-full opacity-30"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              }}
            />
          </div>

          {/* Compact mode: show percentage inline */}
          {compact && (
            <div className="flex items-center justify-between mt-0.5">
              <span className={`font-mono text-[10px] ${colors.text}`}>
                {weight}%
              </span>
            </div>
          )}
        </div>

        {/* Preset buttons */}
        {showPresets && onChange && (
          <div className="flex items-center gap-0.5">
            {WEIGHT_PRESETS.map((preset) => {
              const isActive = Math.abs(weight - preset.value) <= 5;
              const presetColors = getWeightColorClasses(preset.value);

              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.value)}
                  disabled={disabled}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-all
                    focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50
                    ${isActive
                      ? `${presetColors.bg} ${presetColors.text} ${presetColors.border} border`
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                    }
                    ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  title={preset.description}
                  data-testid={`weight-preset-${preset.id}`}
                >
                  {preset.label[0]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && isHovered && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1 z-20"
          >
            <div className={`px-2 py-1 rounded text-[10px] font-mono ${colors.bg} ${colors.border} border shadow-lg`}>
              <span className={colors.text}>{description}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Inline weight badge - compact display for headers
 */
interface WeightBadgeProps {
  weight: number;
  onClick?: () => void;
  showPercentage?: boolean;
}

export function WeightBadge({ weight, onClick, showPercentage = true }: WeightBadgeProps) {
  const colors = getWeightColorClasses(weight);

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm ${colors.bg} ${colors.border} border transition-colors
        ${onClick ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
      `}
      title={getWeightDescription(weight)}
      data-testid="weight-badge"
    >
      {/* Mini bar indicator */}
      <div className="w-6 h-1 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colors.bar}`}
          style={{ width: `${weight}%` }}
        />
      </div>
      {showPercentage && (
        <span className={`font-mono text-[10px] ${colors.text}`}>
          {weight}%
        </span>
      )}
    </button>
  );
}

export const WeightIndicator = memo(WeightIndicatorComponent);
export default WeightIndicator;
