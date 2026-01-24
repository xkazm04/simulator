/**
 * MobileDimensionSheet - Bottom sheet for dimension management on mobile
 *
 * Features:
 * - Draggable bottom sheet with snap points
 * - Swipeable dimension cards
 * - Quick-add dimension presets
 * - Haptic feedback
 * - Handles keyboard avoidance
 */

'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import {
  ChevronDown,
  Plus,
  X,
  GripHorizontal,
  Map,
  Users,
  Palette,
  CloudSun,
  Zap,
  Cpu,
  Camera,
  Ghost,
  Monitor,
  Clock,
  Theater,
} from 'lucide-react';
import { Dimension, DimensionPreset, DimensionType, DimensionFilterMode, DimensionTransformMode } from '../../types';
import { useHapticFeedback, useKeyboardHeight } from '../../hooks/useResponsive';
import { snapToNearest, triggerHaptic, GESTURE_PRESETS } from '../../lib/gestureController';
import { semanticColors } from '../../lib/semanticColors';

interface MobileDimensionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  dimensions: Dimension[];
  onDimensionChange: (id: string, reference: string) => void;
  onDimensionRemove: (id: string) => void;
  onDimensionAdd: (preset: DimensionPreset) => void;
  onDimensionWeightChange?: (id: string, weight: number) => void;
  availablePresets: DimensionPreset[];
}

// Dimension type to icon mapping
const DIMENSION_ICONS: Record<DimensionType, React.ReactNode> = {
  environment: <Map size={16} />,
  characters: <Users size={16} />,
  artStyle: <Palette size={16} />,
  mood: <CloudSun size={16} />,
  action: <Zap size={16} />,
  technology: <Cpu size={16} />,
  camera: <Camera size={16} />,
  creatures: <Ghost size={16} />,
  gameUI: <Monitor size={16} />,
  era: <Clock size={16} />,
  genre: <Theater size={16} />,
  custom: <Plus size={16} />,
};

// Sheet snap points (as percentage of screen height)
const SNAP_POINTS = {
  closed: 0,
  peek: 0.15,
  half: 0.5,
  full: 0.85,
};

export function MobileDimensionSheet({
  isOpen,
  onClose,
  dimensions,
  onDimensionChange,
  onDimensionRemove,
  onDimensionAdd,
  onDimensionWeightChange,
  availablePresets,
}: MobileDimensionSheetProps) {
  const [sheetHeight, setSheetHeight] = useState(SNAP_POINTS.half);
  const [showPresets, setShowPresets] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { trigger: haptic } = useHapticFeedback();
  const keyboardHeight = useKeyboardHeight();

  // Get window height for calculations
  const getWindowHeight = useCallback(() => {
    return typeof window !== 'undefined' ? window.innerHeight : 800;
  }, []);

  // Calculate actual pixel height
  const actualHeight = useMemo(() => {
    const windowHeight = getWindowHeight();
    return windowHeight * sheetHeight - keyboardHeight;
  }, [sheetHeight, keyboardHeight, getWindowHeight]);

  // Snap points in pixels
  const snapPointsPx = useMemo(() => {
    const windowHeight = getWindowHeight();
    return Object.values(SNAP_POINTS)
      .filter((p) => p > 0)
      .map((p) => windowHeight * p);
  }, [getWindowHeight]);

  // Handle sheet drag
  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], direction: [, dy], active, last }) => {
      if (active) {
        const windowHeight = getWindowHeight();
        const currentPx = windowHeight * sheetHeight;
        const newPx = Math.max(0, currentPx - my);
        setSheetHeight(newPx / windowHeight);
      }

      if (last) {
        const windowHeight = getWindowHeight();
        const currentPx = windowHeight * sheetHeight;

        // Use velocity for flick detection
        const snappedPx = snapToNearest(
          currentPx,
          snapPointsPx,
          vy * -dy, // Invert because y is inverted
          GESTURE_PRESETS.bottomSheet.swipeVelocityThreshold
        );

        const newHeight = snappedPx / windowHeight;

        // Close if swiped down below peek
        if (newHeight < SNAP_POINTS.peek / 2) {
          haptic('medium');
          onClose();
          setSheetHeight(SNAP_POINTS.half);
        } else {
          haptic('light');
          setSheetHeight(newHeight);
        }
      }
    },
    {
      axis: 'y',
      filterTaps: true,
      rubberband: true,
    }
  );

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle input focus to expand sheet
  const handleInputFocus = useCallback(() => {
    if (sheetHeight < SNAP_POINTS.half) {
      setSheetHeight(SNAP_POINTS.half);
    }
  }, [sheetHeight]);

  // Filtered presets (not already added)
  const filteredPresets = useMemo(() => {
    const existingTypes = new Set(dimensions.map((d) => d.type));
    return availablePresets.filter((p) => !existingTypes.has(p.type) || p.type === 'custom');
  }, [dimensions, availablePresets]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            data-testid="sheet-backdrop"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: `${(1 - sheetHeight) * 100}%` }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-slate-900 rounded-t-2xl z-50 shadow-elevated overflow-hidden"
            style={{
              height: actualHeight,
              maxHeight: '90vh',
            }}
            data-testid="mobile-dimension-sheet"
          >
            {/* Drag handle */}
            <div
              {...bind()}
              className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
            >
              <div className="w-12 h-1.5 rounded-full bg-slate-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-700/50">
              <h3 className="font-mono type-body-sm text-slate-200 uppercase tracking-wider">
                Dimensions ({dimensions.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    haptic('light');
                    setShowPresets(!showPresets);
                  }}
                  className={`p-2 radius-sm transition-colors ${
                    showPresets
                      ? `${semanticColors.primary.bg} ${semanticColors.primary.border} border`
                      : 'bg-slate-800 border border-slate-700 hover:border-slate-600'
                  }`}
                  data-testid="add-dimension-btn"
                >
                  <Plus size={16} className={showPresets ? semanticColors.primary.text : 'text-slate-400'} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 radius-sm bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors"
                  data-testid="close-sheet-btn"
                >
                  <ChevronDown size={16} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto overscroll-contain" style={{ height: 'calc(100% - 80px)' }}>
              {/* Preset selector (expandable) */}
              <AnimatePresence>
                {showPresets && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-slate-700/50"
                  >
                    <div className="p-4">
                      <span className="font-mono type-label text-slate-500 uppercase tracking-wider block mb-3">
                        Add Dimension
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {filteredPresets.map((preset) => (
                          <button
                            key={preset.type}
                            onClick={() => {
                              haptic('medium');
                              onDimensionAdd(preset);
                              setShowPresets(false);
                            }}
                            className="flex flex-col items-center gap-1 p-3 radius-md bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-colors"
                            data-testid={`preset-${preset.type}`}
                          >
                            <span className="text-slate-400">
                              {DIMENSION_ICONS[preset.type]}
                            </span>
                            <span className="font-mono type-label text-slate-300 text-center">
                              {preset.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dimension list */}
              <div className="p-4 space-y-3">
                {dimensions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Plus size={32} className="text-slate-600 mb-2" />
                    <span className="font-mono type-body-sm text-slate-500">
                      No dimensions added
                    </span>
                    <span className="font-mono type-label text-slate-600 mt-1">
                      Tap + to add your first dimension
                    </span>
                  </div>
                ) : (
                  dimensions.map((dimension, index) => (
                    <MobileDimensionCard
                      key={dimension.id}
                      dimension={dimension}
                      isEditing={editingId === dimension.id}
                      onEdit={() => setEditingId(dimension.id)}
                      onBlur={() => setEditingId(null)}
                      onChange={(value) => onDimensionChange(dimension.id, value)}
                      onRemove={() => {
                        haptic('medium');
                        onDimensionRemove(dimension.id);
                      }}
                      onWeightChange={onDimensionWeightChange ? (w) => onDimensionWeightChange(dimension.id, w) : undefined}
                      onFocus={handleInputFocus}
                    />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Individual dimension card for mobile
interface MobileDimensionCardProps {
  dimension: Dimension;
  isEditing: boolean;
  onEdit: () => void;
  onBlur: () => void;
  onChange: (value: string) => void;
  onRemove: () => void;
  onWeightChange?: (weight: number) => void;
  onFocus: () => void;
}

function MobileDimensionCard({
  dimension,
  isEditing,
  onEdit,
  onBlur,
  onChange,
  onRemove,
  onWeightChange,
  onFocus,
}: MobileDimensionCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const hasValue = dimension.reference.trim().length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`relative p-3 radius-md border transition-colors ${
        hasValue
          ? `${semanticColors.primary.border} ${semanticColors.primary.bg}`
          : 'border-slate-700/50 bg-slate-800/30'
      }`}
      data-testid={`dimension-card-${dimension.id}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={hasValue ? semanticColors.primary.text : 'text-slate-400'}>
            {DIMENSION_ICONS[dimension.type]}
          </span>
          <span className={`font-mono type-body-sm ${hasValue ? semanticColors.primary.text : 'text-slate-400'}`}>
            {dimension.label}
          </span>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 radius-sm hover:bg-red-500/20 transition-colors"
          data-testid={`remove-dimension-${dimension.id}`}
        >
          <X size={14} className="text-slate-500 hover:text-red-400" />
        </button>
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={dimension.reference}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          onEdit();
          onFocus();
        }}
        onBlur={onBlur}
        placeholder={dimension.placeholder}
        className="w-full px-3 py-2.5 radius-md bg-slate-900/50 border border-slate-700/50
                   text-slate-200 font-mono type-body-sm placeholder:text-slate-600
                   focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30
                   transition-colors"
        data-testid={`dimension-input-${dimension.id}`}
      />

      {/* Weight slider (optional) */}
      {onWeightChange && (
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono type-label text-slate-500 w-16">
            {dimension.weight}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={dimension.weight}
            onChange={(e) => onWeightChange(parseInt(e.target.value))}
            className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                       [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-cyan-400"
            data-testid={`dimension-weight-${dimension.id}`}
          />
        </div>
      )}
    </motion.div>
  );
}

export default MobileDimensionSheet;
