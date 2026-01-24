/**
 * ElementChip - Draggable element label extracted from prompts
 * Design: Clean Manuscript style
 *
 * Implements the Concept duality pattern:
 * - Elements are OUTPUT concepts (generated content)
 * - Dragging converts them to INPUT concepts (dimension constraints)
 *
 * Users can:
 * - Click to directly refine dimensions based on this element (triggers LLM)
 * - Drag to any dimension card to apply the element value directly
 *
 * This enables bidirectional creative flow: outputs → inputs
 */

'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, GripVertical } from 'lucide-react';
import { PromptElement } from '../../types';
import { getCategoryColors } from '../../lib/semanticColors';
import { interactiveStates } from '../../lib/motion';
import { useElementInteraction } from '../../hooks/useElementInteraction';

interface ElementChipProps {
  element: PromptElement;
  onToggleLock: (elementId: string) => void;
  onAccept?: (element: PromptElement) => void;
  isAccepting?: boolean;
  /** Enable drag-to-dimension functionality */
  draggable?: boolean;
}

/**
 * Category labels for display
 */
const CATEGORY_LABELS: Record<string, string> = {
  composition: 'comp',
  lighting: 'light',
  style: 'style',
  mood: 'mood',
  subject: 'subj',
  setting: 'set',
  quality: 'qual',
};

/**
 * Get hover class combinations based on category
 * Using explicit class names for Tailwind to detect at build time
 * (Dynamic template literals like hover:${var} don't work with Tailwind)
 */
function getHoverClasses(category: string): string {
  switch (category) {
    case 'composition':
      return 'hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-500/20';
    case 'lighting':
      return 'hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/20';
    case 'style':
      return 'hover:border-purple-500/30 hover:text-purple-400 hover:bg-purple-500/20';
    case 'mood':
      return 'hover:border-pink-500/30 hover:text-pink-400 hover:bg-pink-500/20';
    case 'subject':
      return 'hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-cyan-500/20';
    case 'setting':
      return 'hover:border-green-500/30 hover:text-green-400 hover:bg-green-500/20';
    case 'quality':
    default:
      return 'hover:border-slate-500/30 hover:text-slate-400 hover:bg-slate-500/20';
  }
}

function ElementChipComponent({
  element,
  onToggleLock,
  onAccept,
  isAccepting,
  draggable = true,
}: ElementChipProps) {
  const colors = getCategoryColors(element.category);
  const hoverClasses = getHoverClasses(element.category);

  // Use shared interaction hook for drag, click, and keyboard handling
  const { isDragging, dragProps, handleClick, handleKeyDown } = useElementInteraction({
    element,
    isProcessing: isAccepting,
    draggable,
    onClick: onAccept,
  });

  return (
    <div {...dragProps}>
      <motion.div
        whileHover={isDragging ? interactiveStates.hoverDraggable : interactiveStates.hoverScale}
        whileTap={interactiveStates.tapScale}
        data-testid={`element-chip-${element.id}`}
        data-element-id={element.id}
        data-element-category={element.category}
        className={`
          group inline-flex items-center gap-1.5 px-2.5 py-1.5 radius-sm border
          font-mono type-body-sm
          focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900
          ${isDragging
            ? `${colors.bgHover} ${colors.border} ${colors.text} opacity-70 cursor-grabbing scale-105 transition-all duration-150`
            : isAccepting
              ? `${colors.bgHover} ${colors.border} ${colors.text} cursor-wait transition-all duration-150`
              : `${colors.bg} border-slate-700/50 text-slate-400 ${hoverClasses} cursor-pointer btn-elevated btn-glow-purple`
          }
        `}
        tabIndex={0}
        role="button"
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        title={isAccepting
          ? 'Refining dimensions...'
          : draggable
            ? 'Click to refine or drag to dimension'
            : 'Click to refine dimensions with this element'
        }
      >
        {/* Drag handle indicator (shows on hover when draggable) */}
        {draggable && !isAccepting && (
          <GripVertical
            size={10}
            className="text-slate-600 opacity-0 group-hover:opacity-100 -ml-0.5 mr-0.5 transition-opacity cursor-grab"
            data-testid={`element-chip-drag-handle-${element.id}`}
          />
        )}

        {/* Processing indicator */}
        {isAccepting ? (
          <Loader2 size={10} className="animate-spin text-purple-400" />
        ) : (
          <Sparkles size={10} className="text-purple-400/70 group-hover:text-purple-400" />
        )}

        {/* Category prefix */}
        <span className={`${isAccepting ? colors.text : 'text-slate-500 group-hover:text-slate-400'} opacity-70`}>
          {CATEGORY_LABELS[element.category] || element.category.slice(0, 4)}:
        </span>

        {/* Element text */}
        <span className={isAccepting ? colors.text : 'text-slate-300 group-hover:text-white'}>
          {element.text}
        </span>
      </motion.div>
    </div>
  );
}

/**
 * Custom comparison function for React.memo
 * Only re-render when element content or state changes
 */
function arePropsEqual(
  prevProps: ElementChipProps,
  nextProps: ElementChipProps
): boolean {
  // Compare element identity and content
  if (prevProps.element.id !== nextProps.element.id) return false;
  if (prevProps.element.text !== nextProps.element.text) return false;
  if (prevProps.element.category !== nextProps.element.category) return false;
  if (prevProps.element.locked !== nextProps.element.locked) return false;

  // Compare state flags
  if (prevProps.isAccepting !== nextProps.isAccepting) return false;
  if (prevProps.draggable !== nextProps.draggable) return false;

  return true;
}

export const ElementChip = memo(ElementChipComponent, arePropsEqual);
export default ElementChip;
