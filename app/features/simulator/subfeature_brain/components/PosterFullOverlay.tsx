/**
 * PosterFullOverlay - Full overlay for poster display and selection
 *
 * Displays:
 * - 2x2 grid during poster generation
 * - Single saved poster when viewing
 * - Empty state when no poster exists
 *
 * Covers the CentralBrain area when active.
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Upload, X, Check, Loader2, Save } from 'lucide-react';
import { ProjectPoster } from '../../types';
import { PosterGeneration } from '../../hooks/usePoster';

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];

interface PosterFullOverlayProps {
  isOpen: boolean;
  onClose?: () => void;
  // Saved poster
  poster: ProjectPoster | null;
  // Generation state
  posterGenerations: PosterGeneration[];
  selectedIndex: number | null;
  isGenerating: boolean;
  isSaving: boolean;
  // Actions
  onSelect: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onUpload?: (imageDataUrl: string) => void;
}

export function PosterFullOverlay({
  isOpen,
  onClose,
  poster,
  posterGenerations,
  selectedIndex,
  isGenerating,
  isSaving,
  onSelect,
  onSave,
  onCancel,
  onUpload,
}: PosterFullOverlayProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSaveAnimation, setShowSaveAnimation] = useState(false);

  // Handle file upload
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (!SUPPORTED_FORMATS.includes(file.type)) {
      setUploadError('Use JPEG, PNG, or WebP');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError('Max size is 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onUpload?.(dataUrl);
    };
    reader.onerror = () => {
      setUploadError('Failed to read file');
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onUpload]);

  // Handle save with animation - expand selected poster first, then save
  const handleSave = useCallback(() => {
    if (selectedIndex === null) return;
    setShowSaveAnimation(true);
    // Allow time for expansion animation before saving
    setTimeout(() => {
      onSave();
      setShowSaveAnimation(false);
    }, 500);
  }, [selectedIndex, onSave]);

  // Determine what to show
  const showGrid = posterGenerations.length > 0;
  const showInitialLoading = isGenerating && posterGenerations.length === 0;
  const hasCompletePoster = posterGenerations.some((g) => g.status === 'complete');
  const allDone = posterGenerations.length > 0 && posterGenerations.every(
    (g) => g.status === 'complete' || g.status === 'failed'
  );

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-20 bg-surface-overlay backdrop-blur-md flex flex-col rounded-lg border border-slate-700 shadow-floating overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <span className="text-md uppercase tracking-widest text-white font-medium flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
          Poster Studio
        </span>
        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Upload button */}
          {onUpload && (
            <button
              onClick={handleUploadClick}
              className="px-4 py-1.5 text-sm font-mono rounded-md transition-colors flex items-center gap-2 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20"
            >
              <Upload size={14} />
              Upload
            </button>
          )}

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800/50 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md shrink-0">
          <p className="font-mono text-sm text-red-400">// {uploadError}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-6 flex items-center justify-center min-h-0 overflow-hidden">
        {showInitialLoading ? (
          /* Initial loading state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-6"
          >
            <div className="relative">
              <div className="p-6 rounded-full bg-rose-500/20 border border-rose-500/30">
                <Loader2 size={48} className="text-rose-400 animate-spin" />
              </div>
              <div className="absolute -inset-3 bg-rose-500/10 rounded-full animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-slate-300">Generating 4 Posters</p>
              <p className="text-sm text-slate-500 mt-2 font-mono">Creating unique variations...</p>
            </div>
          </motion.div>
        ) : showGrid ? (
          /* 2x2 Grid during generation - height-based sizing */
          <div className="w-full h-full flex flex-col items-center justify-center">
            {/* Grid sized by height: 2x2 grid of 2:3 items = overall 2:3 aspect ratio */}
            <div
              className="grid grid-cols-2 grid-rows-2 gap-3"
              style={{ height: 'min(90%, 600px)', aspectRatio: '2/3' }}
            >
              <AnimatePresence mode="popLayout">
                {posterGenerations.map((gen) => {
                  const isSelected = selectedIndex === gen.index;
                  const shouldExpand = showSaveAnimation && isSelected;

                  return (
                    <motion.div
                      key={gen.index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{
                        opacity: 1,
                        scale: shouldExpand ? 2.05 : 1,
                        zIndex: shouldExpand ? 50 : 1,
                      }}
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                      transition={{
                        duration: shouldExpand ? 0.4 : 0.3,
                        ease: [0.32, 0.72, 0, 1],
                      }}
                      className={`relative w-full h-full rounded-lg overflow-hidden border-2 transition-colors duration-200 ${
                        gen.status === 'complete'
                          ? isSelected
                            ? 'border-rose-500 shadow-lg shadow-rose-500/30 cursor-pointer'
                            : 'border-slate-700 hover:border-rose-500/50 cursor-pointer'
                          : 'border-slate-700/50 bg-surface-secondary'
                      } ${showSaveAnimation && !isSelected ? 'pointer-events-none' : ''}`}
                      onClick={() => {
                        if (gen.status === 'complete' && !showSaveAnimation && !isSaving) {
                          onSelect(gen.index);
                        }
                      }}
                    >
                      {/* Loading state */}
                      {(gen.status === 'pending' || gen.status === 'generating') && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-secondary">
                          <Loader2 className="w-8 h-8 text-rose-400 animate-spin mb-2" />
                          <span className="font-mono text-xs text-slate-400">
                            {gen.status === 'pending' ? 'Queued...' : 'Generating...'}
                          </span>
                        </div>
                      )}

                      {/* Failed state */}
                      {gen.status === 'failed' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-secondary p-4">
                          <X className="w-8 h-8 text-red-400 mb-2" />
                          <span className="font-mono text-xs text-red-400 text-center line-clamp-3">
                            {gen.error || 'Failed'}
                          </span>
                        </div>
                      )}

                      {/* Completed - show image */}
                      {gen.status === 'complete' && gen.imageUrl && (
                        <>
                          <Image
                            src={gen.imageUrl}
                            alt={`Poster variation ${gen.index + 1}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />

                          {/* Selection indicator */}
                          <AnimatePresence>
                            {isSelected && !showSaveAnimation && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-500 shadow-lg"
                              >
                                <Check size={14} className="text-white" />
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Hover overlay */}
                          {!isSelected && !showSaveAnimation && (
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                              <span className="font-mono text-xs text-white bg-black/50 px-2 py-1 rounded">
                                Click to select
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Variation number badge */}
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-xs font-mono text-slate-300">
                        #{gen.index + 1}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Save/Cancel buttons - centered below grid */}
            <AnimatePresence>
              {selectedIndex !== null && hasCompletePoster && allDone && !showSaveAnimation && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mt-6 flex justify-center gap-4 shrink-0"
                >
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 disabled:cursor-not-allowed rounded-lg text-white font-medium shadow-xl shadow-rose-900/50 transition-all hover:scale-105"
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    {isSaving ? 'Saving...' : 'Save Poster'}
                  </button>
                  <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-6 py-3 text-slate-400 hover:text-slate-200 font-mono disabled:opacity-50 border border-slate-700 rounded-lg hover:bg-slate-800/50 transition-colors"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Instructions when no selection */}
            {selectedIndex === null && hasCompletePoster && allDone && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 text-center shrink-0"
              >
                <p className="font-mono text-sm text-slate-500">
                  Click a poster to select it for saving
                </p>
              </motion.div>
            )}
          </div>
        ) : poster ? (
          /* Single saved poster */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center h-full"
          >
            <div className="relative h-full max-h-[70vh] aspect-[2/3] rounded-lg overflow-hidden border-2 border-rose-500/30 shadow-floating">
              <Image
                src={poster.imageUrl}
                alt="Project Poster"
                fill
                className="object-cover"
                unoptimized
              />
              {/* Subtle overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              {/* Corner badge */}
              <div className="absolute top-3 right-3 p-2 rounded-full bg-rose-500/20 border border-rose-500/30 backdrop-blur-sm">
                <Film size={16} className="text-rose-400" />
              </div>
            </div>
          </motion.div>
        ) : (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-6"
          >
            <div className="p-6 rounded-full bg-surface-secondary border border-slate-700/50">
              <Film size={48} className="text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-slate-400">No Poster Generated</p>
              <p className="text-sm text-slate-600 mt-2 font-mono">
                Select &quot;Poster&quot; mode and click Generate to create key art, or upload your own image
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default PosterFullOverlay;
