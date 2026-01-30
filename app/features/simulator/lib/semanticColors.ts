/**
 * Design Token System - Semantic Colors and Spacing
 *
 * This file defines consistent color and spacing usage across all components.
 * Works in conjunction with CSS custom properties defined in globals.css.
 *
 * SPACING TOKENS (use with Tailwind utilities):
 * - space-xs: 4px (gap-xs, p-xs, m-xs)
 * - space-sm: 8px (gap-sm, p-sm, m-sm)
 * - space-md: 16px (gap-md, p-md, m-md)
 * - space-lg: 24px (gap-lg, p-lg, m-lg)
 * - space-xl: 32px (gap-xl, p-xl, m-xl)
 *
 * SURFACE COLORS (use with bg-surface-*):
 * - surface-primary: #0a0a0a - deepest background
 * - surface-secondary: rgba(15, 23, 42, 0.5) - slate-900/50
 * - surface-elevated: #0f172a - raised elements
 * - surface-overlay: rgba(0, 0, 0, 0.8) - modal overlays
 *
 * ACCENT COLORS (use with text-accent-*, bg-accent-*):
 * - accent-primary: cyan-500 (#06b6d4) - main actions
 * - accent-secondary: purple-500 (#a855f7) - AI/special
 * - accent-warning: amber-500 (#f59e0b) - attention
 * - accent-success: green-500 (#22c55e) - confirmation
 * - accent-error: red-500 (#ef4444) - destructive
 *
 * SEMANTIC COLOR CLASSES (for interactive states):
 * - cyan-500: Primary action, active state, focus
 * - green-500: Success, locked, saved, confirmed
 * - amber-500: Warning, required, attention needed
 * - red-500: Error, delete, destructive action
 * - purple-500: Processing, AI-related, special feature
 *
 * Pattern:
 * - border: COLOR-500/30 for containers
 * - bg: COLOR-500/10 for backgrounds
 * - hover bg: COLOR-500/20 for hover states
 * - text/icon: text-COLOR-400 or text-COLOR-500
 */

export type SemanticColor = 'primary' | 'success' | 'warning' | 'error' | 'processing' | 'neutral';

/**
 * Design Token CSS class mappings for spacing
 * Maps semantic spacing names to Tailwind utility classes
 */
export const spacingTokens = {
  xs: 'xs', // 4px
  sm: 'sm', // 8px
  md: 'md', // 16px
  lg: 'lg', // 24px
  xl: 'xl', // 32px
} as const;

/**
 * Design Token CSS class mappings for surfaces
 * Maps semantic surface names to Tailwind utility classes
 */
export const surfaceTokens = {
  primary: 'bg-surface-primary',
  secondary: 'bg-surface-secondary',
  elevated: 'bg-surface-elevated',
  overlay: 'bg-surface-overlay',
} as const;

/**
 * Design Token CSS class mappings for accents
 * Maps semantic accent names to Tailwind utility classes
 */
export const accentTokens = {
  primary: {
    text: 'text-accent-primary',
    bg: 'bg-accent-primary',
    border: 'border-accent-primary',
  },
  secondary: {
    text: 'text-accent-secondary',
    bg: 'bg-accent-secondary',
    border: 'border-accent-secondary',
  },
  warning: {
    text: 'text-accent-warning',
    bg: 'bg-accent-warning',
    border: 'border-accent-warning',
  },
  success: {
    text: 'text-accent-success',
    bg: 'bg-accent-success',
    border: 'border-accent-success',
  },
  error: {
    text: 'text-accent-error',
    bg: 'bg-accent-error',
    border: 'border-accent-error',
  },
} as const;

/**
 * Semantic color class maps for consistent styling
 * Use these pre-built classes to ensure Tailwind can detect them at build time
 */
export const semanticColors = {
  // Primary action (cyan) - active state, focus, interactive
  primary: {
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/10',
    bgHover: 'bg-cyan-500/20',
    text: 'text-cyan-400',
    ring: 'ring-cyan-500/30',
    shadow: 'shadow-cyan-500/10',
  },

  // Success (green) - locked, saved, confirmed
  success: {
    border: 'border-green-500/30',
    bg: 'bg-green-500/10',
    bgHover: 'bg-green-500/20',
    text: 'text-green-400',
    ring: 'ring-green-500/30',
    shadow: 'shadow-green-500/10',
  },

  // Warning (amber) - required, attention, change
  warning: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    bgHover: 'bg-amber-500/20',
    text: 'text-amber-400',
    ring: 'ring-amber-500/30',
    shadow: 'shadow-amber-500/10',
  },

  // Error (red) - error, delete, destructive
  error: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    bgHover: 'bg-red-500/20',
    text: 'text-red-400',
    ring: 'ring-red-500/30',
    shadow: 'shadow-red-500/10',
  },

  // Processing (purple) - AI action, special feature
  processing: {
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/10',
    bgHover: 'bg-purple-500/20',
    text: 'text-purple-400',
    ring: 'ring-purple-500/30',
    shadow: 'shadow-purple-500/10',
  },

  // Neutral (slate) - inactive, default state
  neutral: {
    border: 'border-slate-500/30',
    bg: 'bg-slate-500/10',
    bgHover: 'bg-slate-500/20',
    text: 'text-slate-400',
    ring: 'ring-slate-500/30',
    shadow: 'shadow-slate-500/10',
  },
} as const;

/**
 * Element category to semantic color mapping
 * Used for ElementChip to maintain category-based coloring
 */
export const categoryColors = {
  composition: {
    bg: 'bg-blue-500/10',
    bgHover: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
  },
  lighting: {
    bg: 'bg-amber-500/10',
    bgHover: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
  },
  style: {
    bg: 'bg-purple-500/10',
    bgHover: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
  },
  mood: {
    bg: 'bg-pink-500/10',
    bgHover: 'bg-pink-500/20',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
  },
  subject: {
    bg: 'bg-cyan-500/10',
    bgHover: 'bg-cyan-500/20',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
  },
  setting: {
    bg: 'bg-green-500/10',
    bgHover: 'bg-green-500/20',
    border: 'border-green-500/30',
    text: 'text-green-400',
  },
  quality: {
    bg: 'bg-slate-500/10',
    bgHover: 'bg-slate-500/20',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
  },
} as const;

export type CategoryType = keyof typeof categoryColors;

/**
 * Get category colors with fallback to default
 */
export function getCategoryColors(category: string) {
  return categoryColors[category as CategoryType] || categoryColors.quality;
}

/**
 * Common state-based class combinations
 * Pre-built for common UI patterns
 */
export const stateClasses = {
  // Active/selected container
  activeContainer: 'border-cyan-500/30 bg-cyan-500/10',

  // Locked/saved container
  lockedContainer: 'border-green-500/30 bg-green-500/10',

  // Required field indicator
  requiredBadge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',

  // Error state
  errorContainer: 'border-red-500/30 bg-red-500/10',

  // Processing/loading state
  processingContainer: 'border-purple-500/30 bg-purple-500/10',

  // Default inactive state
  inactiveContainer: 'border-slate-700/50 bg-slate-900/60',
} as const;
