/**
 * DimensionColumn - Collapsible dimension parameters column
 *
 * Props-only leaf component (no context reads).
 * Displays dimension cards in a vertical scrollable column.
 * Used for both left (Parameters A) and right (Parameters B) columns.
 */

'use client';

import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dimension, DimensionFilterMode, DimensionTransformMode, DimensionPreset, PromptElement } from '../../types';
import { DimensionGrid } from './DimensionGrid';
import { IconButton } from '@/app/components/ui';
import { fadeIn, EASE, DURATION, useReducedMotion, getReducedMotionTransitions } from '../../lib/motion';

export interface DimensionColumnProps {
  /** Position of the column */
  side: 'left' | 'right';
  /** Label for the column header */
  label: string;
  /** Collapsed label (displayed vertically) */
  collapsedLabel: string;
  /** Dimensions to display in this column (subset of all dimensions) */
  dimensions: Dimension[];
  /** Handler for reordering within this column's dimensions */
  onReorder: (reorderedDimensions: Dimension[]) => void;
  /** Handler for dimension value change */
  onChange: (id: string, reference: string) => void;
  /** Handler for dimension weight change */
  onWeightChange: (id: string, weight: number) => void;
  /** Handler for dimension filter mode change */
  onFilterModeChange: (id: string, filterMode: DimensionFilterMode) => void;
  /** Handler for dimension transform mode change */
  onTransformModeChange: (id: string, transformMode: DimensionTransformMode) => void;
  /** Handler for dimension reference image change */
  onReferenceImageChange: (id: string, imageDataUrl: string | null) => void;
  /** Handler for removing a dimension */
  onRemove: (id: string) => void;
  /** Handler for adding a dimension */
  onAdd: (preset: DimensionPreset) => void;
  /** Handler for dropping an element on a dimension */
  onDropElement: (element: PromptElement, dimensionId: string) => void;
  /** Controlled expand state (optional - uses internal state if not provided) */
  isExpanded?: boolean;
  /** Callback when expand state changes (required if isExpanded is provided) */
  onToggleExpand?: () => void;
  /** Whether dimension inputs are disabled (e.g., during autoplay) */
  disabled?: boolean;
}

function DimensionColumnComponent({
  side,
  label,
  collapsedLabel,
  dimensions,
  onReorder,
  onChange,
  onWeightChange,
  onFilterModeChange,
  onTransformModeChange,
  onReferenceImageChange,
  onRemove,
  onAdd,
  onDropElement,
  isExpanded: controlledExpanded,
  onToggleExpand: controlledToggle,
  disabled,
}: DimensionColumnProps) {
  // Local collapse state (used if not controlled)
  const [internalExpanded, setInternalExpanded] = useState(true);

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  // Reduced motion support for accessibility
  const prefersReducedMotion = useReducedMotion();
  const motionTransitions = getReducedMotionTransitions(prefersReducedMotion);
  const panelDuration = prefersReducedMotion ? 0 : DURATION.panel;

  const ChevronIcon = side === 'left' ? ChevronLeft : ChevronRight;
  const testId = side === 'left' ? 'left-params-collapse-btn' : 'right-params-collapse-btn';
  const scrollPadding = side === 'left' ? 'pr-2' : 'pl-2';
  const verticalTextStyle = side === 'left'
    ? { writingMode: 'vertical-rl' as const, transform: 'rotate(180deg)' }
    : { writingMode: 'vertical-rl' as const };

  const onToggleExpand = () => {
    if (isControlled && controlledToggle) {
      controlledToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-sm overflow-hidden bg-slate-900/10 radius-lg border border-white/5 p-sm backdrop-blur-sm shrink-0"
      initial={false}
      animate={{ width: isExpanded ? 288 : 36 }}
      transition={{ duration: panelDuration, ease: EASE.default }}
    >
      {/* Header with toggle */}
      <div
        className={`flex items-center gap-2 px-2 py-1 type-body-sm uppercase tracking-widest text-white/90 font-medium shrink-0 drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] ${
          !isExpanded ? 'flex-col h-full' : ''
        }`}
      >
        {side === 'left' ? (
          <>
            {isExpanded && (
              <>
                <div className="h-px bg-slate-700 flex-1" />
                <span className="whitespace-nowrap">{label}</span>
                <div className="h-px bg-slate-700 flex-1" />
              </>
            )}
            <IconButton
              size="sm"
              variant="solid"
              colorScheme="default"
              onClick={onToggleExpand}
              data-testid={testId}
              label={isExpanded ? `Collapse ${side} parameters` : `Expand ${side} parameters`}
              className="shrink-0"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 0 : 180 }}
                transition={motionTransitions.normal}
              >
                <ChevronIcon size={12} />
              </motion.div>
            </IconButton>
            {!isExpanded && (
              <span
                className="type-label text-slate-600 whitespace-nowrap flex-1 flex items-center justify-center"
                style={verticalTextStyle}
              >
                {collapsedLabel}
              </span>
            )}
          </>
        ) : (
          <>
            <IconButton
              size="sm"
              variant="solid"
              colorScheme="default"
              onClick={onToggleExpand}
              data-testid={testId}
              label={isExpanded ? `Collapse ${side} parameters` : `Expand ${side} parameters`}
              className="shrink-0"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 0 : 180 }}
                transition={motionTransitions.normal}
              >
                <ChevronIcon size={12} />
              </motion.div>
            </IconButton>
            {isExpanded ? (
              <>
                <div className="h-px bg-slate-700 flex-1" />
                <span className="whitespace-nowrap">{label}</span>
                <div className="h-px bg-slate-700 flex-1" />
              </>
            ) : (
              <span
                className="type-label text-slate-600 whitespace-nowrap flex-1 flex items-center justify-center"
                style={verticalTextStyle}
              >
                {collapsedLabel}
              </span>
            )}
          </>
        )}
      </div>

      {/* Content - only render when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={motionTransitions.normal}
            className={`flex-1 overflow-y-auto ${scrollPadding} custom-scrollbar`}
          >
            <div className="pb-2">
              <DimensionGrid
                dimensions={dimensions}
                onChange={onChange}
                onWeightChange={onWeightChange}
                onFilterModeChange={onFilterModeChange}
                onTransformModeChange={onTransformModeChange}
                onReferenceImageChange={onReferenceImageChange}
                onRemove={onRemove}
                onAdd={onAdd}
                onReorder={onReorder}
                onDropElement={onDropElement}
                disabled={disabled}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const DimensionColumn = memo(DimensionColumnComponent);
export default DimensionColumn;
