/**
 * useElementInteraction - Shared hook for element chip interaction patterns
 *
 * Provides consistent drag, click, and keyboard interaction handling for
 * ElementChip and related components. Implements the bidirectional flow
 * pattern where output elements can be dragged/clicked to become inputs.
 *
 * Features:
 * - Drag state management with data transfer
 * - Click handling with processing/dragging guards
 * - Keyboard accessibility (Enter/Space)
 */

'use client';

import { useState, useCallback } from 'react';
import { PromptElement } from '../types';

interface UseElementInteractionOptions {
  /** The element being interacted with */
  element: PromptElement;
  /** Whether the element is currently being processed (e.g., LLM call) */
  isProcessing?: boolean;
  /** Whether dragging is enabled */
  draggable?: boolean;
  /** Callback when element is clicked (not during drag or processing) */
  onClick?: (element: PromptElement) => void;
}

interface UseElementInteractionReturn {
  /** Whether the element is currently being dragged */
  isDragging: boolean;
  /** Props to spread on the draggable container element */
  dragProps: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
  /** Handler for click events (guards against drag/processing states) */
  handleClick: () => void;
  /** Handler for keyboard events (Enter/Space triggers click) */
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Hook for managing element chip interactions
 *
 * @example
 * ```tsx
 * const { isDragging, dragProps, handleClick, handleKeyDown } = useElementInteraction({
 *   element,
 *   isProcessing: isAccepting,
 *   draggable: true,
 *   onClick: (el) => onAccept?.(el),
 * });
 *
 * return (
 *   <div {...dragProps}>
 *     <motion.div
 *       onClick={handleClick}
 *       onKeyDown={handleKeyDown}
 *       tabIndex={0}
 *       role="button"
 *     >
 *       {children}
 *     </motion.div>
 *   </div>
 * );
 * ```
 */
export function useElementInteraction({
  element,
  isProcessing = false,
  draggable = true,
  onClick,
}: UseElementInteractionOptions): UseElementInteractionReturn {
  const [isDragging, setIsDragging] = useState(false);

  // Click handler with guards for drag and processing states
  const handleClick = useCallback(() => {
    if (isProcessing || isDragging) return;
    onClick?.(element);
  }, [isProcessing, isDragging, onClick, element]);

  // Keyboard accessibility - Enter/Space triggers click
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  // Drag start handler - sets up data transfer
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      setIsDragging(true);
      // Store element data for drop target
      e.dataTransfer.setData('application/json', JSON.stringify(element));
      e.dataTransfer.setData('text/plain', element.text);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [element]
  );

  // Drag end handler - resets drag state
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Drag props to spread on container
  const dragProps = {
    draggable: draggable && !isProcessing,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  };

  return {
    isDragging,
    dragProps,
    handleClick,
    handleKeyDown,
  };
}

export default useElementInteraction;
