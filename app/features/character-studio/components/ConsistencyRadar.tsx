'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Settings2 } from 'lucide-react';
import type { ConsistencyMetrics } from '../types';
import {
  type ThresholdConfig,
  type ThresholdAlert,
  type HistoricalDataPoint,
  type ConsistencyTrend,
  DEFAULT_THRESHOLDS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_COLORS,
  detectThresholdAlerts,
  loadHistory,
  saveToHistory,
  calculateTrends,
  getTrendIndicator,
  loadThresholds,
} from '../lib/consistencyCalculator';

interface ConsistencyRadarProps {
  metrics: ConsistencyMetrics | null;
  characterId?: string;
  size?: number;
  thresholds?: ThresholdConfig;
  showAlerts?: boolean;
  showTrends?: boolean;
  onConfigClick?: () => void;
  onAlert?: (alerts: ThresholdAlert[]) => void;
}

interface RadarPoint {
  key: keyof ConsistencyMetrics;
  label: string;
  shortLabel: string;
  value: number;
  color: string;
  threshold: number;
}

export function ConsistencyRadar({
  metrics,
  characterId,
  size = 160,
  thresholds: externalThresholds,
  showAlerts = true,
  showTrends = true,
  onConfigClick,
  onAlert,
}: ConsistencyRadarProps) {
  const [history, setHistory] = useState<HistoricalDataPoint[]>([]);
  const [trends, setTrends] = useState<ConsistencyTrend[]>([]);
  const [alerts, setAlerts] = useState<ThresholdAlert[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<keyof ConsistencyMetrics | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdConfig>(
    externalThresholds ?? DEFAULT_THRESHOLDS
  );

  // Load thresholds on mount
  useEffect(() => {
    if (!externalThresholds) {
      setThresholds(loadThresholds());
    }
  }, [externalThresholds]);

  // Update thresholds when external prop changes
  useEffect(() => {
    if (externalThresholds) {
      setThresholds(externalThresholds);
    }
  }, [externalThresholds]);

  // Load history and save new metrics
  useEffect(() => {
    if (characterId && metrics) {
      const existingHistory = loadHistory(characterId);
      setHistory(existingHistory);

      // Save current metrics to history (debounced by checking last entry)
      const lastEntry = existingHistory[existingHistory.length - 1];
      const shouldSave = !lastEntry ||
        Date.now() - lastEntry.timestamp > 60000 || // At least 1 minute apart
        JSON.stringify(lastEntry.metrics) !== JSON.stringify(metrics);

      if (shouldSave) {
        saveToHistory(characterId, metrics);
        setHistory([...existingHistory.slice(-19), { timestamp: Date.now(), metrics }]);
      }
    }
  }, [characterId, metrics]);

  // Calculate trends from history
  useEffect(() => {
    if (history.length >= 2) {
      setTrends(calculateTrends(history));
    } else {
      setTrends([]);
    }
  }, [history]);

  // Detect threshold alerts
  useEffect(() => {
    const newAlerts = detectThresholdAlerts(metrics, thresholds);
    setAlerts(newAlerts);

    if (onAlert && newAlerts.length > 0) {
      onAlert(newAlerts);
    }
  }, [metrics, thresholds, onAlert]);

  const points: RadarPoint[] = useMemo(() => {
    const attributes: (keyof ConsistencyMetrics)[] = [
      'faceConsistency',
      'styleCoherence',
      'poseVariety',
      'qualityScore',
      'refinementMaturity',
    ];

    return attributes.map((key) => ({
      key,
      label: ATTRIBUTE_LABELS[key],
      shortLabel: ATTRIBUTE_LABELS[key].split(' ')[0],
      value: metrics?.[key] ?? 0,
      color: ATTRIBUTE_COLORS[key],
      threshold: thresholds[key],
    }));
  }, [metrics, thresholds]);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size / 2) - 30;

  const getPointCoords = useCallback((index: number, value: number) => {
    const angle = (index / points.length) * Math.PI * 2 - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
    };
  }, [points.length, radius, centerX, centerY]);

  const getLabelCoords = useCallback((index: number) => {
    const angle = (index / points.length) * Math.PI * 2 - Math.PI / 2;
    const r = radius + 18;
    return {
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
    };
  }, [points.length, radius, centerX, centerY]);

  // Create polygon paths
  const dataPolygonPoints = points
    .map((point, i) => {
      const coords = getPointCoords(i, point.value);
      return `${coords.x},${coords.y}`;
    })
    .join(' ');

  const thresholdPolygonPoints = points
    .map((point, i) => {
      const coords = getPointCoords(i, point.threshold);
      return `${coords.x},${coords.y}`;
    })
    .join(' ');

  // Create historical trend line (average of past values)
  const trendPolygonPoints = useMemo(() => {
    if (history.length < 2) return null;

    const avgMetrics = history.slice(0, -1).reduce((acc, point) => {
      for (const key of Object.keys(point.metrics) as (keyof ConsistencyMetrics)[]) {
        acc[key] = (acc[key] || 0) + point.metrics[key];
      }
      return acc;
    }, {} as Record<keyof ConsistencyMetrics, number>);

    const count = history.length - 1;
    for (const key of Object.keys(avgMetrics) as (keyof ConsistencyMetrics)[]) {
      avgMetrics[key] /= count;
    }

    return points
      .map((point, i) => {
        const coords = getPointCoords(i, avgMetrics[point.key] || 0);
        return `${coords.x},${coords.y}`;
      })
      .join(' ');
  }, [history, points, getPointCoords]);

  const rings = [25, 50, 75, 100];

  const getTrendForAttribute = (attr: keyof ConsistencyMetrics): ConsistencyTrend | undefined => {
    return trends.find((t) => t.attribute === attr);
  };

  return (
    <div className="relative flex flex-col items-center gap-3">
      {/* Config button */}
      {onConfigClick && (
        <button
          onClick={onConfigClick}
          className="absolute top-0 right-0 p-1.5 rounded-md bg-slate-800/50 hover:bg-slate-700/50
                   text-slate-500 hover:text-slate-300 transition-colors"
          title="Configure thresholds"
        >
          <Settings2 size={12} />
        </button>
      )}

      {/* Radar SVG */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          {/* Background grid rings */}
          {rings.map((ring) => {
            const r = (ring / 100) * radius;
            return (
              <circle
                key={ring}
                cx={centerX}
                cy={centerY}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
            );
          })}

          {/* Axis lines */}
          {points.map((_, i) => {
            const coords = getPointCoords(i, 100);
            return (
              <line
                key={i}
                x1={centerX}
                y1={centerY}
                x2={coords.x}
                y2={coords.y}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={1}
              />
            );
          })}

          {/* Gradients */}
          <defs>
            <linearGradient id="radar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ff6b9d" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="threshold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffaa00" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ff6b6b" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Threshold polygon (warning zone) */}
          <polygon
            points={thresholdPolygonPoints}
            fill="none"
            stroke="rgba(255,170,0,0.4)"
            strokeWidth={1}
            strokeDasharray="4 2"
          />

          {/* Historical trend line */}
          {showTrends && trendPolygonPoints && (
            <polygon
              points={trendPolygonPoints}
              fill="none"
              stroke="rgba(100,100,255,0.3)"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            />
          )}

          {metrics && (
            <>
              {/* Filled data area */}
              <polygon
                points={dataPolygonPoints}
                fill="url(#radar-gradient)"
                stroke="rgba(168,85,247,0.5)"
                strokeWidth={2}
              />

              {/* Data points */}
              {points.map((point, i) => {
                const coords = getPointCoords(i, point.value);
                const isHovered = hoveredPoint === point.key;
                const isBelowThreshold = point.value < point.threshold;

                return (
                  <g key={i}>
                    {/* Threshold warning indicator */}
                    {isBelowThreshold && (
                      <circle
                        cx={coords.x}
                        cy={coords.y}
                        r={isHovered ? 10 : 8}
                        fill="rgba(255,107,107,0.2)"
                        stroke="rgba(255,107,107,0.5)"
                        strokeWidth={1}
                        className="transition-all duration-200"
                      />
                    )}

                    {/* Main data point */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={isHovered ? 6 : 4}
                      fill={isBelowThreshold ? '#ff6b6b' : point.color}
                      stroke="#0a0a0f"
                      strokeWidth={2}
                      style={{
                        filter: `drop-shadow(0 0 4px ${isBelowThreshold ? '#ff6b6b' : point.color})`,
                        cursor: 'pointer',
                      }}
                      className="transition-all duration-200"
                      onMouseEnter={() => setHoveredPoint(point.key)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* Labels */}
          {points.map((point, i) => {
            const coords = getLabelCoords(i);
            const trend = getTrendForAttribute(point.key);
            const trendIndicator = trend ? getTrendIndicator(trend.trend) : null;
            const isBelowThreshold = point.value < point.threshold;

            return (
              <g key={i}>
                <text
                  x={coords.x}
                  y={coords.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`font-mono text-[9px] uppercase ${
                    isBelowThreshold ? 'fill-amber-500' : 'fill-slate-500'
                  }`}
                >
                  {point.shortLabel}
                </text>
                {metrics && (
                  <text
                    x={coords.x}
                    y={coords.y + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-mono text-[8px]"
                    fill={isBelowThreshold ? '#ff6b6b' : point.color}
                  >
                    {Math.round(point.value)}%
                    {showTrends && trendIndicator && (
                      <tspan fill={trendIndicator.color}> {trendIndicator.icon}</tspan>
                    )}
                  </text>
                )}
              </g>
            );
          })}

          {/* Center label if no metrics */}
          {!metrics && (
            <text
              x={centerX}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-mono text-[10px] uppercase fill-slate-600"
            >
              no data
            </text>
          )}
        </svg>
      </div>

      {/* Alert badges */}
      {showAlerts && alerts.length > 0 && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-wrap gap-1 justify-center max-w-[200px]"
          >
            {alerts.slice(0, 3).map((alert) => (
              <motion.div
                key={alert.attribute}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono
                          ${alert.severity === 'critical'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
              >
                <AlertTriangle size={10} />
                <span>{alert.label.split(' ')[0]}</span>
                <span>{alert.currentValue}%</span>
              </motion.div>
            ))}
            {alerts.length > 3 && (
              <div className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 text-[9px] font-mono">
                +{alerts.length - 3} more
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Legend */}
      {showTrends && trends.length > 0 && (
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500">
          <div className="flex items-center gap-1">
            <TrendingUp size={10} className="text-green-400" />
            <span>Improving</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus size={10} className="text-slate-400" />
            <span>Stable</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown size={10} className="text-red-400" />
            <span>Declining</span>
          </div>
        </div>
      )}

      {/* Hovered point tooltip */}
      <AnimatePresence>
        {hoveredPoint && metrics && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full
                     bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg
                     z-10 min-w-[140px]"
          >
            <div className="text-[10px] font-mono text-slate-300 mb-1">
              {ATTRIBUTE_LABELS[hoveredPoint]}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-[9px] text-slate-500">Current</span>
                <div
                  className="text-sm font-mono"
                  style={{ color: ATTRIBUTE_COLORS[hoveredPoint] }}
                >
                  {Math.round(metrics[hoveredPoint])}%
                </div>
              </div>
              <div>
                <span className="text-[9px] text-slate-500">Threshold</span>
                <div className="text-sm font-mono text-amber-400">
                  {thresholds[hoveredPoint]}%
                </div>
              </div>
            </div>
            {getTrendForAttribute(hoveredPoint) && (
              <div className="mt-1 pt-1 border-t border-slate-700">
                <span className="text-[9px] text-slate-500">Trend: </span>
                <span
                  className="text-[9px] font-mono"
                  style={{ color: getTrendIndicator(getTrendForAttribute(hoveredPoint)!.trend).color }}
                >
                  {getTrendForAttribute(hoveredPoint)!.trend} ({getTrendForAttribute(hoveredPoint)!.changePercent}%)
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
