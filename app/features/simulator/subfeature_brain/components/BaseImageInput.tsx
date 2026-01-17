/**
 * BaseImageInput - Foundation reference input with image upload
 * Design: Clean Manuscript style
 *
 * Supports drag-and-drop image upload.
 * When an image is uploaded, triggers AI parsing to extract description.
 * Shows error state with red border if parsing fails.
 */

'use client';

import React, { useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { Upload, X, ImageIcon, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { stateClasses, semanticColors } from '../../lib/semanticColors';

// File validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const SUPPORTED_FORMATS_DISPLAY = 'JPEG, PNG, or WebP';

interface BaseImageInputProps {
  value: string;
  onChange: (value: string) => void;
  imageFile: string | null;
  onImageChange: (file: string | null) => void;
  onImageParse?: (imageDataUrl: string) => void;
  isParsingImage?: boolean;
  parseError?: string | null;
  placeholder?: string;
}

export function BaseImageInput({
  value,
  onChange,
  imageFile,
  onImageChange,
  onImageParse,
  isParsingImage = false,
  parseError = null,
  placeholder = 'e.g., "RPG game like Baldur\'s Gate 3", "Anime film like Your Name"',
}: BaseImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    // Clear any previous validation error
    setValidationError(null);

    // Validate file format
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      setValidationError(`Unsupported format. Please use ${SUPPORTED_FORMATS_DISPLAY}.`);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setValidationError(`File too large (${sizeMB}MB). Maximum size is 5MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onImageChange(dataUrl);
      if (onImageParse && dataUrl) {
        onImageParse(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  }, [onImageChange, onImageParse]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if leaving the main container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleRemoveImage = () => {
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReparse = () => {
    if (imageFile && onImageParse) {
      onImageParse(imageFile);
    }
  };

  // Clear validation error when image is removed or changed successfully
  const handleRemoveImageWithClear = () => {
    setValidationError(null);
    handleRemoveImage();
  };

  const hasError = !!parseError || !!validationError;
  const displayError = validationError || parseError;

  return (
    <div className="space-y-sm">
      {/* Header - amber for required/warning semantic */}
      <div className="flex items-center gap-sm">
        <span className="font-mono type-label uppercase tracking-wider text-slate-400">
          // base_image
        </span>
        <span className={`font-mono type-label px-1.5 py-0.5 rounded-sm uppercase tracking-wide ${stateClasses.requiredBadge} border`}
              data-testid="base-image-required-badge">
          required
        </span>
      </div>

      {/* Content Row */}
      <div className="flex gap-md">
        {/* Image Upload Area - Drag & Drop Zone */}
        <div
          className="flex-shrink-0"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {imageFile ? (
            <div className={`relative w-32 h-32 rounded-md overflow-hidden border group transition-colors shadow-subtle
                            ${hasError
                              ? 'border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                              : isDragging
                                ? 'border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                                : 'border-slate-700/50'}`}>
              <Image
                src={imageFile}
                alt="Reference image"
                fill
                className="object-cover"
              />
              {/* Drag overlay */}
              {isDragging && (
                <div className="absolute inset-0 bg-cyan-500/20 flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
                  <Upload className="text-cyan-400" size={24} />
                  <span className="font-mono type-label text-cyan-400">replace</span>
                </div>
              )}
              {/* Loading overlay */}
              {isParsingImage && !isDragging && (
                <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="animate-spin text-cyan-400" size={20} />
                  <span className="font-mono type-label text-cyan-400">analyzing...</span>
                </div>
              )}
              {/* Error overlay */}
              {hasError && !isParsingImage && !isDragging && (
                <div className="absolute inset-0 bg-red-950/60 flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
                  <AlertCircle className="text-red-400" size={20} />
                  <span className="font-mono type-label text-red-400 text-center px-2">parse failed</span>
                </div>
              )}
              {/* Remove button */}
              {!isDragging && (
                <button
                  onClick={handleRemoveImage}
                  disabled={isParsingImage}
                  className="absolute top-1 right-1 p-1 bg-slate-900/80 hover:bg-red-600/80
                            rounded-sm opacity-0 group-hover:opacity-100 transition-opacity
                            disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X size={12} className="text-white" />
                </button>
              )}
              {/* Re-analyze button */}
              {!isParsingImage && !isDragging && onImageParse && (
                <button
                  onClick={handleReparse}
                  className={`absolute top-1 left-1 p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity
                              ${hasError
                                ? 'bg-red-900/80 hover:bg-red-600/80'
                                : 'bg-slate-900/80 hover:bg-cyan-600/80'}`}
                  title={hasError ? 'Retry analysis' : 'Re-analyze image'}
                >
                  <Sparkles size={12} className={hasError ? 'text-red-400' : 'text-cyan-400'} />
                </button>
              )}
              {/* Status label */}
              {!isDragging && (
                <div className={`absolute bottom-0 left-0 right-0 py-1 px-2
                                ${hasError ? 'bg-red-950/90' : 'bg-slate-900/80'}`}>
                  <span className={`font-mono type-label ${hasError ? 'text-red-400' : 'text-slate-400'}`}>
                    {hasError ? 'error' : 'style_reference'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-32 h-32 flex flex-col items-center justify-center gap-2 rounded-md
                        border-2 border-dashed transition-all duration-200
                        ${isDragging
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 scale-105'
                          : validationError
                            ? 'border-red-500/70 bg-red-950/20 text-red-400'
                            : 'border-slate-700/50 hover:border-slate-600 text-slate-500 hover:text-slate-400 bg-slate-900/30'}`}
            >
              {validationError ? (
                <AlertCircle size={20} />
              ) : (
                <Upload size={20} className={isDragging ? 'animate-bounce' : ''} />
              )}
              <span className="font-mono type-label text-center px-1">
                {isDragging ? 'drop here' : validationError ? 'try again' : 'drag or click'}
              </span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Text Input */}
        <div className="flex-1">
          <div className="relative h-full">
            <div className="absolute top-2 left-3">
              <ImageIcon size={14} className="text-amber-500/50" />
            </div>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              disabled={isParsingImage}
              className="w-full h-full min-h-[128px] pl-9 pr-3 py-2 bg-slate-900/60 border border-slate-700/50
                        rounded-md text-sm text-slate-200 placeholder-slate-600 resize-none
                        focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20
                        font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <p className={`mt-1.5 font-mono type-label ${hasError ? 'text-red-400' : 'text-slate-500'}`}>
            {isParsingImage
              ? '// AI is analyzing the uploaded image...'
              : hasError
                ? `// ${displayError}`
                : '// describe the foundation visual or drag & drop an image'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default BaseImageInput;
