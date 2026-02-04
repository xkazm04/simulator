/**
 * FeedbackAnalytics - Dashboard showing feedback patterns and trends
 *
 * Displays analytics about user feedback including:
 * - Overall statistics
 * - Daily trend chart
 * - Top patterns and preferences
 * - Elements to avoid
 * - Scene type performance
 *
 * Design: Clean Manuscript style with semantic colors
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ThumbsUp,
  AlertTriangle,
  Star,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  XCircle,
} from 'lucide-react';
import { FeedbackAnalytics as FeedbackAnalyticsType, UserPreference, PromptPattern } from '../types';
import { semanticColors } from '../lib/semanticColors';
import { expandCollapse, transitions } from '../lib/motion';
import {
  generateFeedbackAnalytics,
  clearAllLearning,
  exportPreferences,
  importPreferences,
  removePreference,
} from '../lib/preferenceEngine';

interface FeedbackAnalyticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackAnalyticsPanel({
  isOpen,
  onClose,
}: FeedbackAnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<FeedbackAnalyticsType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await generateFeedbackAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on open
  useEffect(() => {
    if (isOpen) {
      loadAnalytics();
    }
  }, [isOpen, loadAnalytics]);

  // Handle export
  const handleExport = useCallback(async () => {
    try {
      const data = await exportPreferences();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simulator-preferences-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export:', err);
    }
  }, []);

  // Handle import
  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          await importPreferences(text);
          await loadAnalytics();
        } catch (err) {
          console.error('Failed to import:', err);
          setError('Failed to import preferences');
        }
      }
    };
    input.click();
  }, [loadAnalytics]);

  // Handle clear all
  const handleClearAll = useCallback(async () => {
    setIsClearing(true);
    try {
      await clearAllLearning();
      await loadAnalytics();
      setShowClearConfirm(false);
    } catch (err) {
      console.error('Failed to clear:', err);
    } finally {
      setIsClearing(false);
    }
  }, [loadAnalytics]);

  // Handle remove preference
  const handleRemovePreference = useCallback(
    async (prefId: string) => {
      try {
        await removePreference(prefId);
        await loadAnalytics();
      } catch (err) {
        console.error('Failed to remove preference:', err);
      }
    },
    [loadAnalytics]
  );

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-3xl max-h-[80vh] overflow-y-auto bg-slate-900 border border-slate-700/50 radius-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-slate-900/95 border-b border-slate-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-purple-400" />
            <h2 className="type-heading-sm text-white">Learning Analytics</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAnalytics}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 radius-sm"
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 radius-sm"
              title="Close"
            >
              <XCircle size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-purple-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="type-body">Loading analytics...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div
              className={`p-3 radius-md ${semanticColors.error.bg} ${semanticColors.error.border} border`}
            >
              <span className={semanticColors.error.text}>{error}</span>
            </div>
          )}

          {/* Analytics content */}
          {!isLoading && analytics && (
            <>
              {/* Overview stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Total Feedback"
                  value={analytics.totalFeedbackCollected}
                  icon={<BarChart3 size={16} />}
                />
                <StatCard
                  label="Positive Rate"
                  value={`${Math.round(analytics.positiveRate * 100)}%`}
                  icon={<ThumbsUp size={16} />}
                  color="green"
                />
                <StatCard
                  label="Patterns Learned"
                  value={analytics.topPatterns.length}
                  icon={<Star size={16} />}
                  color="purple"
                />
                <StatCard
                  label="Preferences"
                  value={analytics.topPreferences.length}
                  icon={<TrendingUp size={16} />}
                  color="cyan"
                />
              </div>

              {/* Daily trend */}
              {analytics.dailyTrend.length > 0 && (
                <Section title="7-Day Trend" icon={<TrendingUp size={14} />}>
                  <div className="h-24 flex items-end gap-1">
                    {analytics.dailyTrend.map((day, i) => {
                      const maxTotal = Math.max(
                        ...analytics.dailyTrend.map((d) => d.total),
                        1
                      );
                      const height = (day.total / maxTotal) * 100;
                      const positiveHeight =
                        day.total > 0 ? (day.positive / day.total) * height : 0;

                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col justify-end gap-0.5"
                          title={`${day.date}: ${day.positive} positive, ${day.negative} negative`}
                        >
                          <div
                            className="bg-green-500/30 radius-t-sm transition-all"
                            style={{ height: `${positiveHeight}%` }}
                          />
                          <div
                            className="bg-red-500/30 radius-b-sm transition-all"
                            style={{ height: `${height - positiveHeight}%` }}
                          />
                          <span className="type-label text-slate-600 text-center">
                            {day.date.split('-')[2]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Top preferences */}
              {analytics.topPreferences.length > 0 && (
                <Section title="Your Preferences" icon={<Star size={14} />}>
                  <div className="space-y-2">
                    {analytics.topPreferences.map((pref) => (
                      <PreferenceItem
                        key={pref.id}
                        preference={pref}
                        onRemove={() => handleRemovePreference(pref.id)}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Elements to avoid */}
              {analytics.elementsToAvoid.length > 0 && (
                <Section title="Elements to Avoid" icon={<AlertTriangle size={14} />}>
                  <div className="flex flex-wrap gap-2">
                    {analytics.elementsToAvoid.map((elem) => (
                      <span
                        key={elem.text}
                        className={`px-2 py-1 radius-sm type-label ${semanticColors.error.bg} ${semanticColors.error.border} ${semanticColors.error.text} border`}
                      >
                        {elem.text} ({elem.count})
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Top patterns */}
              {analytics.topPatterns.length > 0 && (
                <Section title="Learned Patterns" icon={<TrendingUp size={14} />}>
                  <div className="space-y-2">
                    {analytics.topPatterns.map((pattern) => (
                      <PatternItem key={pattern.id} pattern={pattern} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Scene type performance */}
              {analytics.sceneTypePerformance.length > 0 && (
                <Section title="Scene Performance" icon={<BarChart3 size={14} />}>
                  <div className="space-y-2">
                    {analytics.sceneTypePerformance.map((scene) => (
                      <div
                        key={scene.sceneType}
                        className="flex items-center gap-3 p-2 radius-sm bg-slate-800/30"
                      >
                        <span className="type-label text-slate-300 flex-1">
                          {scene.sceneType}
                        </span>
                        <div className="w-24 h-2 bg-slate-700/50 radius-full overflow-hidden">
                          <div
                            className="h-full bg-green-500/50"
                            style={{ width: `${scene.positiveRate * 100}%` }}
                          />
                        </div>
                        <span className="type-label text-slate-500 w-12 text-right">
                          {Math.round(scene.positiveRate * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Empty state */}
              {analytics.totalFeedbackCollected === 0 && (
                <div className="py-8 text-center">
                  <BarChart3 size={32} className="text-slate-600 mx-auto mb-3" />
                  <p className="type-body text-slate-400 mb-2">
                    No feedback data yet
                  </p>
                  <p className="type-body-sm text-slate-500">
                    Rate prompts to start building your preference profile.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 flex items-center justify-between px-4 py-3 bg-slate-900/95 border-t border-slate-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 radius-md type-label text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 px-3 py-1.5 radius-md type-label text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50"
            >
              <Upload size={14} />
              Import
            </button>
          </div>

          {/* Clear all */}
          <div className="relative">
            {showClearConfirm ? (
              <div className="flex items-center gap-2">
                <span className="type-label text-red-400">Clear all data?</span>
                <button
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className={`px-3 py-1.5 radius-md type-label ${semanticColors.error.bg} ${semanticColors.error.text} hover:bg-red-500/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50`}
                >
                  {isClearing ? 'Clearing...' : 'Yes, clear'}
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 radius-md type-label text-slate-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 radius-md type-label text-red-400 hover:bg-red-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
              >
                <Trash2 size={14} />
                Clear All
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Helper components

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: 'green' | 'red' | 'purple' | 'cyan' | 'amber';
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  const colorClasses = {
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  };

  const classes = color ? colorClasses[color] : 'text-slate-400 bg-slate-800/30 border-slate-700/30';

  return (
    <div className={`p-3 radius-md border ${classes}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="type-label opacity-70">{label}</span>
      </div>
      <span className="type-heading-sm">{value}</span>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-1 text-slate-300 hover:text-white transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="type-label">{title}</span>
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
            variants={expandCollapse}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.fast}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PreferenceItemProps {
  preference: UserPreference;
  onRemove: () => void;
}

function PreferenceItem({ preference, onRemove }: PreferenceItemProps) {
  return (
    <div className="flex items-center gap-3 p-2 radius-sm bg-slate-800/30 group">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="type-label text-slate-300">{preference.value}</span>
          <span className="type-label text-slate-600 capitalize">
            ({preference.category})
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-20 h-1.5 bg-slate-700/50 radius-full overflow-hidden">
            <div
              className="h-full bg-cyan-500/50"
              style={{ width: `${preference.strength}%` }}
            />
          </div>
          <span className="type-label text-slate-500">
            {preference.strength}% strength
          </span>
          <span className="type-label text-slate-600">
            ({preference.reinforcements} reinforcements)
          </span>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 radius-sm"
        title="Remove preference"
      >
        <XCircle size={14} />
      </button>
    </div>
  );
}

interface PatternItemProps {
  pattern: PromptPattern;
}

function PatternItem({ pattern }: PatternItemProps) {
  const [, value] = pattern.value.split(':');
  const total = pattern.successCount + pattern.failureCount;
  const isPositive = pattern.confidence > 0.5;

  return (
    <div className="flex items-center gap-3 p-2 radius-sm bg-slate-800/30">
      <div
        className={`p-1.5 radius-sm ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}
      >
        {isPositive ? (
          <TrendingUp size={14} className="text-green-400" />
        ) : (
          <TrendingDown size={14} className="text-red-400" />
        )}
      </div>
      <div className="flex-1">
        <span className="type-label text-slate-300">{value || pattern.value}</span>
        <div className="flex items-center gap-2 mt-1">
          <span className="type-label text-slate-500">
            {Math.round(pattern.confidence * 100)}% confidence
          </span>
          <span className="type-label text-slate-600">
            ({pattern.successCount}/{total} positive)
          </span>
        </div>
      </div>
    </div>
  );
}

export default FeedbackAnalyticsPanel;
