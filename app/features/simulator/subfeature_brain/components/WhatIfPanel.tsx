/**
 * WhatIfPanel - Before/After comparison upload panel
 *
 * Displays two halves for uploading "Before" and "After" images
 * to showcase transformation comparisons for a project.
 *
 * Visual identity: emerald/teal for "Before" (preservation),
 * purple for "After" (transformation).
 */

'use client';

import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, ImageIcon, Loader2, Maximize2 } from 'lucide-react';
import { useWhatif } from '../hooks/useWhatif';
import { useViewModeStore } from '../../stores';

interface WhatIfPanelProps {
  projectId: string | null;
}

type SlotSide = 'before' | 'after';

interface ImageUploadSlotProps {
  label: string;
  side: SlotSide;
  imageUrl: string | null;
  caption: string | null;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  onCaptionChange: (caption: string) => void;
  onMaximize?: () => void;
}

// Accent color maps for each side
const ACCENT = {
  before: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    textMuted: 'text-emerald-400/60',
    border: 'border-emerald-500/40',
    borderHover: 'hover:border-emerald-400/60',
    borderSolid: 'border-emerald-400/60',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    glowStrong: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    ring: 'from-emerald-500/30 to-emerald-400/10',
    focusRing: 'focus:border-emerald-500/50',
    focusBorderLeft: 'focus:border-l-emerald-400',
    iconGradient: 'from-emerald-500/20 to-emerald-400/5',
    loader: 'text-emerald-400',
    cornerBorder: 'border-emerald-500/20',
  },
  after: {
    dot: 'bg-purple-400',
    text: 'text-purple-400',
    textMuted: 'text-purple-400/60',
    border: 'border-purple-500/40',
    borderHover: 'hover:border-purple-400/60',
    borderSolid: 'border-purple-400/60',
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
    glowStrong: 'shadow-[0_0_20px_rgba(168,85,247,0.25)]',
    ring: 'from-purple-500/30 to-purple-400/10',
    focusRing: 'focus:border-purple-500/50',
    focusBorderLeft: 'focus:border-l-purple-400',
    iconGradient: 'from-purple-500/20 to-purple-400/5',
    loader: 'text-purple-400',
    cornerBorder: 'border-purple-500/20',
  },
} as const;

function ImageUploadSlot({
  label,
  side,
  imageUrl,
  caption,
  isUploading,
  onUpload,
  onClear,
  onCaptionChange,
  onMaximize,
}: ImageUploadSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const accent = ACCENT[side];

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) onUpload(file);
  }, [onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div className="flex-1 flex flex-col gap-3">
      {/* Accent-colored label */}
      <div className="flex items-center justify-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
        <span className={`text-base font-mono uppercase tracking-[0.2em] font-medium ${accent.text}`}>
          {label}
        </span>
      </div>

      {/* Upload area */}
      <div
        className={`relative flex-1 min-h-[200px] overflow-hidden transition-all duration-200 rounded-lg group ${
          isDragOver
            ? `border-2 border-solid ${accent.borderSolid} ${accent.glowStrong} bg-slate-900/60`
            : `border-2 border-dashed ${accent.border} ${accent.borderHover}`
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Corner accent marks */}
        <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${accent.cornerBorder} rounded-tl-lg pointer-events-none z-10`} />
        <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${accent.cornerBorder} rounded-tr-lg pointer-events-none z-10`} />
        <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${accent.cornerBorder} rounded-bl-lg pointer-events-none z-10`} />
        <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${accent.cornerBorder} rounded-br-lg pointer-events-none z-10`} />

        {isUploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <Loader2 className={`w-8 h-8 ${accent.loader} animate-spin`} />
          </div>
        ) : imageUrl ? (
          <>
            {/* Animated image reveal */}
            <motion.img
              key={imageUrl}
              src={imageUrl}
              alt={label}
              className="w-full h-full object-contain bg-slate-950 cursor-pointer"
              onClick={onMaximize}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            />
            {/* Hover vignette overlay for button readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
            {/* Maximize Button */}
            {onMaximize && (
              <button
                onClick={onMaximize}
                className="absolute top-2 left-2 p-1.5 bg-slate-900/80 hover:bg-slate-800 rounded-md transition-all opacity-0 group-hover:opacity-100"
                title="View full size"
              >
                <Maximize2 size={14} className="text-slate-300" />
              </button>
            )}
            {/* Clear Button */}
            <button
              onClick={onClear}
              className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-900/80 rounded-md transition-all opacity-0 group-hover:opacity-100"
              title="Remove image"
            >
              <X size={14} className="text-slate-400 hover:text-red-400" />
            </button>
            {/* Re-upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 p-1.5 bg-slate-900/80 hover:bg-slate-800 rounded-md transition-all opacity-0 group-hover:opacity-100"
              title="Replace image"
            >
              <Upload size={14} className="text-slate-300" />
            </button>
          </>
        ) : (
          /* Enhanced empty state */
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-slate-400 transition-colors cursor-pointer"
          >
            <motion.div
              className={`w-16 h-16 rounded-full bg-gradient-to-br ${accent.iconGradient} flex items-center justify-center ring-1 ring-inset ${accent.border}`}
              whileHover={{ scale: 1.08 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <ImageIcon size={24} className={accent.textMuted} />
            </motion.div>
            <div className="flex items-center gap-2">
              <motion.div
                animate={isDragOver ? { scale: 1.15 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Upload size={14} />
              </motion.div>
              <span className="text-sm">Click or drop to upload</span>
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Caption input with accent focus ring */}
      <input
        type="text"
        value={caption || ''}
        onChange={(e) => onCaptionChange(e.target.value)}
        placeholder="Add caption..."
        className={`w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-sm font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none ${accent.focusRing} focus:border-l-2 ${accent.focusBorderLeft} transition-colors`}
      />
    </div>
  );
}

export function WhatIfPanel({ projectId }: WhatIfPanelProps) {
  const {
    whatif,
    isLoading,
    isUploading,
    error,
    uploadBeforeImage,
    uploadAfterImage,
    updateCaption,
    clearImage,
  } = useWhatif({ projectId });

  const { setViewMode } = useViewModeStore();
  const [maximizedImage, setMaximizedImage] = useState<{ url: string; label: string; side: SlotSide } | null>(null);

  if (!projectId) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <p>Select a project to manage WhatIf comparisons</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <span className="text-md uppercase tracking-widest text-white font-medium flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          Before / After
        </span>
        <button
          onClick={() => setViewMode('cmd')}
          className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-lg gap-4">
      {/* Error Display */}
      {error && (
        <div className="px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-md text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="flex-1 flex gap-4">
        {/* Before (Left) */}
        <ImageUploadSlot
          label="BEFORE"
          side="before"
          imageUrl={whatif?.beforeImageUrl || null}
          caption={whatif?.beforeCaption || null}
          isUploading={isUploading}
          onUpload={uploadBeforeImage}
          onClear={() => clearImage('before')}
          onCaptionChange={(caption) => updateCaption('before', caption)}
          onMaximize={whatif?.beforeImageUrl ? () => setMaximizedImage({ url: whatif.beforeImageUrl!, label: 'Before', side: 'before' }) : undefined}
        />

        {/* Upgraded divider with VS badge */}
        <div className="relative shrink-0 flex items-center">
          <div className="w-px h-full bg-gradient-to-b from-transparent via-slate-600/30 to-transparent" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800/90 border border-slate-700/60 rounded-full">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">VS</span>
          </div>
        </div>

        {/* After (Right) */}
        <ImageUploadSlot
          label="AFTER"
          side="after"
          imageUrl={whatif?.afterImageUrl || null}
          caption={whatif?.afterCaption || null}
          isUploading={isUploading}
          onUpload={uploadAfterImage}
          onClear={() => clearImage('after')}
          onCaptionChange={(caption) => updateCaption('after', caption)}
          onMaximize={whatif?.afterImageUrl ? () => setMaximizedImage({ url: whatif.afterImageUrl!, label: 'After', side: 'after' }) : undefined}
        />
      </div>

      {/* Lightbox Modal with motion */}
      <AnimatePresence>
        {maximizedImage && (
          <motion.div
            key="whatif-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-pointer"
            onClick={() => setMaximizedImage(null)}
          >
            <button
              onClick={() => setMaximizedImage(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors z-10"
              title="Close"
            >
              <X size={20} className="text-slate-300" />
            </button>
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-lg z-10">
              <span className={`w-1.5 h-1.5 rounded-full ${ACCENT[maximizedImage.side].dot}`} />
              <span className={`font-mono text-xs uppercase tracking-wider ${ACCENT[maximizedImage.side].text}`}>
                {maximizedImage.label}
              </span>
            </div>
            <motion.img
              key={maximizedImage.url}
              src={maximizedImage.url}
              alt={maximizedImage.label}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

export default WhatIfPanel;
