/**
 * ComparisonCard - Single prompt card in the comparison view
 *
 * Displays a prompt with its image, elements, and highlights differences
 * when compared against other prompts.
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Lock, ImageIcon, CheckCircle2 } from 'lucide-react';
import { GeneratedPrompt, GeneratedImage, PromptElement, ElementDiff } from '../types';
import { getCategoryColors } from '../lib/semanticColors';
import { scaleIn, transitions } from '../lib/motion';
import { getElementClassification } from '../lib/comparison';

interface ComparisonCardProps {
  prompt: GeneratedPrompt;
  image?: GeneratedImage;
  index: number;
  /** Element diff result when comparing with another prompt */
  elementDiff?: ElementDiff;
  /** Whether this is the first or second prompt in comparison */
  position: 'first' | 'second';
  /** Whether to highlight differences */
  highlightDifferences: boolean;
  /** Whether to show elements section */
  showElements: boolean;
  /** Whether to show the prompt text */
  showPromptText: boolean;
  /** Whether this card is selected for comparison */
  isSelected?: boolean;
  /** Selection mode - show checkbox */
  selectionMode?: boolean;
  /** Toggle selection */
  onToggleSelect?: (promptId: string) => void;
}

export function ComparisonCard({
  prompt,
  image,
  index,
  elementDiff,
  position,
  highlightDifferences,
  showElements,
  showPromptText,
  isSelected = false,
  selectionMode = false,
  onToggleSelect,
}: ComparisonCardProps) {
  const hasImage = image?.status === 'complete' && image?.url;

  const getElementHighlightClass = (element: PromptElement): string => {
    if (!highlightDifferences || !elementDiff) {
      return '';
    }

    const classification = getElementClassification(element, elementDiff);

    switch (classification) {
      case 'unique-first':
        return position === 'first'
          ? 'ring-2 ring-amber-500/50 bg-amber-500/20'
          : '';
      case 'unique-second':
        return position === 'second'
          ? 'ring-2 ring-cyan-500/50 bg-cyan-500/20'
          : '';
      case 'common':
        return 'ring-1 ring-green-500/30 bg-green-500/10';
      default:
        return '';
    }
  };

  const handleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(prompt.id);
    }
  };

  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      transition={{ ...transitions.normal, delay: index * 0.05 }}
      className={`relative flex flex-col bg-slate-900/60 radius-md border overflow-hidden transition-all ${
        isSelected
          ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10'
          : 'border-slate-700/50 hover:border-slate-600'
      } ${selectionMode ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
      data-testid={`comparison-card-${prompt.id}`}
    >
      {/* Selection checkbox overlay */}
      {selectionMode && (
        <div
          className={`absolute top-2 right-2 z-20 w-6 h-6 radius-sm border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-cyan-500 border-cyan-500'
              : 'bg-slate-900/80 border-slate-600 hover:border-slate-500'
          }`}
          data-testid={`comparison-card-checkbox-${prompt.id}`}
        >
          {isSelected && <CheckCircle2 size={14} className="text-white" />}
        </div>
      )}

      {/* Image Section */}
      <div className="relative aspect-video bg-slate-900">
        {hasImage ? (
          <Image
            src={image.url!}
            alt={prompt.sceneType}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="p-3 rounded-full bg-slate-800/60">
              <ImageIcon size={20} className="text-slate-600" />
            </div>
            <span className="font-mono type-label text-slate-600 uppercase">
              {image?.status === 'generating' || image?.status === 'pending'
                ? 'Generating...'
                : image?.status === 'failed'
                  ? 'Failed'
                  : 'No Image'}
            </span>
          </div>
        )}

        {/* Scene type badge */}
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 radius-sm backdrop-blur-sm">
          <span className="font-mono type-label text-cyan-400 uppercase">
            {prompt.sceneType}
          </span>
        </div>

        {/* Locked badge */}
        {prompt.locked && (
          <div className="absolute top-2 left-2 p-1.5 bg-green-500/20 radius-sm border border-green-500/30">
            <Lock size={12} className="text-green-400" />
          </div>
        )}

        {/* Position indicator */}
        <div
          className={`absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 radius-sm text-xs font-mono uppercase tracking-wider ${
            position === 'first'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
          }`}
        >
          Scene {prompt.sceneNumber}
        </div>
      </div>

      {/* Prompt Text Section */}
      {showPromptText && (
        <div className="p-3 border-t border-slate-800">
          <p className="font-mono text-xs text-slate-400 line-clamp-3 leading-relaxed">
            {prompt.prompt}
          </p>
        </div>
      )}

      {/* Elements Section */}
      {showElements && (
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono type-label text-slate-500 uppercase">
              Elements
            </span>
            <span className="font-mono type-label text-slate-600">
              ({prompt.elements.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {prompt.elements.map((element) => {
              const categoryColors = getCategoryColors(element.category);
              const highlightClass = getElementHighlightClass(element);

              return (
                <div
                  key={element.id}
                  className={`px-2 py-1 radius-sm border text-xs font-mono transition-all ${categoryColors.border} ${categoryColors.bg} ${categoryColors.text} ${highlightClass}`}
                  data-testid={`comparison-element-${element.id}`}
                >
                  {element.text}
                  {element.locked && (
                    <Lock size={10} className="inline ml-1 text-green-400" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default ComparisonCard;
