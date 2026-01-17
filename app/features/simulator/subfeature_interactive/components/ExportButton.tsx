/**
 * ExportButton - Component for exporting interactive demos as standalone HTML
 *
 * Features:
 * - Export current demo as self-contained HTML file
 * - Progress indicator during export
 * - File size estimation
 * - Download trigger
 */

'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Loader2,
  Check,
  FileCode2,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  exportDemo,
  downloadExport,
  formatFileSize,
  estimateExportSize,
  ExportOptions,
  ExportResult,
} from '../lib/demoExporter';
import { GameMechanicsType, MechanicsConfig } from '../lib/mechanicsTemplates';
import { fadeIn, transitions } from '../../lib/motion';
import { semanticColors } from '../../lib/semanticColors';

interface ExportButtonProps {
  /** Game mechanics type */
  mechanics: GameMechanicsType;
  /** Mechanics configuration */
  config: MechanicsConfig;
  /** Image URL or base64 data */
  imageData: string;
  /** Title for the export */
  title?: string;
  /** Description for metadata */
  description?: string;
  /** Include debug info in export */
  includeDebug?: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Callback when export completes */
  onExportComplete?: (result: ExportResult) => void;
}

type ExportState = 'idle' | 'exporting' | 'complete' | 'error';

export function ExportButton({
  mechanics,
  config,
  imageData,
  title = 'Interactive Demo',
  description = 'Interactive game demo created with Simulator',
  includeDebug = false,
  disabled = false,
  compact = false,
  onExportComplete,
}: ExportButtonProps) {
  const [state, setState] = useState<ExportState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Estimate file size
  const estimatedSize = imageData ? estimateExportSize(imageData) : 0;

  const handleExport = useCallback(async () => {
    if (state === 'exporting' || disabled || !imageData) return;

    setState('exporting');
    setError(null);

    try {
      const options: ExportOptions = {
        mechanics,
        config,
        imageData,
        title,
        description,
        includeDebug,
        compressionLevel: 6,
      };

      const result = await exportDemo(options);

      // Generate filename from title
      const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-demo.html`;
      downloadExport(result, filename);

      setState('complete');
      onExportComplete?.(result);

      // Reset to idle after a delay
      setTimeout(() => {
        setState('idle');
      }, 2000);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Export failed');

      // Reset to idle after showing error
      setTimeout(() => {
        setState('idle');
        setError(null);
      }, 3000);
    }
  }, [
    state,
    disabled,
    imageData,
    mechanics,
    config,
    title,
    description,
    includeDebug,
    onExportComplete,
  ]);

  // Compact button variant
  if (compact) {
    return (
      <button
        onClick={handleExport}
        disabled={disabled || state === 'exporting' || !imageData}
        className={`flex items-center gap-1.5 px-2 py-1 radius-sm border transition-all
                   ${state === 'complete'
                     ? `${semanticColors.success.border} ${semanticColors.success.bg}`
                     : state === 'error'
                       ? `${semanticColors.error.border} ${semanticColors.error.bg}`
                       : `${semanticColors.primary.border} ${semanticColors.primary.bg}`}
                   ${disabled || !imageData ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-125'}`}
        data-testid="export-btn-compact"
        title="Export as HTML"
      >
        {state === 'exporting' && (
          <Loader2 size={12} className="text-cyan-400 animate-spin" />
        )}
        {state === 'complete' && <Check size={12} className="text-green-400" />}
        {state === 'error' && <AlertCircle size={12} className="text-red-400" />}
        {state === 'idle' && (
          <Download
            size={12}
            className={!imageData ? 'text-slate-500' : semanticColors.primary.text}
          />
        )}
        <span
          className={`font-mono type-label uppercase ${
            state === 'complete'
              ? semanticColors.success.text
              : state === 'error'
                ? semanticColors.error.text
                : !imageData
                  ? 'text-slate-500'
                  : semanticColors.primary.text
          }`}
        >
          {state === 'exporting'
            ? 'Exporting...'
            : state === 'complete'
              ? 'Downloaded!'
              : state === 'error'
                ? 'Failed'
                : 'Export'}
        </span>
      </button>
    );
  }

  // Full button with info
  return (
    <div className="relative" data-testid="export-btn-container">
      {/* Main button */}
      <button
        onClick={handleExport}
        disabled={disabled || state === 'exporting' || !imageData}
        className={`flex items-center gap-2 px-4 py-2 radius-md border transition-all w-full
                   ${state === 'complete'
                     ? `${semanticColors.success.border} ${semanticColors.success.bg}`
                     : state === 'error'
                       ? `${semanticColors.error.border} ${semanticColors.error.bg}`
                       : `${semanticColors.primary.border} ${semanticColors.primary.bg}`}
                   ${disabled || !imageData ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-125'}`}
        data-testid="export-btn"
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {state === 'exporting' && (
            <Loader2 size={16} className="text-cyan-400 animate-spin" />
          )}
          {state === 'complete' && <Check size={16} className="text-green-400" />}
          {state === 'error' && <AlertCircle size={16} className="text-red-400" />}
          {state === 'idle' && (
            <Download
              size={16}
              className={!imageData ? 'text-slate-500' : semanticColors.primary.text}
            />
          )}
        </div>

        {/* Label */}
        <div className="flex-1 text-left">
          <span
            className={`font-mono type-body-sm block ${
              state === 'complete'
                ? semanticColors.success.text
                : state === 'error'
                  ? semanticColors.error.text
                  : !imageData
                    ? 'text-slate-500'
                    : semanticColors.primary.text
            }`}
          >
            {state === 'exporting'
              ? 'Generating HTML...'
              : state === 'complete'
                ? 'Download Started!'
                : state === 'error'
                  ? error || 'Export Failed'
                  : 'Export as HTML'}
          </span>
          {state === 'idle' && imageData && (
            <span className="font-mono type-label text-slate-500 block">
              ~{formatFileSize(estimatedSize)} standalone file
            </span>
          )}
        </div>

        {/* Info toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowInfo(!showInfo);
          }}
          className="p-1 radius-sm hover:bg-slate-700/50 transition-colors"
          data-testid="export-info-btn"
        >
          <Info size={14} className="text-slate-500" />
        </button>
      </button>

      {/* Info dropdown */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.fast}
            className="absolute top-full left-0 right-0 mt-2 p-3 radius-md border border-slate-700 bg-slate-900/95 shadow-elevated z-10"
            data-testid="export-info-panel"
          >
            <div className="flex items-start gap-3 mb-3">
              <FileCode2 size={20} className="text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-mono type-body-sm text-slate-200 mb-1">
                  Standalone HTML Export
                </h4>
                <p className="font-mono type-label text-slate-500 leading-relaxed">
                  Creates a single HTML file containing the complete interactive demo.
                  No server or internet connection required to run.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <InfoRow label="Format" value="Self-contained HTML5" />
              <InfoRow label="Game Type" value={mechanics.charAt(0).toUpperCase() + mechanics.slice(1)} />
              <InfoRow label="Size" value={`~${formatFileSize(estimatedSize)}`} />
              <InfoRow label="Compatibility" value="All modern browsers" />
              <InfoRow
                label="Includes"
                value="Physics, controls, image assets"
              />
            </div>

            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <p className="font-mono type-label text-slate-600">
                Tip: Share the exported file via email, messaging, or file hosting.
                Recipients can open it directly in their browser.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Info row component for the info panel
 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono type-label text-slate-500">{label}</span>
      <span className="font-mono type-label text-slate-300">{value}</span>
    </div>
  );
}

export default ExportButton;
