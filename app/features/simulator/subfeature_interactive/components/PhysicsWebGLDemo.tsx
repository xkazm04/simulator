/**
 * PhysicsWebGLDemo - Enhanced WebGL demo with physics simulation
 *
 * Extends the basic WebGLDemo with:
 * - Matter.js physics engine integration
 * - Real-time player controls (keyboard/touch)
 * - Game mechanics templates (platformer, top-down, puzzle)
 * - Camera following and smooth movement
 * - Export to standalone HTML capability
 */

'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  Loader2,
  RotateCcw,
  Move,
  Maximize2,
  Play,
  Pause,
  Download,
  Settings,
  Keyboard,
} from 'lucide-react';
import { InteractivePrototype } from '../../types';
import { semanticColors } from '../../lib/semanticColors';
import { fadeIn, transitions } from '../../lib/motion';
import { GameEngine, GameMechanicsType, GameState } from '../lib/mechanicsTemplates';
import { CameraController, createCameraForGameType } from '../lib/cameraController';
import { MechanicsSelector } from './MechanicsSelector';
import { ExportButton } from './ExportButton';

interface PhysicsWebGLDemoProps {
  prototype: InteractivePrototype;
  imageUrl?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Initial mechanics type */
  initialMechanics?: GameMechanicsType;
  /** Show mechanics selector */
  showMechanicsSelector?: boolean;
  /** Show export button */
  showExport?: boolean;
  /** Title for export */
  exportTitle?: string;
}

export function PhysicsWebGLDemo({
  prototype,
  imageUrl,
  isFullscreen = false,
  onToggleFullscreen,
  initialMechanics = 'platformer',
  showMechanicsSelector = true,
  showExport = true,
  exportTitle = 'Interactive Demo',
}: PhysicsWebGLDemoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mechanics, setMechanics] = useState<GameMechanicsType>(initialMechanics);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  // Initialize game engine when mechanics change
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Get dimensions
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Cleanup previous engine
    if (engineRef.current) {
      engineRef.current.dispose();
    }

    // Create new engine
    const engine = new GameEngine({
      mechanics,
      bounds: { width, height },
    });

    // Create camera
    const camera = createCameraForGameType(mechanics, { width, height }, { width: width * 2, height: height * 2 });

    engineRef.current = engine;
    cameraRef.current = camera;

    // Attach input to canvas
    engine.attach(canvas);

    // Start engine
    engine.start();

    return () => {
      engine.dispose();
    };
  }, [mechanics]);

  // Load background image
  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      backgroundImageRef.current = img;
      setIsLoaded(true);
    };

    img.onerror = () => {
      setError('Failed to load image');
    };

    img.src = imageUrl;
  }, [imageUrl]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Canvas context not available');
      return;
    }

    // Resize handler
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Update camera viewport
      if (cameraRef.current) {
        cameraRef.current.updateConfig({
          viewport: { width: rect.width, height: rect.height },
        });
      }
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Render loop
    const render = (timestamp: number) => {
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const rect = container.getBoundingClientRect();
      const engine = engineRef.current;
      const camera = cameraRef.current;
      const bgImage = backgroundImageRef.current;

      // Clear canvas
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw background image (parallax)
      if (bgImage && isLoaded) {
        ctx.save();
        ctx.globalAlpha = 0.5;

        const imgAspect = bgImage.width / bgImage.height;
        const canvasAspect = rect.width / rect.height;
        let drawWidth, drawHeight;

        if (imgAspect > canvasAspect) {
          drawHeight = rect.height * 1.1;
          drawWidth = drawHeight * imgAspect;
        } else {
          drawWidth = rect.width * 1.1;
          drawHeight = drawWidth / imgAspect;
        }

        // Parallax offset based on game state
        let parallaxX = 0;
        let parallaxY = 0;
        if (engine && gameState) {
          parallaxX = (gameState.playerPosition.x / rect.width - 0.5) * -30;
          parallaxY = (gameState.playerPosition.y / rect.height - 0.5) * -15;
        }

        ctx.drawImage(
          bgImage,
          (rect.width - drawWidth) / 2 + parallaxX,
          (rect.height - drawHeight) / 2 + parallaxY,
          drawWidth,
          drawHeight
        );

        ctx.restore();
      }

      // Update camera to follow player
      if (engine && camera && gameState) {
        camera.follow(
          gameState.playerPosition.x,
          gameState.playerPosition.y,
          gameState.playerVelocity.x,
          gameState.playerVelocity.y
        );
        camera.update(deltaTime);
      }

      // Draw game world
      if (engine && isLoaded) {
        const world = engine.getWorld();
        const bodies = world.getAllBodies();

        // Draw platforms
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;

        for (const body of bodies) {
          if (body.type === 'platform' && !body.id.startsWith('__')) {
            const pos = world.getPosition(body.id);
            if (!pos) continue;

            const vertices = body.body.vertices;
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
              ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }

        // Draw obstacles and dynamic objects
        ctx.fillStyle = '#64748b';
        for (const body of bodies) {
          if ((body.type === 'obstacle' || body.type === 'dynamic') && !body.id.startsWith('__')) {
            const pos = world.getPosition(body.id);
            if (!pos) continue;

            const vertices = body.body.vertices;
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
              ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.closePath();
            ctx.fill();
          }
        }

        // Draw triggers
        ctx.fillStyle = 'rgba(234, 179, 8, 0.3)';
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
        for (const body of bodies) {
          if (body.type === 'trigger') {
            const pos = world.getPosition(body.id);
            if (!pos) continue;

            const vertices = body.body.vertices;
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
              ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }

        // Draw player
        const player = world.getBody('player');
        if (player) {
          const pos = world.getPosition('player');
          if (pos) {
            const isGrounded = gameState?.isGrounded ?? false;

            // Player glow
            ctx.save();
            ctx.shadowColor = 'rgba(34, 211, 238, 0.5)';
            ctx.shadowBlur = 15;

            // Player body
            ctx.fillStyle = isGrounded ? '#22d3ee' : '#06b6d4';
            const vertices = player.body.vertices;
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
              ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.closePath();
            ctx.fill();

            // Player outline
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();

            // Direction indicator (based on velocity)
            if (gameState && Math.abs(gameState.playerVelocity.x) > 0.5) {
              const dir = Math.sign(gameState.playerVelocity.x);
              ctx.fillStyle = '#67e8f9';
              ctx.beginPath();
              ctx.arc(pos.x + dir * 8, pos.y - 10, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // Update game state for UI
        const currentState = engine.getState();
        setGameState(currentState);

        // Debug rendering
        if (debugMode) {
          engine.renderDebug(ctx);
        }
      }

      // Draw HUD
      if (gameState && isLoaded) {
        // Score
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`Score: ${gameState.score}`, rect.width - 100, 25);

        // Time
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText(`Time: ${gameState.time.toFixed(1)}s`, rect.width - 100, 45);

        // Collectibles
        if (gameState.collectibles > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`Items: ${gameState.collectibles}`, rect.width - 100, 65);
        }

        // Pause indicator
        if (gameState.isPaused) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, 0, rect.width, rect.height);

          ctx.fillStyle = '#22d3ee';
          ctx.font = 'bold 24px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('PAUSED', rect.width / 2, rect.height / 2);
          ctx.font = '14px monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('Press ESC to resume', rect.width / 2, rect.height / 2 + 30);
          ctx.textAlign = 'left';
        }
      }

      // Continue loop
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [isLoaded, isPlaying, gameState?.isPaused, debugMode]);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (isPlaying) {
      engine.pause();
    } else {
      engine.resume();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Handle reset
  const handleReset = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.reset();
      setIsPlaying(true);
    }
  }, []);

  // Handle mechanics change
  const handleMechanicsChange = useCallback((type: GameMechanicsType) => {
    setMechanics(type);
    setIsPlaying(true);
  }, []);

  // Loading state
  if (prototype.status === 'generating') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 radius-md" data-testid="physics-demo-loading">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="font-mono type-label text-cyan-400 uppercase tracking-wider">
            Generating Physics Demo...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (prototype.status === 'failed' || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 radius-md" data-testid="physics-demo-error">
        <div className="flex flex-col items-center gap-3">
          <Gamepad2 className="w-8 h-8 text-red-400" />
          <span className="font-mono type-label text-red-400 uppercase tracking-wider">
            {error || prototype.error || 'Failed to generate physics demo'}
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
      data-testid="physics-demo-container"
    >
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        tabIndex={0}
        data-testid="physics-demo-canvas"
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

      {/* Top HUD - Controls help */}
      <AnimatePresence>
        {isLoaded && showControls && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ delay: 0.5, ...transitions.normal }}
            className="absolute top-3 left-3 px-3 py-2 bg-black/70 radius-sm border border-slate-700/50"
          >
            <div className="flex items-center gap-4">
              <Keyboard size={14} className="text-slate-400" />
              <span className="font-mono type-label text-slate-400">
                {mechanics === 'platformer' && 'Arrow/WASD: Move • Space: Jump'}
                {mechanics === 'top-down' && 'Arrow/WASD: Move • Click: Action'}
                {mechanics === 'puzzle' && 'Arrow/WASD: Move • Space: Interact'}
                {mechanics === 'shooter' && 'WASD: Move • Mouse: Aim • Click: Shoot'}
              </span>
              <button
                onClick={() => setShowControls(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute top-16 right-3 w-72 p-4 bg-slate-900/95 border border-slate-700 radius-md shadow-elevated"
            data-testid="physics-demo-settings"
          >
            {showMechanicsSelector && (
              <MechanicsSelector
                selected={mechanics}
                onSelect={handleMechanicsChange}
              />
            )}

            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                  className="accent-cyan-500"
                />
                <span className="font-mono type-label text-slate-400">Debug Mode</span>
              </label>
            </div>

            {showExport && imageUrl && (
              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <ExportButton
                  mechanics={mechanics}
                  config={engineRef.current?.getConfig() || {
                    moveSpeed: 5,
                    jumpForce: 0.012,
                    maxFallSpeed: 15,
                    doubleJump: true,
                    wallJump: false,
                    playerSize: { width: 30, height: 40 },
                    startPosition: { x: 100, y: 300 },
                    bounds: { width: 800, height: 600 },
                    debug: false,
                  }}
                  imageData={imageUrl}
                  title={exportTitle}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className={`p-2 radius-sm transition-colors ${semanticColors.primary.bg} ${semanticColors.primary.border} border hover:brightness-125`}
              data-testid="physics-demo-play-btn"
              title={isPlaying ? 'Pause (ESC)' : 'Play'}
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
              data-testid="physics-demo-reset-btn"
              title="Reset (R)"
            >
              <RotateCcw size={14} className="text-slate-300" />
            </button>
          </div>

          {/* Center - Mode indicator */}
          <div className="flex items-center gap-2">
            <MechanicsSelector
              selected={mechanics}
              onSelect={handleMechanicsChange}
              compact
              disabled={!showMechanicsSelector}
            />
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 radius-sm border transition-colors ${
                showSettings
                  ? `${semanticColors.primary.bg} ${semanticColors.primary.border}`
                  : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700'
              }`}
              data-testid="physics-demo-settings-btn"
              title="Settings"
            >
              <Settings size={14} className={showSettings ? semanticColors.primary.text : 'text-slate-300'} />
            </button>

            {showExport && imageUrl && (
              <ExportButton
                mechanics={mechanics}
                config={engineRef.current?.getConfig() || {
                  moveSpeed: 5,
                  jumpForce: 0.012,
                  maxFallSpeed: 15,
                  doubleJump: true,
                  wallJump: false,
                  playerSize: { width: 30, height: 40 },
                  startPosition: { x: 100, y: 300 },
                  bounds: { width: 800, height: 600 },
                  debug: false,
                }}
                imageData={imageUrl}
                title={exportTitle}
                compact
              />
            )}

            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="p-2 radius-sm bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition-colors"
                data-testid="physics-demo-fullscreen-btn"
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
        {isLoaded && !showControls && (
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
              Playable Demo • Hover for controls
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default PhysicsWebGLDemo;
