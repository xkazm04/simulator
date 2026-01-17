/**
 * SavedImageModal - Modal for viewing and regenerating saved panel images
 * Features: View image, copy prompt, Gemini regeneration with before/after comparison
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, ImageIcon, Trash2, Wand2, Loader2, ArrowRight, RotateCcw, Gamepad2, Maximize2 } from 'lucide-react';
import { SavedPanelImage } from '../../types';
import { IconButton } from '@/app/components/ui';
import { fadeIn, modalContent, transitions } from '../../lib/motion';

interface SavedImageModalProps {
  image: SavedPanelImage | null;
  isOpen: boolean;
  onClose: () => void;
  onRemove?: (imageId: string) => void;
  onUpdateImage?: (imageId: string, newUrl: string) => void;
  gameUIDimension?: string;
  /** Callback when prompt is copied - for toast notifications */
  onCopy?: () => void;
}

export function SavedImageModal({
  image,
  isOpen,
  onClose,
  onRemove,
  onUpdateImage,
  gameUIDimension,
  onCopy,
}: SavedImageModalProps) {
  const [justCopied, setJustCopied] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratedUrl, setRegeneratedUrl] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<'original' | 'regenerated' | null>(null);

  if (!isOpen || !image) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(image.prompt);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
      onCopy?.();
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove(image.id);
      onClose();
    }
  };

  const handleRegenerate = async () => {
    if (!regeneratePrompt.trim() || isRegenerating) return;

    setIsRegenerating(true);
    setRegenerateError(null);
    setRegeneratedUrl(null);

    try {
      const response = await fetch('/api/ai/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: regeneratePrompt.trim(),
          sourceImageUrl: image.url,
          aspectRatio: '16:9',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate image');
      }

      setRegeneratedUrl(data.imageUrl);
    } catch (err) {
      setRegenerateError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSaveRegenerated = () => {
    if (regeneratedUrl && onUpdateImage) {
      onUpdateImage(image.id, regeneratedUrl);
      // Reset state
      setRegeneratedUrl(null);
      setRegeneratePrompt('');
      onClose();
    }
  };

  const handleCancelRegenerate = () => {
    setRegeneratedUrl(null);
    setRegeneratePrompt('');
    setRegenerateError(null);
  };

  const slotLabel = `${image.side === 'left' ? 'L' : 'R'}${image.slotIndex + 1}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        <motion.div
          variants={modalContent}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.normal}
          className="relative w-full max-w-4xl bg-surface-primary border border-slate-700 radius-lg overflow-hidden flex flex-col max-h-[90vh] shadow-floating"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-amber-500/10 radius-sm border border-amber-500/20">
                <ImageIcon size={14} className="text-amber-400" />
              </div>
              <div>
                <h3 className="type-body font-medium text-slate-200">Saved Image</h3>
                <p className="type-label font-mono text-amber-400">Panel Slot {slotLabel}</p>
              </div>
            </div>
            <IconButton
              size="md"
              variant="subtle"
              colorScheme="default"
              onClick={onClose}
              data-testid="saved-image-close-btn"
              label="Close"
            >
              <X size={16} />
            </IconButton>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar" data-testid="saved-image-modal-body">
            <div className="p-md space-y-md">
              {/* Image Comparison - Before/After */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
                {/* Original Image */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono type-label text-slate-500 uppercase">
                        {regeneratedUrl ? 'Original' : 'Saved Image'}
                      </span>
                      <span className="font-mono type-label text-amber-400">{slotLabel}</span>
                    </div>
                    <button
                      onClick={() => setExpandedImage('original')}
                      className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
                      title="View full size"
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                  <div
                    className="relative aspect-video radius-md overflow-hidden border border-slate-700 bg-slate-900/50 cursor-pointer hover:border-cyan-500/50 transition-colors group"
                    onClick={() => setExpandedImage('original')}
                  >
                    <Image
                      src={image.url}
                      alt={`Saved image ${slotLabel}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Maximize2 className="text-white/0 group-hover:text-white/80 transition-colors" size={24} />
                    </div>
                  </div>
                </div>

                {/* Regenerated Image (or placeholder) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono type-label text-slate-500 uppercase">
                        {regeneratedUrl ? 'Regenerated' : 'New Version'}
                      </span>
                      {regeneratedUrl && (
                        <span className="font-mono type-label text-green-500">Ready to save</span>
                      )}
                    </div>
                    {regeneratedUrl && (
                      <button
                        onClick={() => setExpandedImage('regenerated')}
                        className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
                        title="View full size"
                      >
                        <Maximize2 size={14} />
                      </button>
                    )}
                  </div>
                  <div
                    className={`relative aspect-video radius-md overflow-hidden border border-slate-700 bg-slate-900/50 ${regeneratedUrl ? 'cursor-pointer hover:border-cyan-500/50 group' : ''} transition-colors`}
                    onClick={() => regeneratedUrl && setExpandedImage('regenerated')}
                  >
                    {regeneratedUrl ? (
                      <>
                        <Image
                          src={regeneratedUrl}
                          alt="Regenerated"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Maximize2 className="text-white/0 group-hover:text-white/80 transition-colors" size={24} />
                        </div>
                      </>
                    ) : isRegenerating ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
                        <span className="font-mono text-xs text-slate-400">Generating with Gemini...</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <ArrowRight className="w-8 h-8 text-slate-600 mb-2" />
                        <span className="font-mono text-xs text-slate-500">Enter a prompt below</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {regenerateError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 radius-md">
                  <X className="w-4 h-4 text-red-400" />
                  <span className="font-mono text-xs text-red-400">{regenerateError}</span>
                </div>
              )}

              {/* Regeneration Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wand2 size={12} className="text-purple-400" />
                    <label className="font-mono type-label text-slate-400 uppercase">
                      Gemini Regeneration
                    </label>
                  </div>
                  {/* Apply HUD Button - only show if gameUI dimension is set */}
                  {gameUIDimension && gameUIDimension.trim() && (
                    <button
                      onClick={() => setRegeneratePrompt(`Add game UI overlay: ${gameUIDimension}. Keep the same scene and composition.`)}
                      disabled={isRegenerating}
                      className="flex items-center gap-1 px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 radius-sm type-label font-mono text-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Gamepad2 size={10} />
                      Apply HUD
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={3}
                    value={regeneratePrompt}
                    onChange={(e) => setRegeneratePrompt(e.target.value)}
                    placeholder="Describe how to modify this image..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 radius-md
                             font-mono text-xs text-slate-200 placeholder:text-slate-500
                             focus:outline-none focus:border-purple-500/50 resize-none"
                    disabled={isRegenerating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleRegenerate();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <p className="font-mono type-label text-slate-600">
                      Tip: &quot;Make it nighttime&quot;, &quot;Add rain&quot;, &quot;Change to anime style&quot; | Ctrl+Enter to generate
                    </p>
                    <button
                      onClick={handleRegenerate}
                      disabled={!regeneratePrompt.trim() || isRegenerating}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700
                               disabled:cursor-not-allowed radius-md font-mono type-label text-white
                               flex items-center gap-1.5 transition-colors"
                    >
                      {isRegenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 size={12} />}
                      Generate
                    </button>
                  </div>
                </div>
              </div>

              {/* Original Prompt Section */}
              <div className="space-y-2">
                <h4 className="type-body-sm font-medium text-slate-400 uppercase tracking-wider">Original Prompt</h4>
                <div className="p-3 radius-md border border-slate-800 bg-slate-900/40 max-h-32 overflow-y-auto custom-scrollbar" data-testid="saved-image-prompt-container">
                  <p className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {image.prompt ? (
                      image.prompt.split(/(".*?"|\d+)/g).map((part, i) => {
                        if (part && part.startsWith('"') && part.endsWith('"')) {
                          return <span key={i} className="text-amber-400">{part}</span>;
                        }
                        if (!isNaN(Number(part)) && part.trim() !== '') {
                          return <span key={i} className="text-cyan-400 font-bold">{part}</span>;
                        }
                        return <span key={i}>{part}</span>;
                      })
                    ) : (
                      <span className="text-slate-500 italic">No prompt saved</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    disabled={!image.prompt}
                    data-testid="saved-image-copy-btn"
                    className={`flex items-center gap-1.5 px-3 py-1.5 radius-md border text-xs font-medium transition-colors ${
                      justCopied
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                        : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50'
                    }`}
                  >
                    {justCopied ? <Check size={12} /> : <Copy size={12} />}
                    {justCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Timestamp */}
              <div className="type-label font-mono text-slate-600">
                Created: {new Date(image.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-4 py-3 bg-slate-900/30 border-t border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {onRemove && !regeneratedUrl && (
                <button
                  onClick={handleRemove}
                  className="flex items-center gap-1.5 px-3 py-1.5 radius-md border border-red-500/30 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
              {regeneratedUrl && (
                <button
                  onClick={handleCancelRegenerate}
                  className="flex items-center gap-1.5 px-3 py-1.5 radius-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw size={14} />
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {regeneratedUrl ? (
                <button
                  onClick={handleSaveRegenerated}
                  className="flex items-center gap-1.5 px-4 py-1.5 radius-md bg-green-600 hover:bg-green-500 text-xs font-medium text-white transition-colors"
                >
                  <Check size={14} />
                  Replace with New Image
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 radius-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Full-size Image Overlay */}
        <AnimatePresence>
          {expandedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setExpandedImage(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative max-w-[95vw] max-h-[95vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <Image
                  src={expandedImage === 'original' ? image.url : regeneratedUrl || image.url}
                  alt={expandedImage === 'original' ? `Saved image ${slotLabel}` : 'Regenerated image'}
                  width={1920}
                  height={1080}
                  className="object-contain max-w-[95vw] max-h-[95vh] w-auto h-auto"
                  unoptimized
                />
                {/* Close button */}
                <button
                  onClick={() => setExpandedImage(null)}
                  className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 radius-md transition-colors"
                  title="Close preview"
                >
                  <X size={20} className="text-white" />
                </button>
                {/* Image label */}
                <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/50 radius-md">
                  <span className="font-mono text-sm text-white">
                    {expandedImage === 'original' ? `Original - ${slotLabel}` : 'Regenerated'}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
