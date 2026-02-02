'use client';

/**
 * ExportButton - Download button with progress indicator for video export
 *
 * Shows visual feedback during the export process:
 * - Idle: Download icon
 * - Preparing/Rendering/Encoding: Spinner with progress bar
 * - Complete: Checkmark
 * - Error: Alert icon with retry
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Download, Loader2, Check, AlertCircle } from 'lucide-react';

interface ExportButtonProps {
  stage: 'idle' | 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error';
  progress: number;
  error?: string;
  onExport: () => void;
  onReset?: () => void;
  disabled?: boolean;
}

export function ExportButton({
  stage,
  progress,
  error,
  onExport,
  onReset,
  disabled,
}: ExportButtonProps) {
  const isWorking = stage === 'preparing' || stage === 'rendering' || stage === 'encoding';
  const isComplete = stage === 'complete';
  const isError = stage === 'error';

  const getStatusText = () => {
    switch (stage) {
      case 'preparing':
        return 'Preparing...';
      case 'rendering':
        return `Rendering ${progress}%`;
      case 'encoding':
        return 'Encoding...';
      case 'complete':
        return 'Downloaded!';
      case 'error':
        return 'Failed';
      default:
        return 'Download MP4';
    }
  };

  return (
    <motion.button
      onClick={isError && onReset ? onReset : onExport}
      disabled={disabled || isWorking}
      className={`
        relative flex items-center gap-2 px-4 py-2.5 rounded-lg
        font-mono text-sm transition-all duration-200
        border backdrop-blur-sm overflow-hidden
        ${isComplete
          ? 'bg-green-500/20 border-green-500/30 text-green-400'
          : isError
            ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
            : isWorking
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 cursor-wait'
              : 'bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-cyan-500/30'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      whileHover={!isWorking && !disabled ? { scale: 1.02 } : {}}
      whileTap={!isWorking && !disabled ? { scale: 0.98 } : {}}
    >
      {/* Progress bar background */}
      {isWorking && (
        <motion.div
          className="absolute inset-0 bg-cyan-500/10"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Icon */}
      <span className="relative z-10">
        {isWorking ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isComplete ? (
          <Check size={16} />
        ) : isError ? (
          <AlertCircle size={16} />
        ) : (
          <Download size={16} />
        )}
      </span>

      {/* Text */}
      <span className="relative z-10">{getStatusText()}</span>

      {/* Tooltip for error */}
      {isError && error && (
        <span className="sr-only">{error}</span>
      )}
    </motion.button>
  );
}

export default ExportButton;
