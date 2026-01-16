'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { CharacterDNA, HelixConfig, DNANode } from '../types';
import { DEFAULT_HELIX_CONFIG } from '../types';

interface DNAHelixProps {
  dna: CharacterDNA | null;
  config?: Partial<HelixConfig>;
  isInteractive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function DNAHelix({
  dna,
  config: customConfig,
  isInteractive = true,
  size = 'md',
}: DNAHelixProps) {
  const [rotation, setRotation] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<DNANode | null>(null);

  const config = { ...DEFAULT_HELIX_CONFIG, ...customConfig };

  // Size multipliers
  const sizeMultiplier = size === 'sm' ? 0.5 : size === 'lg' ? 1.5 : 1;
  const scaledConfig = {
    ...config,
    helixRadius: config.helixRadius * sizeMultiplier,
    helixHeight: config.helixHeight * sizeMultiplier,
    nodeSize: config.nodeSize * sizeMultiplier,
  };

  // Parse embeddings into nodes
  const nodes = useMemo(() => {
    if (!dna) return { face: [], style: [] };

    const parseEmbedding = (
      base64: string | null,
      strand: 'face' | 'style',
      expectedDims: number
    ): DNANode[] => {
      if (!base64) return [];

      try {
        // Decode base64 to binary
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        // Convert to Float32Array
        const floats = new Float32Array(bytes.buffer);

        // Sample nodes (take every Nth value to get nodeCount nodes)
        const step = Math.floor(floats.length / scaledConfig.nodeCount);
        const nodes: DNANode[] = [];

        for (let i = 0; i < scaledConfig.nodeCount; i++) {
          const index = i * step;
          const value = floats[index] || 0;
          nodes.push({
            index,
            value,
            normalizedValue: Math.min(1, Math.max(0, (value + 1) / 2)), // Normalize -1 to 1 -> 0 to 1
            strand,
          });
        }

        return nodes;
      } catch {
        // Return placeholder nodes if parsing fails
        return Array.from({ length: scaledConfig.nodeCount }, (_, i) => ({
          index: i,
          value: 0,
          normalizedValue: 0.5,
          strand,
        }));
      }
    };

    return {
      face: parseEmbedding(dna.face_embedding, 'face', 512),
      style: parseEmbedding(dna.style_embedding, 'style', 768),
    };
  }, [dna, scaledConfig.nodeCount]);

  // Auto-rotate animation
  useEffect(() => {
    if (isPaused || !isInteractive) return;

    const interval = setInterval(() => {
      setRotation((r) => (r + 1) % 360);
    }, (scaledConfig.rotationSpeed * 1000) / 360);

    return () => clearInterval(interval);
  }, [isPaused, isInteractive, scaledConfig.rotationSpeed]);

  // Calculate 3D position for a node
  const getNodePosition = (index: number, strand: 'face' | 'style') => {
    const phaseOffset = strand === 'style' ? Math.PI : 0;
    const heightStep = scaledConfig.helixHeight / scaledConfig.nodeCount;
    const angle = ((index / scaledConfig.nodeCount) * Math.PI * 4) + phaseOffset;

    const rotationRad = (rotation * Math.PI) / 180;
    const x = Math.cos(angle + rotationRad) * scaledConfig.helixRadius;
    const z = Math.sin(angle + rotationRad) * scaledConfig.helixRadius;
    const y = index * heightStep - scaledConfig.helixHeight / 2;

    // Calculate depth for opacity/size scaling
    const depth = (z + scaledConfig.helixRadius) / (2 * scaledConfig.helixRadius);

    return { x, y, z, depth };
  };

  const handleClick = () => {
    if (isInteractive) {
      setIsPaused(!isPaused);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isInteractive) return;
    // Could implement drag rotation here
  };

  // If no DNA, show placeholder
  if (!dna) {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{
          width: scaledConfig.helixRadius * 2 + 40,
          height: scaledConfig.helixHeight + 40,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="font-mono text-[10px] text-slate-600 uppercase">no dna</div>
        </div>
        {/* Placeholder helix outline */}
        <svg
          width={scaledConfig.helixRadius * 2 + 40}
          height={scaledConfig.helixHeight + 40}
          className="opacity-20"
        >
          <path
            d={`M ${scaledConfig.helixRadius + 20} 20
                Q ${scaledConfig.helixRadius * 2 + 20} ${scaledConfig.helixHeight / 2 + 20}
                  ${scaledConfig.helixRadius + 20} ${scaledConfig.helixHeight + 20}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="text-slate-700"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{
        width: scaledConfig.helixRadius * 2 + 40,
        height: scaledConfig.helixHeight + 40,
        perspective: '600px',
      }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      title={isPaused ? 'Click to resume' : 'Click to pause'}
    >
      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-slate-800/80
                      font-mono text-[8px] text-slate-500 uppercase">
          paused
        </div>
      )}

      {/* SVG container */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${scaledConfig.helixRadius * 2 + 40} ${scaledConfig.helixHeight + 40}`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Connections between strands */}
        {nodes.face.map((faceNode, i) => {
          const styleNode = nodes.style[i];
          if (!styleNode) return null;

          const facePos = getNodePosition(i, 'face');
          const stylePos = getNodePosition(i, 'style');

          // Only draw connections when nodes are visible (front-facing)
          if (facePos.depth < 0.3 || stylePos.depth < 0.3) return null;

          return (
            <line
              key={`conn-${i}`}
              x1={facePos.x + scaledConfig.helixRadius + 20}
              y1={facePos.y + scaledConfig.helixHeight / 2 + 20}
              x2={stylePos.x + scaledConfig.helixRadius + 20}
              y2={stylePos.y + scaledConfig.helixHeight / 2 + 20}
              stroke={scaledConfig.connectionColor}
              strokeWidth={1}
              opacity={Math.min(facePos.depth, stylePos.depth)}
            />
          );
        })}

        {/* Face strand nodes */}
        {nodes.face.map((node, i) => {
          const pos = getNodePosition(i, 'face');
          const nodeSize = scaledConfig.nodeSize * (0.5 + node.normalizedValue * 0.5);
          const opacity = 0.3 + pos.depth * 0.7;

          return (
            <motion.circle
              key={`face-${i}`}
              cx={pos.x + scaledConfig.helixRadius + 20}
              cy={pos.y + scaledConfig.helixHeight / 2 + 20}
              r={nodeSize * (0.8 + pos.depth * 0.4)}
              fill={scaledConfig.faceColor}
              opacity={opacity}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{
                filter: `drop-shadow(0 0 ${nodeSize}px ${scaledConfig.faceColor})`,
              }}
            />
          );
        })}

        {/* Style strand nodes */}
        {nodes.style.map((node, i) => {
          const pos = getNodePosition(i, 'style');
          const nodeSize = scaledConfig.nodeSize * (0.5 + node.normalizedValue * 0.5);
          const opacity = 0.3 + pos.depth * 0.7;

          return (
            <motion.circle
              key={`style-${i}`}
              cx={pos.x + scaledConfig.helixRadius + 20}
              cy={pos.y + scaledConfig.helixHeight / 2 + 20}
              r={nodeSize * (0.8 + pos.depth * 0.4)}
              fill={scaledConfig.styleColor}
              opacity={opacity}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{
                filter: `drop-shadow(0 0 ${nodeSize}px ${scaledConfig.styleColor})`,
              }}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 px-2 py-1 rounded
                      bg-slate-900/90 border border-white/10 pointer-events-none">
          <span className="font-mono text-[9px] text-slate-400">
            {hoveredNode.strand === 'face' ? 'Face' : 'Style'} dim #{hoveredNode.index}:{' '}
            <span className={hoveredNode.strand === 'face' ? 'text-cyan-400' : 'text-pink-400'}>
              {hoveredNode.value.toFixed(3)}
            </span>
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-0 right-0 flex items-center gap-3 text-[9px] font-mono">
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: scaledConfig.faceColor }}
          />
          face
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: scaledConfig.styleColor }}
          />
          style
        </span>
      </div>
    </div>
  );
}
