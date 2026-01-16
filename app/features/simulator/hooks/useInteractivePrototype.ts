/**
 * useInteractivePrototype - Hook for managing interactive prototype generation
 *
 * Handles the generation and state management of interactive prototypes:
 * - WebGL demos for gameplay scenes
 * - Clickable prototypes for UI concepts
 * - Animated trailers for movie posters
 */

import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  InteractiveMode,
  InteractivePrototype,
  InteractiveRegion,
  WebGLSceneConfig,
  TrailerConfig,
  DimensionType,
} from '../types';

/**
 * Progress stage for prototype generation
 */
export type GenerationStage = 'analyzing' | 'generating' | 'rendering' | 'complete';

/**
 * Progress state for prototype generation
 */
export interface GenerationProgress {
  /** Current stage of generation */
  stage: GenerationStage;
  /** Progress percentage (0-100) */
  percent: number;
  /** Human-readable message for current stage */
  message: string;
  /** Estimated time remaining in seconds (null if unknown) */
  estimatedTimeRemaining: number | null;
}

/**
 * Get estimated generation time based on mode (in seconds)
 */
function getEstimatedTime(mode: InteractiveMode): number {
  switch (mode) {
    case 'webgl':
      return 4; // WebGL demos take longer
    case 'clickable':
      return 2; // Clickable prototypes are simpler
    case 'trailer':
      return 6; // Trailers require more processing
    default:
      return 2;
  }
}

/**
 * Get stage message based on mode and stage
 */
function getStageMessage(mode: InteractiveMode, stage: GenerationStage): string {
  const modeLabel = mode === 'webgl' ? '3D scene' : mode === 'trailer' ? 'animation' : 'prototype';

  switch (stage) {
    case 'analyzing':
      return `Analyzing prompt for ${modeLabel}...`;
    case 'generating':
      return mode === 'webgl'
        ? 'Generating 3D scene configuration...'
        : mode === 'trailer'
          ? 'Creating animation keyframes...'
          : 'Mapping interactive regions...';
    case 'rendering':
      return mode === 'webgl'
        ? 'Preparing WebGL renderer...'
        : mode === 'trailer'
          ? 'Rendering animation frames...'
          : 'Finalizing clickable areas...';
    case 'complete':
      return 'Generation complete!';
    default:
      return 'Processing...';
  }
}

interface UseInteractivePrototypeReturn {
  /** Current interactive mode */
  interactiveMode: InteractiveMode;
  /** Set the interactive mode */
  setInteractiveMode: (mode: InteractiveMode) => void;
  /** Map of prompt ID to prototype */
  prototypes: Map<string, InteractivePrototype>;
  /** Whether any prototype is currently generating */
  isGenerating: boolean;
  /** Current generation progress (null if not generating) */
  generationProgress: GenerationProgress | null;
  /** Generate interactive prototype for a prompt */
  generatePrototype: (params: {
    promptId: string;
    imageUrl?: string;
    prompt: string;
    sceneType: string;
    dimensions: Array<{ type: DimensionType; reference: string }>;
  }) => Promise<InteractivePrototype | null>;
  /** Get prototype for a specific prompt */
  getPrototype: (promptId: string) => InteractivePrototype | undefined;
  /** Clear all prototypes */
  clearPrototypes: () => void;
  /** Check if mode is available for scene type */
  getAvailableModes: (sceneType: string) => InteractiveMode[];
}

/**
 * Determine available interactive modes based on scene type
 */
function getModesForSceneType(sceneType: string): InteractiveMode[] {
  const sceneTypeLower = sceneType.toLowerCase();

  // All scenes support static
  const modes: InteractiveMode[] = ['static'];

  // Gameplay/action scenes support WebGL
  if (
    sceneTypeLower.includes('gameplay') ||
    sceneTypeLower.includes('action') ||
    sceneTypeLower.includes('cinematic') ||
    sceneTypeLower.includes('wide shot') ||
    sceneTypeLower.includes('environmental')
  ) {
    modes.push('webgl');
  }

  // UI/HUD/portrait scenes support clickable prototypes
  if (
    sceneTypeLower.includes('hero') ||
    sceneTypeLower.includes('portrait') ||
    sceneTypeLower.includes('close-up') ||
    sceneTypeLower.includes('ui') ||
    sceneTypeLower.includes('hud') ||
    sceneTypeLower.includes('menu') ||
    sceneTypeLower.includes('key art')
  ) {
    modes.push('clickable');
  }

  // Poster/cinematic scenes support trailers
  if (
    sceneTypeLower.includes('poster') ||
    sceneTypeLower.includes('key art') ||
    sceneTypeLower.includes('cinematic') ||
    sceneTypeLower.includes('dramatic') ||
    sceneTypeLower.includes('atmospheric')
  ) {
    modes.push('trailer');
  }

  return modes;
}

/**
 * Generate default WebGL scene configuration based on scene type
 */
function generateWebGLConfig(sceneType: string, dimensions: Array<{ type: DimensionType; reference: string }>): WebGLSceneConfig {
  const isActionScene = sceneType.toLowerCase().includes('action');
  const isCinematic = sceneType.toLowerCase().includes('cinematic');

  // Find mood dimension for lighting
  const moodDim = dimensions.find(d => d.type === 'mood');
  const isDark = moodDim?.reference.toLowerCase().includes('dark') ||
                 moodDim?.reference.toLowerCase().includes('noir');

  return {
    camera: {
      type: 'perspective',
      position: isCinematic ? [0, 2, 10] : [0, 1, 5],
      target: [0, 0, 0],
      fov: isCinematic ? 45 : 60,
    },
    lighting: {
      ambient: isDark ? 0.2 : 0.4,
      directional: {
        intensity: isDark ? 0.6 : 0.8,
        position: [5, 10, 5],
        color: isDark ? '#4a5568' : '#ffffff',
      },
    },
    controls: {
      type: isActionScene ? 'fly' : 'orbit',
      enabled: true,
      autoRotate: !isActionScene,
      dampingFactor: 0.05,
    },
    environment: {
      type: 'gradient',
      value: isDark ? ['#1a1a2e', '#0f0f1a'] : ['#1e3a5f', '#0a1628'],
    },
    effects: isActionScene
      ? ['bloom', 'chromatic-aberration']
      : isCinematic
        ? ['bloom', 'vignette', 'film-grain']
        : ['bloom'],
  };
}

/**
 * Generate default trailer configuration
 */
function generateTrailerConfig(sceneType: string, dimensions: Array<{ type: DimensionType; reference: string }>): TrailerConfig {
  const moodDim = dimensions.find(d => d.type === 'mood');
  const mood = moodDim?.reference || 'epic';

  return {
    duration: 15,
    fps: 30,
    cameraPath: [
      { time: 0, position: [0, 0, 20], target: [0, 0, 0], easing: 'ease-out' },
      { time: 0.3, position: [5, 2, 15], target: [0, 0, 0], easing: 'ease-in-out' },
      { time: 0.6, position: [-5, 3, 10], target: [0, 1, 0], easing: 'ease-in-out' },
      { time: 1, position: [0, 1, 5], target: [0, 0, 0], easing: 'ease-in' },
    ],
    effects: [
      { type: 'fade', startTime: 0, endTime: 0.1, params: { from: 0, to: 1 } },
      { type: 'zoom', startTime: 0.2, endTime: 0.4, params: { scale: 1.1 } },
      { type: 'parallax', startTime: 0.4, endTime: 0.8, params: { layers: 3, speed: 0.5 } },
      { type: 'title-card', startTime: 0.85, endTime: 1, params: { text: sceneType } },
      { type: 'fade', startTime: 0.95, endTime: 1, params: { from: 1, to: 0 } },
    ],
    audio: {
      type: 'ambient',
      mood: mood,
    },
  };
}

/**
 * Generate clickable regions based on scene type and UI genre
 */
function generateClickableRegions(sceneType: string, dimensions: Array<{ type: DimensionType; reference: string }>): InteractiveRegion[] {
  const regions: InteractiveRegion[] = [];
  const gameUIDim = dimensions.find(d => d.type === 'gameUI');
  const uiGenre = gameUIDim?.reference.toLowerCase() || '';

  // Common button regions for most UI types
  const baseRegions: InteractiveRegion[] = [
    {
      id: uuidv4(),
      x: 0.05,
      y: 0.9,
      width: 0.15,
      height: 0.08,
      type: 'button',
      action: { type: 'animate', params: { animation: 'pulse' } },
      feedback: { hover: 'scale-105', active: 'scale-95' },
      label: 'Action Button',
    },
  ];

  // Add genre-specific regions
  if (uiGenre.includes('rpg') || uiGenre.includes('crpg')) {
    regions.push(
      {
        id: uuidv4(),
        x: 0.02,
        y: 0.7,
        width: 0.1,
        height: 0.25,
        type: 'hover',
        action: { type: 'toggle', target: 'inventory-panel' },
        feedback: { hover: 'glow' },
        label: 'Inventory',
      },
      {
        id: uuidv4(),
        x: 0.88,
        y: 0.02,
        width: 0.1,
        height: 0.1,
        type: 'button',
        action: { type: 'toggle', target: 'menu' },
        feedback: { hover: 'highlight', active: 'press' },
        label: 'Menu',
      },
      {
        id: uuidv4(),
        x: 0.3,
        y: 0.85,
        width: 0.4,
        height: 0.12,
        type: 'hover',
        action: { type: 'animate', params: { animation: 'expand' } },
        feedback: { hover: 'expand' },
        label: 'Action Bar',
      }
    );
  }

  if (uiGenre.includes('fps') || uiGenre.includes('shooter')) {
    regions.push(
      {
        id: uuidv4(),
        x: 0.45,
        y: 0.45,
        width: 0.1,
        height: 0.1,
        type: 'button',
        action: { type: 'animate', params: { animation: 'crosshair-pulse' } },
        feedback: { hover: 'crosshair-active' },
        label: 'Crosshair',
      },
      {
        id: uuidv4(),
        x: 0.85,
        y: 0.85,
        width: 0.12,
        height: 0.12,
        type: 'hover',
        action: { type: 'animate', params: { animation: 'ammo-check' } },
        feedback: { hover: 'highlight' },
        label: 'Ammo Counter',
      }
    );
  }

  if (uiGenre.includes('mmo') || uiGenre.includes('moba')) {
    regions.push(
      {
        id: uuidv4(),
        x: 0.02,
        y: 0.02,
        width: 0.15,
        height: 0.1,
        type: 'hover',
        action: { type: 'toggle', target: 'minimap-zoom' },
        feedback: { hover: 'zoom' },
        label: 'Minimap',
      },
      {
        id: uuidv4(),
        x: 0.3,
        y: 0.9,
        width: 0.4,
        height: 0.08,
        type: 'button',
        action: { type: 'animate', params: { animation: 'ability-cooldown' } },
        feedback: { hover: 'glow', active: 'cast' },
        label: 'Ability Bar',
      }
    );
  }

  // Portrait/character scenes get character interaction regions
  if (sceneType.toLowerCase().includes('portrait') || sceneType.toLowerCase().includes('hero')) {
    regions.push(
      {
        id: uuidv4(),
        x: 0.3,
        y: 0.2,
        width: 0.4,
        height: 0.5,
        type: 'hover',
        action: { type: 'animate', params: { animation: 'character-idle' } },
        feedback: { hover: 'subtle-glow' },
        label: 'Character',
      },
      {
        id: uuidv4(),
        x: 0.7,
        y: 0.3,
        width: 0.25,
        height: 0.4,
        type: 'button',
        action: { type: 'toggle', target: 'stats-panel' },
        feedback: { hover: 'slide-in' },
        label: 'Character Stats',
      }
    );
  }

  return [...baseRegions, ...regions];
}

export function useInteractivePrototype(): UseInteractivePrototypeReturn {
  const [interactiveMode, setInteractiveMode] = useState<InteractiveMode>('static');
  const [prototypes, setPrototypes] = useState<Map<string, InteractivePrototype>>(new Map());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);

  const isGenerating = useMemo(() => generatingIds.size > 0, [generatingIds]);

  const generatePrototype = useCallback(async (params: {
    promptId: string;
    imageUrl?: string;
    prompt: string;
    sceneType: string;
    dimensions: Array<{ type: DimensionType; reference: string }>;
  }): Promise<InteractivePrototype | null> => {
    const { promptId, imageUrl, prompt, sceneType, dimensions } = params;

    // Skip if mode is static
    if (interactiveMode === 'static') {
      return null;
    }

    // Check if already generating
    if (generatingIds.has(promptId)) {
      return null;
    }

    // Mark as generating
    setGeneratingIds(prev => new Set(prev).add(promptId));

    // Create initial prototype
    const prototypeId = uuidv4();
    const prototype: InteractivePrototype = {
      id: prototypeId,
      promptId,
      imageId: imageUrl ? promptId : undefined,
      mode: interactiveMode,
      status: 'generating',
      createdAt: new Date().toISOString(),
      config: null,
    };

    setPrototypes(prev => new Map(prev).set(promptId, prototype));

    // Helper to update progress
    const updateProgress = (stage: GenerationStage, percent: number, estimatedTimeRemaining: number | null) => {
      setGenerationProgress({
        stage,
        percent,
        message: getStageMessage(interactiveMode, stage),
        estimatedTimeRemaining,
      });
    };

    try {
      const totalEstimatedTime = getEstimatedTime(interactiveMode);

      // Stage 1: Analyzing (0-30%)
      updateProgress('analyzing', 0, totalEstimatedTime);
      await new Promise(resolve => setTimeout(resolve, 200));
      updateProgress('analyzing', 15, totalEstimatedTime * 0.85);
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
      updateProgress('analyzing', 30, totalEstimatedTime * 0.7);

      // Stage 2: Generating (30-80%)
      updateProgress('generating', 35, totalEstimatedTime * 0.65);
      await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 300));
      updateProgress('generating', 50, totalEstimatedTime * 0.5);
      await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 300));
      updateProgress('generating', 65, totalEstimatedTime * 0.35);
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
      updateProgress('generating', 80, totalEstimatedTime * 0.2);

      // Stage 3: Rendering (80-100%)
      updateProgress('rendering', 85, totalEstimatedTime * 0.15);
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
      updateProgress('rendering', 95, totalEstimatedTime * 0.05);
      await new Promise(resolve => setTimeout(resolve, 200));
      updateProgress('complete', 100, 0);

      // Generate mode-specific config and assets
      let config: InteractivePrototype['config'];
      const assets: InteractivePrototype['assets'] = {
        thumbnail: imageUrl,
      };

      switch (interactiveMode) {
        case 'webgl':
          config = generateWebGLConfig(sceneType, dimensions);
          assets.sceneData = JSON.stringify({
            prompt,
            sceneType,
            config,
          });
          break;

        case 'clickable':
          const regions = generateClickableRegions(sceneType, dimensions);
          config = { regions };
          assets.regions = regions;
          break;

        case 'trailer':
          config = generateTrailerConfig(sceneType, dimensions);
          // In production, this would be a real video URL
          assets.videoUrl = undefined; // Placeholder for generated video
          break;

        default:
          config = null;
      }

      // Update prototype with completed status
      const completedPrototype: InteractivePrototype = {
        ...prototype,
        status: 'ready',
        config,
        assets,
      };

      setPrototypes(prev => new Map(prev).set(promptId, completedPrototype));
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });

      // Clear progress after short delay to show completion
      setTimeout(() => setGenerationProgress(null), 500);

      return completedPrototype;
    } catch (error) {
      console.error('Failed to generate interactive prototype:', error);

      // Update prototype with failed status
      const failedPrototype: InteractivePrototype = {
        ...prototype,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      setPrototypes(prev => new Map(prev).set(promptId, failedPrototype));
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });

      // Clear progress on error
      setGenerationProgress(null);

      return failedPrototype;
    }
  }, [interactiveMode, generatingIds]);

  const getPrototype = useCallback((promptId: string): InteractivePrototype | undefined => {
    return prototypes.get(promptId);
  }, [prototypes]);

  const clearPrototypes = useCallback(() => {
    setPrototypes(new Map());
    setGeneratingIds(new Set());
  }, []);

  const getAvailableModes = useCallback((sceneType: string): InteractiveMode[] => {
    return getModesForSceneType(sceneType);
  }, []);

  return {
    interactiveMode,
    setInteractiveMode,
    prototypes,
    isGenerating,
    generationProgress,
    generatePrototype,
    getPrototype,
    clearPrototypes,
    getAvailableModes,
  };
}
