'use client';

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Star, Clock, Loader2, AlertTriangle, Check, Dna } from 'lucide-react';
import type { Character } from '../types';

interface CharacterCardProps {
  character: Character;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isCompact?: boolean;
}

export const CharacterCard = memo(function CharacterCard({
  character,
  isSelected,
  onSelect,
  isCompact = false,
}: CharacterCardProps) {
  const handleClick = useCallback(() => {
    onSelect(character.id);
  }, [onSelect, character.id]);
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

  if (isCompact) {
    // Icon-only mode for collapsed sidebar
    return (
      <motion.button
        onClick={handleClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative w-10 h-10 rounded-lg overflow-hidden border transition-all ${
          isSelected
            ? 'border-cyan-500/50 ring-2 ring-cyan-500/20'
            : 'border-white/10 hover:border-white/20'
        }`}
        title={character.name}
      >
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
        {/* Status indicator */}
        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-tl ${status.bg}`}>
          <StatusIcon
            size={8}
            className={`${status.color} ${status.animate ? 'animate-spin' : ''}`}
          />
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={handleClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ x: 2 }}
      className={`group relative w-full text-left rounded-lg overflow-hidden border
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
          </div>

          {/* Description preview */}
          {character.description && (
            <p className="text-[10px] text-slate-500 truncate mt-1">
              {character.description}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
});
