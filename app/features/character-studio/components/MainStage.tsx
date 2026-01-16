'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, ImageIcon, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import type { Character, ViewMode } from '../types';

interface MainStageProps {
  character: Character | null;
  viewMode: ViewMode;
  characters: Character[];
  onSelectCharacter: (id: string) => void;
  isLoading: boolean;
}

export function MainStage({
  character,
  viewMode,
  characters,
  onSelectCharacter,
  isLoading,
}: MainStageProps) {
  const [orbitRotation, setOrbitRotation] = useState(0);

  // Constellation view
  if (viewMode === 'constellation') {
    return (
      <div className="flex-1 relative overflow-hidden bg-[#05050a]">
        {/* Star field background */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-[#05050a]" />

        {/* Stars (characters) */}
        <div className="absolute inset-0 flex items-center justify-center">
          {characters.map((char, index) => {
            const angle = (index / characters.length) * Math.PI * 2;
            const radius = 150 + (char.quality_score || 0.5) * 100;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const size = 8 + (char.quality_score || 0.5) * 16;

            return (
              <motion.button
                key={char.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  x,
                  y,
                }}
                transition={{ delay: index * 0.05, type: 'spring' }}
                whileHover={{ scale: 1.3 }}
                onClick={() => onSelectCharacter(char.id)}
                className={`absolute rounded-full transition-shadow ${
                  char.id === character?.id
                    ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#05050a]'
                    : ''
                }`}
                style={{ width: size, height: size }}
              >
                {/* Star glow */}
                <div
                  className={`absolute inset-0 rounded-full ${
                    char.status === 'ready'
                      ? 'bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]'
                      : char.status === 'processing'
                      ? 'bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)] animate-pulse'
                      : 'bg-slate-500'
                  }`}
                />
                {/* Tooltip */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0
                              group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                  <span className="font-mono text-[10px] text-slate-400">{char.name}</span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Center indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-4 h-4 rounded-full border border-white/20" />
      </div>
    );
  }

  // Portrait view (default)
  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center p-8">
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 text-slate-500"
          >
            <Loader2 size={32} className="animate-spin" />
            <span className="font-mono text-xs">loading character...</span>
          </motion.div>
        ) : !character ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 text-slate-500"
          >
            <div className="p-6 rounded-full bg-slate-900/50 border border-white/5">
              <User size={48} />
            </div>
            <span className="font-mono text-xs uppercase tracking-wider">
              select a character
            </span>
            <span className="text-[10px] text-slate-600 max-w-xs text-center">
              Choose a character from the roster or create a new one to get started
            </span>
          </motion.div>
        ) : (
          <motion.div
            key={character.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative"
          >
            {/* Orbiting references */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                className="absolute w-[400px] h-[400px]"
                style={{ transform: `rotate(${orbitRotation}deg)` }}
              >
                {character.references?.slice(0, 8).map((ref, index) => {
                  const count = Math.min(character.references?.length || 0, 8);
                  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
                  const x = Math.cos(angle) * 180;
                  const y = Math.sin(angle) * 180;

                  return (
                    <motion.div
                      key={ref.id}
                      className="absolute w-14 h-14 rounded-lg overflow-hidden border border-white/20
                               shadow-lg transform -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
                      whileHover={{ scale: 1.2, zIndex: 10 }}
                    >
                      {ref.thumbnail_url ? (
                        <img
                          src={ref.thumbnail_url}
                          alt={`Reference ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                          <ImageIcon size={20} className="text-slate-600" />
                        </div>
                      )}
                      {ref.is_primary && (
                        <div className="absolute top-0 right-0 p-0.5 bg-cyan-500 rounded-bl">
                          <Sparkles size={8} className="text-white" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Orbit ring */}
              <div className="absolute w-[360px] h-[360px] rounded-full border border-dashed
                            border-white/5" />
            </div>

            {/* Main portrait */}
            <div className="relative z-10">
              <div className="w-48 h-48 rounded-2xl overflow-hidden border-2 border-cyan-500/30
                            shadow-[0_0_60px_rgba(34,211,238,0.15)]">
                {character.primary_thumbnail_url ? (
                  <img
                    src={character.primary_thumbnail_url}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <User size={64} className="text-slate-600" />
                  </div>
                )}
              </div>

              {/* Status badge */}
              <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full
                            font-mono text-[10px] uppercase tracking-wider border ${
                              character.status === 'ready'
                                ? 'bg-green-500/20 border-green-500/40 text-green-400'
                                : character.status === 'processing'
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                : character.status === 'failed'
                                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                : 'bg-slate-500/20 border-slate-500/40 text-slate-400'
                            }`}>
                {character.status}
              </div>
            </div>

            {/* Character name */}
            <div className="mt-8 text-center">
              <h2 className="font-mono text-xl text-white">{character.name}</h2>
              {character.description && (
                <p className="text-sm text-slate-500 mt-1 max-w-xs">{character.description}</p>
              )}
            </div>

            {/* Reset orbit button */}
            <button
              onClick={() => setOrbitRotation(0)}
              className="absolute top-0 right-0 p-2 rounded-lg text-slate-500 hover:text-white
                       hover:bg-white/5 transition-colors"
              title="Reset orbit"
            >
              <RotateCcw size={14} />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
