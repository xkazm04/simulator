/**
 * ShowcaseCinematic - Full viewport immersive project showcase
 *
 * Reimagines the Simulator's Onion Ring layout for view-only mode:
 * - Hero Zone: Massive ambient poster with play button overlay
 * - Floating Gallery: Images arranged in orbital positions
 * - Dimension Ribbon: Glowing tags as decorative sidebar
 * - Video Player: Replaces poster when playing
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { staggerContainer } from '@/app/features/simulator/lib/motion';
import { ProjectWithState } from './ProjectShowcaseModal';
import { HeroZone } from './cinematic/HeroZone';
import { FloatingGallery } from './cinematic/FloatingGallery';
import { DimensionRibbon } from './cinematic/DimensionRibbon';
import { DimensionSpotlight } from './cinematic/DimensionSpotlight';
import { ShowcasePlayer } from './cinematic/ShowcasePlayer';
import { AmbientEffects } from './cinematic/AmbientEffects';
import { SketchSidebar } from './cinematic/SketchSidebar';
import { ShowcaseVideoItem, ShowcaseSketchItem, ShowcaseWhatifItem, SHOWCASE_VIDEO_DEFAULTS } from '@/remotion/types';
import { useVideoPreloader } from '../hooks/useVideoPreloader';
import { useVideoExport } from '../hooks/useVideoExport';
import { ExportButton } from './cinematic/ExportButton';

interface Dimension {
  id: string;
  type: string;
  label: string;
  reference: string;
  weight?: number;
}

interface ShowcaseCinematicProps {
  project: ProjectWithState;
  dimensions: Dimension[];
  onImageClick: (imageId: string) => void;
  onImageError?: (imageId: string) => void;
}

export function ShowcaseCinematic({ project, dimensions, onImageClick, onImageError }: ShowcaseCinematicProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDimension, setSelectedDimension] = useState<Dimension | null>(null);

  // Video export hook
  const { exportState, exportVideo, resetExport, isExporting } = useVideoExport();

  // Separate sketch images from other images
  const { sketchImages, nonSketchImages } = useMemo(() => {
    const sketches = project.panelImages.filter(img => img.type === 'sketch');
    const others = project.panelImages.filter(img => img.type !== 'sketch');
    return { sketchImages: sketches, nonSketchImages: others };
  }, [project.panelImages]);

  // Filter images with videos (only non-sketch images)
  const imagesWithVideos = useMemo(() => {
    const withVideos = nonSketchImages.filter(img => img.video_url);
    return withVideos;
  }, [nonSketchImages]);

  // Videos for the showcase player
  const showcaseVideos: ShowcaseVideoItem[] = useMemo(() => {
    return imagesWithVideos.map(img => ({
      id: img.id,
      videoUrl: img.video_url!,
      thumbnailUrl: img.image_url,
      label: `${img.side} • Slot ${img.slot_index + 1}`,
    }));
  }, [imagesWithVideos]);

  // Sketches for the showcase player (max 6)
  const showcaseSketches: ShowcaseSketchItem[] = useMemo(() => {
    return sketchImages.slice(0, 6).map(img => ({
      id: img.id,
      imageUrl: img.image_url,
      label: `Sketch ${img.slot_index + 1}`,
    }));
  }, [sketchImages]);

  // Whatif pairs for the showcase player (only pairs with both images)
  const showcaseWhatifs: ShowcaseWhatifItem[] = useMemo(() => {
    return (project.whatifs || [])
      .filter(w => w.before_image_url && w.after_image_url)
      .map(w => ({
        id: w.id,
        beforeImageUrl: w.before_image_url!,
        afterImageUrl: w.after_image_url!,
        beforeCaption: w.before_caption,
        afterCaption: w.after_caption,
      }));
  }, [project.whatifs]);

  // Extract video URLs for preloading
  const videoUrls = useMemo(() => showcaseVideos.map(v => v.videoUrl), [showcaseVideos]);

  // Preload videos before allowing playback
  const {
    progress: loadProgress,
    isReady: videosReady,
    isLoading: videosLoading,
    loadedCount,
    totalCount,
    errors: loadErrors,
    retry: retryLoad,
  } = useVideoPreloader(videoUrls);

  // Hero image - poster or first panel image (not sketch)
  const heroImage = project.poster?.image_url || nonSketchImages[0]?.image_url;

  // Distribute sketches to left and right sides (alternating: 1st left, 2nd right, etc.)
  // Max 3 per side
  const { leftSketches, rightSketches } = useMemo(() => {
    const left: typeof sketchImages = [];
    const right: typeof sketchImages = [];
    sketchImages.forEach((img, index) => {
      if (index % 2 === 0 && left.length < 3) {
        left.push(img);
      } else if (right.length < 3) {
        right.push(img);
      } else if (left.length < 3) {
        left.push(img);
      }
    });
    return { leftSketches: left, rightSketches: right };
  }, [sketchImages]);

  // All viewable images for bottom gallery (poster + non-sketch images)
  const allImages = useMemo(() => {
    const images = [];
    if (project.poster) {
      images.push({
        id: project.poster.id,
        url: project.poster.image_url,
        label: 'Project Poster',
        isPoster: true,
        hasVideo: false,
        type: 'poster' as const,
      });
    }
    nonSketchImages.forEach(img => {
      images.push({
        id: img.id,
        url: img.image_url,
        label: `${img.side} • Slot ${img.slot_index + 1}`,
        isPoster: false,
        hasVideo: Boolean(img.video_url),
        type: img.type,
      });
    });
    return images;
  }, [project.poster, nonSketchImages]);

  // Check if we have content to show in video preview
  // Title card always shows, so we need cover, sketches, whatifs, OR videos for meaningful content
  const hasContent = Boolean(heroImage) || showcaseSketches.length > 0 || showcaseWhatifs.length > 0 || showcaseVideos.length > 0;
  const hasVideos = showcaseVideos.length > 0;

  // Export handler - calculates duration and triggers export
  const handleExport = useCallback(() => {
    const { titleDuration, coverDuration, estimatedVideoDuration, transitionDuration, sketchDuration, whatifDuration } = SHOWCASE_VIDEO_DEFAULTS;

    // Calculate duration (same logic as ShowcasePlayer)
    let totalSequenceDuration = titleDuration;
    let numTransitions = 0;

    if (heroImage) {
      totalSequenceDuration += coverDuration;
      numTransitions++;
    }

    if (showcaseSketches.length > 0) {
      totalSequenceDuration += sketchDuration;
      numTransitions++;
    }

    if (showcaseWhatifs.length > 0) {
      totalSequenceDuration += showcaseWhatifs.length * whatifDuration;
      numTransitions++; // transition into first whatif
      numTransitions += Math.max(0, showcaseWhatifs.length - 1);
    }

    if (showcaseVideos.length > 0) {
      totalSequenceDuration += showcaseVideos.length * estimatedVideoDuration;
      numTransitions++; // transition into first video
      numTransitions += Math.max(0, showcaseVideos.length - 1);
    }

    const transitionOverlap = numTransitions * transitionDuration;
    const durationInFrames = Math.max(1, totalSequenceDuration - transitionOverlap);

    exportVideo({
      projectName: project.name,
      inputProps: {
        projectName: project.name,
        coverUrl: heroImage || null,
        videos: showcaseVideos,
        sketches: showcaseSketches,
        whatifs: showcaseWhatifs,
        coverDuration,
        titleDuration,
        sketchDuration,
        whatifDuration,
      },
      durationInFrames,
    });
  }, [project.name, heroImage, showcaseVideos, showcaseSketches, showcaseWhatifs, exportVideo]);

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-[#030303]">
      {/* Ambient Background Effects */}
      <AmbientEffects heroImageUrl={heroImage} />

      {/* Main Content Grid - Onion Ring Inspired */}
      <motion.div
        className="relative z-10 w-full h-full flex flex-col"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Center Ring: Main Content Area */}
        <div className="flex-1 flex min-h-0 min-w-0">
          {/* Left Ribbon: Dimensions */}
          <DimensionRibbon
            dimensions={dimensions}
            onDimensionClick={setSelectedDimension}
          />

          {/* Center: Hero / Video Player */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
            {/* Main Content: Hero Zone or Video Player */}
            <AnimatePresence mode="wait">
              {isPlaying ? (
                /* Video Player Mode */
                <motion.div
                  key="player"
                  className="flex-1 flex flex-col items-center justify-center p-8"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="relative w-full max-w-4xl">
                    {/* Close button */}
                    <button
                      onClick={() => setIsPlaying(false)}
                      className="absolute -top-12 right-0 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                    >
                      <X size={20} className="text-white" />
                    </button>

                    {/* Remotion Player */}
                    <ShowcasePlayer
                      projectName={project.name}
                      coverUrl={heroImage || null}
                      videos={showcaseVideos}
                      sketches={showcaseSketches}
                      whatifs={showcaseWhatifs}
                      className="rounded-lg overflow-hidden shadow-2xl shadow-black/50"
                      autoPlay
                    />
                  </div>

                  {/* Project Title */}
                  <motion.div
                    className="mt-8 text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                  >
                    <div className="relative inline-block">
                      {/* Decorative lines */}
                      <div className="absolute -left-16 top-1/2 w-12 h-px bg-gradient-to-r from-transparent via-yellow-700/50 to-yellow-600/80" />
                      <div className="absolute -right-16 top-1/2 w-12 h-px bg-gradient-to-l from-transparent via-yellow-700/50 to-yellow-600/80" />

                      {/* Title - Dark golden gradient */}
                      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                        <span className="bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-700 bg-clip-text text-transparent">
                          {project.name}
                        </span>
                      </h2>

                      {/* Subtitle */}
                      <motion.p
                        className="mt-3 text-xs sm:text-sm font-mono text-slate-500 tracking-[0.3em] uppercase"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                      >
                        Project Showcase
                      </motion.p>
                    </div>
                  </motion.div>
                </motion.div>
              ) : (
                /* Poster Mode with Play Button and Sketch Sidebars */
                <motion.div
                  key="poster"
                  className="flex-1 relative flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Export Button - Top left when there's content */}
                  {hasContent && (
                    <div className="absolute top-4 left-4 z-30">
                      <ExportButton
                        stage={exportState.stage}
                        progress={exportState.progress}
                        error={exportState.error}
                        onExport={handleExport}
                        onReset={resetExport}
                        disabled={isExporting}
                      />
                    </div>
                  )}

                  {/* Left Sketch Sidebar */}
                  {leftSketches.length > 0 && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20 hidden lg:block">
                      <SketchSidebar
                        images={leftSketches}
                        side="left"
                        onImageClick={onImageClick}
                        onImageError={onImageError}
                      />
                    </div>
                  )}

                  {/* Hero Zone - Centered */}
                  <div className="relative">
                    <HeroZone
                      imageUrl={heroImage}
                      imageId={project.poster?.id || nonSketchImages[0]?.id}
                      projectName={project.name}
                      onImageClick={() => heroImage && onImageClick(project.poster?.id || nonSketchImages[0]?.id)}
                      onImageError={onImageError}
                    />

                    {/* Play Button Overlay with Loading Progress */}
                    {hasContent && (
                      <motion.div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-4"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5, duration: 0.3 }}
                      >
                        {/* Play Button - Ready when no videos to preload OR videos are ready */}
                        {(() => {
                          const playReady = !hasVideos || videosReady;
                          return (
                            <motion.button
                              onClick={() => playReady && setIsPlaying(true)}
                              disabled={!playReady}
                              className={`
                                p-6 rounded-full backdrop-blur-sm
                                border-2 shadow-2xl shadow-black/50
                                transition-all duration-300 group
                                ${playReady
                                  ? 'bg-black/60 hover:bg-black/80 border-white/30 hover:border-cyan-400/50 cursor-pointer'
                                  : 'bg-black/40 border-white/20 cursor-not-allowed'
                                }
                              `}
                              whileHover={playReady ? { scale: 1.1 } : {}}
                              whileTap={playReady ? { scale: 0.95 } : {}}
                            >
                              {hasVideos && videosLoading ? (
                                <Loader2
                                  size={48}
                                  className="text-cyan-400 animate-spin"
                                />
                              ) : hasVideos && loadErrors.length > 0 && !videosReady ? (
                                <AlertCircle
                                  size={48}
                                  className="text-red-400"
                                />
                              ) : (
                                <Play
                                  size={48}
                                  className={`
                                    transition-colors
                                    ${playReady
                                      ? 'text-white fill-white group-hover:text-cyan-400 group-hover:fill-cyan-400'
                                      : 'text-white/50 fill-white/50'
                                    }
                                  `}
                                />
                              )}
                            </motion.button>
                          );
                        })()}

                        {/* Progress Bar - Show while loading videos */}
                        {hasVideos && !videosReady && (
                          <motion.div
                            className="flex flex-col items-center gap-2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            {/* Progress bar container */}
                            <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                              <motion.div
                                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${loadProgress}%` }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                              />
                            </div>

                            {/* Status text */}
                            <div className="text-center">
                              {loadErrors.length > 0 ? (
                                <div className="flex flex-col items-center gap-2">
                                  <span className="text-xs font-mono text-red-400">
                                    {loadErrors.length} video{loadErrors.length !== 1 ? 's' : ''} failed to load
                                  </span>
                                  <button
                                    onClick={retryLoad}
                                    className="flex items-center gap-1 px-3 py-1 text-xs font-mono text-cyan-400 hover:text-cyan-300 bg-white/5 hover:bg-white/10 rounded-full border border-cyan-500/30 transition-colors"
                                  >
                                    <RefreshCw size={12} />
                                    Retry
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs font-mono text-slate-400">
                                  Loading videos... {loadedCount}/{totalCount}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        )}

                        {/* Ready indicator - different text for cover-only vs with videos */}
                        {(!hasVideos || videosReady) && (
                          <motion.span
                            className="text-xs font-mono text-cyan-400"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                          >
                            {hasVideos ? 'Ready to play' : 'Watch showcase'}
                          </motion.span>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Right Sketch Sidebar */}
                  {rightSketches.length > 0 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 hidden lg:block">
                      <SketchSidebar
                        images={rightSketches}
                        side="right"
                        onImageClick={onImageClick}
                        onImageError={onImageError}
                      />
                    </div>
                  )}

                  {/* Content badge - shows for any content (cover or videos) */}
                  {hasContent && (
                    <motion.div
                      className="absolute left-1/2 -translate-x-1/2 bottom-8 z-30"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                    >
                      <span className={`px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border text-xs font-mono ${
                        (!hasVideos || videosReady)
                          ? 'border-cyan-500/30 text-cyan-400'
                          : 'border-white/20 text-slate-400'
                      }`}>
                        {hasVideos
                          ? videosReady
                            ? `${showcaseVideos.length} video${showcaseVideos.length !== 1 ? 's' : ''} ready`
                            : videosLoading
                              ? `Loading ${loadedCount}/${totalCount}...`
                              : `${showcaseVideos.length} video${showcaseVideos.length !== 1 ? 's' : ''}`
                          : 'Watch showcase'
                        }
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Gallery Row - Always visible below hero/player */}
            <div className="h-[180px] overflow-hidden bg-gradient-to-t from-black via-black/95 to-transparent">
              <FloatingGallery
                images={allImages}
                onImageClick={onImageClick}
                onImageError={onImageError}
              />
            </div>
          </div>

          {/* Right Ribbon: Mirror for balance */}
          <div className="w-16 lg:w-20 shrink-0 border-l border-white/5 bg-black/20 backdrop-blur-sm hidden lg:flex flex-col items-center py-8 gap-4">
            {/* Decorative elements */}
            <div className="w-1 h-full bg-gradient-to-b from-transparent via-rose-500/20 to-transparent rounded-full" />
          </div>
        </div>
      </motion.div>

      {/* Cinematic Letterbox Bars */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black to-transparent pointer-events-none z-30" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black to-transparent pointer-events-none z-30" />

      {/* Dimension Spotlight Overlay */}
      <DimensionSpotlight
        dimension={selectedDimension}
        onClose={() => setSelectedDimension(null)}
      />
    </div>
  );
}

export default ShowcaseCinematic;
