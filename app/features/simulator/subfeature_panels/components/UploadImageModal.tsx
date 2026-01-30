/**
 * UploadImageModal - Modal for uploading images via URL to panel slots
 *
 * Features:
 * - URL input field for Leonardo image URLs
 * - Image preview with validation
 * - Loading state during URL verification
 * - Error display for invalid URLs
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Link, Loader2, AlertCircle, Check, Image as ImageIcon } from 'lucide-react';

interface UploadImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (imageUrl: string) => void;
  side: 'left' | 'right';
  slotIndex: number;
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

export function UploadImageModal({
  isOpen,
  onClose,
  onUpload,
  side,
  slotIndex,
}: UploadImageModalProps) {
  const [url, setUrl] = useState('');
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // SSR safety
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setValidationState('idle');
      setError(null);
      setPreviewUrl(null);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Validate URL by attempting to load the image
  const validateUrl = useCallback(async (imageUrl: string) => {
    if (!imageUrl.trim()) {
      setValidationState('idle');
      setPreviewUrl(null);
      setError(null);
      return;
    }

    // Basic URL validation
    try {
      new URL(imageUrl);
    } catch {
      setValidationState('invalid');
      setError('Invalid URL format');
      setPreviewUrl(null);
      return;
    }

    // Check if it's a Leonardo CDN URL or other valid image URL
    const isLeonardoUrl = imageUrl.includes('cdn.leonardo.ai');
    const isImageUrl = /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(imageUrl) || isLeonardoUrl;

    if (!isImageUrl && !isLeonardoUrl) {
      setValidationState('invalid');
      setError('URL must be a valid image URL (Leonardo CDN or image file)');
      setPreviewUrl(null);
      return;
    }

    setValidationState('validating');
    setError(null);

    // Try to load the image
    const img = new Image();
    img.onload = () => {
      setValidationState('valid');
      setPreviewUrl(imageUrl);
      setError(null);
    };
    img.onerror = () => {
      setValidationState('invalid');
      setError('Failed to load image. Please check the URL is accessible.');
      setPreviewUrl(null);
    };
    img.src = imageUrl;
  }, []);

  // Debounce URL validation
  useEffect(() => {
    const timer = setTimeout(() => {
      validateUrl(url);
    }, 500);

    return () => clearTimeout(timer);
  }, [url, validateUrl]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (validationState === 'valid' && previewUrl) {
      onUpload(previewUrl);
      onClose();
    }
  }, [validationState, previewUrl, onUpload, onClose]);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: '28rem',
          background: '#0f172a',
          border: '1px solid rgba(71, 85, 105, 0.6)',
          borderRadius: '0.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Upload image"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-500/20 border border-amber-500/30">
              <ImageIcon size={14} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">Upload Image</h2>
              <p className="text-[10px] font-mono text-slate-500 uppercase">
                {side} panel - slot {slotIndex + 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
              <Link size={12} className="text-amber-400" />
              Image URL
            </label>
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://cdn.leonardo.ai/..."
                className={`w-full px-3 py-2.5 pr-10 bg-slate-800/50 border rounded-lg text-sm
                          placeholder-slate-600 focus:outline-none focus:ring-1 transition-all
                          ${validationState === 'valid'
                            ? 'border-green-500/50 focus:border-green-500/70 focus:ring-green-500/30'
                            : validationState === 'invalid'
                              ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/30'
                              : 'border-slate-700 focus:border-amber-500/50 focus:ring-amber-500/30'
                          }`}
                autoFocus
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validationState === 'validating' && (
                  <Loader2 size={16} className="text-amber-400 animate-spin" />
                )}
                {validationState === 'valid' && (
                  <Check size={16} className="text-green-400" />
                )}
                {validationState === 'invalid' && (
                  <AlertCircle size={16} className="text-red-400" />
                )}
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={10} />
                {error}
              </p>
            )}
            <p className="text-[10px] text-slate-500 font-mono">
              Paste a Leonardo AI image URL or any accessible image URL
            </p>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Preview</label>
              <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-700/60 bg-slate-800/50">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700
                       border border-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={validationState !== 'valid'}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all
                        ${validationState === 'valid'
                          ? 'bg-amber-500 hover:bg-amber-400 text-black'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
            >
              {validationState === 'validating' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Validating...
                </span>
              ) : (
                'Upload to Panel'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default UploadImageModal;
