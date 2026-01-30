/**
 * BasePromptBanner - Displays the project's core prompt/idea
 * Shown above the gallery section as a contextual header
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Quote, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { slideUp } from '@/app/features/simulator/lib/motion';

interface BasePromptBannerProps {
  prompt: string | null;
}

export function BasePromptBanner({ prompt }: BasePromptBannerProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!prompt || !prompt.trim()) {
    return null;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const isLongPrompt = prompt.length > 150;

  return (
    <motion.div
      className="shrink-0"
      variants={slideUp}
      initial="initial"
      animate="animate"
    >
      <div
        className={`
          relative px-4 py-3 rounded-lg
          bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-rose-500/10
          border border-white/10 backdrop-blur-sm
          ${isLongPrompt ? 'cursor-pointer' : ''}
        `}
        onClick={() => isLongPrompt && setIsExpanded(!isExpanded)}
      >
        {/* Quote icon - inline for header style */}
        <div className="absolute -top-2 left-3">
          <div className="p-1 rounded bg-cyan-500/20 border border-cyan-500/30">
            <Quote size={10} className="text-cyan-400" />
          </div>
        </div>

        {/* Label */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Project Vision
          </span>
          <div className="flex items-center gap-2">
            {/* Copy button */}
            <motion.button
              onClick={handleCopy}
              className={`
                p-1.5 rounded-lg transition-all
                ${copied
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
                }
              `}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Copy to clipboard"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </motion.button>

            {/* Expand toggle for long prompts */}
            {isLongPrompt && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-all"
              >
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
        </div>

        {/* Prompt text */}
        <p
          className={`
            text-sm text-white/80 leading-relaxed italic
            ${!isExpanded && isLongPrompt ? 'line-clamp-2' : ''}
          `}
        >
          "{prompt}"
        </p>

        {/* Truncation indicator */}
        {!isExpanded && isLongPrompt && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/40 to-transparent rounded-b-xl pointer-events-none" />
        )}
      </div>
    </motion.div>
  );
}

export default BasePromptBanner;
