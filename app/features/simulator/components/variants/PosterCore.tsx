/**
 * PosterCore - Poster management mode core layout
 *
 * Project poster workflow:
 * - Poster display/upload area
 * - Generation controls
 * - Full poster management
 */

'use client';

import React, { memo } from 'react';
import { Upload, Wand2, Loader2, Image as ImageIcon } from 'lucide-react';
import { ProjectPoster } from '../../types';
import { PosterGeneration } from '../../hooks/usePoster';

export interface PosterCoreProps {
  projectPoster?: ProjectPoster | null;
  posterGenerations?: PosterGeneration[];
  selectedPosterIndex?: number | null;
  isGeneratingPoster: boolean;
  isSavingPoster?: boolean;
  onSelectPoster?: (index: number) => void;
  onSavePoster?: () => void;
  onCancelPosterGeneration?: () => void;
  onUploadPoster?: (imageDataUrl: string) => void;
  onGeneratePoster?: () => Promise<void>;
}

function PosterCoreComponent({
  projectPoster,
  posterGenerations = [],
  selectedPosterIndex,
  isGeneratingPoster,
  isSavingPoster,
  onSelectPoster,
  onSavePoster,
  onCancelPosterGeneration,
  onUploadPoster,
  onGeneratePoster,
}: PosterCoreProps) {
  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadPoster) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUploadPoster(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const hasGenerations = posterGenerations.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden z-10 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-lg py-md border-b border-slate-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-slate-200">Project Poster</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Create or upload key art for your project
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Generate Button */}
            <button
              onClick={onGeneratePoster}
              disabled={isGeneratingPoster}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white radius-md transition-colors text-sm font-medium"
            >
              {isGeneratingPoster ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Wand2 size={16} />
              )}
              {isGeneratingPoster ? 'Generating...' : 'Generate Poster'}
            </button>

            {/* Upload Button */}
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 radius-md transition-colors text-sm font-medium cursor-pointer">
              <Upload size={16} />
              Upload
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-lg">
        {/* Generation Grid (when generating or has generations) */}
        {(isGeneratingPoster || hasGenerations) && (
          <div className="mb-lg">
            <h3 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
              {isGeneratingPoster ? 'Generating Options...' : 'Select a Poster'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {isGeneratingPoster && posterGenerations.length === 0 ? (
                // Loading placeholders
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] bg-slate-800/50 radius-lg border border-slate-700/50 flex items-center justify-center"
                  >
                    <Loader2 size={24} className="text-slate-500 animate-spin" />
                  </div>
                ))
              ) : (
                posterGenerations.map((gen, index) => (
                  <button
                    key={gen.id}
                    onClick={() => onSelectPoster?.(index)}
                    className={`relative aspect-[3/4] overflow-hidden radius-lg border-2 transition-all ${
                      selectedPosterIndex === index
                        ? 'border-cyan-500 ring-2 ring-cyan-500/30'
                        : 'border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    {gen.status === 'complete' && gen.imageUrl ? (
                      <img
                        src={gen.imageUrl}
                        alt={`Poster option ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : gen.status === 'generating' ? (
                      <div className="w-full h-full bg-slate-800/50 flex items-center justify-center">
                        <Loader2 size={24} className="text-slate-500 animate-spin" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-slate-800/50 flex items-center justify-center">
                        <span className="text-slate-500 text-sm">{gen.error || 'Failed'}</span>
                      </div>
                    )}
                    {selectedPosterIndex === index && (
                      <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none" />
                    )}
                  </button>
                ))
              )}
            </div>
            {hasGenerations && selectedPosterIndex !== null && (
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={onSavePoster}
                  disabled={isSavingPoster}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white radius-md transition-colors text-sm font-medium"
                >
                  {isSavingPoster ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Save Selected'
                  )}
                </button>
                <button
                  onClick={onCancelPosterGeneration}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 radius-md transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Current Poster Display */}
        <div>
          <h3 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
            Current Poster
          </h3>
          <div className="aspect-[3/4] max-w-md bg-slate-900/50 radius-lg border border-slate-800/50 overflow-hidden">
            {projectPoster?.imageUrl ? (
              <img
                src={projectPoster.imageUrl}
                alt="Project poster"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                <ImageIcon size={48} strokeWidth={1} />
                <span className="text-sm">No poster yet</span>
                <span className="text-xs text-slate-600">
                  Generate or upload a poster above
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const PosterCore = memo(PosterCoreComponent);
export default PosterCore;
