'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  History,
  RefreshCw,
  Sparkles,
  Scan,
  Palette,
  Move,
  Smile,
  Fingerprint,
  X,
} from 'lucide-react';
import type {
  CharacterTrait,
  TraitCategory,
  TraitHistoryEntry,
  CharacterTraits,
} from '../types';
import { TRAIT_CATEGORY_INFO } from '../types';
import { TraitEditor } from './TraitEditor';

interface TraitBreakdownProps {
  traits: CharacterTraits | null;
  isLoading?: boolean;
  onTraitUpdate: (traitId: string, value: string, weight: number) => Promise<void>;
  onTraitRevert?: (traitId: string, historyEntryId: string) => Promise<void>;
  onRegenerateWithEdits?: () => void;
  disabled?: boolean;
}

const CATEGORY_ICONS: Record<TraitCategory, typeof Scan> = {
  facial: Scan,
  style: Palette,
  pose: Move,
  expression: Smile,
  identity: Fingerprint,
};

interface CategorySectionProps {
  category: TraitCategory;
  traits: CharacterTrait[];
  isExpanded: boolean;
  onToggle: () => void;
  onTraitUpdate: (traitId: string, value: string, weight: number) => Promise<void>;
  onTraitRevert?: (traitId: string) => void;
  history: TraitHistoryEntry[];
  disabled?: boolean;
}

function CategorySection({
  category,
  traits,
  isExpanded,
  onToggle,
  onTraitUpdate,
  onTraitRevert,
  history,
  disabled = false,
}: CategorySectionProps) {
  const info = TRAIT_CATEGORY_INFO[category];
  const Icon = CATEGORY_ICONS[category];
  const editedCount = traits.filter((t) => t.source === 'user').length;

  const canRevertTrait = useCallback(
    (traitId: string) => history.some((h) => h.traitId === traitId),
    [history]
  );

  return (
    <div className="border-b border-white/5 last:border-b-0">
      {/* Category header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02]
                 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-md"
            style={{ backgroundColor: `${info.color}20` }}
          >
            <Icon size={12} style={{ color: info.color }} />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            {info.label}
          </span>
          <span className="text-[9px] text-slate-600 font-mono">
            ({traits.length})
          </span>
          {editedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[8px] font-mono">
              {editedCount} edited
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown size={14} className="text-slate-500" />
        ) : (
          <ChevronRight size={14} className="text-slate-500" />
        )}
      </button>

      {/* Traits list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {traits.map((trait) => (
                <div key={trait.id} className="pl-2 border-l-2" style={{ borderColor: `${info.color}40` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-slate-500 font-mono uppercase">
                      {trait.name}
                    </span>
                  </div>
                  <TraitEditor
                    trait={trait}
                    onSave={onTraitUpdate}
                    onRevert={onTraitRevert}
                    canRevert={canRevertTrait(trait.id)}
                    disabled={disabled}
                  />
                </div>
              ))}
              {traits.length === 0 && (
                <p className="text-[10px] text-slate-600 italic py-2">
                  No traits in this category
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TraitHistoryPanelProps {
  history: TraitHistoryEntry[];
  traits: CharacterTrait[];
  onRevert: (traitId: string, historyEntryId: string) => void;
  onClose: () => void;
}

function TraitHistoryPanel({ history, traits, onRevert, onClose }: TraitHistoryPanelProps) {
  const getTraitName = useCallback(
    (traitId: string) => traits.find((t) => t.id === traitId)?.name || 'Unknown',
    [traits]
  );

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [history]
  );

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-10 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <History size={14} className="text-amber-400" />
          <span className="font-mono text-xs text-white">Change History</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-700
                   transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-auto ms-scrollbar p-3 space-y-2">
        {sortedHistory.length === 0 ? (
          <div className="text-center py-8">
            <History size={24} className="mx-auto mb-2 text-slate-600" />
            <p className="text-xs text-slate-500">No changes recorded yet</p>
          </div>
        ) : (
          sortedHistory.map((entry) => (
            <div
              key={entry.id}
              className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400 font-mono">
                  {getTraitName(entry.traitId)}
                </span>
                <span className="text-[9px] text-slate-600">
                  {formatDate(entry.timestamp)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] mb-2">
                <span className="text-red-400/70 line-through truncate max-w-[80px]">
                  {entry.previousValue}
                </span>
                <span className="text-slate-500">→</span>
                <span className="text-green-400 truncate max-w-[80px]">
                  {entry.newValue}
                </span>
              </div>
              {entry.previousWeight !== entry.newWeight && (
                <div className="flex items-center gap-2 text-[9px] text-slate-500 mb-2">
                  <span>Weight: {Math.round(entry.previousWeight * 100)}%</span>
                  <span>→</span>
                  <span className="text-cyan-400">{Math.round(entry.newWeight * 100)}%</span>
                </div>
              )}
              <button
                onClick={() => onRevert(entry.traitId, entry.id)}
                className="w-full py-1 rounded bg-amber-500/10 border border-amber-500/20
                         text-amber-400 text-[9px] font-mono uppercase hover:bg-amber-500/20
                         transition-colors"
              >
                Revert to this
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

export function TraitBreakdown({
  traits,
  isLoading = false,
  onTraitUpdate,
  onTraitRevert,
  onRegenerateWithEdits,
  disabled = false,
}: TraitBreakdownProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<TraitCategory>>(
    new Set(['facial', 'identity'])
  );
  const [showHistory, setShowHistory] = useState(false);

  const toggleCategory = useCallback((category: TraitCategory) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  const traitsByCategory = useMemo(() => {
    if (!traits) return new Map<TraitCategory, CharacterTrait[]>();

    const grouped = new Map<TraitCategory, CharacterTrait[]>();
    const categories: TraitCategory[] = ['facial', 'style', 'pose', 'expression', 'identity'];

    for (const category of categories) {
      grouped.set(category, traits.traits.filter((t) => t.category === category));
    }

    return grouped;
  }, [traits]);

  const handleTraitRevert = useCallback(
    (traitId: string) => {
      if (onTraitRevert && traits) {
        const latestHistoryEntry = traits.history
          .filter((h) => h.traitId === traitId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        if (latestHistoryEntry) {
          onTraitRevert(traitId, latestHistoryEntry.id);
        }
      }
    },
    [onTraitRevert, traits]
  );

  const handleHistoryRevert = useCallback(
    (traitId: string, historyEntryId: string) => {
      if (onTraitRevert) {
        onTraitRevert(traitId, historyEntryId);
        setShowHistory(false);
      }
    },
    [onTraitRevert]
  );

  const hasEdits = traits?.traits.some((t) => t.source === 'user') ?? false;
  const editCount = traits?.traits.filter((t) => t.source === 'user').length ?? 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
        <RefreshCw size={20} className="animate-spin mb-2" />
        <span className="text-xs font-mono">Loading traits...</span>
      </div>
    );
  }

  if (!traits) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
        <Scan size={24} className="mb-2 opacity-50" />
        <span className="text-xs font-mono">No trait data available</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full">
      {/* Header with actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">
            v{traits.version}
          </span>
          {hasEdits && (
            <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[9px] font-mono">
              {editCount} edit{editCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(true)}
            className="p-1.5 rounded-md text-slate-500 hover:text-amber-400 hover:bg-amber-500/10
                     transition-colors"
            title="View history"
          >
            <History size={12} />
          </button>
        </div>
      </div>

      {/* Category sections */}
      <div className="flex-1 overflow-auto ms-scrollbar">
        {(['facial', 'style', 'pose', 'expression', 'identity'] as TraitCategory[]).map((category) => (
          <CategorySection
            key={category}
            category={category}
            traits={traitsByCategory.get(category) || []}
            isExpanded={expandedCategories.has(category)}
            onToggle={() => toggleCategory(category)}
            onTraitUpdate={onTraitUpdate}
            onTraitRevert={handleTraitRevert}
            history={traits.history.filter((h) =>
              traitsByCategory.get(category)?.some((t) => t.id === h.traitId)
            )}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Regenerate button */}
      {hasEdits && onRegenerateWithEdits && (
        <div className="p-3 border-t border-white/5">
          <button
            onClick={onRegenerateWithEdits}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                     bg-gradient-to-r from-purple-500/20 to-cyan-500/20
                     border border-purple-500/30 text-white hover:from-purple-500/30 hover:to-cyan-500/30
                     font-mono text-xs uppercase tracking-wider transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles size={14} />
            Regenerate with edits
          </button>
        </div>
      )}

      {/* History panel overlay */}
      <AnimatePresence>
        {showHistory && (
          <TraitHistoryPanel
            history={traits.history}
            traits={traits.traits}
            onRevert={handleHistoryRevert}
            onClose={() => setShowHistory(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
