/**
 * ClickablePrototype - Interactive UI prototype component
 *
 * Renders the generated image with interactive clickable regions overlaid.
 * Each region responds to hover and click with visual feedback and animations.
 *
 * Features:
 * - Clickable regions with hover/active states
 * - Visual feedback animations (pulse, glow, scale)
 * - Region labels on hover
 * - Edit mode for drawing and configuring hotspots
 */

'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MousePointer2,
  Loader2,
  Eye,
  EyeOff,
  Maximize2,
  Info,
  Pencil,
} from 'lucide-react';
import { InteractivePrototype, InteractiveRegion } from '../../types';
import { semanticColors } from '../../lib/semanticColors';
import { fadeIn, scaleIn, transitions } from '../../lib/motion';
import { HotspotEditor } from '../../subfeature_interactive/components/HotspotEditor';
import { Hotspot } from '../../subfeature_interactive/lib/hotspotTypes';

interface ClickablePrototypeProps {
  prototype: InteractivePrototype;
  imageUrl?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Custom hotspots created in edit mode */
  customHotspots?: Hotspot[];
  /** Callback when custom hotspots change */
  onHotspotsChange?: (hotspots: Hotspot[]) => void;
}

/**
 * Get feedback styles for a region based on interaction type
 */
function getFeedbackStyles(region: InteractiveRegion, isHovered: boolean, isActive: boolean): string {
  const base = 'transition-all duration-200';

  if (isActive && region.feedback?.active) {
    switch (region.feedback.active) {
      case 'scale-95':
        return `${base} scale-95`;
      case 'press':
        return `${base} scale-95 brightness-75`;
      default:
        return `${base} scale-95`;
    }
  }

  if (isHovered && region.feedback?.hover) {
    switch (region.feedback.hover) {
      case 'scale-105':
        return `${base} scale-105`;
      case 'glow':
        return `${base} shadow-lg shadow-cyan-500/50`;
      case 'highlight':
        return `${base} brightness-125`;
      case 'expand':
        return `${base} scale-102`;
      case 'zoom':
        return `${base} scale-110`;
      case 'slide-in':
        return `${base} translate-x-1`;
      case 'subtle-glow':
        return `${base} shadow-md shadow-purple-500/30`;
      case 'crosshair-active':
        return `${base} scale-110 brightness-150`;
      default:
        return `${base} brightness-110`;
    }
  }

  return base;
}

/**
 * Get region type color
 */
function getRegionTypeColor(type: InteractiveRegion['type']): { bg: string; border: string; text: string } {
  switch (type) {
    case 'button':
      return {
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/40',
        text: 'text-cyan-400',
      };
    case 'link':
      return {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/40',
        text: 'text-purple-400',
      };
    case 'hover':
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/40',
        text: 'text-amber-400',
      };
    case 'drag':
      return {
        bg: 'bg-green-500/10',
        border: 'border-green-500/40',
        text: 'text-green-400',
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/40',
        text: 'text-slate-400',
      };
  }
}

export function ClickablePrototype({
  prototype,
  imageUrl,
  isFullscreen = false,
  onToggleFullscreen,
  customHotspots = [],
  onHotspotsChange,
}: ClickablePrototypeProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [showRegions, setShowRegions] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [interactionLog, setInteractionLog] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Combine prototype regions with custom hotspots
  const regions = useMemo(() => {
    const prototypeRegions = prototype.assets?.regions || [];
    // Custom hotspots take precedence (user-created)
    const allRegions = [...prototypeRegions, ...customHotspots];
    return allRegions;
  }, [prototype.assets?.regions, customHotspots]);

  // Handle hotspot changes from the editor
  const handleHotspotsChange = useCallback((hotspots: Hotspot[]) => {
    onHotspotsChange?.(hotspots);
  }, [onHotspotsChange]);

  const handleRegionClick = useCallback((region: InteractiveRegion) => {
    setActiveRegion(region.id);

    // Log the interaction
    const logEntry = `${region.label || region.id}: ${region.action.type}`;
    setInteractionLog(prev => [...prev.slice(-4), logEntry]);

    // Reset active state after animation
    setTimeout(() => setActiveRegion(null), 200);

    // Trigger action animation feedback
    console.log('Region clicked:', region.label, region.action);
  }, []);

  if (prototype.status === 'generating') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 radius-md" data-testid="clickable-prototype-loading">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <span className="font-mono type-label text-purple-400 uppercase tracking-wider">
            Generating Clickable Prototype...
          </span>
        </div>
      </div>
    );
  }

  if (prototype.status === 'failed') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 radius-md" data-testid="clickable-prototype-error">
        <div className="flex flex-col items-center gap-3">
          <MousePointer2 className="w-8 h-8 text-red-400" />
          <span className="font-mono type-label text-red-400 uppercase tracking-wider">
            {prototype.error || 'Failed to generate prototype'}
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
      className={`relative w-full ${isFullscreen ? 'h-screen fixed inset-0 z-50 bg-black' : 'h-full'} radius-md overflow-hidden group`}
      data-testid="clickable-prototype-container"
    >
      {/* Background Image */}
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt="Prototype background"
          fill
          className="object-contain"
          unoptimized
          data-testid="clickable-prototype-image"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
      )}

      {/* Hotspot Editor (when in edit mode) */}
      {onHotspotsChange && (
        <HotspotEditor
          hotspots={customHotspots}
          onHotspotsChange={handleHotspotsChange}
          isEditMode={isEditMode}
          onExitEditMode={() => setIsEditMode(false)}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      )}

      {/* Interactive Regions Overlay (hidden in edit mode) */}
      <AnimatePresence>
        {showRegions && !isEditMode && regions.map((region) => {
          const isHovered = hoveredRegion === region.id;
          const isActive = activeRegion === region.id;
          const colors = getRegionTypeColor(region.type);
          const feedbackStyles = getFeedbackStyles(region, isHovered, isActive);

          return (
            <motion.div
              key={region.id}
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitions.fast}
              className={`absolute cursor-pointer ${feedbackStyles}`}
              style={{
                left: `${region.x * 100}%`,
                top: `${region.y * 100}%`,
                width: `${region.width * 100}%`,
                height: `${region.height * 100}%`,
              }}
              onMouseEnter={() => setHoveredRegion(region.id)}
              onMouseLeave={() => setHoveredRegion(null)}
              onClick={() => handleRegionClick(region)}
              data-testid={`clickable-region-${region.id}`}
            >
              {/* Region boundary */}
              <div
                className={`absolute inset-0 radius-sm border-2 border-dashed ${colors.border} ${colors.bg} ${
                  isHovered ? 'opacity-80' : 'opacity-40'
                } transition-opacity`}
              />

              {/* Region center indicator */}
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${
                isHovered ? colors.bg.replace('/10', '/40') : colors.bg.replace('/10', '/20')
              } border ${colors.border} transition-all`}>
                {region.type === 'button' && (
                  <div className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: 'currentColor' }} />
                )}
              </div>

              {/* Label tooltip */}
              <AnimatePresence>
                {showLabels && isHovered && region.label && (
                  <motion.div
                    variants={scaleIn}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={transitions.fast}
                    className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 radius-sm whitespace-nowrap
                               bg-black/90 border ${colors.border} z-10`}
                  >
                    <span className={`font-mono type-label ${colors.text}`}>
                      {region.label}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action type indicator */}
              <div className={`absolute bottom-1 right-1 px-1 py-0.5 radius-sm ${colors.bg} border ${colors.border}`}>
                <span className={`font-mono text-[8px] uppercase ${colors.text}`}>
                  {region.type}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRegions(!showRegions)}
              className={`p-2 radius-sm transition-colors ${
                showRegions
                  ? `${semanticColors.primary.bg} ${semanticColors.primary.border}`
                  : 'bg-slate-800/80 border-slate-700'
              } border hover:brightness-110`}
              data-testid="clickable-prototype-toggle-regions-btn"
              title={showRegions ? 'Hide regions' : 'Show regions'}
            >
              {showRegions ? (
                <Eye size={14} className={showRegions ? semanticColors.primary.text : 'text-slate-300'} />
              ) : (
                <EyeOff size={14} className="text-slate-300" />
              )}
            </button>
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`p-2 radius-sm transition-colors ${
                showLabels
                  ? 'bg-amber-500/20 border-amber-500/30'
                  : 'bg-slate-800/80 border-slate-700'
              } border hover:brightness-110`}
              data-testid="clickable-prototype-toggle-labels-btn"
              title={showLabels ? 'Hide labels' : 'Show labels'}
            >
              <Info size={14} className={showLabels ? 'text-amber-400' : 'text-slate-300'} />
            </button>
          </div>

          {/* Center - Mode indicator */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/80 radius-sm border border-purple-500/30">
            <MousePointer2 size={12} className="text-purple-400" />
            <span className="font-mono type-label text-purple-400 uppercase">
              Clickable Prototype
            </span>
            <span className="font-mono type-label text-slate-500">
              • {regions.length} regions
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Edit Mode Toggle */}
            {onHotspotsChange && (
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`p-2 radius-sm transition-colors border ${
                  isEditMode
                    ? 'bg-cyan-500/30 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                data-testid="clickable-prototype-edit-btn"
                title={isEditMode ? 'Exit edit mode' : 'Edit hotspots'}
              >
                <Pencil size={14} />
              </button>
            )}
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="p-2 radius-sm bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition-colors"
                data-testid="clickable-prototype-fullscreen-btn"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <Maximize2 size={14} className="text-slate-300" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interaction log */}
      <AnimatePresence>
        {interactionLog.length > 0 && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute top-3 right-3 p-2 bg-black/80 radius-sm border border-slate-700/50 max-w-xs"
          >
            <span className="font-mono type-label text-slate-500 block mb-1">Interactions:</span>
            {interactionLog.map((log, i) => (
              <span key={i} className="font-mono type-label text-slate-400 block">
                → {log}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive hint (hidden in edit mode) */}
      {!isEditMode && (
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.5, ...transitions.normal }}
          className="absolute top-3 left-3 px-2 py-1 bg-black/60 radius-sm border border-slate-700/50 opacity-60 group-hover:opacity-0 transition-opacity pointer-events-none"
        >
          <span className="font-mono type-label text-slate-400 flex items-center gap-1.5">
            <MousePointer2 size={10} />
            Click to interact • Hover for labels{onHotspotsChange && ' • Edit to add hotspots'}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

export default ClickablePrototype;
