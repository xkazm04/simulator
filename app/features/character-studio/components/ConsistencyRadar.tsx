'use client';

import { useMemo } from 'react';
import type { ConsistencyMetrics } from '../types';

interface ConsistencyRadarProps {
  metrics: ConsistencyMetrics | null;
  size?: number;
}

interface RadarPoint {
  label: string;
  shortLabel: string;
  value: number;
  color: string;
}

export function ConsistencyRadar({ metrics, size = 160 }: ConsistencyRadarProps) {
  const points: RadarPoint[] = useMemo(() => {
    if (!metrics) {
      return [
        { label: 'Face Consistency', shortLabel: 'Face', value: 0, color: '#00d4ff' },
        { label: 'Style Coherence', shortLabel: 'Style', value: 0, color: '#ff6b9d' },
        { label: 'Pose Variety', shortLabel: 'Pose', value: 0, color: '#a855f7' },
        { label: 'Quality Score', shortLabel: 'Quality', value: 0, color: '#00ff88' },
        { label: 'Refinement', shortLabel: 'Refine', value: 0, color: '#ffaa00' },
      ];
    }

    return [
      { label: 'Face Consistency', shortLabel: 'Face', value: metrics.faceConsistency, color: '#00d4ff' },
      { label: 'Style Coherence', shortLabel: 'Style', value: metrics.styleCoherence, color: '#ff6b9d' },
      { label: 'Pose Variety', shortLabel: 'Pose', value: metrics.poseVariety, color: '#a855f7' },
      { label: 'Quality Score', shortLabel: 'Quality', value: metrics.qualityScore, color: '#00ff88' },
      { label: 'Refinement', shortLabel: 'Refine', value: metrics.refinementMaturity, color: '#ffaa00' },
    ];
  }, [metrics]);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size / 2) - 30; // Leave room for labels

  // Calculate polygon points
  const getPointCoords = (index: number, value: number) => {
    const angle = (index / points.length) * Math.PI * 2 - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
    };
  };

  const getLabelCoords = (index: number) => {
    const angle = (index / points.length) * Math.PI * 2 - Math.PI / 2;
    const r = radius + 18;
    return {
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
    };
  };

  // Create polygon path
  const polygonPoints = points
    .map((point, i) => {
      const coords = getPointCoords(i, point.value);
      return `${coords.x},${coords.y}`;
    })
    .join(' ');

  // Create grid rings
  const rings = [25, 50, 75, 100];

  return (
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

        {/* Data polygon - gradient fill */}
        <defs>
          <linearGradient id="radar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ff6b9d" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {metrics && (
          <>
            {/* Filled area */}
            <polygon
              points={polygonPoints}
              fill="url(#radar-gradient)"
              stroke="rgba(168,85,247,0.5)"
              strokeWidth={2}
            />

            {/* Data points */}
            {points.map((point, i) => {
              const coords = getPointCoords(i, point.value);
              return (
                <circle
                  key={i}
                  cx={coords.x}
                  cy={coords.y}
                  r={4}
                  fill={point.color}
                  stroke="#0a0a0f"
                  strokeWidth={2}
                  style={{
                    filter: `drop-shadow(0 0 4px ${point.color})`,
                  }}
                />
              );
            })}
          </>
        )}

        {/* Labels */}
        {points.map((point, i) => {
          const coords = getLabelCoords(i);
          return (
            <g key={i}>
              <text
                x={coords.x}
                y={coords.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-mono text-[9px] uppercase fill-slate-500"
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
                  fill={point.color}
                >
                  {Math.round(point.value)}%
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
  );
}
