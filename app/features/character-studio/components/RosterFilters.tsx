'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  SortAsc,
  Grid,
  List,
  Tag,
  X,
  Plus,
  Calendar,
  Star,
  ChevronDown,
} from 'lucide-react';
import type { CharacterStatus } from '../types';
import {
  type FilterState,
  type SortOption,
  type ViewMode,
  type TagInfo,
  SORT_OPTIONS,
  DEFAULT_FILTERS,
  getAllTags,
  createTag,
  deleteTag,
  debounce,
} from '../lib/rosterFiltering';

interface RosterFiltersProps {
  viewMode: ViewMode;
  filters: FilterState;
  sort: SortOption;
  onViewModeChange: (mode: ViewMode) => void;
  onFiltersChange: (filters: FilterState) => void;
  onSortChange: (sort: SortOption) => void;
  characterCount: number;
  filteredCount: number;
}

const STATUS_OPTIONS: { value: CharacterStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'ready', label: 'Ready' },
  { value: 'processing', label: 'Processing' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

export function RosterFilters({
  viewMode,
  filters,
  sort,
  onViewModeChange,
  onFiltersChange,
  onSortChange,
  characterCount,
  filteredCount,
}: RosterFiltersProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState<TagInfo[]>([]);

  // Load tags on mount
  useEffect(() => {
    setAvailableTags(getAllTags());
  }, []);

  // Debounced search handler
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        onFiltersChange({ ...filters, searchQuery: query });
      }, 300),
    [filters, onFiltersChange]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      debouncedSearch(e.target.value);
    },
    [debouncedSearch]
  );

  const handleStatusChange = useCallback(
    (status: CharacterStatus | 'all') => {
      onFiltersChange({ ...filters, status });
    },
    [filters, onFiltersChange]
  );

  const handleTagToggle = useCallback(
    (tagName: string) => {
      const newTags = filters.tags.includes(tagName)
        ? filters.tags.filter((t) => t !== tagName)
        : [...filters.tags, tagName];
      onFiltersChange({ ...filters, tags: newTags });
    },
    [filters, onFiltersChange]
  );

  const handleCreateTag = useCallback(() => {
    if (newTagInput.trim()) {
      const newTag = createTag(newTagInput.trim());
      setAvailableTags(getAllTags());
      setNewTagInput('');
      // Auto-select newly created tag
      onFiltersChange({ ...filters, tags: [...filters.tags, newTag.name] });
    }
  }, [newTagInput, filters, onFiltersChange]);

  const handleDeleteTag = useCallback((tagName: string) => {
    deleteTag(tagName);
    setAvailableTags(getAllTags());
  }, []);

  const handleClearFilters = useCallback(() => {
    onFiltersChange(DEFAULT_FILTERS);
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.searchQuery ||
    filters.status !== 'all' ||
    filters.tags.length > 0 ||
    filters.minQuality !== null ||
    filters.maxQuality !== null ||
    filters.dateRange.from ||
    filters.dateRange.to;

  return (
    <div className="space-y-2">
      {/* Primary toolbar */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            defaultValue={filters.searchQuery}
            onChange={handleSearchChange}
            placeholder="Search characters..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-white/5 rounded-lg
                     text-xs text-slate-200 placeholder-slate-600 focus:outline-none
                     focus:border-cyan-500/30 transition-colors"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 transition-colors ${
              viewMode === 'list'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title="List view"
          >
            <List size={14} />
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 transition-colors ${
              viewMode === 'grid'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Grid view"
          >
            <Grid size={14} />
          </button>
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="flex items-center gap-1.5 px-3 py-2 border border-white/10 rounded-lg
                     text-xs text-slate-400 hover:text-slate-200 hover:border-white/20 transition-colors"
          >
            <SortAsc size={14} />
            <span className="hidden sm:inline">{sort.label}</span>
            <ChevronDown size={12} className={showSortDropdown ? 'rotate-180' : ''} />
          </button>

          <AnimatePresence>
            {showSortDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute right-0 top-full mt-1 w-40 bg-slate-900 border border-white/10
                         rounded-lg shadow-xl z-20 overflow-hidden"
              >
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={`${option.field}-${option.direction}`}
                    onClick={() => {
                      onSortChange(option);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                      sort.field === option.field && sort.direction === option.direction
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs transition-colors ${
            hasActiveFilters || showAdvancedFilters
              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
              : 'border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
          }`}
        >
          <Filter size={14} />
          <span className="hidden sm:inline">Filter</span>
          {hasActiveFilters && (
            <span className="ml-1 w-4 h-4 rounded-full bg-cyan-500 text-[10px] text-white
                           flex items-center justify-center font-mono">
              {(filters.tags.length > 0 ? 1 : 0) +
                (filters.status !== 'all' ? 1 : 0) +
                (filters.minQuality !== null || filters.maxQuality !== null ? 1 : 0) +
                (filters.dateRange.from || filters.dateRange.to ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>
          {filteredCount === characterCount
            ? `${characterCount} characters`
            : `${filteredCount} of ${characterCount} characters`}
        </span>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Advanced filters panel */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-slate-900/50 border border-white/5 rounded-lg space-y-3">
              {/* Status filter */}
              <div>
                <label className="text-[10px] text-slate-500 font-mono uppercase mb-1.5 block">
                  Status
                </label>
                <div className="flex flex-wrap gap-1">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                      className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                        filters.status === option.value
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'text-slate-500 hover:text-slate-300 border border-transparent'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags filter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-slate-500 font-mono uppercase">
                    Tags
                  </label>
                  <button
                    onClick={() => setShowTagManager(!showTagManager)}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono"
                  >
                    {showTagManager ? 'Done' : 'Manage'}
                  </button>
                </div>

                {availableTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.name}
                        onClick={() => handleTagToggle(tag.name)}
                        className={`group flex items-center gap-1 px-2 py-1 rounded text-[10px]
                                  font-mono transition-colors ${
                                    filters.tags.includes(tag.name)
                                      ? 'bg-opacity-30 border'
                                      : 'bg-opacity-10 hover:bg-opacity-20'
                                  }`}
                        style={{
                          backgroundColor: `${tag.color}20`,
                          borderColor: filters.tags.includes(tag.name) ? `${tag.color}50` : 'transparent',
                          color: tag.color,
                        }}
                      >
                        <Tag size={10} />
                        {tag.name}
                        <span className="text-[9px] opacity-60">({tag.count})</span>
                        {showTagManager && (
                          <X
                            size={10}
                            className="opacity-0 group-hover:opacity-100 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTag(tag.name);
                            }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-600 italic">No tags created yet</p>
                )}

                {/* New tag input */}
                {showTagManager && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                      placeholder="New tag name..."
                      className="flex-1 px-2 py-1 bg-slate-800 border border-white/10 rounded
                               text-xs text-slate-200 placeholder-slate-600 focus:outline-none
                               focus:border-cyan-500/30"
                    />
                    <button
                      onClick={handleCreateTag}
                      disabled={!newTagInput.trim()}
                      className="p-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30
                               disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Quality filter */}
              <div>
                <label className="text-[10px] text-slate-500 font-mono uppercase mb-1.5 block">
                  <Star size={10} className="inline mr-1" />
                  Quality Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={filters.minQuality ?? ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        minQuality: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="Min"
                    className="w-20 px-2 py-1 bg-slate-800 border border-white/10 rounded
                             text-xs text-slate-200 placeholder-slate-600 focus:outline-none
                             focus:border-cyan-500/30"
                  />
                  <span className="text-slate-600">—</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={filters.maxQuality ?? ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        maxQuality: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="Max"
                    className="w-20 px-2 py-1 bg-slate-800 border border-white/10 rounded
                             text-xs text-slate-200 placeholder-slate-600 focus:outline-none
                             focus:border-cyan-500/30"
                  />
                </div>
              </div>

              {/* Date filter */}
              <div>
                <label className="text-[10px] text-slate-500 font-mono uppercase mb-1.5 block">
                  <Calendar size={10} className="inline mr-1" />
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filters.dateRange.from ?? ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        dateRange: { ...filters.dateRange, from: e.target.value || null },
                      })
                    }
                    className="flex-1 px-2 py-1 bg-slate-800 border border-white/10 rounded
                             text-xs text-slate-200 focus:outline-none focus:border-cyan-500/30"
                  />
                  <span className="text-slate-600">—</span>
                  <input
                    type="date"
                    value={filters.dateRange.to ?? ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        dateRange: { ...filters.dateRange, to: e.target.value || null },
                      })
                    }
                    className="flex-1 px-2 py-1 bg-slate-800 border border-white/10 rounded
                             text-xs text-slate-200 focus:outline-none focus:border-cyan-500/30"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
