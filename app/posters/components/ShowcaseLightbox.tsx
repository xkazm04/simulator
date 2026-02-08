/**
 * ShowcaseLightbox - Full-screen image viewer with navigation
 * Features: keyboard navigation, touch swipe, download, video playback toggle
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Check,
  Play,
  ExternalLink,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { fadeIn, transitions } from '@/app/features/simulator/lib/motion';
import { cn } from '@/app/lib/utils';
import { LightboxImage } from './ProjectShowcaseModal';

interface ShowcaseLightboxProps {
  images: LightboxImage[];
  currentIndex: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  projectName: string;
  onImageError?: (imageId: string) => void;
}

export function ShowcaseLightbox({
  images,
  currentIndex,
  onClose,
  onPrev,
  onNext,
  projectName,
  onImageError,
}: ShowcaseLightboxProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const prevIndexRef = useRef(currentIndex);

  const isOpen = currentIndex !== null;
  const currentImage = isOpen ? images[currentIndex] : null;
  const hasVideo = Boolean(currentImage?.video_url);

  // Reset states when image changes (render-time adjustment)
  if (prevIndexRef.current !== currentIndex) {
    prevIndexRef.current = currentIndex;
    setShowVideo(false);
    setIsLoaded(false);
    setHasError(false);
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowLeft':
          onPrev();
          break;
        case 'ArrowRight':
          onNext();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onPrev, onNext, onClose]);

  // Download handler
  const handleDownload = useCallback(async () => {
    if (!currentImage || isDownloading) return;

    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const response = await fetch(currentImage.image_url);
      const blob = await response.blob();

      // Generate filename
      const sanitizedName = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `simulator-${sanitizedName}-${timestamp}.png`;

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [currentImage, projectName, isDownloading]);

  // Copy prompt handler
  const handleCopyPrompt = useCallback(async () => {
    if (!currentImage?.prompt) return;

    try {
      await navigator.clipboard.writeText(currentImage.prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  }, [currentImage?.prompt]);

  // Touch swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        onNext();
      } else {
        onPrev();
      }
    }

    setTouchStart(null);
  };

  return (
    <AnimatePresence>
      {isOpen && currentImage && (
        <motion.div
          className="fixed inset-0 z-[110] flex flex-col bg-black/98"
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.fast}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400 font-mono">
                {currentIndex! + 1} / {images.length}
              </span>
              <span className="text-sm text-slate-500 hidden sm:inline">
                {currentImage.label}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 px-3 py-2 text-sm font-mono text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : downloadSuccess ? (
                  <Check size={16} className="text-green-400" />
                ) : (
                  <Download size={16} />
                )}
                <span className="hidden sm:inline">
                  {downloadSuccess ? 'Downloaded' : 'Download'}
                </span>
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Image Area */}
          <div className="flex-1 flex items-center justify-center relative px-4 sm:px-16">
            {/* Previous Button */}
            <button
              onClick={onPrev}
              className="absolute left-2 sm:left-4 p-2 sm:p-3 text-slate-400 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-all z-10"
              aria-label="Previous image"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Image/Video Display */}
            <div className="relative w-full max-w-5xl h-[70vh] flex items-center justify-center">
              {showVideo && currentImage.video_url ? (
                <video
                  src={currentImage.video_url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[70vh] rounded-lg"
                />
              ) : (
                <div className="relative w-full h-full">
                  {/* Error fallback */}
                  {hasError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                      <AlertTriangle size={32} className="text-slate-500" />
                      <span className="text-sm font-mono text-slate-500">Image unavailable</span>
                    </div>
                  )}

                  <Image
                    src={currentImage.image_url}
                    alt={currentImage.label}
                    fill
                    className={cn(
                      "object-contain rounded-lg transition-opacity duration-300",
                      isLoaded && !hasError ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => { setHasError(true); if (currentImage && onImageError) onImageError(currentImage.id); }}
                    sizes="(max-width: 768px) 100vw, 80vw"
                    priority
                  />
                </div>
              )}
            </div>

            {/* Next Button */}
            <button
              onClick={onNext}
              className="absolute right-2 sm:right-4 p-2 sm:p-3 text-slate-400 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-all z-10"
              aria-label="Next image"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Info Panel - Extended height for prompt display */}
          <div className="px-4 py-6 border-t border-slate-800/50 bg-gradient-to-t from-black/80 to-transparent">
            <div className="max-w-4xl mx-auto">
              {/* Prompt Section - Expanded */}
              {currentImage.prompt && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      Generation Prompt
                    </span>
                    <button
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-400 hover:text-cyan-400 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/30 rounded-md transition-all"
                    >
                      {promptCopied ? (
                        <>
                          <Check size={12} className="text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
                    <p className="text-sm text-slate-300 leading-relaxed line-clamp-4">
                      &quot;{currentImage.prompt}&quot;
                    </p>
                  </div>
                </div>
              )}

              {/* Video Toggle */}
              {hasVideo && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowVideo(!showVideo)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-mono text-purple-300 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg transition-colors"
                  >
                    {showVideo ? (
                      <>
                        <ExternalLink size={14} />
                        <span>Show Image</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} fill="currentColor" />
                        <span>Play Video</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ShowcaseLightbox;
