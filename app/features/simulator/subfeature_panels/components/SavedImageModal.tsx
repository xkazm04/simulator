/**
 * SavedImageModal - Modal for viewing and regenerating saved panel images
 * Features: View image, copy prompt, Gemini regeneration with before/after comparison,
 * and video generation with Leonardo Seedance
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ImageIcon, Trash2, RotateCcw, Check, Video, Brush } from 'lucide-react';
import { SavedPanelImage } from '../../types';
import { IconButton } from '@/app/components/ui';
import { fadeIn, modalContent, transitions } from '../../lib/motion';
import {
  regenerateImage,
  generateVideo,
  checkVideoStatus,
  generateInpainting,
  checkInpaintingStatus,
  type RegenerationMode,
  type VideoDuration,
} from '../lib';
import { SavedImageComparison } from './SavedImageComparison';
import { SavedImageRegeneration } from './SavedImageRegeneration';
import { VideoCreation } from './VideoCreation';
import { RegionalEdit } from './RegionalEdit';

type ModalTab = 'image' | 'video' | 'regional';

interface SavedImageModalProps {
  image: SavedPanelImage | null;
  isOpen: boolean;
  onClose: () => void;
  onRemove?: (imageId: string) => void;
  onUpdateImage?: (imageId: string, newUrl: string) => void;
  onUpdateImageVideo?: (imageId: string, videoUrl: string) => void;
  gameUIDimension?: string;
  onCopy?: () => void;
}

export function SavedImageModal({
  image,
  isOpen,
  onClose,
  onRemove,
  onUpdateImage,
  onUpdateImageVideo,
  gameUIDimension,
  onCopy,
}: SavedImageModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<ModalTab>('image');

  // Image regeneration state
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratedUrl, setRegeneratedUrl] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<'original' | 'regenerated' | null>(null);
  const [hudEnabled, setHudEnabled] = useState(false);

  // Video generation state
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoDuration, setVideoDuration] = useState<VideoDuration>(8);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationId, setVideoGenerationId] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<string | undefined>();

  // Regional edit (inpainting) state
  const [editPrompt, setEditPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(20);
  const [brushMode, setBrushMode] = useState<'brush' | 'eraser'>('brush');
  const [inpaintStrength, setInpaintStrength] = useState(85);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [isInpainting, setIsInpainting] = useState(false);
  const [inpaintingGenerationId, setInpaintingGenerationId] = useState<string | null>(null);
  const [inpaintedImageUrl, setInpaintedImageUrl] = useState<string | null>(null);
  const [inpaintingError, setInpaintingError] = useState<string | null>(null);
  const [inpaintingProgress, setInpaintingProgress] = useState<string | undefined>();
  const [expandedInpaintImage, setExpandedInpaintImage] = useState<'original' | 'inpainted' | null>(null);

  // Poll for video completion
  const pollVideoStatus = useCallback(async (generationId: string) => {
    const maxAttempts = 120; // ~4 minutes
    const intervalMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await checkVideoStatus(generationId);

      if (result.status === 'complete' && result.videoUrl) {
        setGeneratedVideoUrl(result.videoUrl);
        setIsGeneratingVideo(false);
        setVideoProgress(undefined);
        setVideoGenerationId(null);

        // Auto-save video URL if callback provided
        if (onUpdateImageVideo && image) {
          onUpdateImageVideo(image.id, result.videoUrl);
        }
        return;
      }

      if (result.status === 'failed' || result.error) {
        setVideoError(result.error || 'Video generation failed');
        setIsGeneratingVideo(false);
        setVideoProgress(undefined);
        setVideoGenerationId(null);
        return;
      }

      // Update progress
      const progress = Math.round((attempt / maxAttempts) * 100);
      setVideoProgress(`Generating video... ${progress}%`);

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    setVideoError('Video generation timed out');
    setIsGeneratingVideo(false);
    setVideoProgress(undefined);
    setVideoGenerationId(null);
  }, [image, onUpdateImageVideo]);

  // Poll for inpainting completion
  const pollInpaintingStatus = useCallback(async (generationId: string) => {
    const maxAttempts = 60; // ~2 minutes
    const intervalMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await checkInpaintingStatus(generationId);

      if (result.status === 'complete' && result.imageUrl) {
        setInpaintedImageUrl(result.imageUrl);
        setIsInpainting(false);
        setInpaintingProgress(undefined);
        setInpaintingGenerationId(null);
        return;
      }

      if (result.status === 'failed' || result.error) {
        setInpaintingError(result.error || 'Inpainting failed');
        setIsInpainting(false);
        setInpaintingProgress(undefined);
        setInpaintingGenerationId(null);
        return;
      }

      // Update progress
      const progress = Math.round((attempt / maxAttempts) * 100);
      setInpaintingProgress(`Inpainting... ${progress}%`);

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    setInpaintingError('Inpainting timed out');
    setIsInpainting(false);
    setInpaintingProgress(undefined);
    setInpaintingGenerationId(null);
  }, []);

  // Resume polling on mount if there's a pending generation
  useEffect(() => {
    if (videoGenerationId && isGeneratingVideo) {
      pollVideoStatus(videoGenerationId);
    }
    if (inpaintingGenerationId && isInpainting) {
      pollInpaintingStatus(inpaintingGenerationId);
    }
  }, []);

  // Reset state when modal closes or image changes
  useEffect(() => {
    if (!isOpen) {
      setRegeneratePrompt('');
      setRegeneratedUrl(null);
      setRegenerateError(null);
      setVideoPrompt('');
      setVideoError(null);
      setGeneratedVideoUrl(null);
      setVideoProgress(undefined);
      // Reset regional edit state
      setEditPrompt('');
      setMaskDataUrl(null);
      setInpaintedImageUrl(null);
      setInpaintingError(null);
      setInpaintingProgress(undefined);
      setBrushSize(20);
      setBrushMode('brush');
      setInpaintStrength(85);
      setExpandedInpaintImage(null);
    }
  }, [isOpen]);

  // Set existing video URL from image data
  useEffect(() => {
    if (image?.videoUrl) {
      setGeneratedVideoUrl(image.videoUrl);
    } else {
      setGeneratedVideoUrl(null);
    }
  }, [image?.videoUrl]);

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
      // Reset state to go back to editing view - modal stays open
      setRegeneratedUrl(null);
      setRegeneratePrompt('');
    }
  };

  const handleCancelRegenerate = () => {
    setRegeneratedUrl(null);
    setRegeneratePrompt('');
    setRegenerateError(null);
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim() || isGeneratingVideo) return;

    setIsGeneratingVideo(true);
    setVideoError(null);
    setGeneratedVideoUrl(null);
    setVideoProgress('Starting video generation...');

    const result = await generateVideo({
      sourceImageUrl: image.url,
      prompt: videoPrompt.trim(),
      duration: videoDuration,
    });

    if (result.success && result.generationId) {
      setVideoGenerationId(result.generationId);
      // Start polling
      pollVideoStatus(result.generationId);
    } else {
      setVideoError(result.error || 'Failed to start video generation');
      setIsGeneratingVideo(false);
      setVideoProgress(undefined);
    }
  };

  const handleGenerateInpainting = async () => {
    if (!maskDataUrl || !editPrompt.trim() || isInpainting) return;

    setIsInpainting(true);
    setInpaintingError(null);
    setInpaintedImageUrl(null);
    setInpaintingProgress('Starting inpainting...');

    const result = await generateInpainting({
      sourceImageUrl: image.url,
      maskDataUrl,
      prompt: editPrompt.trim(),
      inpaintStrength,
    });

    if (result.success && result.generationId) {
      setInpaintingGenerationId(result.generationId);
      // Start polling
      pollInpaintingStatus(result.generationId);
    } else {
      setInpaintingError(result.error || 'Failed to start inpainting');
      setIsInpainting(false);
      setInpaintingProgress(undefined);
    }
  };

  const handleSaveInpainted = () => {
    if (inpaintedImageUrl && onUpdateImage) {
      onUpdateImage(image.id, inpaintedImageUrl);
      // Reset state to go back to editing view - modal stays open
      setInpaintedImageUrl(null);
      setEditPrompt('');
      setMaskDataUrl(null);
    }
  };

  const handleCancelInpainting = () => {
    setInpaintedImageUrl(null);
    setEditPrompt('');
    setMaskDataUrl(null);
    setInpaintingError(null);
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
          className="relative w-full max-w-4xl min-h-[70vh] bg-surface-primary border border-slate-700 radius-lg overflow-hidden flex flex-col max-h-[90vh] shadow-floating"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center justify-between px-4 py-3">
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

            {/* Tab Switcher */}
            <div className="flex px-4 gap-2 pb-0">
              <button
                onClick={() => setActiveTab('image')}
                className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-sm font-medium transition-all rounded-t-md ${
                  activeTab === 'image'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 border-b-0 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-surface-primary'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <ImageIcon size={14} />
                Re-generate Image
              </button>
              <button
                onClick={() => setActiveTab('video')}
                className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-sm font-medium transition-all rounded-t-md ${
                  activeTab === 'video'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 border-b-0 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-surface-primary'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Video size={14} />
                Create Video
              </button>
              <button
                onClick={() => setActiveTab('regional')}
                className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-sm font-medium transition-all rounded-t-md ${
                  activeTab === 'regional'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 border-b-0 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-surface-primary'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Brush size={14} />
                Regional Edit
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar" data-testid="saved-image-modal-body">
            <div className="p-md space-y-md">
              {activeTab === 'image' && (
                <>
                  {/* Show comparison only after regeneration, otherwise show single image */}
                  {regeneratedUrl && !isRegenerating ? (
                    <div className="space-y-md">
                      {/* Success message */}
                      <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 radius-md">
                        <Check size={16} className="text-green-400" />
                        <span className="font-mono text-xs text-green-400">
                          Regeneration complete! Compare and save below.
                        </span>
                      </div>

                      {/* Image Comparison */}
                      <SavedImageComparison
                        originalUrl={image.url}
                        regeneratedUrl={regeneratedUrl}
                        isRegenerating={false}
                        slotLabel={slotLabel}
                        expandedImage={expandedImage}
                        onExpandImage={setExpandedImage}
                      />

                      {/* Option to regenerate again */}
                      <button
                        onClick={() => setRegeneratedUrl(null)}
                        className="w-full px-4 py-2 radius-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        Regenerate Again
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Single image preview when no regeneration yet */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono type-label text-slate-500 uppercase">Saved Image</span>
                            <span className="font-mono type-label text-amber-400">{slotLabel}</span>
                          </div>
                        </div>
                        <div
                          className="relative aspect-video radius-md overflow-hidden border border-slate-700 bg-slate-900/50 cursor-pointer hover:border-cyan-500/50 transition-colors group"
                          onClick={() => setExpandedImage('original')}
                        >
                          <img
                            src={image.url}
                            alt={`Saved image ${slotLabel}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* Full-size Image Overlay for single image view */}
                      <AnimatePresence>
                        {expandedImage === 'original' && (
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
                              <img
                                src={image.url}
                                alt={`Saved image ${slotLabel}`}
                                className="object-contain max-w-[95vw] max-h-[95vh] w-auto h-auto"
                              />
                              <button
                                onClick={() => setExpandedImage(null)}
                                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 radius-md transition-colors"
                                title="Close preview"
                              >
                                <X size={20} className="text-white" />
                              </button>
                              <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/50 radius-md">
                                <span className="font-mono text-sm text-white">Original - {slotLabel}</span>
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>

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
                    </>
                  )}
                </>
              )}

              {activeTab === 'video' && (
                <VideoCreation
                  sourceImageUrl={image.url}
                  existingVideoUrl={generatedVideoUrl || undefined}
                  videoPrompt={videoPrompt}
                  duration={videoDuration}
                  isGenerating={isGeneratingVideo}
                  generationProgress={videoProgress}
                  generateError={videoError}
                  onPromptChange={setVideoPrompt}
                  onDurationChange={setVideoDuration}
                  onGenerate={handleGenerateVideo}
                />
              )}

              {activeTab === 'regional' && (
                <>
                  {/* Show comparison when inpainting complete, otherwise show editor */}
                  {inpaintedImageUrl && !isInpainting ? (
                    <div className="space-y-md">
                      {/* Success message */}
                      <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 radius-md">
                        <Check size={16} className="text-green-400" />
                        <span className="font-mono text-xs text-green-400">
                          Inpainting complete! Compare and save below.
                        </span>
                      </div>

                      {/* Image Comparison using same component as regenerate */}
                      <SavedImageComparison
                        originalUrl={image.url}
                        regeneratedUrl={inpaintedImageUrl}
                        isRegenerating={false}
                        slotLabel={slotLabel}
                        expandedImage={expandedInpaintImage === 'original' ? 'original' : expandedInpaintImage === 'inpainted' ? 'regenerated' : null}
                        onExpandImage={(img) => setExpandedInpaintImage(img === 'original' ? 'original' : img === 'regenerated' ? 'inpainted' : null)}
                      />

                      {/* Option to edit again */}
                      <button
                        onClick={() => setInpaintedImageUrl(null)}
                        className="w-full px-4 py-2 radius-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        Edit Again
                      </button>
                    </div>
                  ) : (
                    <RegionalEdit
                      sourceImageUrl={image.url}
                      editPrompt={editPrompt}
                      brushSize={brushSize}
                      brushMode={brushMode}
                      inpaintStrength={inpaintStrength}
                      isGenerating={isInpainting}
                      generationProgress={inpaintingProgress}
                      generateError={inpaintingError}
                      editedImageUrl={null}
                      hasMask={!!maskDataUrl}
                      onPromptChange={setEditPrompt}
                      onBrushSizeChange={setBrushSize}
                      onBrushModeChange={setBrushMode}
                      onInpaintStrengthChange={setInpaintStrength}
                      onMaskChange={setMaskDataUrl}
                      onGenerate={handleGenerateInpainting}
                      onClearMask={() => setMaskDataUrl(null)}
                    />
                  )}
                </>
              )}

              {/* Timestamp */}
              <div className="type-label font-mono text-slate-600">
                Created: {new Date(image.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-4 py-3 bg-slate-900/30 border-t border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {onRemove && !regeneratedUrl && !inpaintedImageUrl && (
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
              {inpaintedImageUrl && (
                <button
                  onClick={handleCancelInpainting}
                  className="flex items-center gap-1.5 px-3 py-1.5 radius-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw size={14} />
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Save button - only shown when there's a generated result */}
              {regeneratedUrl && (
                <button
                  onClick={handleSaveRegenerated}
                  className="flex items-center gap-1.5 px-4 py-1.5 radius-md bg-green-600 hover:bg-green-500 text-xs font-medium text-white transition-colors"
                >
                  <Check size={14} />
                  Save
                </button>
              )}
              {inpaintedImageUrl && (
                <button
                  onClick={handleSaveInpainted}
                  className="flex items-center gap-1.5 px-4 py-1.5 radius-md bg-green-600 hover:bg-green-500 text-xs font-medium text-white transition-colors"
                >
                  <Check size={14} />
                  Save
                </button>
              )}
              {/* Close button - always visible */}
              <button
                onClick={onClose}
                className="px-4 py-1.5 radius-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
