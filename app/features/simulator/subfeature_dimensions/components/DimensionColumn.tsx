/**
 * DimensionColumn - Collapsible dimension parameters column
 *
 * Uses DimensionsContext to access all dimension state and handlers.
 * Displays dimension cards in a vertical scrollable column.
 * Used for both left (Parameters A) and right (Parameters B) columns.
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dimension } from '../../types';
import { DimensionGrid } from './DimensionGrid';
import { IconButton } from '@/app/components/ui';
import { fadeIn, EASE, DURATION, useReducedMotion, getReducedMotionTransitions } from '../../lib/motion';
import { useDimensionsContext } from '../DimensionsContext';
import { useSimulatorContext } from '../../SimulatorContext';

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
}

export function DimensionColumn({
  side,
  label,
  collapsedLabel,
  dimensions,
  onReorder,
}: DimensionColumnProps) {
  // Get dimension handlers from context
  const dimensionsCtx = useDimensionsContext();
  const simulatorCtx = useSimulatorContext();

  // Local collapse state
  const [isExpanded, setIsExpanded] = useState(true);

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

  const onToggleExpand = () => setIsExpanded(!isExpanded);

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
                onChange={dimensionsCtx.handleDimensionChange}
                onWeightChange={dimensionsCtx.handleDimensionWeightChange}
                onFilterModeChange={dimensionsCtx.handleDimensionFilterModeChange}
                onTransformModeChange={dimensionsCtx.handleDimensionTransformModeChange}
                onReferenceImageChange={dimensionsCtx.handleDimensionReferenceImageChange}
                onRemove={dimensionsCtx.handleDimensionRemove}
                onAdd={dimensionsCtx.handleDimensionAdd}
                onReorder={onReorder}
                onDropElement={simulatorCtx.onDropElementOnDimension}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default DimensionColumn;
