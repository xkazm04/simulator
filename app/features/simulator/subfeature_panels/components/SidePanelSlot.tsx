/**
 * SidePanelSlot - Individual slot in the side panel for saved images
 * Design: Clean Manuscript style
 *
 * Semantic Colors:
 * - cyan: Primary action (view)
 * - red: Destructive action (remove)
 * - amber: Empty slot hover (attention/action needed)
 *
 * Shows either:
 * - Empty placeholder with hover effect
 * - Saved image with view/delete options
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { Image as ImageIcon, X, Eye } from 'lucide-react';
import { SavedPanelImage } from '../../types';
import { semanticColors } from '../../lib/semanticColors';

interface SidePanelSlotProps {
  image: SavedPanelImage | null;
  slotIndex: number;
  side: 'left' | 'right';
  onRemove?: (imageId: string) => void;
  onView?: (image: SavedPanelImage) => void;
}

export function SidePanelSlot({
  image,
  slotIndex,
  side,
  onRemove,
  onView,
}: SidePanelSlotProps) {
  if (image) {
    return (
      <div
        className="relative aspect-square radius-lg border border-slate-700/60 overflow-hidden
                   group cursor-pointer transition-all duration-300
                   hover:border-cyan-500/30 hover:shadow-elevated hover:shadow-cyan-900/20"
        onClick={() => onView?.(image)}
        data-testid={`side-panel-slot-${side}-${slotIndex}`}
      >
        {/* Image */}
        <Image
          src={image.url}
          alt={`Saved image ${slotIndex + 1}`}
          fill
          className="object-cover"
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
                        transition-opacity flex items-center justify-center gap-2">
          {/* View button - cyan for primary action */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView?.(image);
            }}
            data-testid={`view-image-${image.id}`}
            className={`p-2 radius-md ${semanticColors.primary.bgHover} ${semanticColors.primary.text}
                       hover:bg-cyan-500/30 transition-colors`}
            title="View"
          >
            <Eye size={14} />
          </button>
          {/* Remove button - red for destructive action */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.(image.id);
            }}
            data-testid={`remove-image-${image.id}`}
            className={`p-2 radius-md ${semanticColors.error.bgHover} ${semanticColors.error.text}
                       hover:bg-red-500/30 transition-colors`}
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>

        {/* Slot indicator */}
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 radius-sm
                        font-mono type-label text-slate-400">
          {side[0].toUpperCase()}{slotIndex + 1}
        </div>
      </div>
    );
  }

  // Empty slot - amber for attention/action needed
  return (
    <div
      data-testid={`side-panel-slot-empty-${side}-${slotIndex}`}
      className="aspect-square bg-slate-900/40 radius-lg border border-slate-800/60
                 flex items-center justify-center
                 opacity-40 hover:opacity-100 hover:scale-105 hover:border-amber-500/30
                 hover:shadow-elevated hover:shadow-amber-900/20
                 transition-all duration-300 cursor-pointer group backdrop-blur-sm"
    >
      <ImageIcon
        size={20}
        className="text-slate-700 group-hover:text-amber-400 transition-colors"
      />
    </div>
  );
}

export default SidePanelSlot;
