/**
 * Consistency Calculator - Scoring logic and threshold management
 *
 * Calculates per-attribute consistency scores and manages configurable thresholds
 * for alert notifications when quality drops below acceptable levels.
 */

import type { ConsistencyMetrics, CharacterRefinementStats, Character } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface ThresholdConfig {
  faceConsistency: number;
  styleCoherence: number;
  poseVariety: number;
  qualityScore: number;
  refinementMaturity: number;
}

export interface ThresholdAlert {
  attribute: keyof ConsistencyMetrics;
  label: string;
  currentValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
}

export interface HistoricalDataPoint {
  timestamp: number;
  metrics: ConsistencyMetrics;
}

export interface ConsistencyTrend {
  attribute: keyof ConsistencyMetrics;
  trend: 'improving' | 'stable' | 'declining';
  changePercent: number;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  faceConsistency: 70,
  styleCoherence: 65,
  poseVariety: 40,
  qualityScore: 60,
  refinementMaturity: 30,
};

export const CRITICAL_THRESHOLD_OFFSET = 20; // Below threshold by this amount = critical

export const ATTRIBUTE_LABELS: Record<keyof ConsistencyMetrics, string> = {
  faceConsistency: 'Face Consistency',
  styleCoherence: 'Style Coherence',
  poseVariety: 'Pose Variety',
  qualityScore: 'Quality Score',
  refinementMaturity: 'Refinement Maturity',
};

export const ATTRIBUTE_COLORS: Record<keyof ConsistencyMetrics, string> = {
  faceConsistency: '#00d4ff',
  styleCoherence: '#ff6b9d',
  poseVariety: '#a855f7',
  qualityScore: '#00ff88',
  refinementMaturity: '#ffaa00',
};

// Storage key for threshold persistence
const THRESHOLDS_STORAGE_KEY = 'character-studio-thresholds';
const HISTORY_STORAGE_KEY_PREFIX = 'character-studio-history-';
const MAX_HISTORY_POINTS = 20;

// =============================================================================
// Threshold Management
// =============================================================================

export function loadThresholds(): ThresholdConfig {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLDS;

  const stored = localStorage.getItem(THRESHOLDS_STORAGE_KEY);
  if (!stored) return DEFAULT_THRESHOLDS;

  try {
    const parsed = JSON.parse(stored) as Partial<ThresholdConfig>;
    return { ...DEFAULT_THRESHOLDS, ...parsed };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export function saveThresholds(thresholds: ThresholdConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(thresholds));
}

export function resetThresholds(): ThresholdConfig {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(THRESHOLDS_STORAGE_KEY);
  }
  return DEFAULT_THRESHOLDS;
}

// =============================================================================
// Consistency Score Calculation
// =============================================================================

/**
 * Calculate consistency metrics from character and refinement stats
 */
export function calculateConsistencyMetrics(
  character: Character | null,
  refinementStats: CharacterRefinementStats | null
): ConsistencyMetrics | null {
  if (!character || !refinementStats) return null;

  // Face consistency: based on refinement score (how well the face is preserved)
  const faceConsistency = Math.min(100, Math.max(0,
    (refinementStats.refinement_score ?? 0.5) * 100
  ));

  // Style coherence: based on approval rate with minimum floor
  const approvalRate = refinementStats.approval_rate ?? 0.5;
  const styleCoherence = Math.min(100, Math.max(0,
    (approvalRate * 0.8 + 0.2) * 100
  ));

  // Pose variety: based on number of references (more refs = more pose variety)
  const poseVariety = Math.min(100, Math.max(0,
    (character.reference_count ?? 0) * 15
  ));

  // Quality score: direct from character
  const qualityScore = Math.min(100, Math.max(0,
    (character.quality_score ?? 0.5) * 100
  ));

  // Refinement maturity: based on refinement count (more refinements = more mature)
  const refinementMaturity = Math.min(100, Math.max(0,
    (refinementStats.refinement_count ?? 0) * 20
  ));

  return {
    faceConsistency,
    styleCoherence,
    poseVariety,
    qualityScore,
    refinementMaturity,
  };
}

/**
 * Calculate overall consistency score (weighted average)
 */
export function calculateOverallScore(metrics: ConsistencyMetrics): number {
  const weights = {
    faceConsistency: 0.3,
    styleCoherence: 0.25,
    poseVariety: 0.1,
    qualityScore: 0.25,
    refinementMaturity: 0.1,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const value = metrics[key as keyof ConsistencyMetrics];
    weightedSum += value * weight;
    totalWeight += weight;
  }

  return Math.round(weightedSum / totalWeight);
}

// =============================================================================
// Alert Detection
// =============================================================================

/**
 * Check metrics against thresholds and generate alerts
 */
export function detectThresholdAlerts(
  metrics: ConsistencyMetrics | null,
  thresholds: ThresholdConfig
): ThresholdAlert[] {
  if (!metrics) return [];

  const alerts: ThresholdAlert[] = [];

  for (const [key, threshold] of Object.entries(thresholds)) {
    const attribute = key as keyof ConsistencyMetrics;
    const currentValue = metrics[attribute];

    if (currentValue < threshold) {
      const severity = currentValue < threshold - CRITICAL_THRESHOLD_OFFSET
        ? 'critical'
        : 'warning';

      alerts.push({
        attribute,
        label: ATTRIBUTE_LABELS[attribute],
        currentValue: Math.round(currentValue),
        threshold,
        severity,
      });
    }
  }

  // Sort by severity (critical first) then by how far below threshold
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    return (a.currentValue - a.threshold) - (b.currentValue - b.threshold);
  });
}

/**
 * Get alert message for display
 */
export function getAlertMessage(alert: ThresholdAlert): string {
  const delta = Math.round(alert.threshold - alert.currentValue);
  if (alert.severity === 'critical') {
    return `${alert.label} critically low at ${alert.currentValue}% (${delta}% below threshold)`;
  }
  return `${alert.label} below threshold at ${alert.currentValue}% (needs ${delta}% more)`;
}

// =============================================================================
// Historical Data & Trends
// =============================================================================

/**
 * Load historical metrics data for a character
 */
export function loadHistory(characterId: string): HistoricalDataPoint[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(`${HISTORY_STORAGE_KEY_PREFIX}${characterId}`);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as HistoricalDataPoint[];
  } catch {
    return [];
  }
}

/**
 * Save metrics to history
 */
export function saveToHistory(characterId: string, metrics: ConsistencyMetrics): void {
  if (typeof window === 'undefined') return;

  const history = loadHistory(characterId);
  const newPoint: HistoricalDataPoint = {
    timestamp: Date.now(),
    metrics,
  };

  // Add new point and limit history size
  history.push(newPoint);
  const trimmedHistory = history.slice(-MAX_HISTORY_POINTS);

  localStorage.setItem(
    `${HISTORY_STORAGE_KEY_PREFIX}${characterId}`,
    JSON.stringify(trimmedHistory)
  );
}

/**
 * Clear history for a character
 */
export function clearHistory(characterId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${HISTORY_STORAGE_KEY_PREFIX}${characterId}`);
}

/**
 * Calculate trends from historical data
 */
export function calculateTrends(history: HistoricalDataPoint[]): ConsistencyTrend[] {
  if (history.length < 2) return [];

  const trends: ConsistencyTrend[] = [];
  const attributes: (keyof ConsistencyMetrics)[] = [
    'faceConsistency',
    'styleCoherence',
    'poseVariety',
    'qualityScore',
    'refinementMaturity',
  ];

  // Compare most recent with average of older entries
  const recent = history[history.length - 1].metrics;
  const olderEntries = history.slice(0, -1);

  for (const attribute of attributes) {
    const recentValue = recent[attribute];
    const avgOldValue = olderEntries.reduce(
      (sum, point) => sum + point.metrics[attribute],
      0
    ) / olderEntries.length;

    const changePercent = avgOldValue > 0
      ? ((recentValue - avgOldValue) / avgOldValue) * 100
      : 0;

    let trend: 'improving' | 'stable' | 'declining';
    if (changePercent > 5) {
      trend = 'improving';
    } else if (changePercent < -5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    trends.push({
      attribute,
      trend,
      changePercent: Math.round(changePercent),
    });
  }

  return trends;
}

/**
 * Get trend indicator for display
 */
export function getTrendIndicator(trend: ConsistencyTrend['trend']): { icon: string; color: string } {
  switch (trend) {
    case 'improving':
      return { icon: '↑', color: '#00ff88' };
    case 'declining':
      return { icon: '↓', color: '#ff6b6b' };
    default:
      return { icon: '→', color: '#94a3b8' };
  }
}
