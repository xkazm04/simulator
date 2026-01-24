/**
 * SavedImageRegeneration - Regeneration input and original prompt display
 * Includes Gemini regeneration controls and HUD toggle
 */

'use client';

import React, { useState } from 'react';
import { Wand2, Loader2, Gamepad2, X, Copy, Check } from 'lucide-react';

interface SavedImageRegenerationProps {
  prompt: string;
  regeneratePrompt: string;
  isRegenerating: boolean;
  regenerateError: string | null;
  hudEnabled: boolean;
  onHudToggle: (enabled: boolean) => void;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onCopy?: () => void;
}

export function SavedImageRegeneration({
  prompt,
  regeneratePrompt,
  isRegenerating,
  regenerateError,
  hudEnabled,
  onHudToggle,
  onPromptChange,
  onGenerate,
  onCopy,
}: SavedImageRegenerationProps) {
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
      onCopy?.();
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Toggle between transform and overlay mode
  const handleToggleHud = () => {
    onHudToggle(!hudEnabled);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <div className="space-y-md">
      {/* Error Message */}
      {regenerateError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 radius-md">
          <X className="w-4 h-4 text-red-400" />
          <span className="font-mono text-xs text-red-400">{regenerateError}</span>
        </div>
      )}

      {/* Regeneration Input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Wand2 size={12} className="text-purple-400" />
          <label className="font-mono type-label text-slate-400 uppercase">
            Gemini Regeneration
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <textarea
            rows={3}
            value={regeneratePrompt}
            onChange={(e) => {
              onPromptChange(e.target.value);
              // Reset HUD state if user manually edits
              if (hudEnabled) {
                const hasHud = e.target.value.includes('Add game UI overlay:');
                if (!hasHud) onHudToggle(false);
              }
            }}
            placeholder="Describe how to modify this image..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 radius-md
                     font-mono text-xs text-slate-200 placeholder:text-slate-500
                     focus:outline-none focus:border-purple-500/50 resize-none"
            disabled={isRegenerating}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center justify-between">
            <p className="font-mono type-label text-slate-600">
              Tip: &quot;Make it nighttime&quot;, &quot;Add rain&quot;, &quot;Change to anime style&quot; | Ctrl+Enter to generate
            </p>
            <div className="flex items-center gap-2">
              {/* HUD Toggle Button - controls overlay vs transform mode */}
              <button
                onClick={handleToggleHud}
                disabled={isRegenerating}
                className={`flex items-center gap-1 px-2 py-1.5 border radius-md type-label font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${hudEnabled
                    ? 'bg-amber-600/30 border-amber-500/50 text-amber-300'
                    : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-400 hover:text-slate-300'
                  }`}
                title={hudEnabled ? 'Overlay mode: adds elements on top of image' : 'Transform mode: redesigns the image'}
              >
                <Gamepad2 size={12} />
                {hudEnabled ? 'Overlay' : 'Transform'}
              </button>
              <button
                onClick={onGenerate}
                disabled={!regeneratePrompt.trim() || isRegenerating}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700
                         disabled:cursor-not-allowed radius-md font-mono type-label text-white
                         flex items-center gap-1.5 transition-colors"
              >
                {isRegenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 size={12} />}
                Generate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Original Prompt Section */}
      <div className="space-y-2">
        <h4 className="type-body-sm font-medium text-slate-400 uppercase tracking-wider">Original Prompt</h4>
        <div className="p-3 radius-md border border-slate-800 bg-slate-900/40 max-h-32 overflow-y-auto custom-scrollbar" data-testid="saved-image-prompt-container">
          <p className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
            {prompt ? (
              prompt.split(/(".*?"|\d+)/g).map((part, i) => {
                if (part && part.startsWith('"') && part.endsWith('"')) {
                  return <span key={i} className="text-amber-400">{part}</span>;
                }
                if (!isNaN(Number(part)) && part.trim() !== '') {
                  return <span key={i} className="text-cyan-400 font-bold">{part}</span>;
                }
                return <span key={i}>{part}</span>;
              })
            ) : (
              <span className="text-slate-500 italic">No prompt saved</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!prompt}
            data-testid="saved-image-copy-btn"
            className={`flex items-center gap-1.5 px-3 py-1.5 radius-md border text-xs font-medium transition-colors ${justCopied
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50'
              }`}
          >
            {justCopied ? <Check size={12} /> : <Copy size={12} />}
            {justCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
