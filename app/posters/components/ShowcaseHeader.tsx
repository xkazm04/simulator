/**
 * ShowcaseHeader - Floating header with stats and back button
 * Positioned in top right corner for minimal distraction
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Images, Layers, Video } from 'lucide-react';
import { fadeIn, transitions } from '@/app/features/simulator/lib/motion';

interface ShowcaseHeaderProps {
  projectName: string;
  createdAt?: string;
  onClose: () => void;
  stats?: {
    images: number;
    dimensions: number;
    videos: number;
    sketches?: number;
  };
}

export function ShowcaseHeader({ onClose, stats }: ShowcaseHeaderProps) {
  const statItems = stats ? [
    { icon: Images, label: 'Images', value: stats.images, color: 'cyan' },
    { icon: Layers, label: 'Dimensions', value: stats.dimensions, color: 'purple' },
    ...(stats.videos > 0 ? [{ icon: Video, label: 'Videos', value: stats.videos, color: 'rose' }] : []),
  ] : [];

  return (
    <motion.div
      className="absolute top-4 right-4 z-50 flex items-center gap-2"
      variants={fadeIn}
      initial="initial"
      animate="animate"
      transition={{ ...transitions.normal, delay: 0.3 }}
    >
      {/* Stats */}
      {stats && (
        <div className="hidden sm:flex items-center gap-1 mr-2">
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border backdrop-blur-sm ${colorClasses}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 + 0.3 }}
              >
                <Icon size={12} />
                <span className="text-xs font-mono font-medium">{stat.value}</span>
                <span className="text-[9px] font-mono text-slate-500 uppercase hidden lg:inline">
                  {stat.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Back to Gallery */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white transition-all rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/10 hover:border-white/20"
      >
        <ArrowLeft size={16} />
        <span className="text-xs font-mono">Back</span>
      </button>
    </motion.div>
  );
}

export default ShowcaseHeader;
