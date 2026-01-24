/**
 * SavedImageModal - Modal for viewing and regenerating saved panel images
 * Features: View image, copy prompt, Gemini regeneration with before/after comparison
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ImageIcon, Trash2, RotateCcw, Check } from 'lucide-react';
import { SavedPanelImage } from '../../types';
import { IconButton } from '@/app/components/ui';
import { fadeIn, modalContent, transitions } from '../../lib/motion';
import { regenerateImage, type RegenerationMode } from '../lib';
import { SavedImageComparison } from './SavedImageComparison';
import { SavedImageRegeneration } from './SavedImageRegeneration';

interface SavedImageModalProps {
  image: SavedPanelImage | null;
  isOpen: boolean;
  onClose: () => void;
  onRemove?: (imageId: string) => void;
  onUpdateImage?: (imageId: string, newUrl: string) => void;
  gameUIDimension?: string;
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
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratedUrl, setRegeneratedUrl] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<'original' | 'regenerated' | null>(null);
  const [hudEnabled, setHudEnabled] = useState(false);

  if (!isOpen || !image) return null;

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

    // Use 'overlay' mode when HUD is enabled, 'transform' otherwise
    const mode: RegenerationMode = hudEnabled ? 'overlay' : 'transform';

    const result = await regenerateImage({
      prompt: regeneratePrompt,
      sourceImageUrl: image.url,
      aspectRatio: '16:9',
      mode,
    });

    if (result.success && result.imageUrl) {
      setRegeneratedUrl(result.imageUrl);
    } else {
      setRegenerateError(result.error || 'Generation failed');
    }

    setIsRegenerating(false);
  };

  const handleSaveRegenerated = () => {
    if (regeneratedUrl && onUpdateImage) {
      onUpdateImage(image.id, regeneratedUrl);
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
              {/* Image Comparison */}
              <SavedImageComparison
                originalUrl={image.url}
                regeneratedUrl={regeneratedUrl}
                isRegenerating={isRegenerating}
                slotLabel={slotLabel}
                expandedImage={expandedImage}
                onExpandImage={setExpandedImage}
              />

              {/* Regeneration Input & Original Prompt */}
              <SavedImageRegeneration
                prompt={image.prompt}
                regeneratePrompt={regeneratePrompt}
                isRegenerating={isRegenerating}
                regenerateError={regenerateError}
                hudEnabled={hudEnabled}
                onHudToggle={setHudEnabled}
                onPromptChange={setRegeneratePrompt}
                onGenerate={handleRegenerate}
                onCopy={onCopy}
              />

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
      </div>
    </AnimatePresence>
  );
}
