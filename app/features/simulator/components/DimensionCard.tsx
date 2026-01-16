/**
 * DimensionCard - Remix dimension card with drop zone and lens controls
 * Design: Clean Manuscript style
 *
 * Implements the Dimension-as-Lens pattern:
 * - Dimensions are LENSES that filter and transform content
 * - Each dimension has: filter mode, transform mode, and weight
 * - Enables graduated transformations (e.g., "50% Star Wars, 50% Ghibli")
 *
 * Semantic Colors:
 * - cyan: Active state (has content)
 * - purple: Processing/AI-related (image reference, drop active)
 * - red: Destructive action (remove)
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ImagePlus, Image as ImageIcon, ArrowDownToLine, SlidersHorizontal, GripVertical } from 'lucide-react';

// File validation constants (same as BaseImageInput)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
import { Dimension, DimensionFilterMode, DimensionTransformMode, PromptElement } from '../types';
import { semanticColors, stateClasses } from '../lib/semanticColors';
import { IconButton } from '@/app/components/ui';
import { scaleInSubtle, expandCollapse, staggeredTransition, transitions, useReducedMotion, getReducedMotionStaggeredTransition, getReducedMotionTransitions } from '../lib/motion';

/** Labels for filter modes */
const FILTER_MODE_LABELS: Record<DimensionFilterMode, { label: string; description: string }> = {
  preserve_structure: { label: 'Structure', description: 'Keep layout & composition' },
  preserve_subject: { label: 'Subject', description: 'Keep main subjects' },
  preserve_mood: { label: 'Mood', description: 'Keep emotional tone' },
  preserve_color_palette: { label: 'Colors', description: 'Keep color relationships' },
  none: { label: 'None', description: 'Full transformation' },
};

/** Labels for transform modes */
const TRANSFORM_MODE_LABELS: Record<DimensionTransformMode, { label: string; description: string }> = {
  replace: { label: 'Replace', description: 'Complete replacement' },
  blend: { label: 'Blend', description: 'Mix with weight ratio' },
  style_transfer: { label: 'Style', description: 'Apply style only' },
  semantic_swap: { label: 'Semantic', description: 'Swap meaning' },
  additive: { label: 'Add', description: 'Layer on top' },
};

interface DimensionCardProps {
  dimension: Dimension;
  onChange: (id: string, reference: string) => void;
  onWeightChange?: (id: string, weight: number) => void;
  onFilterModeChange?: (id: string, filterMode: DimensionFilterMode) => void;
  onTransformModeChange?: (id: string, transformMode: DimensionTransformMode) => void;
  onRemove?: (id: string) => void;
  index: number;
  /** Callback when an element is dropped on this dimension */
  onDropElement?: (element: PromptElement, dimensionId: string) => void;
  /** Callback when a reference image is added or removed */
  onReferenceImageChange?: (id: string, imageDataUrl: string | null) => void;
}

export function DimensionCard({
  dimension,
  onChange,
  onWeightChange,
  onFilterModeChange,
  onTransformModeChange,
  onRemove,
  index,
  onDropElement,
  onReferenceImageChange,
}: DimensionCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showLensControls, setShowLensControls] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent = dimension.reference.trim().length > 0;
  const hasImage = !!dimension.referenceImage;

  // Reduced motion support for accessibility (WCAG 2.1 Level AAA)
  const prefersReducedMotion = useReducedMotion();
  const motionTransitions = getReducedMotionTransitions(prefersReducedMotion);

  // Get current weight with fallback for backward compatibility
  const weight = dimension.weight ?? 100;
  const filterMode = dimension.filterMode ?? 'preserve_structure';
  const transformMode = dimension.transformMode ?? 'replace';

  // Image upload handler
  const handleImageUpload = useCallback(() => {
    if (hasImage) {
      // Remove existing image
      onReferenceImageChange?.(dimension.id, null);
      setImageError(null);
    } else {
      // Trigger file input
      fileInputRef.current?.click();
    }
  }, [hasImage, dimension.id, onReferenceImageChange]);

  // File selection handler
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous error
    setImageError(null);

    // Validate file format
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      setImageError('Use JPEG, PNG, or WebP');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setImageError('Max size is 5MB');
      return;
    }

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onReferenceImageChange?.(dimension.id, dataUrl);
    };
    reader.onerror = () => {
      setImageError('Failed to read file');
    };
    reader.readAsDataURL(file);

    // Reset input for re-selection of same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [dimension.id, onReferenceImageChange]);

  // ============================================
  // Drop handlers for bidirectional flow (element → dimension)
  // ============================================

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if drag data contains element data
    if (e.dataTransfer.types.includes('application/json')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const element: PromptElement = JSON.parse(jsonData);
        if (onDropElement) {
          // Use the handler from props (maintains undo history)
          onDropElement(element, dimension.id);
        } else {
          // Fallback: directly update the reference
          onChange(dimension.id, element.text);
        }
      }
    } catch (err) {
      // Fallback to plain text
      const text = e.dataTransfer.getData('text/plain');
      if (text) {
        onChange(dimension.id, text);
      }
    }
  }, [dimension.id, onChange, onDropElement]);

  return (
    <motion.div
      variants={scaleInSubtle}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={getReducedMotionStaggeredTransition(index, prefersReducedMotion)}
      className="group relative"
      data-testid={`dimension-card-${dimension.id}`}
      data-dimension-type={dimension.type}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`relative radius-md overflow-hidden border min-h-[220px] flex flex-col shadow-subtle btn-outline ${isDragOver
          ? `${semanticColors.processing.border} bg-purple-500/10 ring-2 ring-purple-500/30`
          : hasContent
            ? `${semanticColors.primary.border} bg-cyan-500/5`
            : `${stateClasses.inactiveContainer} hover:border-slate-600/50`
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-sm py-sm bg-slate-800/30 border-b border-slate-700/30">
          <div className="flex items-center gap-sm">
            {/* Drag handle */}
            <GripVertical size={14} className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0" />
            <span className="text-sm">{dimension.icon}</span>
            <span className="font-mono type-body-sm uppercase tracking-wide text-slate-400">
              {dimension.label.toLowerCase().replace(/\s+/g, '_')}
            </span>
            {hasContent && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-1.5 h-1.5 rounded-full bg-cyan-400"
              />
            )}
            {/* Weight indicator - show when not 100% */}
            {weight < 100 && (
              <span className="font-mono type-label text-cyan-400/70 bg-cyan-500/10 px-1 py-0.5 radius-sm">
                {weight}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Lens controls toggle button */}
            <IconButton
              size="sm"
              variant={showLensControls ? 'solid' : 'subtle'}
              colorScheme="accent"
              onClick={() => setShowLensControls(!showLensControls)}
              data-testid={`dimension-lens-toggle-${dimension.id}`}
              label="Lens controls (filter, transform, weight)"
              className={!showLensControls ? 'opacity-0 group-hover:opacity-100' : ''}
            >
              <SlidersHorizontal size={12} />
            </IconButton>

            {/* Image upload button - purple for AI/processing */}
            <IconButton
              size="sm"
              variant={hasImage ? 'solid' : 'subtle'}
              colorScheme="processing"
              onClick={handleImageUpload}
              data-testid={`dimension-image-upload-${dimension.id}`}
              label={hasImage ? 'Reference image attached (click to remove)' : 'Add reference image'}
              className={!hasImage ? 'opacity-0 group-hover:opacity-100' : ''}
            >
              {hasImage ? <ImageIcon size={12} /> : <ImagePlus size={12} />}
            </IconButton>

            {onRemove && (
              <IconButton
                size="sm"
                variant="subtle"
                colorScheme="danger"
                onClick={() => onRemove(dimension.id)}
                data-testid={`dimension-remove-${dimension.id}`}
                label="Remove dimension"
                className="opacity-0 group-hover:opacity-100"
              >
                <X size={12} />
              </IconButton>
            )}
          </div>
        </div>

        {/* Lens Controls Panel - Filter, Transform, Weight */}
        <AnimatePresence>
          {showLensControls && (
            <motion.div
              variants={expandCollapse}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={motionTransitions.normal}
              className="border-b border-slate-700/30 overflow-hidden"
              data-testid={`dimension-lens-controls-${dimension.id}`}
            >
              <div className="p-sm space-y-sm bg-slate-800/20">
                {/* Weight Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono type-label uppercase tracking-wide text-slate-500">
                      intensity
                    </span>
                    <span className="font-mono type-label text-cyan-400">
                      {weight}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weight}
                    onChange={(e) => onWeightChange?.(dimension.id, parseInt(e.target.value))}
                    data-testid={`dimension-weight-slider-${dimension.id}`}
                    className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                              focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
                              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                              [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400
                              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                              [&::-webkit-slider-thumb]:hover:bg-cyan-300"
                  />
                  <div className="flex justify-between type-label text-slate-600 font-mono">
                    <span>preserve</span>
                    <span>full swap</span>
                  </div>
                </div>

                {/* Filter Mode Selector */}
                <div className="space-y-1">
                  <span className="font-mono type-label uppercase tracking-wide text-slate-500">
                    preserve
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(FILTER_MODE_LABELS) as DimensionFilterMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onFilterModeChange?.(dimension.id, mode)}
                        data-testid={`dimension-filter-${mode}-${dimension.id}`}
                        className={`px-1.5 py-0.5 radius-sm font-mono type-label border focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${
                          filterMode === mode
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600/30 btn-outline'
                        }`}
                        title={FILTER_MODE_LABELS[mode].description}
                      >
                        {FILTER_MODE_LABELS[mode].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transform Mode Selector */}
                <div className="space-y-1">
                  <span className="font-mono type-label uppercase tracking-wide text-slate-500">
                    transform
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(TRANSFORM_MODE_LABELS) as DimensionTransformMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onTransformModeChange?.(dimension.id, mode)}
                        data-testid={`dimension-transform-${mode}-${dimension.id}`}
                        className={`px-1.5 py-0.5 radius-sm font-mono type-label border focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${
                          transformMode === mode
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600/30 btn-outline-purple'
                        }`}
                        title={TRANSFORM_MODE_LABELS[mode].description}
                      >
                        {TRANSFORM_MODE_LABELS[mode].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input */}
        <div className="p-sm flex-1 flex flex-col">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            data-testid={`dimension-image-input-${dimension.id}`}
          />

          {/* Image preview area - purple for AI/processing */}
          {hasImage && dimension.referenceImage && (
            <div className={`mb-sm p-sm ${semanticColors.processing.bg} ${semanticColors.processing.border} border radius-sm flex items-center gap-sm`}>
              <div className="relative w-10 h-10 radius-sm overflow-hidden flex-shrink-0">
                <Image
                  src={dimension.referenceImage}
                  alt="Reference image"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono type-label text-purple-400 truncate">reference_image</p>
                <p className="font-mono type-label text-slate-500">// visual reference attached</p>
              </div>
              <button
                onClick={() => onReferenceImageChange?.(dimension.id, null)}
                className="p-1 radius-sm hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                title="Remove reference image"
                data-testid={`dimension-image-remove-${dimension.id}`}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Image error message */}
          {imageError && (
            <div className="mb-sm px-sm py-1 bg-red-500/10 border border-red-500/30 radius-sm">
              <p className="font-mono type-label text-red-400">// {imageError}</p>
            </div>
          )}

          <textarea
            value={dimension.reference}
            onChange={(e) => onChange(dimension.id, e.target.value)}
            placeholder={dimension.placeholder || `Describe ${dimension.label.toLowerCase()}...`}
            rows={8}
            className="w-full bg-transparent text-xs text-slate-300 placeholder-slate-600
                      resize-none outline-none font-mono leading-relaxed flex-1 h-full min-h-[140px]"
          />
        </div>

        {/* Active indicator */}
        {hasContent && !isDragOver && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-cyan-500/50" />
        )}

        {/* Drop indicator overlay - purple for processing/AI flow */}
        {isDragOver && (
          <div
            className="absolute inset-0 bg-purple-500/10 flex flex-col items-center justify-center gap-2 pointer-events-none z-10"
            data-testid={`dimension-drop-zone-${dimension.id}`}
          >
            <ArrowDownToLine size={24} className="text-purple-400 animate-bounce" />
            <span className="font-mono type-label text-purple-400 uppercase tracking-wider">
              Drop to apply
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default DimensionCard;
