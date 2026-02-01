/**
 * WhatIfPanel - Before/After comparison upload panel
 *
 * Displays two halves for uploading "Before" and "After" images
 * to showcase transformation comparisons for a project.
 */

'use client';

import React, { useCallback, useRef } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { useWhatif, WhatifPair } from '../hooks/useWhatif';

interface WhatIfPanelProps {
  projectId: string | null;
}

interface ImageUploadSlotProps {
  label: string;
  sublabel: string;
  imageUrl: string | null;
  caption: string | null;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  onCaptionChange: (caption: string) => void;
}

function ImageUploadSlot({
  label,
  sublabel,
  imageUrl,
  caption,
  isUploading,
  onUpload,
  onClear,
  onCaptionChange,
}: ImageUploadSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset input for re-upload
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUpload(file);
    }
  }, [onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="flex-1 flex flex-col gap-3">
      {/* Label */}
      <div className="text-center">
        <span className="text-sm font-mono uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-xs text-slate-500 block mt-0.5">{sublabel}</span>
      </div>

      {/* Upload Area */}
      <div
        className="relative flex-1 min-h-[200px] border-2 border-dashed border-slate-700 radius-lg overflow-hidden transition-colors hover:border-slate-600 group"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {isUploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : imageUrl ? (
          <>
            {/* Image Display */}
            <img
              src={imageUrl}
              alt={label}
              className="w-full h-full object-contain bg-slate-950"
            />
            {/* Clear Button */}
            <button
              onClick={onClear}
              className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-900/80 radius-sm transition-colors opacity-0 group-hover:opacity-100"
              title="Remove image"
            >
              <X size={14} className="text-slate-400 hover:text-red-400" />
            </button>
            {/* Re-upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 p-1.5 bg-slate-900/80 hover:bg-slate-800 radius-sm transition-colors opacity-0 group-hover:opacity-100"
              title="Replace image"
            >
              <Upload size={14} className="text-slate-400" />
            </button>
          </>
        ) : (
          /* Empty State */
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-slate-400 transition-colors cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
              <ImageIcon size={24} />
            </div>
            <div className="flex items-center gap-2">
              <Upload size={14} />
              <span className="text-sm">Click or drop to upload</span>
            </div>
          </button>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Caption Input */}
      <input
        type="text"
        value={caption || ''}
        onChange={(e) => onCaptionChange(e.target.value)}
        placeholder="Add caption..."
        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 radius-sm text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
      />
    </div>
  );
}

export function WhatIfPanel({ projectId }: WhatIfPanelProps) {
  const {
    whatif,
    isLoading,
    isUploading,
    error,
    uploadBeforeImage,
    uploadAfterImage,
    updateCaption,
    clearImage,
  } = useWhatif({ projectId });

  if (!projectId) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <p>Select a project to manage WhatIf comparisons</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-lg gap-4">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-md font-medium text-slate-200">What If Comparison</h3>
        <p className="text-xs text-slate-500 mt-1">
          Upload before and after images to showcase your transformation
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-3 py-2 bg-red-900/20 border border-red-500/30 radius-sm text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="flex-1 flex gap-4">
        {/* Before (Left) */}
        <ImageUploadSlot
          label="BEFORE"
          sublabel="Original state"
          imageUrl={whatif?.beforeImageUrl || null}
          caption={whatif?.beforeCaption || null}
          isUploading={isUploading}
          onUpload={uploadBeforeImage}
          onClear={() => clearImage('before')}
          onCaptionChange={(caption) => updateCaption('before', caption)}
        />

        {/* Divider */}
        <div className="w-px bg-slate-800 shrink-0" />

        {/* After (Right) */}
        <ImageUploadSlot
          label="AFTER"
          sublabel="Transformed state"
          imageUrl={whatif?.afterImageUrl || null}
          caption={whatif?.afterCaption || null}
          isUploading={isUploading}
          onUpload={uploadAfterImage}
          onClear={() => clearImage('after')}
          onCaptionChange={(caption) => updateCaption('after', caption)}
        />
      </div>
    </div>
  );
}

export default WhatIfPanel;
