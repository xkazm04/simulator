'use client';

import { memo, useMemo } from 'react';

/**
 * Activity data point
 */
export interface ActivityPoint {
  timestamp: string | Date;
  value: number;
}

/**
 * Generate mock activity data from project timestamps
 */
export function generateActivityData(
  createdAt: string,
  updatedAt: string,
  generationCount: number = 0,
  days: number = 7
): ActivityPoint[] {
  const data: ActivityPoint[] = [];
  const now = new Date();
  const created = new Date(createdAt);
  const updated = new Date(updatedAt);

  // Generate data points for each day
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    let value = 0;

    // Check if this day falls within the project's active period
    if (date >= created) {
      // Base activity based on recency
      const daysSinceUpdate = Math.floor(
        (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (i >= daysSinceUpdate) {
        // Activity drops off after last update
        value = 0;
      } else {
        // Simulate activity based on generation count and recency
        const activityLevel = Math.max(0, generationCount / days);
        const recencyBoost = i === 0 ? 1.5 : 1;
        value = Math.floor(Math.random() * activityLevel * 3 * recencyBoost);
      }

      // Boost on creation day
      if (
        date.toDateString() === created.toDateString() &&
        generationCount > 0
      ) {
        value = Math.max(value, Math.floor(generationCount * 0.3));
      }

      // Boost on update day
      if (date.toDateString() === updated.toDateString()) {
        value = Math.max(value, Math.floor(generationCount * 0.2) + 1);
      }
    }

    data.push({
      timestamp: date.toISOString(),
      value: Math.min(value, 10), // Cap at 10 for visualization
    });
  }

  return data;
}

interface ActivitySparklineProps {
  data: ActivityPoint[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  showDots?: boolean;
  className?: string;
}

/**
 * ActivitySparkline - Mini activity chart using SVG
 */
export const ActivitySparkline = memo(function ActivitySparkline({
  data,
  width = 60,
  height = 20,
  color = '#00d4ff',
  fillColor = 'rgba(0, 212, 255, 0.1)',
  showDots = false,
  className = '',
}: ActivitySparklineProps) {
  const pathData = useMemo(() => {
    if (data.length === 0) return { linePath: '', areaPath: '' };

    const maxValue = Math.max(...data.map((d) => d.value), 1);
    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = data.map((point, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - (point.value / maxValue) * chartHeight;
      return { x, y, value: point.value };
    });

    // Create smooth curve using quadratic bezier
    let linePath = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      linePath += ` Q ${cpX} ${prev.y}, ${curr.x} ${curr.y}`;
    }

    // Create area path (line + close to bottom)
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return { linePath, areaPath, points };
  }, [data, width, height]);

  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-[8px] text-slate-600 font-mono">No activity</span>
      </div>
    );
  }

  const hasActivity = data.some((d) => d.value > 0);

  if (!hasActivity) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Flat line for no activity */}
        <line
          x1={2}
          y1={height - 4}
          x2={width - 2}
          y2={height - 4}
          stroke="#334155"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Area fill */}
      <path d={pathData.areaPath} fill={fillColor} />

      {/* Line */}
      <path
        d={pathData.linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots at data points */}
      {showDots &&
        pathData.points?.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={point.value > 0 ? 2 : 1}
            fill={point.value > 0 ? color : '#475569'}
          />
        ))}

      {/* End dot (current day) */}
      {pathData.points && pathData.points.length > 0 && (
        <circle
          cx={pathData.points[pathData.points.length - 1].x}
          cy={pathData.points[pathData.points.length - 1].y}
          r={2.5}
          fill={color}
        />
      )}
    </svg>
  );
});

/**
 * ActivityIndicator - Combined sparkline with label
 */
interface ActivityIndicatorProps {
  data: ActivityPoint[];
  label?: string;
  className?: string;
}

export const ActivityIndicator = memo(function ActivityIndicator({
  data,
  label = '7d activity',
  className = '',
}: ActivityIndicatorProps) {
  const totalActivity = useMemo(
    () => data.reduce((sum, d) => sum + d.value, 0),
    [data]
  );

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ActivitySparkline data={data} />
      <div className="flex flex-col">
        <span className="text-[9px] text-slate-500 font-mono uppercase">
          {label}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {totalActivity} actions
        </span>
      </div>
    </div>
  );
});

export default ActivitySparkline;
