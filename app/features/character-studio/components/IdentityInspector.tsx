'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dna,
  RefreshCw,
  ImagePlus,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import type { Character, CharacterDNA, CharacterRefinementStats, ConsistencyMetrics, CharacterTraits } from '../types';
import {
  getCharacterDNA,
  getRefinementStats,
  loadCharacterTraits,
  updateCharacterTrait,
  revertCharacterTrait,
} from '../lib/api';
import {
  type ThresholdConfig,
  type ThresholdAlert,
  loadThresholds,
  calculateConsistencyMetrics,
  getAlertMessage,
} from '../lib/consistencyCalculator';
import { DNAHelix } from './DNAHelix';
import { ConsistencyRadar } from './ConsistencyRadar';
import { ThresholdConfig as ThresholdConfigModal } from './ThresholdConfig';
import { TraitBreakdown } from './TraitBreakdown';
import { Toast, useToast } from '@/app/components/ui/Toast';

interface IdentityInspectorProps {
  character: Character | null;
  isCollapsed: boolean;
  onRefine: () => void;
  onAddReferences: () => void;
}

export function IdentityInspector({
  character,
  isCollapsed,
  onRefine,
  onAddReferences,
}: IdentityInspectorProps) {
  const [dna, setDna] = useState<CharacterDNA | null>(null);
  const [refinementStats, setRefinementStats] = useState<CharacterRefinementStats | null>(null);
  const [traits, setTraits] = useState<CharacterTraits | null>(null);
  const [isLoadingDna, setIsLoadingDna] = useState(false);
  const [isLoadingTraits, setIsLoadingTraits] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'dna' | 'radar' | 'traits' | 'stats' | null>('dna');
  const [thresholds, setThresholds] = useState<ThresholdConfig>(loadThresholds);
  const [isThresholdConfigOpen, setIsThresholdConfigOpen] = useState(false);

  // Toast for threshold alerts
  const { showToast, toastProps } = useToast(4000);

  // Track previous alerts to avoid repeated notifications
  const previousAlertsRef = useRef<Set<string>>(new Set());

  // Load DNA and stats when character changes
  useEffect(() => {
    if (!character || character.status !== 'ready') {
      setDna(null);
      setRefinementStats(null);
      setTraits(null);
      previousAlertsRef.current.clear();
      return;
    }

    const loadData = async () => {
      setIsLoadingDna(true);
      setIsLoadingTraits(true);
      try {
        const [dnaData, statsData] = await Promise.all([
          getCharacterDNA(character.id),
          getRefinementStats(character.id),
        ]);
        setDna(dnaData);
        setRefinementStats(statsData);

        // Load traits after DNA is available
        const traitsData = loadCharacterTraits(character.id, dnaData);
        setTraits(traitsData);
      } catch (err) {
        console.error('Failed to load character data:', err);
      } finally {
        setIsLoadingDna(false);
        setIsLoadingTraits(false);
      }
    };

    loadData();
  }, [character?.id, character?.status]);

  // Calculate consistency metrics using the calculator
  const consistencyMetrics = calculateConsistencyMetrics(character, refinementStats);

  // Handle threshold alerts
  const handleAlerts = useCallback((alerts: ThresholdAlert[]) => {
    // Find new alerts that weren't shown before
    const newAlerts = alerts.filter(
      (alert) => !previousAlertsRef.current.has(alert.attribute)
    );

    if (newAlerts.length > 0) {
      // Show toast for the most critical new alert
      const mostCritical = newAlerts[0];
      showToast(getAlertMessage(mostCritical), 'warning');

      // Track all current alerts
      previousAlertsRef.current = new Set(alerts.map((a) => a.attribute));
    }
  }, [showToast]);

  // Handle threshold changes from config modal
  const handleThresholdsChange = useCallback((newThresholds: ThresholdConfig) => {
    setThresholds(newThresholds);
    // Reset alert tracking when thresholds change
    previousAlertsRef.current.clear();
  }, []);

  // Handle trait update
  const handleTraitUpdate = useCallback(async (traitId: string, value: string, weight: number) => {
    if (!traits) return;

    const updatedTraits = updateCharacterTrait(traits, traitId, value, weight);
    setTraits(updatedTraits);
    showToast('Trait updated successfully', 'success');
  }, [traits, showToast]);

  // Handle trait revert
  const handleTraitRevert = useCallback(async (traitId: string, historyEntryId: string) => {
    if (!traits) return;

    const revertedTraits = revertCharacterTrait(traits, traitId, historyEntryId);
    setTraits(revertedTraits);
    showToast('Trait reverted to previous value', 'info');
  }, [traits, showToast]);

  // Handle regenerate with edits
  const handleRegenerateWithEdits = useCallback(() => {
    // This would trigger a new generation with the edited traits
    // For now, we'll just show a toast
    showToast('Regeneration with trait edits would start here', 'info');
    // In a real implementation, this would:
    // 1. Build modified prompt parameters from edited traits
    // 2. Trigger a new generation job with those parameters
  }, [showToast]);

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="flex-1 flex flex-col items-center py-4 gap-4">
        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400" title="DNA">
          <Dna size={16} />
        </div>
        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400" title="Stats">
          <TrendingUp size={16} />
        </div>
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400" title="Traits">
          <Layers size={16} />
        </div>
        <button
          onClick={onRefine}
          disabled={!character || character.status !== 'ready'}
          className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Refine DNA"
        >
          <RefreshCw size={16} />
        </button>
        <button
          onClick={onAddReferences}
          disabled={!character}
          className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Add References"
        >
          <ImagePlus size={16} />
        </button>
      </div>
    );
  }

  // No character selected
  if (!character) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500">
        <Dna size={32} className="mb-3 opacity-50" />
        <span className="font-mono text-xs uppercase">No character selected</span>
      </div>
    );
  }

  // Character not ready
  if (character.status !== 'ready') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500">
        <Loader2 size={32} className="mb-3 animate-spin" />
        <span className="font-mono text-xs uppercase">
          {character.status === 'processing' ? 'Extracting DNA...' : character.status}
        </span>
      </div>
    );
  }

  const Section = ({
    id,
    title,
    icon: Icon,
    children,
    badge,
  }: {
    id: 'dna' | 'radar' | 'traits' | 'stats';
    title: string;
    icon: typeof Dna;
    children: React.ReactNode;
    badge?: React.ReactNode;
  }) => {
    const isExpanded = expandedSection === id;

    return (
      <div className="border-b border-white/5">
        <button
          onClick={() => setExpandedSection(isExpanded ? null : id)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02]
                   transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon size={14} className="text-slate-500" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              {title}
            </span>
            {badge}
          </div>
          {isExpanded ? (
            <ChevronUp size={14} className="text-slate-500" />
          ) : (
            <ChevronDown size={14} className="text-slate-500" />
          )}
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const traitEditCount = traits?.traits.filter((t) => t.source === 'user').length ?? 0;

  return (
    <>
      <div className="flex-1 flex flex-col overflow-auto ms-scrollbar">
        {/* Character header */}
        <div className="p-4 border-b border-white/5">
          <h3 className="font-mono text-sm text-white">{character.name}</h3>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-mono">
            <span>v{dna?.version || '?'}</span>
            <span>{refinementStats?.generation_count || 0} generations</span>
          </div>
        </div>

        {/* DNA Helix Section */}
        <Section id="dna" title="Character DNA" icon={Dna}>
          <div className="flex justify-center py-2">
            {isLoadingDna ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-mono">Loading DNA...</span>
              </div>
            ) : (
              <DNAHelix dna={dna} size="md" />
            )}
          </div>
        </Section>

        {/* Trait Breakdown Section */}
        <Section
          id="traits"
          title="Trait Breakdown"
          icon={Layers}
          badge={
            traitEditCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[8px] font-mono">
                {traitEditCount} edited
              </span>
            ) : null
          }
        >
          <TraitBreakdown
            traits={traits}
            isLoading={isLoadingTraits}
            onTraitUpdate={handleTraitUpdate}
            onTraitRevert={handleTraitRevert}
            onRegenerateWithEdits={handleRegenerateWithEdits}
            disabled={false}
          />
        </Section>

        {/* Consistency Radar Section */}
        <Section id="radar" title="Consistency Radar" icon={TrendingUp}>
          <div className="flex justify-center py-2">
            <ConsistencyRadar
              metrics={consistencyMetrics}
              characterId={character.id}
              size={180}
              thresholds={thresholds}
              showAlerts={true}
              showTrends={true}
              onConfigClick={() => setIsThresholdConfigOpen(true)}
              onAlert={handleAlerts}
            />
          </div>
        </Section>

        {/* Stats Section */}
        <Section id="stats" title="Refinement Stats" icon={RefreshCw}>
          <div className="space-y-3">
            {/* Approval rate */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Approval Rate</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <ThumbsUp size={12} className="text-green-400" />
                  <span className="font-mono text-xs text-green-400">
                    {refinementStats?.approved_count || 0}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <ThumbsDown size={12} className="text-red-400" />
                  <span className="font-mono text-xs text-red-400">
                    {refinementStats?.rejected_count || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-cyan-500 transition-all"
                style={{
                  width: `${(refinementStats?.approval_rate || 0) * 100}%`,
                }}
              />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="p-2 bg-slate-900/50 rounded-lg">
                <span className="text-[10px] text-slate-500 font-mono uppercase">DNA Version</span>
                <div className="font-mono text-lg text-white">
                  {refinementStats?.dna_version || 1}
                </div>
              </div>
              <div className="p-2 bg-slate-900/50 rounded-lg">
                <span className="text-[10px] text-slate-500 font-mono uppercase">Refinements</span>
                <div className="font-mono text-lg text-white">
                  {refinementStats?.refinement_count || 0}
                </div>
              </div>
              <div className="p-2 bg-slate-900/50 rounded-lg">
                <span className="text-[10px] text-slate-500 font-mono uppercase">References</span>
                <div className="font-mono text-lg text-white">{character.reference_count}</div>
              </div>
              <div className="p-2 bg-slate-900/50 rounded-lg">
                <span className="text-[10px] text-slate-500 font-mono uppercase">Quality</span>
                <div className="font-mono text-lg text-white">
                  {character.quality_score ? `${Math.round(character.quality_score * 100)}%` : '-'}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Action buttons */}
        <div className="p-4 space-y-2 mt-auto border-t border-white/5">
          <button
            onClick={onRefine}
            disabled={!refinementStats || refinementStats.approved_count === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                     bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30
                     font-mono text-xs uppercase tracking-wider transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} />
            refine dna
          </button>
          <button
            onClick={onAddReferences}
            disabled={character.reference_count >= 12}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                     border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white
                     font-mono text-xs uppercase tracking-wider transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ImagePlus size={14} />
            add references ({character.reference_count}/12)
          </button>
        </div>
      </div>

      {/* Threshold Configuration Modal */}
      <ThresholdConfigModal
        isOpen={isThresholdConfigOpen}
        onClose={() => setIsThresholdConfigOpen(false)}
        thresholds={thresholds}
        onThresholdsChange={handleThresholdsChange}
        currentMetrics={consistencyMetrics}
      />

      {/* Toast for alerts */}
      <Toast {...toastProps} position="top" data-testid="consistency-alert-toast" />
    </>
  );
}
