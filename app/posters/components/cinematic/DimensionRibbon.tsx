/**
 * DimensionRibbon - Vertical ribbon displaying dimensions as glowing tags
 * Inspired by the Simulator's dimension columns, transformed for view-only display
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Mountain,
  Palette,
  Users,
  Sparkles,
  Zap,
  Cpu,
  Camera,
  Bug,
  Gamepad2,
  Clock,
  Film,
  Settings,
  Layers,
} from 'lucide-react';
import { slideUp, staggerContainer, STAGGER } from '@/app/features/simulator/lib/motion';

interface Dimension {
  id: string;
  type: string;
  label: string;
  reference: string;
  weight?: number;
}

interface DimensionRibbonProps {
  dimensions: Dimension[];
  onDimensionClick?: (dimension: Dimension) => void;
}

// Icon mapping
const dimensionIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  environment: Mountain,
  artStyle: Palette,
  characters: Users,
  mood: Sparkles,
  action: Zap,
  technology: Cpu,
  camera: Camera,
  creatures: Bug,
  gameUI: Gamepad2,
  era: Clock,
  genre: Film,
  custom: Settings,
};

// Color mapping
const dimensionGradients: Record<string, string> = {
  environment: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
  artStyle: 'from-purple-500/20 to-violet-500/20 border-purple-500/30 text-purple-400',
  characters: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400',
  mood: 'from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400',
  action: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-400',
  technology: 'from-cyan-500/20 to-teal-500/20 border-cyan-500/30 text-cyan-400',
  camera: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-400',
  creatures: 'from-red-500/20 to-rose-500/20 border-red-500/30 text-red-400',
  gameUI: 'from-indigo-500/20 to-blue-500/20 border-indigo-500/30 text-indigo-400',
  era: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-400',
  genre: 'from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-400',
  custom: 'from-slate-500/20 to-gray-500/20 border-slate-500/30 text-slate-400',
};

export function DimensionRibbon({ dimensions, onDimensionClick }: DimensionRibbonProps) {
  // Filter active dimensions
  const activeDimensions = dimensions.filter(d => d.reference && d.reference.trim());

  if (activeDimensions.length === 0) {
    return (
      <div className="w-16 lg:w-64 shrink-0 border-r border-white/5 bg-black/20 backdrop-blur-sm flex flex-col items-center justify-center">
        <Layers size={20} className="text-slate-600 mb-2" />
        <span className="text-[10px] font-mono text-slate-600 hidden lg:block">No dimensions</span>
      </div>
    );
  }

  return (
    <div className="w-16 lg:w-64 shrink-0 border-r border-white/5 bg-black/20 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="p-3 lg:p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Layers size={14} className="text-purple-400" />
          </div>
          <div className="hidden lg:block">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Dimensions
            </span>
            <p className="text-[9px] font-mono text-slate-600 mt-0.5">
              Click to expand
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable dimension list */}
      <motion.div
        className="flex-1 overflow-y-auto custom-scrollbar p-2 lg:p-3 space-y-2"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {activeDimensions.map((dimension, index) => {
          const Icon = dimensionIcons[dimension.type] || Settings;
          const gradientClass = dimensionGradients[dimension.type] || dimensionGradients.custom;

          return (
            <motion.div
              key={dimension.id}
              className={`
                relative group p-2 lg:p-3 rounded-lg border backdrop-blur-sm cursor-pointer
                bg-gradient-to-br ${gradientClass}
                transition-all duration-300 hover:scale-[1.02]
              `}
              variants={slideUp}
              custom={index}
              transition={{ delay: index * STAGGER.default }}
              onClick={() => onDimensionClick?.(dimension)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDimensionClick?.(dimension);
                }
              }}
            >
              {/* Mobile: Icon only */}
              <div className="lg:hidden flex justify-center">
                <Icon size={18} />
              </div>

              {/* Desktop: Full content */}
              <div className="hidden lg:block">
                {/* Type label */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} />
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-80">
                    {dimension.label || dimension.type}
                  </span>
                  {dimension.weight && dimension.weight < 100 && (
                    <span className="text-[9px] font-mono opacity-60">
                      {dimension.weight}%
                    </span>
                  )}
                </div>

                {/* Reference value */}
                <p className="text-xs text-white/80 leading-relaxed line-clamp-2">
                  "{dimension.reference}"
                </p>
              </div>

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </motion.div>
          );
        })}
      </motion.div>

      {/* Decorative bottom gradient */}
      <div className="h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </div>
  );
}

export default DimensionRibbon;
