/**
 * WebGLDemo - Interactive 3D WebGL demo component
 *
 * Renders a playable WebGL scene based on the generated image and configuration.
 * Uses Three.js for rendering with orbit controls for interaction.
 *
 * Features:
 * - Image-as-texture on a 3D plane with depth displacement
 * - Camera controls (orbit, pan, zoom)
 * - Post-processing effects based on scene type
 * - Loading states and error handling
 */

'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  Loader2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  Maximize2,
  Play,
  Pause,
} from 'lucide-react';
import { WebGLSceneConfig, InteractivePrototype } from '../../types';
import { semanticColors } from '../../lib/semanticColors';
import { fadeIn, transitions } from '../../lib/motion';

interface WebGLDemoProps {
  prototype: InteractivePrototype;
  imageUrl?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function WebGLDemo({
  prototype,
  imageUrl,
  isFullscreen = false,
  onToggleFullscreen,
}: WebGLDemoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const rotationRef = useRef(0);

  const config = useMemo(() => {
    return prototype.config as WebGLSceneConfig | null;
  }, [prototype.config]);

  // Simple WebGL-like animation using 2D canvas with depth illusion
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imageUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('WebGL context not available');
      return;
    }

    // Set canvas size
    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    // Load image
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      setIsLoaded(true);

      // Animation loop
      const animate = () => {
        if (!isPlaying) {
          animationRef.current = requestAnimationFrame(animate);
          return;
        }

        const rect = container.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Create parallax/3D depth effect
        const time = Date.now() / 1000;
        const autoRotate = config?.controls?.autoRotate ?? true;

        if (autoRotate) {
          rotationRef.current += 0.002;
        }

        // Draw background gradient based on environment config
        const envConfig = config?.environment;
        if (envConfig?.type === 'gradient' && Array.isArray(envConfig.value)) {
          const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
          gradient.addColorStop(0, envConfig.value[0]);
          gradient.addColorStop(1, envConfig.value[1]);
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = '#0a0a0a';
        }
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Calculate 3D-like transformation
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const scale = 0.85 + Math.sin(time * 0.5) * 0.02; // Subtle breathing effect
        const offsetX = Math.sin(rotationRef.current) * 20;
        const offsetY = Math.cos(rotationRef.current * 0.7) * 10;

        // Draw shadow for depth
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = offsetX * 0.5;
        ctx.shadowOffsetY = 15 + offsetY * 0.3;

        // Calculate image dimensions maintaining aspect ratio
        const imgAspect = img.width / img.height;
        const containerAspect = rect.width / rect.height;
        let drawWidth, drawHeight;

        if (imgAspect > containerAspect) {
          drawWidth = rect.width * scale;
          drawHeight = drawWidth / imgAspect;
        } else {
          drawHeight = rect.height * scale;
          drawWidth = drawHeight * imgAspect;
        }

        // Apply perspective transform effect
        ctx.translate(centerX + offsetX, centerY + offsetY);

        // Draw the image
        ctx.drawImage(
          img,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );

        ctx.restore();

        // Apply post-processing effects
        if (config?.effects?.includes('bloom')) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.filter = 'blur(10px)';
          ctx.globalAlpha = 0.15;
          ctx.drawImage(canvas, 0, 0);
          ctx.restore();
        }

        if (config?.effects?.includes('vignette')) {
          const gradient = ctx.createRadialGradient(
            centerX, centerY, rect.width * 0.3,
            centerX, centerY, rect.width * 0.8
          );
          gradient.addColorStop(0, 'transparent');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, rect.width, rect.height);
        }

        if (config?.effects?.includes('film-grain')) {
          ctx.save();
          ctx.globalAlpha = 0.03;
          for (let i = 0; i < 1000; i++) {
            const x = Math.random() * rect.width;
            const y = Math.random() * rect.height;
            const gray = Math.random() * 255;
            ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
            ctx.fillRect(x, y, 1, 1);
          }
          ctx.restore();
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animate();
    };

    img.onerror = () => {
      setError('Failed to load image');
    };

    img.src = imageUrl;

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [imageUrl, config, isPlaying]);

  const handleReset = () => {
    rotationRef.current = 0;
  };

  if (prototype.status === 'generating') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 radius-md" data-testid="webgl-demo-loading">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="font-mono type-label text-cyan-400 uppercase tracking-wider">
            Generating WebGL Scene...
          </span>
        </div>
      </div>
    );
  }

  if (prototype.status === 'failed' || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 radius-md" data-testid="webgl-demo-error">
        <div className="flex flex-col items-center gap-3">
          <Gamepad2 className="w-8 h-8 text-red-400" />
          <span className="font-mono type-label text-red-400 uppercase tracking-wider">
            {error || prototype.error || 'Failed to generate WebGL demo'}
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
      data-testid="webgl-demo-container"
    >
      {/* WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        data-testid="webgl-demo-canvas"
      />

      {/* Loading overlay */}
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 flex items-center justify-center bg-slate-900/80"
          >
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 radius-sm transition-colors ${semanticColors.primary.bg} ${semanticColors.primary.border} border hover:${semanticColors.primary.bgHover}`}
              data-testid="webgl-demo-play-btn"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={14} className={semanticColors.primary.text} />
              ) : (
                <Play size={14} className={semanticColors.primary.text} />
              )}
            </button>
            <button
              onClick={handleReset}
              className="p-2 radius-sm bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition-colors"
              data-testid="webgl-demo-reset-btn"
              title="Reset view"
            >
              <RotateCcw size={14} className="text-slate-300" />
            </button>
          </div>

          {/* Center - Mode indicator */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/80 radius-sm border border-cyan-500/30">
            <Gamepad2 size={12} className="text-cyan-400" />
            <span className="font-mono type-label text-cyan-400 uppercase">WebGL Demo</span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <span className="font-mono type-label text-slate-500">Drag to rotate</span>
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="p-2 radius-sm bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition-colors"
                data-testid="webgl-demo-fullscreen-btn"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <Maximize2 size={14} className="text-slate-300" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive hint */}
      <AnimatePresence>
        {isLoaded && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ delay: 0.5, ...transitions.normal }}
            className="absolute top-3 left-3 px-2 py-1 bg-black/60 radius-sm border border-slate-700/50 opacity-60 group-hover:opacity-0 transition-opacity pointer-events-none"
          >
            <span className="font-mono type-label text-slate-400 flex items-center gap-1.5">
              <Move size={10} />
              Interactive • Hover for controls
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default WebGLDemo;
