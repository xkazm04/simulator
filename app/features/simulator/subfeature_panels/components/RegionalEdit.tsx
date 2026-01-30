/**
 * RegionalEdit - Regional inpainting controls for saved images
 * Uses Leonardo Canvas Inpainting API for mask-based image editing
 */

'use client';

import React, { useRef, useCallback } from 'react';
import { Brush, Eraser, Trash2, Loader2, X, Sliders, Sparkles } from 'lucide-react';
import { MaskCanvas } from './MaskCanvas';

interface RegionalEditProps {
  sourceImageUrl: string;
  editPrompt: string;
  brushSize: number;
  brushMode: 'brush' | 'eraser';
  inpaintStrength: number;
  isGenerating: boolean;
  generationProgress?: string;
  generateError: string | null;
  editedImageUrl: string | null;
  hasMask: boolean;
  onPromptChange: (prompt: string) => void;
  onBrushSizeChange: (size: number) => void;
  onBrushModeChange: (mode: 'brush' | 'eraser') => void;
  onInpaintStrengthChange: (strength: number) => void;
  onMaskChange: (maskDataUrl: string | null) => void;
  onGenerate: () => void;
  onClearMask: () => void;
}

export function RegionalEdit({
  sourceImageUrl,
  editPrompt,
  brushSize,
  brushMode,
  inpaintStrength,
  isGenerating,
  generationProgress,
  generateError,
  editedImageUrl,
  hasMask,
  onPromptChange,
  onBrushSizeChange,
  onBrushModeChange,
  onInpaintStrengthChange,
  onMaskChange,
  onGenerate,
  onClearMask,
}: RegionalEditProps) {
  const canvasRef = useRef<HTMLCanvasElement & { clearMask?: () => void }>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onGenerate();
    }
  };

  const handleClearMask = useCallback(() => {
    // Call the exposed clearMask method on the canvas
    const canvas = document.querySelector('canvas');
    const clearMaskFn = (canvas as HTMLCanvasElement & { clearMask?: () => void })?.clearMask;
    if (clearMaskFn) {
      clearMaskFn();
    }
    onClearMask();
  }, [onClearMask]);

  const canGenerate = hasMask && editPrompt.trim() && !isGenerating;

  return (
    <div className="space-y-md">
      {/* Error Message */}
      {generateError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 radius-md">
          <X className="w-4 h-4 text-red-400" />
          <span className="font-mono text-xs text-red-400">{generateError}</span>
        </div>
      )}

      {/* Generated Result Preview */}
      {editedImageUrl && !isGenerating && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-green-400" />
            <label className="font-mono type-label text-slate-400 uppercase">
              Inpainted Result
            </label>
          </div>
          <div className="relative radius-md overflow-hidden border border-green-500/30 bg-slate-900">
            <img
              src={editedImageUrl}
              alt="Inpainted result"
              className="w-full max-h-[300px] object-contain"
            />
          </div>
          <p className="font-mono text-xs text-slate-400">
            Click &quot;Replace with New Image&quot; below to save, or paint and generate again
          </p>
        </div>
      )}

      {/* Generation Progress */}
      {isGenerating && generationProgress && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 radius-md">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          <span className="font-mono text-xs text-amber-400">{generationProgress}</span>
        </div>
      )}

      {/* Mask Canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brush size={12} className="text-amber-400" />
            <label className="font-mono type-label text-slate-400 uppercase">
              Paint Region to Edit
            </label>
          </div>
          {hasMask && (
            <span className="font-mono text-xs text-amber-400">Mask ready</span>
          )}
        </div>
        <div className="relative radius-md overflow-hidden border border-slate-700 bg-slate-900">
          <MaskCanvas
            sourceImageUrl={sourceImageUrl}
            brushSize={brushSize}
            mode={brushMode}
            onMaskChange={onMaskChange}
            disabled={isGenerating}
          />
        </div>
        <p className="font-mono text-xs text-slate-400">
          Paint over the areas you want to change. White areas will be regenerated.
        </p>
      </div>

      {/* Drawing Tools */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onBrushModeChange('brush')}
            disabled={isGenerating}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-medium transition-colors radius-md disabled:opacity-50 ${
              brushMode === 'brush'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
            }`}
          >
            <Brush size={14} />
            Brush
          </button>
          <button
            onClick={() => onBrushModeChange('eraser')}
            disabled={isGenerating}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-medium transition-colors radius-md disabled:opacity-50 ${
              brushMode === 'eraser'
                ? 'bg-slate-500/20 text-slate-300 border border-slate-500/50'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
            }`}
          >
            <Eraser size={14} />
            Eraser
          </button>
          <button
            onClick={handleClearMask}
            disabled={isGenerating || !hasMask}
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-medium transition-colors radius-md
                     bg-slate-800 text-slate-400 border border-slate-700 hover:text-red-400 hover:border-red-500/50
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>

        {/* Brush Size */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-400">Size:</span>
          <input
            type="range"
            min={5}
            max={50}
            value={brushSize}
            onChange={(e) => onBrushSizeChange(Number(e.target.value))}
            disabled={isGenerating}
            className="w-24 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500
                     [&::-webkit-slider-thumb]:cursor-pointer disabled:opacity-50"
          />
          <span className="font-mono text-xs text-amber-400 w-8">{brushSize}px</span>
        </div>
      </div>

      {/* Inpaint Strength Slider */}
      <div className="flex items-center gap-3 py-2 px-3 bg-slate-800/50 border border-slate-700 radius-md">
        <Sliders size={14} className="text-slate-400" />
        <span className="font-mono text-xs text-slate-400">Strength:</span>
        <input
          type="range"
          min={0}
          max={100}
          value={inpaintStrength}
          onChange={(e) => onInpaintStrengthChange(Number(e.target.value))}
          disabled={isGenerating}
          className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500
                   [&::-webkit-slider-thumb]:cursor-pointer disabled:opacity-50"
        />
        <span className="font-mono text-xs text-amber-400 w-10">{inpaintStrength}%</span>
      </div>

      {/* Prompt Input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles size={12} className="text-amber-400" />
          <label className="font-mono type-label text-slate-400 uppercase">
            What to Generate
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <textarea
            rows={3}
            value={editPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe what should appear in the painted area..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 radius-md
                     font-mono text-xs text-slate-200 placeholder:text-slate-500
                     focus:outline-none focus:border-amber-500/50 resize-none"
            disabled={isGenerating}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-mono text-xs text-slate-400">
              Tip: Ctrl+Enter to generate | Examples: &quot;a cat sitting&quot;, &quot;blue sky with clouds&quot;
            </p>
            <button
              onClick={onGenerate}
              disabled={!canGenerate}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500
                       disabled:cursor-not-allowed radius-md font-mono text-sm font-medium text-white
                       flex items-center gap-2 transition-colors shadow-sm"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles size={14} />}
              Inpaint
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegionalEdit;
