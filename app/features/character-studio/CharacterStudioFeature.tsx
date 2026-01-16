'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Plus,
  Clapperboard,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import type { Character, StudioSettings, ViewMode, Worker } from './types';
import { getSettings, listCharacters, listWorkers } from './lib/api';
import { SettingsModal } from './components/SettingsModal';
import { CharacterRoster } from './components/CharacterRoster';
import { MainStage } from './components/MainStage';
import { IdentityInspector } from './components/IdentityInspector';
import { GeneratorToolbar } from './components/GeneratorToolbar';
import { JobTestTab } from './components/JobTestTab';

export function CharacterStudioFeature() {
  // Settings state
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // UI state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('portrait');

  // Data state
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected character derived state
  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) || null;

  // Initialize settings on mount
  useEffect(() => {
    const stored = getSettings();
    if (stored?.apiKey && stored?.coordinatorUrl) {
      setSettings(stored);
    } else {
      setIsSettingsOpen(true);
    }
    setIsInitialized(true);
  }, []);

  // Load characters when settings are available
  useEffect(() => {
    if (!settings) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [charResponse, workerResponse] = await Promise.all([
          listCharacters(),
          listWorkers('online'),
        ]);
        setCharacters(charResponse.characters);
        setWorkers(workerResponse.workers);

        // Select first character if none selected
        if (!selectedCharacterId && charResponse.characters.length > 0) {
          setSelectedCharacterId(charResponse.characters[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [settings, selectedCharacterId]);

  // Refresh characters
  const refreshCharacters = useCallback(async () => {
    if (!settings) return;
    try {
      const response = await listCharacters();
      setCharacters(response.characters);
    } catch (err) {
      console.error('Failed to refresh characters:', err);
    }
  }, [settings]);

  // Handle settings change
  const handleSettingsChange = (newSettings: StudioSettings | null) => {
    setSettings(newSettings);
    if (!newSettings) {
      setCharacters([]);
      setWorkers([]);
      setSelectedCharacterId(null);
    }
  };

  // Handle character selection
  const handleSelectCharacter = (characterId: string) => {
    setSelectedCharacterId(characterId);
    // Ensure inspector is visible when selecting
    if (isInspectorCollapsed) {
      setIsInspectorCollapsed(false);
    }
  };

  // Handle character creation
  const handleCreateCharacter = () => {
    // TODO: Open wizard modal
    console.log('Create character');
  };

  // Show loading state before initialization
  if (!isInitialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0f]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Clapperboard size={48} className="text-cyan-400" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute -inset-2 border-2 border-cyan-500/30 border-t-cyan-500
                       rounded-full"
            />
          </div>
          <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">
            initializing...
          </span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5
                        bg-[#0a0a0f]/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {/* Back to Simulator */}
          <Link
            href="/simulator"
            className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white
                     hover:bg-white/5 hover:border-white/20 transition-colors"
            title="Back to Simulator"
          >
            <ArrowLeft size={18} />
          </Link>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20
                          border border-cyan-500/20">
              <Clapperboard size={20} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="font-mono text-sm uppercase tracking-wider text-white">
                the character foundry
              </h1>
              <p className="text-[10px] text-slate-500">
                {settings?.developerName ? `${settings.developerName}` : 'Not connected'}
              </p>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 ml-8 p-1 bg-slate-900/50 rounded-lg border
                        border-white/5">
            {(['portrait', 'constellation', 'job-test'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider
                          transition-all ${
                            viewMode === mode
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
              >
                {mode === 'portrait' ? 'studio' : mode === 'constellation' ? 'constellation' : 'job test'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* New Character Button */}
          <button
            onClick={handleCreateCharacter}
            disabled={!settings}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border
                     border-purple-500/30 text-purple-400 hover:bg-purple-500/30
                     font-mono text-xs uppercase tracking-wider transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            new actor
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`p-2 rounded-lg border transition-colors ${
              settings
                ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                : 'border-amber-500/30 text-amber-400 bg-amber-500/10 animate-pulse'
            }`}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Character Roster */}
        <AnimatePresence initial={false}>
          <motion.aside
            initial={false}
            animate={{
              width: isSidebarCollapsed ? 56 : 280,
            }}
            transition={{ duration: 0.2 }}
            className="h-full border-r border-white/5 bg-[#0c0c14] flex flex-col"
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              {!isSidebarCollapsed && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  roster
                </span>
              )}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-white
                         transition-colors ml-auto"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen size={14} />
                ) : (
                  <PanelLeftClose size={14} />
                )}
              </button>
            </div>

            {/* Character List */}
            <CharacterRoster
              characters={characters}
              selectedId={selectedCharacterId}
              onSelect={handleSelectCharacter}
              onCreate={handleCreateCharacter}
              isCollapsed={isSidebarCollapsed}
              isLoading={isLoading}
            />
          </motion.aside>
        </AnimatePresence>

        {/* Center - Main Stage */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0f]">
          {viewMode === 'job-test' ? (
            <JobTestTab workers={workers} />
          ) : (
            <>
              <MainStage
                character={selectedCharacter}
                viewMode={viewMode}
                characters={characters}
                onSelectCharacter={handleSelectCharacter}
                isLoading={isLoading}
              />

              {/* Generator Toolbar */}
              <GeneratorToolbar
                character={selectedCharacter}
                workers={workers}
                onGenerate={(prompt, preset, workerId) => {
                  console.log('Generate:', { prompt, preset, workerId });
                }}
              />
            </>
          )}
        </main>

        {/* Right Sidebar - Identity Inspector */}
        <AnimatePresence initial={false}>
          <motion.aside
            initial={false}
            animate={{
              width: isInspectorCollapsed ? 56 : 320,
            }}
            transition={{ duration: 0.2 }}
            className="h-full border-l border-white/5 bg-[#0c0c14] flex flex-col"
          >
            {/* Inspector Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              <button
                onClick={() => setIsInspectorCollapsed(!isInspectorCollapsed)}
                className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-white
                         transition-colors"
              >
                {isInspectorCollapsed ? (
                  <PanelRightOpen size={14} />
                ) : (
                  <PanelRightClose size={14} />
                )}
              </button>
              {!isInspectorCollapsed && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  identity
                </span>
              )}
            </div>

            {/* Inspector Content */}
            <IdentityInspector
              character={selectedCharacter}
              isCollapsed={isInspectorCollapsed}
              onRefine={() => {
                console.log('Refine DNA');
              }}
              onAddReferences={() => {
                console.log('Add references');
              }}
            />
          </motion.aside>
        </AnimatePresence>
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between px-4 py-2 border-t border-white/5
                        bg-[#0a0a0f]/80 text-[10px] font-mono text-slate-600">
        <div className="flex items-center gap-4">
          <span>
            {settings ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                not connected
              </span>
            )}
          </span>
          <span>{characters.length} characters</span>
          <span>{workers.length} workers online</span>
        </div>
        <div className="flex items-center gap-4">
          {error && <span className="text-red-400">{error}</span>}
          <span>v1.0.0</span>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsChange={handleSettingsChange}
        forceOpen={!settings}
      />
    </div>
  );
}
