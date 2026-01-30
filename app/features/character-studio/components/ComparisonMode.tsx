'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  RefreshCw,
  Check,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Loader2,
  Dna,
  ArrowLeftRight,
} from 'lucide-react';
import type { Character, CharacterDNA, CharacterTraits, TraitCategory } from '../types';
import { TRAIT_CATEGORY_INFO } from '../types';
import { getCharacterDNA } from '../lib/api';
import { loadCharacterTraits } from '../lib/api';
import {
  type CharacterComparisonData,
  type ComparisonSummary,
  type TraitComparison,
  type DNASimilarityResult,
  generateComparisonSummary,
  downloadComparisonExport,
  getSimilarityColor,
  getSimilarityLabel,
} from '../lib/characterComparison';

interface ComparisonModeProps {
  characters: Character[];
  selectedIds: string[];
  onClose: () => void;
  onRemoveCharacter: (id: string) => void;
}

// Character card in comparison view
function ComparisonCharacterCard({
  character,
  dna,
  onRemove,
}: {
  character: Character;
  dna: CharacterDNA | null;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col items-center p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 p-1 rounded-md text-slate-500 hover:text-red-400
                 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
      >
        <X size={12} />
      </button>

      {/* Thumbnail */}
      <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 mb-2">
        {character.primary_thumbnail_url ? (
          <img
            src={character.primary_thumbnail_url}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-700
                        text-slate-400 font-mono text-2xl uppercase">
            {character.name.charAt(0)}
          </div>
        )}
        {/* DNA indicator */}
        {dna && (
          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-slate-900 border border-slate-700">
            <Dna size={10} className="text-cyan-400" />
          </div>
        )}
      </div>

      {/* Name */}
      <span className="font-mono text-xs text-white truncate max-w-[100px]">
        {character.name}
      </span>

      {/* Quality score */}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[10px] text-slate-500">Quality:</span>
        <span className="text-[10px] font-mono text-cyan-400">
          {character.quality_score ? `${Math.round(character.quality_score * 100)}%` : '-'}
        </span>
      </div>

      {/* Status */}
      <div className={`px-2 py-0.5 rounded-full text-[9px] font-mono mt-1 ${
        character.status === 'ready'
          ? 'bg-green-500/20 text-green-400'
          : character.status === 'processing'
          ? 'bg-amber-500/20 text-amber-400'
          : 'bg-slate-500/20 text-slate-400'
      }`}>
        {character.status}
      </div>
    </div>
  );
}

// DNA Similarity display
function SimilarityMatrix({
  similarities,
  characters,
}: {
  similarities: DNASimilarityResult[];
  characters: CharacterComparisonData[];
}) {
  const getCharacterName = (id: string) =>
    characters.find((c) => c.character.id === id)?.character.name || 'Unknown';

  if (similarities.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500 text-xs">
        Select at least 2 characters to compare DNA
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {similarities.map((sim, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-lg"
        >
          {/* Character names */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-slate-300 truncate max-w-[80px]">
              {getCharacterName(sim.characterA)}
            </span>
            <ArrowLeftRight size={12} className="text-slate-500 flex-shrink-0" />
            <span className="text-xs text-slate-300 truncate max-w-[80px]">
              {getCharacterName(sim.characterB)}
            </span>
          </div>

          {/* Similarity scores */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[9px] text-slate-500">Face</div>
              <div
                className="text-xs font-mono"
                style={{ color: getSimilarityColor(sim.faceSimilarity) }}
              >
                {sim.faceSimilarity}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-slate-500">Style</div>
              <div
                className="text-xs font-mono"
                style={{ color: getSimilarityColor(sim.styleSimilarity) }}
              >
                {sim.styleSimilarity}%
              </div>
            </div>
            <div className="text-right border-l border-slate-700 pl-3">
              <div className="text-[9px] text-slate-500">Overall</div>
              <div
                className="text-sm font-mono font-bold"
                style={{ color: getSimilarityColor(sim.overallSimilarity) }}
              >
                {sim.overallSimilarity}%
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Trait comparison table
function TraitComparisonTable({
  comparisons,
  characters,
}: {
  comparisons: TraitComparison[];
  characters: CharacterComparisonData[];
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<TraitCategory>>(
    new Set(['facial', 'identity'])
  );

  const toggleCategory = (category: TraitCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const byCategory = useMemo(() => {
    const grouped = new Map<TraitCategory, TraitComparison[]>();
    for (const comp of comparisons) {
      if (!grouped.has(comp.category)) {
        grouped.set(comp.category, []);
      }
      grouped.get(comp.category)!.push(comp);
    }
    return grouped;
  }, [comparisons]);

  const getCharacterName = (id: string) =>
    characters.find((c) => c.character.id === id)?.character.name || 'Unknown';

  if (comparisons.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500 text-xs">
        No traits to compare
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {(['facial', 'style', 'pose', 'expression', 'identity'] as TraitCategory[]).map((category) => {
        const traits = byCategory.get(category) || [];
        if (traits.length === 0) return null;

        const info = TRAIT_CATEGORY_INFO[category];
        const differentCount = traits.filter((t) => t.isDifferent).length;
        const isExpanded = expandedCategories.has(category);

        return (
          <div key={category} className="border border-slate-700/50 rounded-lg overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/50
                       hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: info.color }}
                />
                <span className="text-xs font-mono text-slate-300">{info.label}</span>
                <span className="text-[10px] text-slate-500">({traits.length})</span>
                {differentCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-mono">
                    {differentCount} differ
                  </span>
                )}
              </div>
              {isExpanded ? (
                <ChevronDown size={14} className="text-slate-500" />
              ) : (
                <ChevronRight size={14} className="text-slate-500" />
              )}
            </button>

            {/* Traits */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="divide-y divide-slate-700/30">
                    {traits.map((trait) => (
                      <div
                        key={trait.traitName}
                        className={`px-3 py-2 ${trait.isDifferent ? 'bg-amber-500/5' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-400 font-mono uppercase">
                            {trait.traitName}
                          </span>
                          {trait.isDifferent ? (
                            <AlertTriangle size={10} className="text-amber-400" />
                          ) : (
                            <Check size={10} className="text-green-400" />
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {trait.values.map((v) => (
                            <div
                              key={v.characterId}
                              className={`px-2 py-1 rounded text-[10px] font-mono ${
                                trait.isDifferent
                                  ? 'bg-slate-700/50 border border-slate-600'
                                  : 'bg-green-500/10 border border-green-500/20'
                              }`}
                            >
                              <span className="text-slate-500 mr-1">
                                {getCharacterName(v.characterId).substring(0, 8)}:
                              </span>
                              <span className={trait.isDifferent ? 'text-amber-300' : 'text-green-300'}>
                                {v.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// Highlights section
function ComparisonHighlights({
  highlights,
}: {
  highlights: ComparisonSummary['highlights'];
}) {
  if (highlights.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'match':
        return <Check size={12} className="text-green-400" />;
      case 'difference':
        return <AlertTriangle size={12} className="text-amber-400" />;
      case 'warning':
        return <AlertTriangle size={12} className="text-red-400" />;
      default:
        return <Info size={12} className="text-cyan-400" />;
    }
  };

  const getBgClass = (type: string) => {
    switch (type) {
      case 'match':
        return 'bg-green-500/10 border-green-500/20';
      case 'difference':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'warning':
        return 'bg-red-500/10 border-red-500/20';
      default:
        return 'bg-cyan-500/10 border-cyan-500/20';
    }
  };

  return (
    <div className="space-y-2">
      {highlights.map((highlight, index) => (
        <div
          key={index}
          className={`flex items-start gap-2 p-2 rounded-lg border ${getBgClass(highlight.type)}`}
        >
          <div className="mt-0.5">{getIcon(highlight.type)}</div>
          <div>
            <p className="text-xs text-slate-200">{highlight.message}</p>
            {highlight.details && (
              <p className="text-[10px] text-slate-400 mt-0.5">{highlight.details}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Main comparison mode component
export function ComparisonMode({
  characters,
  selectedIds,
  onClose,
  onRemoveCharacter,
}: ComparisonModeProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState<CharacterComparisonData[]>([]);
  const [summary, setSummary] = useState<ComparisonSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'traits' | 'dna'>('overview');

  // Load DNA and traits for selected characters
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);

      const selectedCharacters = characters.filter((c) => selectedIds.includes(c.id));
      const data: CharacterComparisonData[] = [];

      for (const character of selectedCharacters) {
        let dna: CharacterDNA | null = null;
        let traits: CharacterTraits | null = null;

        if (character.status === 'ready') {
          try {
            dna = await getCharacterDNA(character.id);
            traits = loadCharacterTraits(character.id, dna);
          } catch (err) {
            console.error(`Failed to load data for ${character.name}:`, err);
          }
        }

        data.push({ character, dna, traits });
      }

      setComparisonData(data);
      setSummary(generateComparisonSummary(data));
      setIsLoading(false);
    };

    if (selectedIds.length > 0) {
      loadData();
    }
  }, [characters, selectedIds]);

  const handleExport = useCallback(() => {
    if (summary) {
      downloadComparisonExport(summary);
    }
  }, [summary]);

  const handleRefresh = useCallback(() => {
    // Trigger reload by updating state
    setIsLoading(true);
    setTimeout(() => {
      setSummary(generateComparisonSummary(comparisonData));
      setIsLoading(false);
    }, 500);
  }, [comparisonData]);

  if (selectedIds.length < 2) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
        <ArrowLeftRight size={48} className="mb-4 opacity-30" />
        <h3 className="font-mono text-sm mb-2">Comparison Mode</h3>
        <p className="text-xs text-center max-w-[200px]">
          Select 2-4 characters to compare their traits and DNA similarity
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <ArrowLeftRight size={16} className="text-cyan-400" />
          <h2 className="font-mono text-sm text-white">Character Comparison</h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-700 text-[10px] font-mono text-slate-300">
            {selectedIds.length} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700
                     transition-colors disabled:opacity-50"
            title="Refresh comparison"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExport}
            disabled={isLoading || !summary}
            className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10
                     transition-colors disabled:opacity-50"
            title="Export comparison"
          >
            <Download size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700
                     transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-xs font-mono">Loading comparison data...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Character cards */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-start justify-center gap-4 flex-wrap">
              {comparisonData.map((data) => (
                <div key={data.character.id} className="relative group">
                  <ComparisonCharacterCard
                    character={data.character}
                    dna={data.dna}
                    onRemove={() => onRemoveCharacter(data.character.id)}
                  />
                </div>
              ))}
            </div>

            {/* Overall consistency score */}
            {summary && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    Overall Consistency
                  </div>
                  <div
                    className="text-3xl font-mono font-bold"
                    style={{ color: getSimilarityColor(summary.overallConsistency) }}
                  >
                    {summary.overallConsistency}%
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {getSimilarityLabel(summary.overallConsistency)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5">
            {(['overview', 'traits', 'dna'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase transition-colors ${
                  activeTab === tab
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-500 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto ms-scrollbar p-4">
            {activeTab === 'overview' && summary && (
              <div className="space-y-4">
                {/* Highlights */}
                <div>
                  <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                    Key Findings
                  </h3>
                  <ComparisonHighlights highlights={summary.highlights} />
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                    <div className="text-2xl font-mono text-white">
                      {summary.traitComparisons.filter((t) => !t.isDifferent).length}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase">Matching Traits</div>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                    <div className="text-2xl font-mono text-amber-400">
                      {summary.traitComparisons.filter((t) => t.isDifferent).length}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase">Differing Traits</div>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                    <div className="text-2xl font-mono text-cyan-400">
                      {summary.dnaSimilarities.length > 0
                        ? Math.round(
                            summary.dnaSimilarities.reduce((s, d) => s + d.overallSimilarity, 0) /
                              summary.dnaSimilarities.length
                          )
                        : '-'}
                      {summary.dnaSimilarities.length > 0 && '%'}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase">Avg DNA Match</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'traits' && summary && (
              <TraitComparisonTable
                comparisons={summary.traitComparisons}
                characters={comparisonData}
              />
            )}

            {activeTab === 'dna' && summary && (
              <div className="space-y-4">
                <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  DNA Similarity Matrix
                </h3>
                <SimilarityMatrix
                  similarities={summary.dnaSimilarities}
                  characters={comparisonData}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
