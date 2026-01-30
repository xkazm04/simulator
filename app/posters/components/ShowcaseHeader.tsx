/**
 * ShowcaseHeader - Floating close button for cinematic showcase
 * Minimal design to not distract from the immersive experience
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';
import { fadeIn, transitions } from '@/app/features/simulator/lib/motion';

interface ShowcaseHeaderProps {
  projectName: string;
  createdAt?: string;
  onClose: () => void;
}

export function ShowcaseHeader({ onClose }: ShowcaseHeaderProps) {
  return (
    <motion.div
      className="absolute top-4 right-4 z-50 flex items-center gap-2"
      variants={fadeIn}
      initial="initial"
      animate="animate"
      transition={{ ...transitions.normal, delay: 0.3 }}
    >
      {/* Back to Gallery */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white transition-all rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/5 hover:border-white/10"
      >
        <ArrowLeft size={16} />
        <span className="text-xs font-mono hidden sm:inline">Gallery</span>
      </button>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="p-2.5 text-slate-400 hover:text-white transition-all rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/5 hover:border-white/10"
        aria-label="Close showcase"
      >
        <X size={18} />
      </button>
    </motion.div>
  );
}

export default ShowcaseHeader;
