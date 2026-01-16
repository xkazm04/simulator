/**
 * IconButton - Unified icon-only button component
 *
 * Provides consistent styling for all icon buttons across the application.
 * Replaces the various p-1/p-1.5/p-2 button patterns with a single source of truth.
 *
 * Props:
 * - size: 'xs' | 'sm' | 'md' | 'lg' - Controls padding and icon area
 * - variant: 'ghost' | 'subtle' | 'solid' - Visual weight of the button
 * - colorScheme: 'default' | 'success' | 'danger' | 'accent' - Semantic color
 *
 * All variants include consistent hover/focus/active/disabled states.
 */

'use client';

import React, { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/utils';

export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'ghost' | 'subtle' | 'solid';
export type IconButtonColorScheme = 'default' | 'success' | 'danger' | 'accent' | 'processing';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Size of the button - controls padding */
  size?: IconButtonSize;
  /** Visual variant - controls background and border */
  variant?: IconButtonVariant;
  /** Color scheme - semantic color mapping */
  colorScheme?: IconButtonColorScheme;
  /** Icon element to render */
  children: ReactNode;
  /** Optional label for accessibility (used in aria-label) */
  label?: string;
  /** Test ID for automated testing */
  'data-testid'?: string;
}

/**
 * Size classes - padding for different button sizes
 */
const sizeClasses: Record<IconButtonSize, string> = {
  xs: 'p-xs',     // Design token xs - extra small for tight spaces
  sm: 'p-1',      // 4px padding - smallest common size
  md: 'p-1.5',    // 6px padding - default, balanced
  lg: 'p-2',      // 8px padding - larger touch targets
};

/**
 * Base classes shared across all variants
 */
const baseClasses = `
  inline-flex items-center justify-center
  radius-sm
  transition-all duration-150
  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900
  disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
`;

/**
 * Variant + ColorScheme combined styles
 * Each variant has different visual weight, each color scheme has semantic meaning
 */
const variantColorClasses: Record<IconButtonVariant, Record<IconButtonColorScheme, string>> = {
  // Ghost: No background, minimal visual weight. Icon changes color on hover.
  ghost: {
    default: `
      text-slate-500
      hover:text-slate-300
      active:text-slate-200
      focus-visible:ring-slate-500/50
    `,
    success: `
      text-slate-500
      hover:text-green-400
      active:text-green-300
      focus-visible:ring-green-500/50
    `,
    danger: `
      text-slate-500
      hover:text-red-400
      active:text-red-300
      focus-visible:ring-red-500/50
    `,
    accent: `
      text-slate-500
      hover:text-cyan-400
      active:text-cyan-300
      focus-visible:ring-cyan-500/50
    `,
    processing: `
      text-slate-500
      hover:text-purple-400
      active:text-purple-300
      focus-visible:ring-purple-500/50
    `,
  },

  // Subtle: Background appears on hover. Common pattern for toolbar buttons.
  subtle: {
    default: `
      text-slate-500
      hover:text-slate-300 hover:bg-slate-800
      active:bg-slate-700
      focus-visible:ring-slate-500/50
    `,
    success: `
      text-slate-500
      hover:text-green-400 hover:bg-green-500/20
      active:bg-green-500/30
      focus-visible:ring-green-500/50
    `,
    danger: `
      text-slate-500
      hover:text-red-400 hover:bg-red-500/20
      active:bg-red-500/30
      focus-visible:ring-red-500/50
    `,
    accent: `
      text-slate-500
      hover:text-cyan-400 hover:bg-cyan-500/20
      active:bg-cyan-500/30
      focus-visible:ring-cyan-500/50
    `,
    processing: `
      text-slate-500
      hover:text-purple-400 hover:bg-purple-500/20
      active:bg-purple-500/30
      focus-visible:ring-purple-500/50
    `,
  },

  // Solid: Always has background and border. High visual weight for important actions.
  solid: {
    default: `
      text-slate-400 bg-slate-800/80 border border-slate-700/50
      hover:text-slate-300 hover:border-slate-600 hover:bg-slate-800
      active:bg-slate-700
      focus-visible:ring-slate-500/50
    `,
    success: `
      text-green-400 bg-green-500/10 border border-green-500/30
      hover:bg-green-500/20 hover:border-green-500/40
      active:bg-green-500/30
      focus-visible:ring-green-500/50
    `,
    danger: `
      text-red-400 bg-red-500/10 border border-red-500/30
      hover:bg-red-500/20 hover:border-red-500/40
      active:bg-red-500/30
      focus-visible:ring-red-500/50
    `,
    accent: `
      text-cyan-400 bg-cyan-500/10 border border-cyan-500/30
      hover:bg-cyan-500/20 hover:border-cyan-500/40
      active:bg-cyan-500/30
      focus-visible:ring-cyan-500/50
    `,
    processing: `
      text-purple-400 bg-purple-500/10 border border-purple-500/30
      hover:bg-purple-500/20 hover:border-purple-500/40
      active:bg-purple-500/30
      focus-visible:ring-purple-500/50
    `,
  },
};

/**
 * IconButton - A unified icon-only button component
 *
 * @example
 * // Ghost button (minimal)
 * <IconButton size="sm" variant="ghost" colorScheme="default" label="Close">
 *   <X size={12} />
 * </IconButton>
 *
 * @example
 * // Subtle button with hover background
 * <IconButton size="md" variant="subtle" colorScheme="danger" label="Delete">
 *   <Trash2 size={14} />
 * </IconButton>
 *
 * @example
 * // Solid button for important actions
 * <IconButton size="lg" variant="solid" colorScheme="accent" label="Settings">
 *   <Settings size={16} />
 * </IconButton>
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      size = 'md',
      variant = 'subtle',
      colorScheme = 'default',
      children,
      label,
      className,
      disabled,
      'data-testid': testId,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-label={label}
        data-testid={testId}
        className={cn(
          baseClasses,
          sizeClasses[size],
          variantColorClasses[variant][colorScheme],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default IconButton;
