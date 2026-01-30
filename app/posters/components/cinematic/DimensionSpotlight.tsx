/**
 * DimensionSpotlight - Enlarged dimension display in center of viewport
 * Shows full dimension content with copy to clipboard functionality
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Copy,
  Check,
  X,
} from 'lucide-react';

interface Dimension {
  id: string;
  type: string;
  label: string;
  reference: string;
  weight?: number;
}

interface DimensionSpotlightProps {
  dimension: Dimension | null;
  onClose: () => void;
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

// Gradient colors for each dimension type
const dimensionGradients: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  environment: { bg: 'from-green-500/30 to-emerald-600/20', border: 'border-green-400/50', text: 'text-green-300', glow: 'shadow-green-500/30' },
  artStyle: { bg: 'from-purple-500/30 to-violet-600/20', border: 'border-purple-400/50', text: 'text-purple-300', glow: 'shadow-purple-500/30' },
  characters: { bg: 'from-blue-500/30 to-indigo-600/20', border: 'border-blue-400/50', text: 'text-blue-300', glow: 'shadow-blue-500/30' },
  mood: { bg: 'from-pink-500/30 to-rose-600/20', border: 'border-pink-400/50', text: 'text-pink-300', glow: 'shadow-pink-500/30' },
  action: { bg: 'from-orange-500/30 to-amber-600/20', border: 'border-orange-400/50', text: 'text-orange-300', glow: 'shadow-orange-500/30' },
  technology: { bg: 'from-cyan-500/30 to-teal-600/20', border: 'border-cyan-400/50', text: 'text-cyan-300', glow: 'shadow-cyan-500/30' },
  camera: { bg: 'from-amber-500/30 to-yellow-600/20', border: 'border-amber-400/50', text: 'text-amber-300', glow: 'shadow-amber-500/30' },
  creatures: { bg: 'from-red-500/30 to-rose-600/20', border: 'border-red-400/50', text: 'text-red-300', glow: 'shadow-red-500/30' },
  gameUI: { bg: 'from-indigo-500/30 to-blue-600/20', border: 'border-indigo-400/50', text: 'text-indigo-300', glow: 'shadow-indigo-500/30' },
  era: { bg: 'from-yellow-500/30 to-amber-600/20', border: 'border-yellow-400/50', text: 'text-yellow-300', glow: 'shadow-yellow-500/30' },
  genre: { bg: 'from-rose-500/30 to-pink-600/20', border: 'border-rose-400/50', text: 'text-rose-300', glow: 'shadow-rose-500/30' },
  custom: { bg: 'from-slate-500/30 to-gray-600/20', border: 'border-slate-400/50', text: 'text-slate-300', glow: 'shadow-slate-500/30' },
};

export function DimensionSpotlight({ dimension, onClose }: DimensionSpotlightProps) {
  const [copied, setCopied] = useState(false);

  // Reset copied state when dimension changes
  useEffect(() => {
    setCopied(false);
  }, [dimension?.id]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dimension) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dimension, onClose]);

  const handleCopy = async () => {
    if (!dimension) return;

    try {
      await navigator.clipboard.writeText(dimension.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!dimension) return null;

  const Icon = dimensionIcons[dimension.type] || Settings;
  const gradient = dimensionGradients[dimension.type] || dimensionGradients.custom;

  return (
    <AnimatePresence>
      {dimension && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Content */}
          <motion.div
            className={`
              relative z-10 max-w-2xl w-full mx-8 p-8 rounded-2xl
              bg-gradient-to-br ${gradient.bg}
              border ${gradient.border}
              backdrop-blur-xl shadow-2xl ${gradient.glow}
            `}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
            >
              <X size={18} className="text-white" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className={`p-4 rounded-xl bg-white/10 border ${gradient.border}`}>
                <Icon size={32} className={gradient.text} />
              </div>
              <div>
                <h3 className={`text-2xl font-bold ${gradient.text}`}>
                  {dimension.label || dimension.type}
                </h3>
                <span className="text-xs font-mono text-white/50 uppercase tracking-wider">
                  {dimension.type}
                  {dimension.weight && dimension.weight < 100 && ` • ${dimension.weight}% weight`}
                </span>
              </div>
            </div>

            {/* Reference content */}
            <div className="relative">
              <blockquote className="text-xl text-white/90 leading-relaxed font-light italic pl-6 border-l-2 border-white/20">
                "{dimension.reference}"
              </blockquote>
            </div>

            {/* Copy button */}
            <div className="mt-8 flex justify-end">
              <motion.button
                onClick={handleCopy}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-lg
                  font-mono text-sm uppercase tracking-wider
                  transition-all duration-200
                  ${copied
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : `bg-white/10 ${gradient.text} border border-white/20 hover:bg-white/20`
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy to Clipboard
                  </>
                )}
              </motion.button>
            </div>

            {/* Decorative corners */}
            <div className={`absolute top-3 left-3 w-8 h-8 border-l-2 border-t-2 ${gradient.border} rounded-tl-lg opacity-50`} />
            <div className={`absolute top-3 right-3 w-8 h-8 border-r-2 border-t-2 ${gradient.border} rounded-tr-lg opacity-50`} />
            <div className={`absolute bottom-3 left-3 w-8 h-8 border-l-2 border-b-2 ${gradient.border} rounded-bl-lg opacity-50`} />
            <div className={`absolute bottom-3 right-3 w-8 h-8 border-r-2 border-b-2 ${gradient.border} rounded-br-lg opacity-50`} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DimensionSpotlight;
