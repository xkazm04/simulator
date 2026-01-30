'use client';

import { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Clock, Loader2, AlertTriangle, Check, Dna, Tag } from 'lucide-react';
import type { Character } from '../types';
import { QuickActionBar } from './QuickActionBar';
import {
  duplicateCharacter,
  removeCharacter,
  generateVariation,
  exportCharacter,
  type QuickActionResult,
} from '../lib/quickActions';
import { getAllTags } from '../lib/rosterFiltering';

interface CharacterCardProps {
  character: Character;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onCharacterDeleted?: (id: string) => void;
  onCharacterDuplicated?: (result: QuickActionResult) => void;
  onActionFeedback?: (message: string, variant: 'success' | 'info' | 'warning') => void;
  isCompact?: boolean;
  isGrid?: boolean;
  tags?: string[];
}

export const CharacterCard = memo(function CharacterCard({
  character,
  isSelected,
  onSelect,
  onCharacterDeleted,
  onCharacterDuplicated,
  onActionFeedback,
  isCompact = false,
  isGrid = false,
  tags = [],
}: CharacterCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && 'ontouchstart' in window
  );

  const handleClick = useCallback(() => {
    onSelect(character.id);
  }, [onSelect, character.id]);

  const handleMouseEnter = useCallback(() => {
    if (!isTouchDevice) {
      setIsHovered(true);
    }
  }, [isTouchDevice]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // Quick action handlers
  const handleDuplicate = useCallback(async () => {
    const result = await duplicateCharacter(character);
    if (onActionFeedback) {
      onActionFeedback(result.message, result.success ? 'success' : 'warning');
    }
    if (result.success && onCharacterDuplicated) {
      onCharacterDuplicated(result);
    }
  }, [character, onActionFeedback, onCharacterDuplicated]);

  const handleDelete = useCallback(async () => {
    const result = await removeCharacter(character);
    if (onActionFeedback) {
      onActionFeedback(result.message, result.success ? 'success' : 'warning');
    }
    if (result.success && onCharacterDeleted) {
      onCharacterDeleted(character.id);
    }
  }, [character, onActionFeedback, onCharacterDeleted]);

  const handleGenerateVariation = useCallback(async () => {
    const result = await generateVariation(character);
    if (onActionFeedback) {
      onActionFeedback(result.message, result.success ? 'info' : 'warning');
    }
  }, [character, onActionFeedback]);

  const handleExport = useCallback(async () => {
    const result = await exportCharacter(character);
    if (onActionFeedback) {
      onActionFeedback(result.message, result.success ? 'success' : 'warning');
    }
  }, [character, onActionFeedback]);

  const statusConfig: Record<
    string,
    { icon: typeof Clock; color: string; bg: string; label: string; animate?: boolean }
  > = {
    pending: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'pending' },
    processing: { icon: Loader2, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'extracting', animate: true },
    ready: { icon: Check, color: 'text-green-400', bg: 'bg-green-500/20', label: 'ready' },
    failed: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'failed' },
  };

  const status = statusConfig[character.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  // Calculate star rating from quality score (0-5 stars)
  const starRating = character.quality_score
    ? Math.round(character.quality_score * 5)
    : 0;

  // Get tag colors
  const allTags = getAllTags();
  const tagColors = tags.map((tagName) => {
    const tagInfo = allTags.find((t) => t.name === tagName);
    return { name: tagName, color: tagInfo?.color || '#666' };
  });

  if (isCompact) {
    // Icon-only mode for collapsed sidebar
    return (
      <motion.button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative w-10 h-10 rounded-lg overflow-visible border transition-all ${
          isSelected
            ? 'border-cyan-500/50 ring-2 ring-cyan-500/20'
            : 'border-white/10 hover:border-white/20'
        }`}
        title={character.name}
      >
        <div className="w-full h-full rounded-lg overflow-hidden">
          {character.primary_thumbnail_url ? (
            <img
              src={character.primary_thumbnail_url}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400
                          font-mono text-sm uppercase">
              {character.name.charAt(0)}
            </div>
          )}
        </div>
        {/* Status indicator */}
        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-tl ${status.bg}`}>
          <StatusIcon
            size={8}
            className={`${status.color} ${status.animate ? 'animate-spin' : ''}`}
          />
        </div>

        {/* Tag indicator (small dot) */}
        {tags.length > 0 && (
          <div
            className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: tagColors[0]?.color }}
            title={tags.join(', ')}
          />
        )}

        {/* Quick action bar for compact mode */}
        <QuickActionBar
          character={character}
          isVisible={isHovered}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onGenerateVariation={handleGenerateVariation}
          onExport={handleExport}
          position="bottom"
        />
      </motion.button>
    );
  }

  if (isGrid) {
    // Grid card mode - larger thumbnail focus
    return (
      <motion.button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        className={`group relative w-full text-left rounded-lg overflow-visible border
                  transition-all duration-200 ${
                    isSelected
                      ? 'border-cyan-500/40 bg-cyan-500/5'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                  }`}
      >
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-cyan-500 rounded-l-lg" />
        )}

        {/* Thumbnail */}
        <div className="relative aspect-square w-full overflow-hidden rounded-t-lg">
          {character.primary_thumbnail_url ? (
            <img
              src={character.primary_thumbnail_url}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800
                          text-slate-400 font-mono text-2xl uppercase">
              {character.name.charAt(0)}
            </div>
          )}

          {/* Status badge (top right) */}
          <div className={`absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5
                        rounded text-[9px] font-mono ${status.bg} ${status.color}`}>
            <StatusIcon
              size={10}
              className={status.animate ? 'animate-spin' : ''}
            />
            {status.label}
          </div>

          {/* DNA indicator */}
          {character.status === 'ready' && (
            <div className="absolute bottom-1.5 right-1.5 p-1 rounded-full bg-[#0c0c14]/80">
              <Dna size={12} className="text-cyan-400" />
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="p-2">
          {/* Name */}
          <div className="font-mono text-xs text-white truncate mb-1">
            {character.name}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between">
            {/* Star rating */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={8}
                  className={
                    i <= starRating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-700'
                  }
                />
              ))}
            </div>

            {/* Reference count */}
            <span className="text-[9px] text-slate-500 font-mono">
              {character.reference_count} refs
            </span>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tagColors.slice(0, 2).map(({ name, color }) => (
                <span
                  key={name}
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-mono"
                  style={{
                    backgroundColor: `${color}20`,
                    color: color,
                  }}
                >
                  <Tag size={8} />
                  {name}
                </span>
              ))}
              {tags.length > 2 && (
                <span className="text-[8px] text-slate-500 font-mono">
                  +{tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick action bar */}
        <QuickActionBar
          character={character}
          isVisible={isHovered}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onGenerateVariation={handleGenerateVariation}
          onExport={handleExport}
          position="right"
        />
      </motion.button>
    );
  }

  // Default list view
  return (
    <motion.button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ x: 2 }}
      className={`group relative w-full text-left rounded-lg overflow-visible border
                transition-all duration-200 ${
                  isSelected
                    ? 'border-cyan-500/40 bg-cyan-500/5'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                }`}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-cyan-500" />
      )}

      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10
                      flex-shrink-0">
          {character.primary_thumbnail_url ? (
            <img
              src={character.primary_thumbnail_url}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800
                          text-slate-400 font-mono text-lg uppercase">
              {character.name.charAt(0)}
            </div>
          )}
          {/* Mini DNA indicator */}
          {character.status === 'ready' && (
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#0c0c14]">
              <Dna size={10} className="text-cyan-400" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-white truncate">
              {character.name}
            </span>
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px]
                          font-mono ${status.bg} ${status.color}`}>
              <StatusIcon
                size={10}
                className={status.animate ? 'animate-spin' : ''}
              />
              {status.label}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-1.5">
            {/* Star rating */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={10}
                  className={
                    i <= starRating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-700'
                  }
                />
              ))}
            </div>

            {/* Reference count */}
            <span className="text-[10px] text-slate-500 font-mono">
              {character.reference_count} refs
            </span>

            {/* Tags (inline in list view) */}
            {tags.length > 0 && (
              <div className="flex items-center gap-1">
                {tagColors.slice(0, 2).map(({ name, color }) => (
                  <span
                    key={name}
                    className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-mono"
                    style={{
                      backgroundColor: `${color}20`,
                      color: color,
                    }}
                  >
                    <Tag size={8} />
                    {name}
                  </span>
                ))}
                {tags.length > 2 && (
                  <span className="text-[8px] text-slate-500 font-mono">
                    +{tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description preview */}
          {character.description && (
            <p className="text-[10px] text-slate-500 truncate mt-1">
              {character.description}
            </p>
          )}
        </div>
      </div>

      {/* Quick action bar */}
      <QuickActionBar
        character={character}
        isVisible={isHovered}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onGenerateVariation={handleGenerateVariation}
        onExport={handleExport}
        position="right"
      />
    </motion.button>
  );
});
