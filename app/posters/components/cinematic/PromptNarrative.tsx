/**
 * PromptNarrative - Elegant scrolling prompt display
 * Shows generation prompts as narrative quote blocks
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, ChevronLeft, ChevronRight, Copy, Check, Sparkles } from 'lucide-react';
import { fadeIn, transitions } from '@/app/features/simulator/lib/motion';

interface GeneratedPrompt {
  id: string;
  scene_number: number;
  scene_type: string;
  prompt: string;
  negative_prompt: string | null;
}

interface PromptNarrativeProps {
  prompts: GeneratedPrompt[];
}

export function PromptNarrative({ prompts }: PromptNarrativeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (prompts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Sparkles size={24} className="text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-mono text-slate-600">No prompts generated</p>
        </div>
      </div>
    );
  }

  const currentPrompt = prompts[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + prompts.length) % prompts.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % prompts.length);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentPrompt.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="h-full flex flex-col justify-center px-4 sm:px-8 lg:px-16">
      {/* Section Label */}
      <motion.div
        className="text-center mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          Generation Prompts • {currentIndex + 1} of {prompts.length}
        </span>
      </motion.div>

      {/* Prompt Card */}
      <div className="relative max-w-4xl mx-auto w-full">
        {/* Navigation Buttons */}
        {prompts.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 p-2 rounded-full bg-black/60 border border-white/10 text-white/60 hover:text-white hover:bg-black/80 transition-all backdrop-blur-sm"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 p-2 rounded-full bg-black/60 border border-white/10 text-white/60 hover:text-white hover:bg-black/80 transition-all backdrop-blur-sm"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPrompt.id}
            className="relative p-6 sm:p-8 rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-800/40 border border-white/5 backdrop-blur-sm"
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.normal}
          >
            {/* Quote icon */}
            <div className="absolute -top-3 left-6 p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <Quote size={16} className="text-amber-400" />
            </div>

            {/* Scene type badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500">Scene {currentPrompt.scene_number}:</span>
                <span className="text-sm font-medium text-amber-400">{currentPrompt.scene_type}</span>
              </div>

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-700/50 transition-all"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-green-400" />
                    <span className="text-green-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Prompt text */}
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed italic">
              "{currentPrompt.prompt}"
            </p>

            {/* Decorative corners */}
            <div className="absolute top-0 right-0 w-16 h-16 border-t border-r border-white/5 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b border-l border-white/5 rounded-bl-xl" />
          </motion.div>
        </AnimatePresence>

        {/* Pagination dots */}
        {prompts.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {prompts.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-amber-400 w-6'
                    : 'bg-slate-600 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PromptNarrative;
