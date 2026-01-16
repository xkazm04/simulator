/**
 * DimensionGrid - Grid layout for remix dimensions
 * Design: Clean Manuscript style
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Dimension, DimensionPreset, DimensionFilterMode, DimensionTransformMode, PromptElement } from '../types';
import { DimensionCard } from './DimensionCard';
import { EXTRA_DIMENSIONS } from '../lib/defaultDimensions';
import { fadeIn, slideDown, staggeredTransition, transitions } from '../lib/motion';

interface DimensionGridProps {
  dimensions: Dimension[];
  onChange: (id: string, reference: string) => void;
  onWeightChange?: (id: string, weight: number) => void;
  onFilterModeChange?: (id: string, filterMode: DimensionFilterMode) => void;
  onTransformModeChange?: (id: string, transformMode: DimensionTransformMode) => void;
  onReferenceImageChange?: (id: string, imageDataUrl: string | null) => void;
  onRemove: (id: string) => void;
  onAdd: (preset: DimensionPreset) => void;
  /** Handler for reordering dimensions via drag-and-drop */
  onReorder?: (reorderedDimensions: Dimension[]) => void;
  /** Handler for dropping an element onto a dimension (bidirectional flow) */
  onDropElement?: (element: PromptElement, dimensionId: string) => void;
}

export function DimensionGrid({
  dimensions,
  onChange,
  onWeightChange,
  onFilterModeChange,
  onTransformModeChange,
  onReferenceImageChange,
  onRemove,
  onAdd,
  onReorder,
  onDropElement,
}: DimensionGridProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Filter out already-used dimension types
  const usedTypes = new Set(dimensions.map((d) => d.type));
  const availableExtras = EXTRA_DIMENSIONS.filter((d) => !usedTypes.has(d.type));

  const filledCount = dimensions.filter((d) => d.reference.trim()).length;

  return (
    <div className="space-y-sm">
      {/* Header */}
      <div className="flex items-center gap-sm">
        <span className="font-mono type-label uppercase tracking-wider text-slate-600">
          // remix_dimensions
        </span>
        <span className="font-mono type-label text-slate-500">
          ({filledCount}/{dimensions.length} filled)
        </span>
        <div className="flex-1 h-px bg-slate-800/50" />
      </div>

      {/* Grid with drag-and-drop reordering */}
      <Reorder.Group
        axis="y"
        values={dimensions}
        onReorder={onReorder || (() => {})}
        className="grid grid-cols-1 gap-sm"
      >
        {dimensions.map((dimension, index) => (
          <Reorder.Item
            key={dimension.id}
            value={dimension}
            className="cursor-grab active:cursor-grabbing"
          >
            <DimensionCard
              dimension={dimension}
              onChange={onChange}
              onWeightChange={onWeightChange}
              onFilterModeChange={onFilterModeChange}
              onTransformModeChange={onTransformModeChange}
              onReferenceImageChange={onReferenceImageChange}
              onRemove={onRemove}
              index={index}
              onDropElement={onDropElement}
            />
          </Reorder.Item>
        ))}

        {/* Add More Button */}
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          transition={staggeredTransition(dimensions.length)}
          className="relative"
        >
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-full h-full min-h-[100px] flex flex-col items-center justify-center gap-sm
                      radius-lg border-2 border-dashed border-slate-700/50 hover:border-slate-600
                      text-slate-500 hover:text-slate-400 transition-colors bg-surface-secondary"
          >
            <Plus size={18} />
            <span className="font-mono type-label">add_dimension</span>
          </button>

          {/* Add Menu Dropdown */}
          <AnimatePresence>
            {showAddMenu && availableExtras.length > 0 && (
              <motion.div
                variants={slideDown}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transitions.fast}
                className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700
                          radius-lg shadow-floating overflow-hidden z-10"
              >
                {availableExtras.map((preset) => (
                  <button
                    key={preset.type}
                    onClick={() => {
                      onAdd(preset);
                      setShowAddMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left
                              hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="text-sm">{preset.icon}</span>
                    <span className="font-mono type-label text-slate-300">
                      {preset.label.toLowerCase().replace(/\s+/g, '_')}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </Reorder.Group>
    </div>
  );
}

export default DimensionGrid;
