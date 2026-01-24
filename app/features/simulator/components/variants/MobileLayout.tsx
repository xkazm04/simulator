/**
 * MobileLayout - Mobile-optimized layout for the simulator
 *
 * Features:
 * - Vertical stacking for narrow screens
 * - Swipeable prompt carousel
 * - Bottom sheet for dimensions
 * - Fixed bottom action bar
 * - Progressive disclosure
 * - Touch-optimized controls
 */

'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sliders,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Settings,
  ChevronUp,
} from 'lucide-react';
import { GeneratedPrompt, GeneratedImage, DimensionPreset } from '../../types';
import { MobilePromptCarousel } from '../mobile/MobilePromptCarousel';
import { MobileDimensionSheet } from '../mobile/MobileDimensionSheet';
import { Toast, useToast } from '@/app/components/ui';
import { useDimensionsContext } from '../../subfeature_dimensions/DimensionsContext';
import { usePromptsContext } from '../../subfeature_prompts/PromptsContext';
import { useSimulatorContext } from '../../SimulatorContext';
import { useBrainContext } from '../../subfeature_brain/BrainContext';
import { useHapticFeedback, useProgressiveFeatures } from '../../hooks/useResponsive';
import { semanticColors } from '../../lib/semanticColors';
import { fadeIn, transitions } from '../../lib/motion';
import { DEFAULT_DIMENSIONS } from '../../lib/defaultDimensions';

export interface MobileLayoutProps {
  // Image generation props
  generatedImages?: GeneratedImage[];
  isGeneratingImages?: boolean;
  onStartImage?: (promptId: string) => void;
  savedPromptIds?: Set<string>;
  // Modal handlers
  onViewPrompt: (prompt: GeneratedPrompt) => void;
}

function MobileLayoutComponent({
  generatedImages = [],
  isGeneratingImages = false,
  onStartImage,
  savedPromptIds = new Set(),
  onViewPrompt,
}: MobileLayoutProps) {
  // Contexts
  const dimensions = useDimensionsContext();
  const prompts = usePromptsContext();
  const simulator = useSimulatorContext();
  const brain = useBrainContext();

  // UI state
  const [showDimensionSheet, setShowDimensionSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Toast
  const { showToast, toastProps } = useToast();

  // Haptic feedback
  const { trigger: haptic } = useHapticFeedback();

  // Progressive features
  const features = useProgressiveFeatures();

  // Copy handler with toast
  const handleCopyWithToast = useCallback((id: string) => {
    const prompt = prompts.generatedPrompts.find(p => p.id === id);
    if (prompt) {
      navigator.clipboard.writeText(prompt.prompt);
      prompts.handleCopy(id);
      haptic('light');
      showToast('Copied to clipboard', 'success');
    }
  }, [prompts, showToast, haptic]);

  // Generate handler with haptic
  const handleGenerate = useCallback(() => {
    if (simulator.canGenerate && !simulator.isGenerating) {
      haptic('medium');
      simulator.handleGenerate();
    }
  }, [simulator, haptic]);

  // Dimension sheet handlers
  const handleOpenDimensions = useCallback(() => {
    haptic('light');
    setShowDimensionSheet(true);
  }, [haptic]);

  const handleCloseDimensions = useCallback(() => {
    setShowDimensionSheet(false);
  }, []);

  // Count filled dimensions
  const filledDimensionCount = useMemo(() =>
    dimensions.dimensions.filter(d => d.reference.trim().length > 0).length,
    [dimensions.dimensions]
  );

  // Has any content
  const hasContent = brain.baseImage.trim().length > 0 || filledDimensionCount > 0;

  return (
    <div className="h-full w-full bg-surface-primary text-slate-200 flex flex-col overflow-hidden font-sans">
      {/* Toast */}
      <Toast {...toastProps} />

      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800/50 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-mono type-body-sm text-slate-200 font-medium">
              Simulator
            </span>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 radius-md transition-colors ${
              showSettings
                ? `${semanticColors.primary.bg} ${semanticColors.primary.border} border`
                : 'bg-slate-800/50'
            }`}
          >
            <Settings size={18} className={showSettings ? semanticColors.primary.text : 'text-slate-400'} />
          </button>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto overscroll-contain pb-24">
        {/* Source Image / Brain Section */}
        <section className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon size={14} className="text-cyan-400" />
            <span className="font-mono type-label text-cyan-400 uppercase tracking-wider">
              Source
            </span>
          </div>

          <div className="relative">
            {/* Base image textarea */}
            <textarea
              value={brain.baseImage}
              onChange={(e) => brain.setBaseImage(e.target.value)}
              placeholder="Describe your base image or paste a reference..."
              rows={3}
              className="w-full px-4 py-3 radius-md bg-slate-800/50 border border-slate-700/50
                         text-slate-200 font-mono type-body-sm placeholder:text-slate-500
                         focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30
                         resize-none transition-colors"
            />

            {/* Quick action - paste image */}
            {!brain.baseImage && (
              <div className="absolute bottom-3 right-3">
                <span className="font-mono type-label text-slate-600">
                  or paste image
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Dimensions Summary */}
        <section className="px-4 py-2">
          <button
            onClick={handleOpenDimensions}
            className="w-full flex items-center justify-between px-4 py-3 radius-md
                       bg-slate-800/30 border border-slate-700/50 hover:border-cyan-500/30
                       transition-colors active:bg-slate-800/50"
          >
            <div className="flex items-center gap-3">
              <Sliders size={18} className="text-slate-400" />
              <span className="font-mono type-body-sm text-slate-300">
                Dimensions
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono type-label px-2 py-0.5 radius-sm ${
                filledDimensionCount > 0
                  ? `${semanticColors.primary.bg} ${semanticColors.primary.text}`
                  : 'bg-slate-700/50 text-slate-500'
              }`}>
                {filledDimensionCount} / {dimensions.dimensions.length}
              </span>
              <ChevronUp size={16} className="text-slate-500" />
            </div>
          </button>

          {/* Quick dimension chips */}
          {dimensions.dimensions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {dimensions.dimensions.slice(0, features.visibleDimensionCount).map((dim) => (
                <button
                  key={dim.id}
                  onClick={handleOpenDimensions}
                  className={`px-2.5 py-1 radius-full text-xs font-mono transition-colors ${
                    dim.reference
                      ? `${semanticColors.primary.bg} ${semanticColors.primary.border} border ${semanticColors.primary.text}`
                      : 'bg-slate-800/50 border border-slate-700/50 text-slate-500'
                  }`}
                >
                  {dim.label}
                  {dim.reference && ': '}
                  {dim.reference && (
                    <span className="opacity-70">
                      {dim.reference.length > 15 ? dim.reference.slice(0, 15) + '...' : dim.reference}
                    </span>
                  )}
                </button>
              ))}
              {dimensions.dimensions.length > features.visibleDimensionCount && (
                <span className="px-2 py-1 text-xs font-mono text-slate-500">
                  +{dimensions.dimensions.length - features.visibleDimensionCount} more
                </span>
              )}
            </div>
          )}
        </section>

        {/* Feedback Section (compact on mobile) */}
        <section className="px-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="font-mono type-label text-slate-500 block mb-1.5">
                More of...
              </span>
              <input
                type="text"
                value={brain.feedback.positive}
                onChange={(e) => brain.setFeedback({ ...brain.feedback, positive: e.target.value })}
                placeholder="e.g., dramatic lighting"
                className="w-full px-3 py-2 radius-md bg-slate-800/50 border border-slate-700/50
                           text-slate-200 font-mono type-body-sm placeholder:text-slate-600
                           focus:border-green-500/50 focus:outline-none text-sm"
              />
            </div>
            <div>
              <span className="font-mono type-label text-slate-500 block mb-1.5">
                Less of...
              </span>
              <input
                type="text"
                value={brain.feedback.negative}
                onChange={(e) => brain.setFeedback({ ...brain.feedback, negative: e.target.value })}
                placeholder="e.g., busy backgrounds"
                className="w-full px-3 py-2 radius-md bg-slate-800/50 border border-slate-700/50
                           text-slate-200 font-mono type-body-sm placeholder:text-slate-600
                           focus:border-red-500/50 focus:outline-none text-sm"
              />
            </div>
          </div>
        </section>

        {/* Generated Prompts */}
        <section className="py-4">
          <div className="flex items-center justify-between px-4 mb-3">
            <span className="font-mono type-label text-slate-500 uppercase tracking-wider">
              Generated Prompts
            </span>
            {prompts.generatedPrompts.length > 0 && (
              <span className="font-mono type-label text-slate-600">
                {prompts.generatedPrompts.length} results
              </span>
            )}
          </div>

          {prompts.generatedPrompts.length === 0 && !simulator.isGenerating ? (
            <div className="px-4 py-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800/50 flex items-center justify-center">
                <Sparkles size={24} className="text-slate-600" />
              </div>
              <p className="font-mono type-body-sm text-slate-500 mb-1">
                No prompts yet
              </p>
              <p className="font-mono type-label text-slate-600">
                Add some dimensions and generate
              </p>
            </div>
          ) : (
            <MobilePromptCarousel
              prompts={prompts.generatedPrompts}
              onViewPrompt={onViewPrompt}
              onRate={prompts.handlePromptRate}
              onLock={prompts.handlePromptLock}
              onLockElement={prompts.handleElementLock}
              onCopy={handleCopyWithToast}
              generatedImages={generatedImages}
              onStartImage={onStartImage}
              savedPromptIds={savedPromptIds}
              isGenerating={simulator.isGenerating}
              skeletonCount={2}
            />
          )}
        </section>
      </main>

      {/* Fixed Bottom Action Bar */}
      <footer className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/50 z-30 safe-area-pb">
        <button
          onClick={handleGenerate}
          disabled={!simulator.canGenerate || simulator.isGenerating}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 radius-lg
                     font-mono type-body-sm font-medium uppercase tracking-wider
                     transition-all duration-200 ${
                       !simulator.canGenerate || simulator.isGenerating
                         ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                         : 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25 active:scale-[0.98]'
                     }`}
        >
          {simulator.isGenerating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              <span>Generate Prompts</span>
            </>
          )}
        </button>
      </footer>

      {/* Dimension Bottom Sheet */}
      <MobileDimensionSheet
        isOpen={showDimensionSheet}
        onClose={handleCloseDimensions}
        dimensions={dimensions.dimensions}
        onDimensionChange={dimensions.handleDimensionChange}
        onDimensionRemove={dimensions.handleDimensionRemove}
        onDimensionAdd={dimensions.handleDimensionAdd}
        onDimensionWeightChange={dimensions.handleDimensionWeightChange}
        availablePresets={DEFAULT_DIMENSIONS}
      />
    </div>
  );
}

export const MobileLayout = memo(MobileLayoutComponent);

export default MobileLayout;
