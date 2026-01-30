/**
 * MaskCanvas - Canvas overlay for drawing inpainting masks
 *
 * Renders source image with a drawable mask layer on top.
 * Brush draws white strokes, eraser removes strokes.
 * Mask is exported as PNG with white strokes on black background.
 */

'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface MaskCanvasProps {
  sourceImageUrl: string;
  brushSize: number;
  mode: 'brush' | 'eraser';
  onMaskChange: (maskDataUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function MaskCanvas({
  sourceImageUrl,
  brushSize,
  mode,
  onMaskChange,
  disabled = false,
  className = '',
}: MaskCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Load source image and set canvas size
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Calculate canvas size to fit container while maintaining aspect ratio
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const aspectRatio = img.width / img.height;
      const canvasWidth = containerWidth;
      const canvasHeight = containerWidth / aspectRatio;

      setCanvasSize({ width: canvasWidth, height: canvasHeight });
      setImageLoaded(true);
    };
    img.src = sourceImageUrl;
  }, [sourceImageUrl]);

  // Initialize canvas when size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Clear canvas (transparent)
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [canvasSize]);

  // Get canvas-relative coordinates from event
  const getCanvasCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  // Draw a stroke from lastPoint to currentPoint
  const drawStroke = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = mode === 'brush' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (mode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }, [mode, brushSize]);

  // Export mask as data URL (white strokes on black background)
  const exportMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Create a new canvas for export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return null;

    // Fill with black background
    exportCtx.fillStyle = 'black';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw the mask on top
    exportCtx.drawImage(canvas, 0, 0);

    return exportCanvas.toDataURL('image/png');
  }, []);

  // Check if mask has any strokes
  const hasMaskContent = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Check if any pixel has alpha > 0 (has been drawn on)
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) return true;
    }
    return false;
  }, []);

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();

    const coords = getCanvasCoords(e);
    if (!coords) return;

    setIsDrawing(true);
    lastPointRef.current = coords;

    // Draw a dot at the starting point
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = mode === 'brush' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';

      if (mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [disabled, getCanvasCoords, brushSize, mode]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();

    const coords = getCanvasCoords(e);
    if (!coords || !lastPointRef.current) return;

    drawStroke(lastPointRef.current, coords);
    lastPointRef.current = coords;
  }, [isDrawing, disabled, getCanvasCoords, drawStroke]);

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);
    lastPointRef.current = null;

    // Export mask and notify parent
    if (hasMaskContent()) {
      const maskDataUrl = exportMask();
      onMaskChange(maskDataUrl);
    } else {
      onMaskChange(null);
    }
  }, [isDrawing, hasMaskContent, exportMask, onMaskChange]);

  // Handle pointer leave
  const handlePointerLeave = useCallback(() => {
    if (isDrawing) {
      handlePointerUp();
    }
  }, [isDrawing, handlePointerUp]);

  // Clear the mask
  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onMaskChange(null);
    }
  }, [onMaskChange]);

  // Expose clearMask via ref
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      (canvas as HTMLCanvasElement & { clearMask?: () => void }).clearMask = clearMask;
    }
  }, [clearMask]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden radius-md ${className}`}
      style={{ minHeight: canvasSize.height || 200 }}
    >
      {/* Source image background */}
      {imageLoaded && (
        <img
          src={sourceImageUrl}
          alt="Source"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ height: canvasSize.height }}
        />
      )}

      {/* Mask canvas overlay - semi-transparent red to show painted areas */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          mixBlendMode: 'normal',
          opacity: 0.5,
          filter: 'drop-shadow(0 0 2px rgba(255, 0, 0, 0.5))',
          // Show strokes as red overlay
          background: 'transparent',
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />

      {/* Colored overlay to make white strokes appear as red */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          height: canvasSize.height,
          background: 'transparent',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Loading state */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Brush size cursor preview */}
      {!disabled && imageLoaded && (
        <div
          className="fixed pointer-events-none border-2 border-white rounded-full opacity-50 mix-blend-difference"
          style={{
            width: brushSize,
            height: brushSize,
            transform: 'translate(-50%, -50%)',
            display: 'none', // Will be shown via CSS :hover on canvas
          }}
        />
      )}
    </div>
  );
}

export default MaskCanvas;
