'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Loader2, Users, Sparkles } from 'lucide-react';
import type { Character, CharacterStatus } from '../types';
import { CharacterCard } from './CharacterCard';

interface CharacterRosterProps {
  characters: Character[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  isCollapsed: boolean;
  isLoading: boolean;
}

const STATUS_FILTERS: { value: CharacterStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'all' },
  { value: 'ready', label: 'ready' },
  { value: 'processing', label: 'processing' },
  { value: 'failed', label: 'failed' },
];

export function CharacterRoster({
  characters,
  selectedId,
  onSelect,
  onCreate,
  isCollapsed,
  isLoading,
}: CharacterRosterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CharacterStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter characters
  const filteredCharacters = characters.filter((char) => {
    const matchesSearch = char.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || char.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

        {/* Character icons */}
        {filteredCharacters.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            isSelected={character.id === selectedId}
            onSelect={onSelect}
            isCompact
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search & Filter */}
      <div className="p-3 space-y-2 border-b border-white/5">
        {/* Search input */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search characters..."
            className="w-full pl-9 pr-9 py-2 bg-slate-900/50 border border-white/5 rounded-lg
                     text-xs text-slate-200 placeholder-slate-600 focus:outline-none
                     focus:border-cyan-500/30 transition-colors"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded
                      transition-colors ${
                        showFilters || statusFilter !== 'all'
                          ? 'text-cyan-400 bg-cyan-500/10'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
          >
            <Filter size={12} />
          </button>
        </div>

        {/* Filter dropdown */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-1"
            >
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`px-2 py-1 rounded text-[10px] font-mono uppercase transition-colors ${
                    statusFilter === filter.value
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Character List */}
      <div className="flex-1 overflow-auto ms-scrollbar p-2 space-y-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <Loader2 size={24} className="animate-spin mb-2" />
            <span className="text-xs font-mono">Loading...</span>
          </div>
        ) : filteredCharacters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 px-4">
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
                <Search size={20} className="mb-2 opacity-50" />
                <span className="text-xs font-mono">No matches found</span>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono mt-2"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredCharacters.map((character, index) => (
            <motion.div
              key={character.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <CharacterCard
                character={character}
                isSelected={character.id === selectedId}
                onSelect={onSelect}
              />
            </motion.div>
          ))
        )}
      </div>

      {/* Add Character Button */}
      <div className="p-3 border-t border-white/5">
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
