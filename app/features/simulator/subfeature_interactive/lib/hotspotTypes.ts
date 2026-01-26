/**
 * Hotspot Types - Types for hotspot editing mode
 *
 * Extends InteractiveRegion with editing-specific functionality for
 * drawing, resizing, and configuring interactive hotspot regions.
 */

import { InteractiveRegion } from '../../types';

/**
 * HotspotAction - Actions that can be assigned to a hotspot
 */
export type HotspotActionType = 'navigate' | 'tooltip' | 'highlight' | 'callback';

/**
 * Hotspot - Extended region with editing metadata
 */
export interface Hotspot extends InteractiveRegion {
  /** Whether this hotspot is currently selected in edit mode */
  selected?: boolean;
  /** Custom tooltip text for tooltip action */
  tooltipText?: string;
  /** Highlight color for highlight action */
  highlightColor?: string;
  /** Navigate URL for navigate action */
  navigateUrl?: string;
}

/**
 * HotspotBounds - Bounding box for a hotspot in normalized coordinates (0-1)
 */
export interface HotspotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * DrawState - Current state of hotspot drawing operation
 */
export interface DrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/**
 * ResizeHandle - Which handle is being dragged for resize
 */
export type ResizeHandle =
  | 'nw' // top-left
  | 'ne' // top-right
  | 'sw' // bottom-left
  | 'se' // bottom-right
  | 'n'  // top
  | 's'  // bottom
  | 'e'  // right
  | 'w'; // left

/**
 * ResizeState - Current state of hotspot resize operation
 */
export interface ResizeState {
  isResizing: boolean;
  hotspotId: string;
  handle: ResizeHandle;
  startBounds: HotspotBounds;
  startMouseX: number;
  startMouseY: number;
}

/**
 * DragState - Current state of hotspot drag operation
 */
export interface DragState {
  isDragging: boolean;
  hotspotId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * HotspotEditorMode - Current mode of the editor
 */
export type HotspotEditorMode = 'select' | 'draw' | 'delete';

/**
 * HotspotEditorState - Complete state for the hotspot editor
 */
export interface HotspotEditorState {
  /** Current editor mode */
  mode: HotspotEditorMode;
  /** All hotspots */
  hotspots: Hotspot[];
  /** Currently selected hotspot ID */
  selectedHotspotId: string | null;
  /** Drawing state */
  drawState: DrawState | null;
  /** Resize state */
  resizeState: ResizeState | null;
  /** Drag state */
  dragState: DragState | null;
  /** Whether the action modal is open */
  isActionModalOpen: boolean;
  /** Hotspot being configured in modal */
  configuringHotspotId: string | null;
}

/**
 * HotspotActionConfig - Configuration for hotspot action assignment
 */
export interface HotspotActionConfig {
  type: HotspotActionType;
  /** Navigate URL */
  url?: string;
  /** Tooltip text */
  tooltipText?: string;
  /** Highlight color (hex) */
  highlightColor?: string;
  /** Callback function name */
  callbackName?: string;
}

/**
 * Create a default hotspot with given bounds
 */
export function createHotspot(
  id: string,
  bounds: HotspotBounds,
  label?: string
): Hotspot {
  return {
    id,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    type: 'button',
    action: {
      type: 'callback',
      params: {},
    },
    label: label || `Hotspot ${id.slice(-4)}`,
    feedback: {
      hover: 'glow',
      active: 'scale-95',
    },
    selected: false,
  };
}

/**
 * Calculate bounds from draw state (handles negative width/height)
 */
export function calculateBoundsFromDraw(drawState: DrawState): HotspotBounds {
  const minX = Math.min(drawState.startX, drawState.currentX);
  const maxX = Math.max(drawState.startX, drawState.currentX);
  const minY = Math.min(drawState.startY, drawState.currentY);
  const maxY = Math.max(drawState.startY, drawState.currentY);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Check if bounds are valid (have minimum size)
 */
export function isValidBounds(bounds: HotspotBounds, minSize: number = 0.02): boolean {
  return bounds.width >= minSize && bounds.height >= minSize;
}

/**
 * Apply action config to a hotspot
 */
export function applyActionToHotspot(
  hotspot: Hotspot,
  config: HotspotActionConfig
): Hotspot {
  const updatedHotspot: Hotspot = {
    ...hotspot,
    action: {
      type: config.type === 'tooltip' ? 'callback' : config.type,
      target: config.url,
      params: {
        tooltipText: config.tooltipText,
        highlightColor: config.highlightColor,
        callbackName: config.callbackName,
      },
    },
    tooltipText: config.tooltipText,
    highlightColor: config.highlightColor,
    navigateUrl: config.url,
  };

  // Set region type based on action
  if (config.type === 'navigate') {
    updatedHotspot.type = 'link';
  } else if (config.type === 'highlight') {
    updatedHotspot.type = 'hover';
  } else {
    updatedHotspot.type = 'button';
  }

  return updatedHotspot;
}

/**
 * Convert screen coordinates to normalized coordinates
 */
export function screenToNormalized(
  screenX: number,
  screenY: number,
  containerRect: DOMRect
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(1, (screenX - containerRect.left) / containerRect.width)),
    y: Math.max(0, Math.min(1, (screenY - containerRect.top) / containerRect.height)),
  };
}

/**
 * Check if a point is inside a hotspot
 */
export function isPointInHotspot(
  x: number,
  y: number,
  hotspot: Hotspot
): boolean {
  return (
    x >= hotspot.x &&
    x <= hotspot.x + hotspot.width &&
    y >= hotspot.y &&
    y <= hotspot.y + hotspot.height
  );
}

/**
 * Get resize handle at point (returns null if not near any handle)
 */
export function getResizeHandleAtPoint(
  x: number,
  y: number,
  hotspot: Hotspot,
  handleSize: number = 0.02
): ResizeHandle | null {
  const { x: hx, y: hy, width: hw, height: hh } = hotspot;

  // Check corners first (higher priority)
  if (Math.abs(x - hx) < handleSize && Math.abs(y - hy) < handleSize) return 'nw';
  if (Math.abs(x - (hx + hw)) < handleSize && Math.abs(y - hy) < handleSize) return 'ne';
  if (Math.abs(x - hx) < handleSize && Math.abs(y - (hy + hh)) < handleSize) return 'sw';
  if (Math.abs(x - (hx + hw)) < handleSize && Math.abs(y - (hy + hh)) < handleSize) return 'se';

  // Check edges
  if (Math.abs(y - hy) < handleSize && x > hx && x < hx + hw) return 'n';
  if (Math.abs(y - (hy + hh)) < handleSize && x > hx && x < hx + hw) return 's';
  if (Math.abs(x - hx) < handleSize && y > hy && y < hy + hh) return 'w';
  if (Math.abs(x - (hx + hw)) < handleSize && y > hy && y < hy + hh) return 'e';

  return null;
}

/**
 * Apply resize to hotspot bounds
 */
export function applyResize(
  bounds: HotspotBounds,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  minSize: number = 0.02
): HotspotBounds {
  let { x, y, width, height } = bounds;

  switch (handle) {
    case 'nw':
      x += deltaX;
      y += deltaY;
      width -= deltaX;
      height -= deltaY;
      break;
    case 'ne':
      y += deltaY;
      width += deltaX;
      height -= deltaY;
      break;
    case 'sw':
      x += deltaX;
      width -= deltaX;
      height += deltaY;
      break;
    case 'se':
      width += deltaX;
      height += deltaY;
      break;
    case 'n':
      y += deltaY;
      height -= deltaY;
      break;
    case 's':
      height += deltaY;
      break;
    case 'e':
      width += deltaX;
      break;
    case 'w':
      x += deltaX;
      width -= deltaX;
      break;
  }

  // Enforce minimum size
  if (width < minSize) {
    if (handle.includes('w')) {
      x = bounds.x + bounds.width - minSize;
    }
    width = minSize;
  }
  if (height < minSize) {
    if (handle.includes('n')) {
      y = bounds.y + bounds.height - minSize;
    }
    height = minSize;
  }

  // Clamp to container bounds
  x = Math.max(0, Math.min(1 - width, x));
  y = Math.max(0, Math.min(1 - height, y));

  return { x, y, width, height };
}
