'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Edit3, Undo2 } from 'lucide-react';
import type { CharacterTrait } from '../types';

interface TraitEditorProps {
  trait: CharacterTrait;
  onSave: (traitId: string, value: string, weight: number) => void;
  onRevert?: (traitId: string) => void;
  canRevert?: boolean;
  disabled?: boolean;
}

export function TraitEditor({
  trait,
  onSave,
  onRevert,
  canRevert = false,
  disabled = false,
}: TraitEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(trait.value);
  const [editWeight, setEditWeight] = useState(trait.weight);
  const [showWeightSlider, setShowWeightSlider] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external trait changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(trait.value);
      setEditWeight(trait.weight);
    }
  }, [trait.value, trait.weight, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    if (disabled || !trait.editable) return;
    setIsEditing(true);
    setEditValue(trait.value);
    setEditWeight(trait.weight);
  }, [disabled, trait.editable, trait.value, trait.weight]);

  const handleSave = useCallback(() => {
    if (editValue.trim() && (editValue !== trait.value || editWeight !== trait.weight)) {
      onSave(trait.id, editValue.trim(), editWeight);
    }
    setIsEditing(false);
    setShowWeightSlider(false);
  }, [editValue, editWeight, trait.id, trait.value, trait.weight, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(trait.value);
    setEditWeight(trait.weight);
    setIsEditing(false);
    setShowWeightSlider(false);
  }, [trait.value, trait.weight]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleRevert = useCallback(() => {
    if (onRevert) {
      onRevert(trait.id);
    }
  }, [onRevert, trait.id]);

  const weightPercent = Math.round(editWeight * 100);
  const confidencePercent = Math.round(trait.confidence * 100);

  return (
    <div className="group relative">
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-2"
          >
            {/* Value input */}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-2 py-1.5 rounded-md bg-slate-800 border border-slate-600
                         text-xs text-white font-mono focus:outline-none focus:border-cyan-500
                         placeholder:text-slate-500"
                placeholder="Enter trait value..."
              />
              <button
                onClick={handleSave}
                className="p-1.5 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30
                         transition-colors"
                title="Save"
              >
                <Check size={12} />
              </button>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30
                         transition-colors"
                title="Cancel"
              >
                <X size={12} />
              </button>
            </div>

            {/* Weight slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-slate-500 font-mono uppercase">Weight</span>
                <span className="text-[10px] text-cyan-400 font-mono">{weightPercent}%</span>
              </div>
              <div className="relative h-1.5 bg-slate-800 rounded-full">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500/50 to-cyan-400 rounded-full transition-all"
                  style={{ width: `${weightPercent}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weightPercent}
                  onChange={(e) => setEditWeight(Number(e.target.value) / 100)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-[9px] text-slate-600">
                Higher weight = stronger influence on generation
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="display"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex items-center gap-2"
          >
            {/* Trait value display */}
            <div
              className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded-md
                        bg-slate-800/50 border border-transparent
                        ${trait.editable && !disabled
                          ? 'hover:border-slate-700 cursor-pointer group-hover:bg-slate-800'
                          : ''
                        }
                        transition-colors`}
              onClick={handleStartEdit}
            >
              <span className="text-xs text-slate-300 font-mono truncate">{trait.value}</span>

              <div className="flex items-center gap-2 ml-2">
                {/* Weight indicator */}
                <div className="flex items-center gap-1" title={`Weight: ${weightPercent}%`}>
                  <div className="w-8 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500/60 rounded-full"
                      style={{ width: `${weightPercent}%` }}
                    />
                  </div>
                </div>

                {/* Confidence indicator */}
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    confidencePercent > 80
                      ? 'bg-green-400'
                      : confidencePercent > 50
                      ? 'bg-amber-400'
                      : 'bg-red-400'
                  }`}
                  title={`Confidence: ${confidencePercent}%`}
                />

                {/* Edit icon */}
                {trait.editable && !disabled && (
                  <Edit3 size={10} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>

            {/* Revert button */}
            {canRevert && onRevert && (
              <button
                onClick={handleRevert}
                className="p-1.5 rounded-md text-slate-500 hover:text-amber-400 hover:bg-amber-500/10
                         transition-colors opacity-0 group-hover:opacity-100"
                title="Revert to previous value"
              >
                <Undo2 size={12} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Source badge */}
      <div className="absolute -top-1 -right-1">
        {trait.source === 'user' && (
          <span className="px-1 py-0.5 rounded text-[8px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
            edited
          </span>
        )}
        {trait.source === 'refined' && (
          <span className="px-1 py-0.5 rounded text-[8px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            refined
          </span>
        )}
      </div>
    </div>
  );
}

// Weight slider subcomponent for standalone use
interface WeightSliderProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  disabled?: boolean;
}

export function WeightSlider({ value, onChange, label, disabled = false }: WeightSliderProps) {
  const percent = Math.round(value * 100);

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-500 font-mono uppercase">{label}</span>
          <span className="text-[10px] text-cyan-400 font-mono">{percent}%</span>
        </div>
      )}
      <div className="relative h-1.5 bg-slate-800 rounded-full">
        <div
          className={`h-full rounded-full transition-all ${
            disabled ? 'bg-slate-600' : 'bg-gradient-to-r from-cyan-500/50 to-cyan-400'
          }`}
          style={{ width: `${percent}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={percent}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
