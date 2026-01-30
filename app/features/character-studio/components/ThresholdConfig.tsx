'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Save, AlertTriangle, Info } from 'lucide-react';
import type { ConsistencyMetrics } from '../types';
import {
  type ThresholdConfig as ThresholdConfigType,
  DEFAULT_THRESHOLDS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_COLORS,
  saveThresholds,
  resetThresholds,
} from '../lib/consistencyCalculator';

interface ThresholdConfigProps {
  isOpen: boolean;
  onClose: () => void;
  thresholds: ThresholdConfigType;
  onThresholdsChange: (thresholds: ThresholdConfigType) => void;
  currentMetrics?: ConsistencyMetrics | null;
}

interface ThresholdSliderProps {
  attribute: keyof ConsistencyMetrics;
  value: number;
  currentValue?: number;
  onChange: (value: number) => void;
}

function ThresholdSlider({ attribute, value, currentValue, onChange }: ThresholdSliderProps) {
  const label = ATTRIBUTE_LABELS[attribute];
  const color = ATTRIBUTE_COLORS[attribute];
  const isBelowThreshold = currentValue !== undefined && currentValue < value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-mono text-slate-300">{label}</span>
          {isBelowThreshold && (
            <AlertTriangle size={12} className="text-amber-400" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentValue !== undefined && (
            <span
              className={`text-[10px] font-mono ${
                isBelowThreshold ? 'text-amber-400' : 'text-slate-500'
              }`}
            >
              Current: {Math.round(currentValue)}%
            </span>
          )}
          <span className="text-xs font-mono text-white w-10 text-right">
            {value}%
          </span>
        </div>
      </div>

      <div className="relative">
        {/* Track background */}
        <div className="h-1.5 bg-slate-800 rounded-full">
          {/* Filled portion */}
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${value}%`,
              background: `linear-gradient(to right, ${color}40, ${color})`,
            }}
          />
        </div>

        {/* Current value indicator */}
        {currentValue !== undefined && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full transition-all"
            style={{
              left: `${currentValue}%`,
              backgroundColor: isBelowThreshold ? '#fbbf24' : '#22c55e',
            }}
          />
        )}

        {/* Range input (invisible, for interaction) */}
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {/* Thumb indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full
                   border-2 border-white bg-slate-900 shadow-md pointer-events-none transition-all"
          style={{ left: `${value}%` }}
        />
      </div>

      {/* Quick presets */}
      <div className="flex gap-1">
        {[30, 50, 70, 90].map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors
                      ${value === preset
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
          >
            {preset}%
          </button>
        ))}
      </div>
    </div>
  );
}

export function ThresholdConfig({
  isOpen,
  onClose,
  thresholds,
  onThresholdsChange,
  currentMetrics,
}: ThresholdConfigProps) {
  const [localThresholds, setLocalThresholds] = useState<ThresholdConfigType>(thresholds);
  const [hasChanges, setHasChanges] = useState(false);

  const handleThresholdChange = useCallback((
    attribute: keyof ConsistencyMetrics,
    value: number
  ) => {
    setLocalThresholds((prev) => ({
      ...prev,
      [attribute]: value,
    }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    saveThresholds(localThresholds);
    onThresholdsChange(localThresholds);
    setHasChanges(false);
    onClose();
  }, [localThresholds, onThresholdsChange, onClose]);

  const handleReset = useCallback(() => {
    const defaults = resetThresholds();
    setLocalThresholds(defaults);
    setHasChanges(true);
  }, []);

  const handleCancel = useCallback(() => {
    setLocalThresholds(thresholds);
    setHasChanges(false);
    onClose();
  }, [thresholds, onClose]);

  // Count how many metrics are currently below threshold
  const alertCount = currentMetrics
    ? Object.entries(localThresholds).filter(([key, threshold]) => {
        const value = currentMetrics[key as keyof ConsistencyMetrics];
        return value < threshold;
      }).length
    : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                     w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl
                     shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div>
                <h3 className="font-mono text-sm text-white">Threshold Configuration</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Set alert thresholds for each consistency metric
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-md text-slate-500 hover:text-white
                         hover:bg-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto ms-scrollbar">
              {/* Info banner */}
              <div className="flex gap-2 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <Info size={14} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-cyan-300/80 leading-relaxed">
                  Alerts will trigger when a metric falls below its threshold.
                  The dashed line on the radar shows the current threshold boundary.
                </p>
              </div>

              {/* Alert summary */}
              {alertCount > 0 && (
                <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span className="text-[10px] text-amber-300/80">
                    {alertCount} metric{alertCount > 1 ? 's' : ''} currently below threshold
                  </span>
                </div>
              )}

              {/* Threshold sliders */}
              <div className="space-y-4">
                {(Object.keys(DEFAULT_THRESHOLDS) as (keyof ConsistencyMetrics)[]).map((attribute) => (
                  <ThresholdSlider
                    key={attribute}
                    attribute={attribute}
                    value={localThresholds[attribute]}
                    currentValue={currentMetrics?.[attribute]}
                    onChange={(value) => handleThresholdChange(attribute, value)}
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800/50">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         text-slate-400 hover:text-white hover:bg-slate-700
                         text-xs font-mono transition-colors"
              >
                <RotateCcw size={12} />
                Reset to defaults
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-lg border border-slate-600
                           text-slate-400 hover:text-white hover:border-slate-500
                           text-xs font-mono transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-cyan-500/20 border border-cyan-500/30 text-cyan-400
                           hover:bg-cyan-500/30 text-xs font-mono transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={12} />
                  Save changes
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
