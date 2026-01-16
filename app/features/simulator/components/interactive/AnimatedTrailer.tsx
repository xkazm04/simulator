/**
 * AnimatedTrailer - Animated motion trailer component
 *
 * Renders a 15-second animated trailer using the generated image with
 * Ken Burns effects, parallax layers, and cinematic transitions.
 *
 * Features:
 * - Camera motion (pan, zoom, parallax)
 * - Cinematic effects (fade, vignette, title cards)
 * - Playback controls (play, pause, scrub)
 * - Timeline visualization
 */

'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import {
  Film,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Volume2,
  VolumeX,
  SkipBack,
} from 'lucide-react';
import { InteractivePrototype, TrailerConfig } from '../../types';
import { semanticColors } from '../../lib/semanticColors';
import { fadeIn, transitions } from '../../lib/motion';

interface AnimatedTrailerProps {
  prototype: InteractivePrototype;
  imageUrl?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

/**
 * Interpolate between camera positions based on normalized time
 */
function interpolateCameraPath(
  path: TrailerConfig['cameraPath'],
  time: number
): { x: number; y: number; scale: number } {
  if (path.length === 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  if (path.length === 1) {
    return { x: path[0].position[0], y: path[0].position[1], scale: 1 / path[0].position[2] };
  }

  // Find the two keyframes to interpolate between
  let prevFrame = path[0];
  let nextFrame = path[path.length - 1];

  for (let i = 0; i < path.length - 1; i++) {
    if (time >= path[i].time && time <= path[i + 1].time) {
      prevFrame = path[i];
      nextFrame = path[i + 1];
      break;
    }
  }

  // Calculate interpolation factor
  const frameDuration = nextFrame.time - prevFrame.time;
  const frameProgress = frameDuration > 0 ? (time - prevFrame.time) / frameDuration : 0;

  // Apply easing
  let easedProgress = frameProgress;
  switch (nextFrame.easing) {
    case 'ease-in':
      easedProgress = frameProgress * frameProgress;
      break;
    case 'ease-out':
      easedProgress = 1 - Math.pow(1 - frameProgress, 2);
      break;
    case 'ease-in-out':
      easedProgress = frameProgress < 0.5
        ? 2 * frameProgress * frameProgress
        : 1 - Math.pow(-2 * frameProgress + 2, 2) / 2;
      break;
  }

  // Interpolate position
  const x = prevFrame.position[0] + (nextFrame.position[0] - prevFrame.position[0]) * easedProgress;
  const y = prevFrame.position[1] + (nextFrame.position[1] - prevFrame.position[1]) * easedProgress;
  const z = prevFrame.position[2] + (nextFrame.position[2] - prevFrame.position[2]) * easedProgress;

  // Convert Z to scale (closer = larger scale)
  const scale = 1 + (20 - z) * 0.05;

  return { x: x * 10, y: y * 10, scale: Math.max(0.8, Math.min(1.5, scale)) };
}

/**
 * Get active effects at a given time
 */
function getActiveEffects(
  effects: TrailerConfig['effects'],
  time: number
): Array<{ type: string; progress: number; params?: Record<string, unknown> }> {
  return effects
    .filter(effect => time >= effect.startTime && time <= effect.endTime)
    .map(effect => ({
      type: effect.type,
      progress: (time - effect.startTime) / (effect.endTime - effect.startTime),
      params: effect.params,
    }));
}

export function AnimatedTrailer({
  prototype,
  imageUrl,
  isFullscreen = false,
  onToggleFullscreen,
}: AnimatedTrailerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const config = useMemo(() => {
    return prototype.config as TrailerConfig | null;
  }, [prototype.config]);

  const duration = config?.duration || 15;

  // Calculate camera transform based on current time
  const cameraTransform = useMemo(() => {
    if (!config?.cameraPath) {
      return { x: 0, y: 0, scale: 1 };
    }
    return interpolateCameraPath(config.cameraPath, currentTime);
  }, [config?.cameraPath, currentTime]);

  // Get active effects
  const activeEffects = useMemo(() => {
    if (!config?.effects) {
      return [];
    }
    return getActiveEffects(config.effects, currentTime);
  }, [config?.effects, currentTime]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp - currentTime * duration * 1000;
      }

      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const normalizedTime = (elapsed / duration) % 1;

      setCurrentTime(normalizedTime);

      // Loop or stop at end
      if (elapsed >= duration) {
        startTimeRef.current = timestamp;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, duration, currentTime]);

  const handlePlayPause = useCallback(() => {
    if (!isPlaying) {
      startTimeRef.current = null;
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    startTimeRef.current = null;
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setCurrentTime(Math.max(0, Math.min(1, x)));
    startTimeRef.current = null;
  }, []);

  // Get effect-based styles
  const fadeEffect = activeEffects.find(e => e.type === 'fade');
  const fadeOpacity = fadeEffect
    ? fadeEffect.params?.from !== undefined
      ? (fadeEffect.params.from as number) + ((fadeEffect.params.to as number) - (fadeEffect.params.from as number)) * fadeEffect.progress
      : 1
    : 1;

  const zoomEffect = activeEffects.find(e => e.type === 'zoom');
  const zoomScale = zoomEffect
    ? 1 + ((zoomEffect.params?.scale as number || 1) - 1) * zoomEffect.progress
    : 1;

  const titleCardEffect = activeEffects.find(e => e.type === 'title-card');

  if (prototype.status === 'generating') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 radius-md" data-testid="animated-trailer-loading">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
          <span className="font-mono type-label text-rose-400 uppercase tracking-wider">
            Generating Animated Trailer...
          </span>
        </div>
      </div>
    );
  }

  if (prototype.status === 'failed') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 radius-md" data-testid="animated-trailer-error">
        <div className="flex flex-col items-center gap-3">
          <Film className="w-8 h-8 text-red-400" />
          <span className="font-mono type-label text-red-400 uppercase tracking-wider">
            {prototype.error || 'Failed to generate trailer'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      variants={fadeIn}
      initial="initial"
      animate="animate"
      className={`relative w-full ${isFullscreen ? 'h-screen fixed inset-0 z-50' : 'h-full'} bg-black radius-md overflow-hidden group`}
      data-testid="animated-trailer-container"
    >
      {/* Animated image layer */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          opacity: fadeOpacity,
        }}
      >
        {imageUrl ? (
          <motion.div
            className="absolute inset-0"
            animate={{
              x: cameraTransform.x,
              y: cameraTransform.y,
              scale: cameraTransform.scale * zoomScale,
            }}
            transition={{ duration: 0.1, ease: 'linear' }}
          >
            <Image
              src={imageUrl}
              alt="Trailer frame"
              fill
              className="object-cover"
              unoptimized
              data-testid="animated-trailer-image"
            />
          </motion.div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
        )}

        {/* Vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
          }}
        />

        {/* Parallax layers effect */}
        {activeEffects.some(e => e.type === 'parallax') && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20"
              style={{
                transform: `translateX(${Math.sin(currentTime * Math.PI * 2) * 20}px)`,
              }}
            />
          </div>
        )}
      </div>

      {/* Title card overlay */}
      <AnimatePresence>
        {titleCardEffect && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: titleCardEffect.progress, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-0 flex items-center justify-center bg-black/60 z-10"
          >
            <div className="text-center">
              <motion.h1
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-bold text-white tracking-wider drop-shadow-2xl"
              >
                {String(titleCardEffect.params?.text || 'Coming Soon')}
              </motion.h1>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent mt-4"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Film grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
        }}
      />

      {/* Letterbox bars for cinematic feel */}
      <div className="absolute top-0 left-0 right-0 h-[8%] bg-black" />
      <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-black" />

      {/* Timeline scrubber */}
      <div className="absolute bottom-[8%] left-0 right-0 h-12 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <div className="px-4 pt-4">
          {/* Timeline bar */}
          <div
            className="relative h-1 bg-slate-700 radius-full cursor-pointer overflow-hidden"
            onClick={handleSeek}
            data-testid="animated-trailer-timeline"
          >
            {/* Progress */}
            <motion.div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-rose-500 to-amber-500"
              style={{ width: `${currentTime * 100}%` }}
            />

            {/* Effect markers */}
            {config?.effects.map((effect, i) => (
              <div
                key={i}
                className="absolute top-0 h-full opacity-50"
                style={{
                  left: `${effect.startTime * 100}%`,
                  width: `${(effect.endTime - effect.startTime) * 100}%`,
                  backgroundColor: effect.type === 'title-card' ? '#f43f5e' : '#94a3b8',
                }}
              />
            ))}

            {/* Playhead */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md"
              style={{ left: `calc(${currentTime * 100}% - 6px)` }}
            />
          </div>

          {/* Time display */}
          <div className="flex items-center justify-between mt-1">
            <span className="font-mono type-label text-slate-400">
              {Math.floor(currentTime * duration)}s
            </span>
            <span className="font-mono type-label text-slate-400">
              {duration}s
            </span>
          </div>
        </div>
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-[12%] left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className={`p-2 radius-sm transition-colors bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30`}
              data-testid="animated-trailer-play-btn"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={14} className="text-rose-400" />
              ) : (
                <Play size={14} className="text-rose-400" />
              )}
            </button>
            <button
              onClick={handleReset}
              className="p-2 radius-sm bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition-colors"
              data-testid="animated-trailer-reset-btn"
              title="Reset"
            >
              <SkipBack size={14} className="text-slate-300" />
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 radius-sm bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition-colors"
              data-testid="animated-trailer-mute-btn"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX size={14} className="text-slate-300" />
              ) : (
                <Volume2 size={14} className="text-slate-300" />
              )}
            </button>
          </div>

          {/* Center - Mode indicator */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/80 radius-sm border border-rose-500/30">
            <Film size={12} className="text-rose-400" />
            <span className="font-mono type-label text-rose-400 uppercase">
              Animated Trailer
            </span>
            <span className="font-mono type-label text-slate-500">
              • {duration}s
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="p-2 radius-sm bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition-colors"
                data-testid="animated-trailer-fullscreen-btn"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <Maximize2 size={14} className="text-slate-300" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Play button overlay when paused */}
      <AnimatePresence>
        {!isPlaying && currentTime === 0 && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 flex items-center justify-center cursor-pointer z-10"
            onClick={handlePlayPause}
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-20 h-20 rounded-full bg-rose-500/80 flex items-center justify-center shadow-2xl"
            >
              <Play size={32} className="text-white ml-1" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive hint */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.5, ...transitions.normal }}
        className="absolute top-[10%] left-3 px-2 py-1 bg-black/60 radius-sm border border-slate-700/50 opacity-60 group-hover:opacity-0 transition-opacity pointer-events-none z-10"
      >
        <span className="font-mono type-label text-slate-400 flex items-center gap-1.5">
          <Film size={10} />
          {isPlaying ? 'Playing...' : 'Click to play trailer'}
        </span>
      </motion.div>
    </motion.div>
  );
}

export default AnimatedTrailer;
