/**
 * SidePanel - Left or right panel with 5 image slots
 * Design: Clean Manuscript style
 *
 * Displays saved images from the simulation workflow.
 * Users save generated images here using the "Start" button.
 */

'use client';

import React from 'react';
import { SidePanelSlot } from './SidePanelSlot';
import { SavedPanelImage, PanelSlot } from '../types';

interface SidePanelProps {
  side: 'left' | 'right';
  slots: PanelSlot[];
  onRemoveImage?: (imageId: string) => void;
  onViewImage?: (image: SavedPanelImage) => void;
}

export function SidePanel({
  side,
  slots,
  onRemoveImage,
  onViewImage,
}: SidePanelProps) {
  // Ensure we always have 5 slots
  const normalizedSlots: PanelSlot[] = Array.from({ length: 5 }, (_, i) => {
    const existing = slots.find((s) => s.index === i);
    return existing || { index: i, image: null };
  });

  return (
    <div className="w-24 flex flex-col gap-3 justify-center shrink-0 z-10">
      {normalizedSlots.map((slot) => (
        <SidePanelSlot
          key={`${side}-${slot.index}`}
          image={slot.image}
          slotIndex={slot.index}
          side={side}
          onRemove={onRemoveImage}
          onView={onViewImage}
        />
      ))}
    </div>
  );
}

export default SidePanel;
