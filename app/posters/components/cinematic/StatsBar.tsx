/**
 * StatsBar - Top ribbon showing project title and statistics
 * Inspired by Simulator's status indicators and header elements
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Film, Images, Layers, FileText, Video, Calendar } from 'lucide-react';
import { slideDown, transitions } from '@/app/features/simulator/lib/motion';

interface StatsBarProps {
  projectName: string;
  createdAt: string;
  stats: {
    images: number;
    dimensions: number;
    prompts: number;
    videos: number;
  };
}

export function StatsBar({ projectName, createdAt, stats }: StatsBarProps) {
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const statItems = [
    { icon: Images, label: 'Images', value: stats.images, color: 'cyan' },
    { icon: Layers, label: 'Dimensions', value: stats.dimensions, color: 'purple' },
    { icon: FileText, label: 'Prompts', value: stats.prompts, color: 'amber' },
    ...(stats.videos > 0 ? [{ icon: Video, label: 'Videos', value: stats.videos, color: 'rose' }] : []),
  ];

  return (
    <motion.div
      className="relative z-20 px-4 lg:px-8 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md"
      variants={slideDown}
      initial="initial"
      animate="animate"
      transition={transitions.normal}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Project Info */}
        <div className="flex items-center gap-4">
          {/* Film Badge */}
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/20 to-purple-500/20 border border-rose-500/30 shadow-lg shadow-rose-500/10">
            <Film size={20} className="text-rose-400" />
          </div>

          {/* Title & Date */}
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              {projectName}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Calendar size={12} className="text-slate-500" />
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                {formattedDate}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="hidden sm:flex items-center gap-1">
          {statItems.map((stat, index) => {
            const Icon = stat.icon;
            const colorClasses = {
              cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
              purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
              amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
            }[stat.color] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';

            return (
              <motion.div
                key={stat.label}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm ${colorClasses}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 + 0.2 }}
              >
                <Icon size={14} />
                <span className="text-xs font-mono font-medium">{stat.value}</span>
                <span className="text-[10px] font-mono text-slate-500 uppercase hidden lg:inline">
                  {stat.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Animated bottom border */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
      />
    </motion.div>
  );
}

export default StatsBar;
