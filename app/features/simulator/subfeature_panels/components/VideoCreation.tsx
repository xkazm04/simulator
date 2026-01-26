/**
 * VideoCreation - Video generation controls for saved images
 * Uses Leonardo Seedance 1.0 API for image-to-video generation
 */

'use client';

import React from 'react';
import { Video, Loader2, X, Clock, Play } from 'lucide-react';
import type { VideoDuration } from '../lib';

interface VideoCreationProps {
  sourceImageUrl: string;
  existingVideoUrl?: string;
  videoPrompt: string;
  duration: VideoDuration;
  isGenerating: boolean;
  generationProgress?: string;
  generateError: string | null;
  onPromptChange: (prompt: string) => void;
  onDurationChange: (duration: VideoDuration) => void;
  onGenerate: () => void;
}

const DURATION_OPTIONS: { value: VideoDuration; label: string }[] = [
  { value: 4, label: '4s' },
  { value: 6, label: '6s' },
  { value: 8, label: '8s' },
];

export function VideoCreation({
  sourceImageUrl,
  existingVideoUrl,
  videoPrompt,
  duration,
  isGenerating,
  generationProgress,
  generateError,
  onPromptChange,
  onDurationChange,
  onGenerate,
}: VideoCreationProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <div className="space-y-md">
      {/* Error Message */}
      {generateError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 radius-md">
          <X className="w-4 h-4 text-red-400" />
          <span className="font-mono text-xs text-red-400">{generateError}</span>
        </div>
      )}

      {/* Existing Video Preview */}
      {existingVideoUrl && !isGenerating && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Play size={12} className="text-cyan-400" />
            <label className="font-mono type-label text-slate-400 uppercase">
              Generated Video
            </label>
          </div>
          <div className="relative radius-md overflow-hidden border border-slate-700 bg-slate-900">
            <video
              src={existingVideoUrl}
              controls
              loop
              className="w-full max-h-[300px] object-contain"
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          </div>
          <p className="font-mono text-xs text-slate-400">
            Generate again with a new prompt to replace this video
          </p>
        </div>
      )}

      {/* Generation Progress */}
      {isGenerating && generationProgress && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-500/10 border border-purple-500/30 radius-md">
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
          <span className="font-mono text-xs text-purple-400">{generationProgress}</span>
        </div>
      )}

      {/* Video Generation Input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Video size={12} className="text-cyan-400" />
          <label className="font-mono type-label text-slate-400 uppercase">
            Video Generation (Seedance)
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <textarea
            rows={3}
            value={videoPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe the motion or animation you want..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 radius-md
                     font-mono text-xs text-slate-200 placeholder:text-slate-500
                     focus:outline-none focus:border-cyan-500/50 resize-none"
            disabled={isGenerating}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-mono text-xs text-slate-400">
              Examples: &quot;gentle wind blowing&quot;, &quot;camera slowly zooms in&quot;, &quot;dramatic lighting changes&quot;
            </p>
            <div className="flex items-center gap-3">
              {/* Duration Selector */}
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                <span className="font-mono text-xs text-slate-300">Duration:</span>
                <div className="flex border border-slate-600 radius-md overflow-hidden">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => onDurationChange(option.value)}
                      disabled={isGenerating}
                      className={`px-3 py-1.5 font-mono text-sm font-medium transition-colors disabled:opacity-50 ${
                        duration === option.value
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={onGenerate}
                disabled={!videoPrompt.trim() || isGenerating}
                className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500
                         disabled:cursor-not-allowed radius-md font-mono text-sm font-medium text-white
                         flex items-center gap-2 transition-colors shadow-sm"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video size={14} />}
                Generate Video
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Source Image Preview */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Source Image</h4>
        <div className="p-2 radius-md border border-slate-700 bg-slate-900/50">
          <img
            src={sourceImageUrl}
            alt="Source image for video"
            className="w-full max-h-[150px] object-contain radius-sm"
          />
        </div>
        <p className="font-mono text-xs text-slate-400">
          This image will be used as the starting frame for the video
        </p>
      </div>
    </div>
  );
}
