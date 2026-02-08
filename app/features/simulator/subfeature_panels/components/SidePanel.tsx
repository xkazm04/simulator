/**
 * SidePanel - Left or right panel with 10 image slots (2 columns x 5 rows)
 * Design: Clean Manuscript style
 *
 * Displays saved images from the simulation workflow.
 * Users save generated images here using the "Start" button.
 */

'use client';

import React from 'react';
import { SidePanelSlot } from './SidePanelSlot';
import { SavedPanelImage, PanelSlot } from '../../types';

/** Number of slots per column in side panel */
export const SLOTS_PER_COLUMN = 5;
/** Total slots per side panel (2 columns) */
export const SLOTS_PER_SIDE = SLOTS_PER_COLUMN * 2;

interface SidePanelProps {
  side: 'left' | 'right';
  slots: PanelSlot[];
  onRemoveImage?: (imageId: string) => void;
  onViewImage?: (image: SavedPanelImage) => void;
  /** Callback when empty slot is clicked - for upload functionality */
  onEmptySlotClick?: (side: 'left' | 'right', slotIndex: number) => void;
  /** Called when an image fails to load (e.g. 403 from CDN) */
  onImageError?: (imageId: string) => void;
}

export function SidePanel({
  side,
  slots,
  onRemoveImage,
  onViewImage,
  onEmptySlotClick,
  onImageError,
}: SidePanelProps) {
  // Ensure we always have 10 slots (2 columns x 5 rows)
  const normalizedSlots: PanelSlot[] = Array.from({ length: SLOTS_PER_SIDE }, (_, i) => {
    const existing = slots.find((s) => s.index === i);
    return existing || { index: i, image: null };
  });

  // Split into two columns: first 5 slots in column 1, next 5 in column 2
  const column1Slots = normalizedSlots.slice(0, SLOTS_PER_COLUMN);
  const column2Slots = normalizedSlots.slice(SLOTS_PER_COLUMN, SLOTS_PER_SIDE);

  // For left panel: column order is [outer, inner] (column1 on left, column2 on right)
  // For right panel: column order is [inner, outer] (column2 on left, column1 on right)
  const orderedColumns = side === 'left'
    ? [column1Slots, column2Slots]
    : [column2Slots, column1Slots];

  return (
    <div className="flex gap-2 justify-center shrink-0 z-10">
      {orderedColumns.map((columnSlots, colIndex) => (
        <div key={colIndex} className="w-24 flex flex-col gap-3 justify-center">
          {columnSlots.map((slot) => (
            <SidePanelSlot
              key={`${side}-${slot.index}`}
              image={slot.image}
              slotIndex={slot.index}
              side={side}
              onRemove={onRemoveImage}
              onView={onViewImage}
              onEmptySlotClick={onEmptySlotClick}
              onImageError={onImageError}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default SidePanel;
