/**
 * TitleCard - Animated title card for video showcase
 *
 * Displays project name with spring-based animated text reveal.
 * Used as the first element in ShowcaseVideo composition.
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export interface TitleCardProps {
  projectName: string;
  subtitle?: string;
}

export function TitleCard({ projectName, subtitle }: TitleCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animation for text entrance
  const progress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  // Fade in opacity
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  // Subtle scale animation for polish (0.95 -> 1.0)
  const scale = interpolate(progress, [0, 1], [0.95, 1]);

  // Subtitle has slightly delayed entrance
  const subtitleProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 25, stiffness: 80 },
  });
  const subtitleOpacity = interpolate(subtitleProgress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {/* Project name */}
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 64,
          fontWeight: 700,
          textAlign: 'center',
          padding: '0 48px',
          letterSpacing: '-0.02em',
        }}
      >
        {projectName}
      </div>

      {/* Optional subtitle */}
      {subtitle && (
        <div
          style={{
            opacity: subtitleOpacity,
            color: '#ca8a04',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 18,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
}

export default TitleCard;
