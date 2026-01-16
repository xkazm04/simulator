/**
 * Toast - Reusable notification component
 *
 * Provides consistent toast notifications across the application.
 * Uses motion.ts animation presets for unified animation behavior.
 *
 * Features:
 * - Three variants: success, info, warning
 * - Configurable duration (default 2000ms based on DURATION.slow)
 * - Uses slideUp animation preset from motion.ts
 * - Automatic dismissal with optional manual dismiss
 * - Stacked toast support ready (via useToast hook)
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { slideUp, transitions, DURATION } from '@/app/features/simulator/lib/motion';

// ============================================
// Types
// ============================================

export type ToastVariant = 'success' | 'info' | 'warning';

export interface ToastProps {
  /** Whether the toast is visible */
  isVisible: boolean;
  /** Message to display */
  message: string;
  /** Visual variant - determines icon and colors */
  variant?: ToastVariant;
  /** Duration in ms before auto-dismiss (default: 2000) */
  duration?: number;
  /** Callback when toast should be hidden */
  onHide: () => void;
  /** Optional custom icon */
  icon?: React.ReactNode;
  /** Position of the toast */
  position?: 'top' | 'bottom';
  /** Test ID for automated testing */
  'data-testid'?: string;
}

export interface ToastState {
  isVisible: boolean;
  message: string;
  variant: ToastVariant;
}

export interface UseToastReturn {
  /** Current toast state */
  toast: ToastState;
  /** Show a toast with the given message and variant */
  showToast: (message: string, variant?: ToastVariant) => void;
  /** Hide the current toast */
  hideToast: () => void;
  /** Toast component props ready to spread */
  toastProps: Omit<ToastProps, 'data-testid'>;
}

// ============================================
// Styling
// ============================================

const variantStyles: Record<ToastVariant, { icon: React.ReactNode; className: string }> = {
  success: {
    icon: <CheckCircle2 size={14} className="text-green-400" />,
    className: 'border-green-500/30',
  },
  info: {
    icon: <Info size={14} className="text-cyan-400" />,
    className: 'border-cyan-500/30',
  },
  warning: {
    icon: <AlertTriangle size={14} className="text-amber-400" />,
    className: 'border-amber-500/30',
  },
};

const positionClasses: Record<'top' | 'bottom', string> = {
  top: 'top-10',
  bottom: 'bottom-10',
};

// Default toast duration based on motion.ts DURATION.slow (300ms) * multiplier for visibility
const DEFAULT_TOAST_DURATION = 2000;

// ============================================
// Toast Component
// ============================================

export function Toast({
  isVisible,
  message,
  variant = 'success',
  duration = DEFAULT_TOAST_DURATION,
  onHide,
  icon,
  position = 'bottom',
  'data-testid': testId = 'toast',
}: ToastProps) {
  const { icon: defaultIcon, className: variantClassName } = variantStyles[variant];

  // Auto-dismiss timer
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onHide();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onHide]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={slideUp}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          data-testid={testId}
          className={cn(
            'fixed left-1/2 -translate-x-1/2 z-50',
            'px-4 py-2 bg-slate-800/90 text-slate-200 radius-md',
            'border shadow-elevated backdrop-blur-md',
            'flex items-center gap-2',
            positionClasses[position],
            variantClassName
          )}
        >
          {icon ?? defaultIcon}
          <span className="text-xs font-mono">{message}</span>
          <button
            onClick={onHide}
            data-testid={`${testId}-dismiss-btn`}
            className="ml-1 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// useToast Hook
// ============================================

/**
 * useToast - Hook for managing toast state
 *
 * @param defaultDuration - Default duration for toasts (default: 2000ms)
 * @returns Toast state and control functions
 *
 * @example
 * const { toast, showToast, toastProps } = useToast();
 *
 * // Show a success toast
 * showToast('Item saved successfully', 'success');
 *
 * // Render the toast
 * <Toast {...toastProps} data-testid="my-toast" />
 */
export function useToast(defaultDuration: number = DEFAULT_TOAST_DURATION): UseToastReturn {
  const [toast, setToast] = useState<ToastState>({
    isVisible: false,
    message: '',
    variant: 'success',
  });

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToast({
      isVisible: true,
      message,
      variant,
    });
  }, []);

  const toastProps: Omit<ToastProps, 'data-testid'> = {
    isVisible: toast.isVisible,
    message: toast.message,
    variant: toast.variant,
    duration: defaultDuration,
    onHide: hideToast,
  };

  return {
    toast,
    showToast,
    hideToast,
    toastProps,
  };
}

export default Toast;
