'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  ChevronDown,
  Loader2,
  Cpu,
  Sliders,
  Target,
  Clapperboard,
  Mountain,
  Palette,
} from 'lucide-react';
import type { Character, Worker, PresetType } from '../types';
import { GENERATION_PRESETS } from '../types';

interface GeneratorToolbarProps {
  character: Character | null;
  workers: Worker[];
  onGenerate: (prompt: string, preset: PresetType, workerId: string | null) => void;
}

const PRESET_ICONS: Record<PresetType, typeof Target> = {
  portrait: Target,
  action: Clapperboard,
  scene: Mountain,
  concept: Palette,
};

export function GeneratorToolbar({ character, workers, onGenerate }: GeneratorToolbarProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('portrait');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [characterWeight, setCharacterWeight] = useState(0.85);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);
  const onlineWorkers = workers.filter((w) => w.status === 'online');
  const preset = GENERATION_PRESETS.find((p) => p.id === selectedPreset)!;

  const handleGenerate = async () => {
    if (!character || character.status !== 'ready') return;

    setIsGenerating(true);
    try {
      const prompt = customPrompt || preset.promptTemplate.replace('{name}', character.name);
      await onGenerate(prompt, selectedPreset, selectedWorkerId);
    } finally {
      setIsGenerating(false);
    }
  };

  const isDisabled = !character || character.status !== 'ready';

  return (
    <div className="border-t border-white/5 bg-[#0c0c14]">
      {/* Main toolbar */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Preset buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-white/5">
          {GENERATION_PRESETS.map((p) => {
            const Icon = PRESET_ICONS[p.id];
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                disabled={isDisabled}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[10px]
                          uppercase tracking-wider transition-all disabled:opacity-50 ${
                            selectedPreset === p.id
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                title={p.description}
              >
                <Icon size={12} />
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Character weight slider */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border
                      border-white/5">
          <span className="font-mono text-[10px] text-slate-500 uppercase">weight</span>
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={characterWeight}
            onChange={(e) => setCharacterWeight(parseFloat(e.target.value))}
            disabled={isDisabled}
            className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer
                     disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
          />
          <span className="font-mono text-xs text-cyan-400 w-8">
            {Math.round(characterWeight * 100)}%
          </span>
        </div>

        {/* Worker selector */}
        <div className="relative">
          <button
            onClick={() => setShowWorkerDropdown(!showWorkerDropdown)}
            disabled={isDisabled || onlineWorkers.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border
                     border-white/5 hover:border-white/10 transition-colors disabled:opacity-50"
          >
            <Cpu size={14} className="text-slate-500" />
            <span className="font-mono text-xs text-slate-300 max-w-[100px] truncate">
              {selectedWorker?.name || 'Auto-assign'}
            </span>
            <ChevronDown size={12} className="text-slate-500" />
          </button>

          {/* Worker dropdown */}
          <AnimatePresence>
            {showWorkerDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute bottom-full left-0 mb-2 w-64 bg-slate-900 border
                         border-white/10 rounded-lg shadow-xl overflow-hidden z-20"
              >
                {/* Auto option */}
                <button
                  onClick={() => {
                    setSelectedWorkerId(null);
                    setShowWorkerDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left
                            hover:bg-white/5 transition-colors ${
                              !selectedWorkerId ? 'bg-cyan-500/10' : ''
                            }`}
                >
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <div className="flex-1">
                    <div className="font-mono text-xs text-white">Auto-assign</div>
                    <div className="text-[10px] text-slate-500">
                      Best available worker
                    </div>
                  </div>
                </button>

                <div className="h-px bg-white/5" />

                {/* Worker list */}
                <div className="max-h-48 overflow-auto ms-scrollbar">
                  {onlineWorkers.map((worker) => (
                    <button
                      key={worker.id}
                      onClick={() => {
                        setSelectedWorkerId(worker.id);
                        setShowWorkerDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left
                                hover:bg-white/5 transition-colors ${
                                  selectedWorkerId === worker.id ? 'bg-cyan-500/10' : ''
                                }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          worker.status === 'online'
                            ? 'bg-green-400'
                            : worker.status === 'busy'
                            ? 'bg-amber-400'
                            : 'bg-slate-600'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs text-white truncate">
                          {worker.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {worker.gpu_model} • {worker.vram_gb}GB
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ~{worker.avg_generation_time}s
                      </div>
                    </button>
                  ))}

                  {onlineWorkers.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-slate-500">
                      No workers online
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`p-2 rounded-lg border transition-colors ${
            showAdvanced
              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
              : 'border-white/5 text-slate-500 hover:text-slate-300'
          }`}
        >
          <Sliders size={14} />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isDisabled || isGenerating}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r
                   from-purple-500/20 to-cyan-500/20 border border-purple-500/30
                   text-white hover:from-purple-500/30 hover:to-cyan-500/30
                   font-mono text-xs uppercase tracking-wider transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed
                   shadow-[0_0_20px_rgba(168,85,247,0.2)]"
        >
          {isGenerating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              generating...
            </>
          ) : (
            <>
              <Zap size={14} />
              generate
            </>
          )}
        </button>
      </div>

      {/* Advanced options */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="px-4 py-3 space-y-3">
              {/* Custom prompt */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  custom_prompt (optional)
                </label>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={preset.promptTemplate}
                  disabled={isDisabled}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-white/5 rounded-lg
                           text-xs text-slate-200 placeholder-slate-600 focus:outline-none
                           focus:border-cyan-500/30 transition-colors font-mono
                           disabled:opacity-50"
                />
              </div>

              {/* Preset info */}
              <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
                <span>CFG: {preset.cfgScale}</span>
                <span>Default Weight: {Math.round(preset.characterWeight * 100)}%</span>
                <span className="text-slate-400">{preset.description}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
