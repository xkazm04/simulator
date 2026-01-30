'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Trash2, Sparkles, Download, X, AlertTriangle, Loader2 } from 'lucide-react';
import type { Character } from '../types';
import {
  type QuickActionType,
  isActionAvailable,
  getActionTooltip,
} from '../lib/quickActions';

interface QuickActionBarProps {
  character: Character;
  isVisible: boolean;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
  onGenerateVariation: () => Promise<void>;
  onExport: () => Promise<void>;
  position?: 'top' | 'bottom' | 'right';
}

interface ActionButtonProps {
  icon: typeof Copy;
  label: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: 'default' | 'danger';
}

function ActionButton({
  icon: Icon,
  label,
  tooltip,
  onClick,
  disabled = false,
  isLoading = false,
  variant = 'default',
}: ActionButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && !isLoading) onClick();
      }}
      disabled={disabled || isLoading}
      title={tooltip}
      className={`p-1.5 rounded-md transition-all ${
        disabled
          ? 'text-slate-600 cursor-not-allowed'
          : variant === 'danger'
          ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
          : 'text-slate-400 hover:text-white hover:bg-white/10'
      }`}
    >
      {isLoading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Icon size={14} />
      )}
    </button>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  variant?: 'default' | 'danger';
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading = false,
  variant = 'default',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                     w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl
                     shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  variant === 'danger' ? 'bg-red-500/10' : 'bg-amber-500/10'
                }`}>
                  <AlertTriangle
                    size={20}
                    className={variant === 'danger' ? 'text-red-400' : 'text-amber-400'}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-mono text-sm text-white">{title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{message}</p>
                </div>
                <button
                  onClick={onCancel}
                  className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-700
                           transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  onClick={onCancel}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400
                           hover:text-white hover:border-slate-500 text-xs font-mono
                           transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors
                           flex items-center gap-2 disabled:opacity-50 ${
                             variant === 'danger'
                               ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                               : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30'
                           }`}
                >
                  {isLoading && <Loader2 size={12} className="animate-spin" />}
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function QuickActionBar({
  character,
  isVisible,
  onDuplicate,
  onDelete,
  onGenerateVariation,
  onExport,
  position = 'right',
}: QuickActionBarProps) {
  const [activeAction, setActiveAction] = useState<QuickActionType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = useCallback(async (action: QuickActionType, handler: () => Promise<void>) => {
    setActiveAction(action);
    setIsLoading(true);
    try {
      await handler();
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, []);

  const handleDuplicate = useCallback(() => {
    return handleAction('duplicate', onDuplicate);
  }, [handleAction, onDuplicate]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
    } finally {
      setIsLoading(false);
    }
  }, [onDelete]);

  const handleGenerateVariation = useCallback(() => {
    return handleAction('generate', onGenerateVariation);
  }, [handleAction, onGenerateVariation]);

  const handleExport = useCallback(() => {
    return handleAction('export', onExport);
  }, [handleAction, onExport]);

  const positionClasses = {
    top: 'absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full flex-row',
    bottom: 'absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full flex-row',
    right: 'absolute top-1/2 -right-1 translate-x-full -translate-y-1/2 flex-col',
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className={`${positionClasses[position]} flex gap-0.5 p-1 rounded-lg
                      bg-slate-800/95 border border-slate-700/50 shadow-lg backdrop-blur-sm z-20`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Duplicate */}
            <ActionButton
              icon={Copy}
              label="Duplicate"
              tooltip={getActionTooltip('duplicate', character)}
              onClick={handleDuplicate}
              disabled={!isActionAvailable('duplicate', character)}
              isLoading={activeAction === 'duplicate' && isLoading}
            />

            {/* Generate Variation */}
            <ActionButton
              icon={Sparkles}
              label="Generate"
              tooltip={getActionTooltip('generate', character)}
              onClick={handleGenerateVariation}
              disabled={!isActionAvailable('generate', character)}
              isLoading={activeAction === 'generate' && isLoading}
            />

            {/* Export */}
            <ActionButton
              icon={Download}
              label="Export"
              tooltip={getActionTooltip('export', character)}
              onClick={handleExport}
              disabled={!isActionAvailable('export', character)}
              isLoading={activeAction === 'export' && isLoading}
            />

            {/* Delete */}
            <ActionButton
              icon={Trash2}
              label="Delete"
              tooltip={getActionTooltip('delete', character)}
              onClick={handleDeleteClick}
              disabled={!isActionAvailable('delete', character)}
              variant="danger"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Character"
        message={`Are you sure you want to delete "${character.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        isLoading={isLoading}
        variant="danger"
      />
    </>
  );
}

// Also export the ConfirmDialog for use in other components
export { ConfirmDialog };
