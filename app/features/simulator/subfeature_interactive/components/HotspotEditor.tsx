/**
 * HotspotEditor - Interactive hotspot editing overlay
 *
 * Provides an editing interface for creating and managing clickable hotspots
 * on generated images. Users can draw rectangular regions, assign actions,
 * and configure visual feedback.
 *
 * Features:
 * - Draw mode: Click and drag to create hotspots
 * - Select mode: Click to select, drag to move, resize with handles
 * - Delete mode: Click hotspots to remove them
 * - Action assignment modal for configuring hotspot behavior
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MousePointer2,
  PenTool,
  Trash2,
  Link,
  MessageSquare,
  Sparkles,
  X,
  Check,
  Plus,
  GripVertical,
} from 'lucide-react';
import {
  Hotspot,
  HotspotEditorMode,
  HotspotActionConfig,
  HotspotActionType,
  DrawState,
  createHotspot,
  calculateBoundsFromDraw,
  isValidBounds,
  applyActionToHotspot,
  screenToNormalized,
  isPointInHotspot,
  getResizeHandleAtPoint,
  applyResize,
  ResizeHandle,
} from '../lib/hotspotTypes';
import { fadeIn, scaleIn, transitions } from '../../lib/motion';

interface HotspotEditorProps {
  /** Current hotspots */
  hotspots: Hotspot[];
  /** Callback when hotspots change */
  onHotspotsChange: (hotspots: Hotspot[]) => void;
  /** Whether editing is enabled */
  isEditMode: boolean;
  /** Callback to exit edit mode */
  onExitEditMode: () => void;
  /** Container width for coordinate calculations */
  containerRef: React.RefObject<HTMLDivElement>;
}

const MODE_ICONS = {
  select: MousePointer2,
  draw: PenTool,
  delete: Trash2,
};

const ACTION_OPTIONS: { type: HotspotActionType; label: string; icon: React.ElementType; description: string }[] = [
  { type: 'navigate', label: 'Navigate', icon: Link, description: 'Open a URL when clicked' },
  { type: 'tooltip', label: 'Tooltip', icon: MessageSquare, description: 'Show tooltip on hover' },
  { type: 'highlight', label: 'Highlight', icon: Sparkles, description: 'Highlight region on hover' },
];

export function HotspotEditor({
  hotspots,
  onHotspotsChange,
  isEditMode,
  onExitEditMode,
  containerRef,
}: HotspotEditorProps) {
  const [mode, setMode] = useState<HotspotEditorMode>('draw');
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [resizeState, setResizeState] = useState<{
    hotspotId: string;
    handle: ResizeHandle;
    startBounds: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [dragState, setDragState] = useState<{
    hotspotId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [configuringHotspotId, setConfigHotspotId] = useState<string | null>(null);
  const [actionConfig, setActionConfig] = useState<HotspotActionConfig>({
    type: 'tooltip',
    tooltipText: '',
  });

  const nextHotspotId = useRef(1);

  // Get normalized mouse position
  const getNormalizedPosition = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return screenToNormalized(e.clientX, e.clientY, rect);
  }, [containerRef]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isEditMode) return;
    e.preventDefault();

    const pos = getNormalizedPosition(e);

    if (mode === 'draw') {
      setDrawState({
        isDrawing: true,
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
      });
      setSelectedHotspotId(null);
    } else if (mode === 'select') {
      // Check if clicking on a resize handle
      const selectedHotspot = hotspots.find(h => h.id === selectedHotspotId);
      if (selectedHotspot) {
        const handle = getResizeHandleAtPoint(pos.x, pos.y, selectedHotspot);
        if (handle) {
          setResizeState({
            hotspotId: selectedHotspot.id,
            handle,
            startBounds: {
              x: selectedHotspot.x,
              y: selectedHotspot.y,
              width: selectedHotspot.width,
              height: selectedHotspot.height,
            },
          });
          return;
        }
      }

      // Check if clicking on a hotspot
      const clickedHotspot = hotspots.find(h => isPointInHotspot(pos.x, pos.y, h));
      if (clickedHotspot) {
        setSelectedHotspotId(clickedHotspot.id);
        setDragState({
          hotspotId: clickedHotspot.id,
          offsetX: pos.x - clickedHotspot.x,
          offsetY: pos.y - clickedHotspot.y,
        });
      } else {
        setSelectedHotspotId(null);
      }
    } else if (mode === 'delete') {
      const clickedHotspot = hotspots.find(h => isPointInHotspot(pos.x, pos.y, h));
      if (clickedHotspot) {
        onHotspotsChange(hotspots.filter(h => h.id !== clickedHotspot.id));
      }
    }
  }, [isEditMode, mode, getNormalizedPosition, hotspots, selectedHotspotId, onHotspotsChange]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isEditMode) return;

    const pos = getNormalizedPosition(e);

    if (drawState?.isDrawing) {
      setDrawState(prev => prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null);
    } else if (resizeState) {
      const hotspot = hotspots.find(h => h.id === resizeState.hotspotId);
      if (hotspot) {
        const deltaX = pos.x - (resizeState.startBounds.x + resizeState.startBounds.width);
        const deltaY = pos.y - (resizeState.startBounds.y + resizeState.startBounds.height);
        const newBounds = applyResize(
          resizeState.startBounds,
          resizeState.handle,
          pos.x - resizeState.startBounds.x - (resizeState.handle.includes('e') ? resizeState.startBounds.width : 0),
          pos.y - resizeState.startBounds.y - (resizeState.handle.includes('s') ? resizeState.startBounds.height : 0)
        );

        onHotspotsChange(
          hotspots.map(h =>
            h.id === resizeState.hotspotId
              ? { ...h, ...newBounds }
              : h
          )
        );
      }
    } else if (dragState) {
      const newX = Math.max(0, Math.min(1, pos.x - dragState.offsetX));
      const hotspot = hotspots.find(h => h.id === dragState.hotspotId);
      if (hotspot) {
        const newY = Math.max(0, Math.min(1 - hotspot.height, pos.y - dragState.offsetY));
        onHotspotsChange(
          hotspots.map(h =>
            h.id === dragState.hotspotId
              ? { ...h, x: Math.min(newX, 1 - h.width), y: newY }
              : h
          )
        );
      }
    }
  }, [isEditMode, drawState, resizeState, dragState, getNormalizedPosition, hotspots, onHotspotsChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (drawState?.isDrawing) {
      const bounds = calculateBoundsFromDraw(drawState);
      if (isValidBounds(bounds)) {
        const newHotspot = createHotspot(
          `hotspot-${nextHotspotId.current++}`,
          bounds
        );
        onHotspotsChange([...hotspots, newHotspot]);
        setSelectedHotspotId(newHotspot.id);
        setConfigHotspotId(newHotspot.id);
        setIsActionModalOpen(true);
      }
      setDrawState(null);
    }
    setResizeState(null);
    setDragState(null);
  }, [drawState, hotspots, onHotspotsChange]);

  // Handle double-click to edit action
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isEditMode || mode !== 'select') return;
    const pos = getNormalizedPosition(e);
    const clickedHotspot = hotspots.find(h => isPointInHotspot(pos.x, pos.y, h));
    if (clickedHotspot) {
      setConfigHotspotId(clickedHotspot.id);
      setActionConfig({
        type: (clickedHotspot.action.type === 'callback' ? 'tooltip' : clickedHotspot.action.type) as HotspotActionType,
        url: clickedHotspot.navigateUrl,
        tooltipText: clickedHotspot.tooltipText,
        highlightColor: clickedHotspot.highlightColor,
      });
      setIsActionModalOpen(true);
    }
  }, [isEditMode, mode, getNormalizedPosition, hotspots]);

  // Apply action configuration
  const handleApplyAction = useCallback(() => {
    if (!configuringHotspotId) return;
    const hotspot = hotspots.find(h => h.id === configuringHotspotId);
    if (hotspot) {
      const updated = applyActionToHotspot(hotspot, actionConfig);
      onHotspotsChange(hotspots.map(h => h.id === configuringHotspotId ? updated : h));
    }
    setIsActionModalOpen(false);
    setConfigHotspotId(null);
    setActionConfig({ type: 'tooltip', tooltipText: '' });
  }, [configuringHotspotId, actionConfig, hotspots, onHotspotsChange]);

  // Close modal without saving
  const handleCancelAction = useCallback(() => {
    setIsActionModalOpen(false);
    setConfigHotspotId(null);
    setActionConfig({ type: 'tooltip', tooltipText: '' });
  }, []);

  // Add global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (drawState?.isDrawing || resizeState || dragState) {
        handleMouseUp();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [drawState, resizeState, dragState, handleMouseUp]);

  if (!isEditMode) return null;

  const selectedHotspot = hotspots.find(h => h.id === selectedHotspotId);

  return (
    <>
      {/* Edit mode overlay */}
      <div
        className="absolute inset-0 z-20"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: mode === 'draw' ? 'crosshair' : mode === 'delete' ? 'not-allowed' : 'default' }}
      >
        {/* Grid overlay for visual guidance */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="10%" height="10%" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-cyan-500" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Existing hotspots */}
        {hotspots.map(hotspot => {
          const isSelected = hotspot.id === selectedHotspotId;
          return (
            <div
              key={hotspot.id}
              className={`absolute border-2 transition-colors ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-500/20'
                  : 'border-purple-500/60 bg-purple-500/10 hover:border-purple-400'
              }`}
              style={{
                left: `${hotspot.x * 100}%`,
                top: `${hotspot.y * 100}%`,
                width: `${hotspot.width * 100}%`,
                height: `${hotspot.height * 100}%`,
              }}
            >
              {/* Label */}
              <div className={`absolute -top-6 left-0 px-1.5 py-0.5 text-xs font-mono rounded ${
                isSelected ? 'bg-cyan-500 text-white' : 'bg-purple-500/80 text-white'
              }`}>
                {hotspot.label}
              </div>

              {/* Resize handles (only for selected) */}
              {isSelected && mode === 'select' && (
                <>
                  {['nw', 'ne', 'sw', 'se'].map(handle => (
                    <div
                      key={handle}
                      className="absolute w-3 h-3 bg-cyan-400 border border-white rounded-sm"
                      style={{
                        left: handle.includes('w') ? '-6px' : 'auto',
                        right: handle.includes('e') ? '-6px' : 'auto',
                        top: handle.includes('n') ? '-6px' : 'auto',
                        bottom: handle.includes('s') ? '-6px' : 'auto',
                        cursor: `${handle}-resize`,
                      }}
                    />
                  ))}
                </>
              )}

              {/* Action type indicator */}
              <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/60 rounded text-[10px] font-mono text-white">
                {hotspot.action.type}
              </div>
            </div>
          );
        })}

        {/* Drawing preview */}
        {drawState?.isDrawing && (
          <div
            className="absolute border-2 border-dashed border-cyan-400 bg-cyan-500/20 pointer-events-none"
            style={{
              left: `${Math.min(drawState.startX, drawState.currentX) * 100}%`,
              top: `${Math.min(drawState.startY, drawState.currentY) * 100}%`,
              width: `${Math.abs(drawState.currentX - drawState.startX) * 100}%`,
              height: `${Math.abs(drawState.currentY - drawState.startY) * 100}%`,
            }}
          />
        )}
      </div>

      {/* Toolbar */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        className="absolute top-3 left-3 z-30 flex items-center gap-2 p-2 bg-black/90 rounded-lg border border-slate-700"
      >
        <span className="font-mono text-xs text-cyan-400 uppercase tracking-wider px-2">Edit Mode</span>
        <div className="w-px h-6 bg-slate-600" />
        {(['select', 'draw', 'delete'] as HotspotEditorMode[]).map(m => {
          const Icon = MODE_ICONS[m];
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`p-2 rounded transition-colors ${
                mode === m
                  ? 'bg-cyan-500/30 text-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={m.charAt(0).toUpperCase() + m.slice(1)}
            >
              <Icon size={16} />
            </button>
          );
        })}
        <div className="w-px h-6 bg-slate-600" />
        <span className="font-mono text-xs text-slate-500 px-2">{hotspots.length} hotspots</span>
        <button
          onClick={onExitEditMode}
          className="p-2 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Exit Edit Mode"
        >
          <X size={16} />
        </button>
      </motion.div>

      {/* Instructions hint */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.3 }}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-black/80 rounded-lg border border-slate-700"
      >
        <span className="font-mono text-xs text-slate-400">
          {mode === 'draw' && 'Click and drag to draw a hotspot'}
          {mode === 'select' && 'Click to select • Drag to move • Double-click to edit action'}
          {mode === 'delete' && 'Click a hotspot to delete it'}
        </span>
      </motion.div>

      {/* Action Configuration Modal */}
      <AnimatePresence>
        {isActionModalOpen && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={handleCancelAction}
          >
            <motion.div
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitions.fast}
              className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-mono text-lg text-cyan-400 mb-4">Configure Hotspot Action</h3>

              {/* Action type selector */}
              <div className="space-y-2 mb-4">
                <label className="font-mono text-xs text-slate-400 uppercase tracking-wider">Action Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {ACTION_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.type}
                        onClick={() => setActionConfig(prev => ({ ...prev, type: opt.type }))}
                        className={`p-3 rounded-lg border transition-colors flex flex-col items-center gap-2 ${
                          actionConfig.type === opt.type
                            ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                            : 'border-slate-600 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="font-mono text-xs">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action-specific fields */}
              <div className="space-y-4 mb-6">
                {actionConfig.type === 'navigate' && (
                  <div>
                    <label className="font-mono text-xs text-slate-400 uppercase tracking-wider block mb-2">URL</label>
                    <input
                      type="url"
                      value={actionConfig.url || ''}
                      onChange={e => setActionConfig(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}
                {actionConfig.type === 'tooltip' && (
                  <div>
                    <label className="font-mono text-xs text-slate-400 uppercase tracking-wider block mb-2">Tooltip Text</label>
                    <textarea
                      value={actionConfig.tooltipText || ''}
                      onChange={e => setActionConfig(prev => ({ ...prev, tooltipText: e.target.value }))}
                      placeholder="Enter tooltip text..."
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>
                )}
                {actionConfig.type === 'highlight' && (
                  <div>
                    <label className="font-mono text-xs text-slate-400 uppercase tracking-wider block mb-2">Highlight Color</label>
                    <div className="flex gap-2">
                      {['#22d3ee', '#a855f7', '#f59e0b', '#10b981', '#ef4444'].map(color => (
                        <button
                          key={color}
                          onClick={() => setActionConfig(prev => ({ ...prev, highlightColor: color }))}
                          className={`w-8 h-8 rounded-full border-2 transition-transform ${
                            actionConfig.highlightColor === color ? 'scale-110 border-white' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancelAction}
                  className="px-4 py-2 font-mono text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyAction}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-mono text-sm rounded transition-colors flex items-center gap-2"
                >
                  <Check size={16} />
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default HotspotEditor;
