/**
 * Shared helpers for interactive mode styling and icons
 *
 * Provides consistent icon and color mappings for interactive modes
 * across all interactive-related components.
 */

import React from 'react';
import {
  Image as ImageIcon,
  Gamepad2,
  MousePointer2,
} from 'lucide-react';
import { InteractiveMode } from '../types';

/**
 * Color scheme for interactive modes
 */
export interface ModeColors {
  /** Background color class */
  bg: string;
  /** Border color class */
  border: string;
  /** Text color class */
  text: string;
  /** Active/selected background color class */
  activeBg: string;
}

/**
 * Get icon component for a given interactive mode
 * @param mode - The interactive mode
 * @param size - Icon size in pixels (default: 14)
 */
export function getModeIcon(mode: InteractiveMode, size: number = 14): React.ReactNode {
  switch (mode) {
    case 'static':
      return React.createElement(ImageIcon, { size });
    case 'webgl':
      return React.createElement(Gamepad2, { size });
    case 'clickable':
      return React.createElement(MousePointer2, { size });
    default:
      return React.createElement(ImageIcon, { size });
  }
}

/**
 * Get color scheme for a given interactive mode
 * @param mode - The interactive mode
 */
export function getModeColors(mode: InteractiveMode): ModeColors {
  switch (mode) {
    case 'static':
      return {
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30',
        text: 'text-slate-400',
        activeBg: 'bg-slate-700/50',
      };
    case 'webgl':
      return {
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        text: 'text-cyan-400',
        activeBg: 'bg-cyan-500/20',
      };
    case 'clickable':
      return {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        activeBg: 'bg-purple-500/20',
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30',
        text: 'text-slate-400',
        activeBg: 'bg-slate-700/50',
      };
  }
}
