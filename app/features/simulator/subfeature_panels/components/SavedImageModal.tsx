/**
 * SavedImageModal - Modal for viewing and regenerating saved panel images
 * Features: View image, copy prompt, Gemini regeneration with before/after comparison,
 * and video generation with Leonardo Seedance
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ImageIcon, Trash2, RotateCcw, Check, Video } from 'lucide-react';
import { SavedPanelImage } from '../../types';
import { IconButton } from '@/app/components/ui';
import { fadeIn, modalContent, transitions } from '../../lib/motion';
import {
  regenerateImage,
  generateVideo,
  checkVideoStatus,
  type RegenerationMode,
  type VideoDuration,
} from '../lib';
import { SavedImageComparison } from './SavedImageComparison';
import { SavedImageRegeneration } from './SavedImageRegeneration';
import { VideoCreation } from './VideoCreation';

type ModalTab = 'image' | 'video';

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

  // Resume polling on mount if there's a pending generation
  useEffect(() => {
    if (videoGenerationId && isGeneratingVideo) {
      pollVideoStatus(videoGenerationId);
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
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar" data-testid="saved-image-modal-body">
            <div className="p-md space-y-md">
              {activeTab === 'image' ? (
                <>
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
                </>
              ) : (
                /* Video Creation Tab */
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
