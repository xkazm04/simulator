'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, Users, Sparkles, ArrowLeftRight, X, Check } from 'lucide-react';
import type { Character, CharacterStatus } from '../types';
import { CharacterCard } from './CharacterCard';
import { RosterFilters } from './RosterFilters';
import {
  type FilterState,
  type SortOption,
  type ViewMode,
  type RosterState,
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  processCharacters,
  getCharacterTags,
} from '../lib/rosterFiltering';

interface CharacterRosterProps {
  characters: Character[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  isCollapsed: boolean;
  isLoading: boolean;
  // Comparison mode props
  comparisonMode?: boolean;
  comparisonIds?: string[];
  onComparisonModeChange?: (enabled: boolean) => void;
  onComparisonSelect?: (ids: string[]) => void;
  maxCompareCount?: number;
}

const ROSTER_STATE_KEY = 'character-roster-state';

function loadRosterState(): Partial<RosterState> {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(ROSTER_STATE_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

function saveRosterState(state: RosterState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ROSTER_STATE_KEY, JSON.stringify(state));
}

export function CharacterRoster({
  characters,
  selectedId,
  onSelect,
  onCreate,
  isCollapsed,
  isLoading,
  comparisonMode = false,
  comparisonIds = [],
  onComparisonModeChange,
  onComparisonSelect,
  maxCompareCount = 4,
}: CharacterRosterProps) {
  // Roster state with persistence
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortOption>(DEFAULT_SORT);

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadRosterState();
    if (saved.viewMode) setViewMode(saved.viewMode);
    if (saved.filters) setFilters(saved.filters);
    if (saved.sort) setSort(saved.sort);
  }, []);

  // Save state on changes
  useEffect(() => {
    saveRosterState({ viewMode, filters, sort });
  }, [viewMode, filters, sort]);

  // Process characters with filters and sorting
  const filteredCharacters = useMemo(() => {
    return processCharacters(characters, { viewMode, filters, sort });
  }, [characters, viewMode, filters, sort]);

  // Handle comparison selection toggle
  const handleComparisonToggle = useCallback((id: string) => {
    if (!onComparisonSelect) return;

    if (comparisonIds.includes(id)) {
      onComparisonSelect(comparisonIds.filter((cid) => cid !== id));
    } else if (comparisonIds.length < maxCompareCount) {
      onComparisonSelect([...comparisonIds, id]);
    }
  }, [comparisonIds, maxCompareCount, onComparisonSelect]);

  // Handle card click in comparison mode vs normal mode
  const handleCardClick = useCallback((id: string) => {
    if (comparisonMode) {
      handleComparisonToggle(id);
    } else {
      onSelect(id);
    }
  }, [comparisonMode, handleComparisonToggle, onSelect]);

  // Toggle comparison mode
  const handleToggleComparisonMode = useCallback(() => {
    if (onComparisonModeChange) {
      onComparisonModeChange(!comparisonMode);
      if (!comparisonMode && onComparisonSelect) {
        onComparisonSelect([]);
      }
    }
  }, [comparisonMode, onComparisonModeChange, onComparisonSelect]);

  // Ready characters count (for comparison)
  const readyCount = characters.filter((c) => c.status === 'ready').length;

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="flex-1 flex flex-col items-center py-2 gap-2 overflow-auto ms-scrollbar">
        {/* Add button */}
        <motion.button
          onClick={onCreate}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 rounded-lg border-2 border-dashed border-white/10
                   hover:border-purple-500/30 flex items-center justify-center
                   text-slate-500 hover:text-purple-400 transition-colors"
          title="New character"
        >
          <Plus size={16} />
        </motion.button>

        {/* Compare button (collapsed) */}
        {readyCount >= 2 && onComparisonModeChange && (
          <motion.button
            onClick={handleToggleComparisonMode}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`w-10 h-10 rounded-lg border flex items-center justify-center
                     transition-colors ${
                       comparisonMode
                         ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                         : 'border-white/10 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/30'
                     }`}
            title="Compare characters"
          >
            <ArrowLeftRight size={14} />
          </motion.button>
        )}

        {/* Character icons */}
        {filteredCharacters.map((character) => (
          <div key={character.id} className="relative">
            <CharacterCard
              character={character}
              isSelected={comparisonMode ? comparisonIds.includes(character.id) : character.id === selectedId}
              onSelect={handleCardClick}
              isCompact
              tags={getCharacterTags(character.id)}
            />
            {/* Comparison selection indicator */}
            {comparisonMode && comparisonIds.includes(character.id) && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500
                            flex items-center justify-center">
                <Check size={10} className="text-white" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Comparison mode header */}
      <AnimatePresence>
        {comparisonMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-cyan-500/10 border-b border-cyan-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight size={14} className="text-cyan-400" />
                  <span className="text-xs font-mono text-cyan-400">Comparison Mode</span>
                </div>
                <button
                  onClick={handleToggleComparisonMode}
                  className="p-1 rounded text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-[10px] text-cyan-300/70 mt-1">
                Select {maxCompareCount - comparisonIds.length > 0
                  ? `up to ${maxCompareCount - comparisonIds.length} more`
                  : 'no more'} characters ({comparisonIds.length}/{maxCompareCount})
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="p-3 border-b border-white/5">
        <RosterFilters
          viewMode={viewMode}
          filters={filters}
          sort={sort}
          onViewModeChange={setViewMode}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          characterCount={characters.length}
          filteredCount={filteredCharacters.length}
        />
      </div>

      {/* Character List / Grid */}
      <div className={`flex-1 overflow-auto ms-scrollbar p-2 ${
        viewMode === 'grid' ? 'grid grid-cols-2 gap-2 auto-rows-min' : 'space-y-1'
      }`}>
        {isLoading ? (
          <div className={`flex flex-col items-center justify-center py-8 text-slate-500 ${
            viewMode === 'grid' ? 'col-span-2' : ''
          }`}>
            <Loader2 size={24} className="animate-spin mb-2" />
            <span className="text-xs font-mono">Loading...</span>
          </div>
        ) : filteredCharacters.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-6 px-4 ${
            viewMode === 'grid' ? 'col-span-2' : ''
          }`}>
            {characters.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center text-center"
              >
                {/* Illustration */}
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20
                                border border-white/10 flex items-center justify-center">
                    <Users size={28} className="text-purple-400" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20
                                border border-amber-500/30 flex items-center justify-center">
                    <Sparkles size={12} className="text-amber-400" />
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-sm font-medium text-slate-200 mb-1">
                  No actors yet
                </h3>

                {/* Description */}
                <p className="text-[11px] text-slate-500 leading-relaxed mb-4 max-w-[180px]">
                  Create character actors to maintain consistent faces and styles across your generated images.
                </p>

                {/* CTA Button */}
                <button
                  onClick={onCreate}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg
                           bg-purple-500/20 hover:bg-purple-500/30
                           border border-purple-500/30 hover:border-purple-500/50
                           text-purple-300 hover:text-purple-200
                           font-mono text-xs uppercase tracking-wider
                           transition-all duration-200"
                >
                  <Plus size={14} />
                  Create first actor
                </button>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center text-slate-500 py-4">
                <Users size={20} className="mb-2 opacity-50" />
                <span className="text-xs font-mono">No matches found</span>
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono mt-2"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          // Grid view
          filteredCharacters.map((character, index) => (
            <motion.div
              key={character.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              className="relative"
            >
              {/* Selection checkbox for comparison mode */}
              {comparisonMode && (
                <button
                  onClick={() => handleComparisonToggle(character.id)}
                  disabled={!comparisonIds.includes(character.id) && comparisonIds.length >= maxCompareCount}
                  className={`absolute left-1 top-1 z-10 w-5 h-5 rounded
                            flex items-center justify-center transition-all ${
                              comparisonIds.includes(character.id)
                                ? 'bg-cyan-500 text-white'
                                : comparisonIds.length >= maxCompareCount
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            }`}
                >
                  {comparisonIds.includes(character.id) && <Check size={12} />}
                </button>
              )}

              <CharacterCard
                character={character}
                isSelected={comparisonMode ? comparisonIds.includes(character.id) : character.id === selectedId}
                onSelect={handleCardClick}
                isGrid
                tags={getCharacterTags(character.id)}
              />
            </motion.div>
          ))
        ) : (
          // List view
          filteredCharacters.map((character, index) => (
            <motion.div
              key={character.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="relative"
            >
              {/* Selection checkbox for comparison mode */}
              {comparisonMode && (
                <button
                  onClick={() => handleComparisonToggle(character.id)}
                  disabled={!comparisonIds.includes(character.id) && comparisonIds.length >= maxCompareCount}
                  className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded
                            flex items-center justify-center transition-all ${
                              comparisonIds.includes(character.id)
                                ? 'bg-cyan-500 text-white'
                                : comparisonIds.length >= maxCompareCount
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            }`}
                >
                  {comparisonIds.includes(character.id) && <Check size={12} />}
                </button>
              )}

              <div className={comparisonMode ? 'ml-7' : ''}>
                <CharacterCard
                  character={character}
                  isSelected={comparisonMode ? comparisonIds.includes(character.id) : character.id === selectedId}
                  onSelect={handleCardClick}
                  tags={getCharacterTags(character.id)}
                />
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Footer buttons */}
      <div className="p-3 border-t border-white/5 space-y-2">
        {/* Compare button */}
        {readyCount >= 2 && onComparisonModeChange && !comparisonMode && (
          <button
            onClick={handleToggleComparisonMode}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                     border border-cyan-500/30 hover:border-cyan-500/50
                     bg-cyan-500/10 hover:bg-cyan-500/20
                     text-cyan-400 font-mono text-xs uppercase
                     tracking-wider transition-colors"
          >
            <ArrowLeftRight size={14} />
            compare characters
          </button>
        )}

        {/* Add Character Button */}
        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                   border-2 border-dashed border-white/10 hover:border-purple-500/30
                   text-slate-500 hover:text-purple-400 font-mono text-xs uppercase
                   tracking-wider transition-colors"
        >
          <Plus size={14} />
          new actor
        </button>
      </div>
    </div>
  );
}
