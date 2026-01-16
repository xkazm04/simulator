'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Check, Loader2, AlertCircle, Server, Key, User } from 'lucide-react';
import type { StudioSettings, Developer } from '../types';
import { getSettings, saveSettings, clearSettings, validateCredentials } from '../lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: StudioSettings | null) => void;
  forceOpen?: boolean; // Prevents closing if true (first-time setup)
}

export function SettingsModal({
  isOpen,
  onClose,
  onSettingsChange,
  forceOpen = false,
}: SettingsModalProps) {
  const [coordinatorUrl, setCoordinatorUrl] = useState('http://localhost:8000');
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [developer, setDeveloper] = useState<Developer | null>(null);

  // Load existing settings on mount
  useEffect(() => {
    const settings = getSettings();
    if (settings) {
      setCoordinatorUrl(settings.coordinatorUrl);
      setApiKey(settings.apiKey);
      if (settings.developerName) {
        setDeveloper({
          id: settings.developerId || '',
          name: settings.developerName,
          email: '',
          credits_balance: 0,
          created_at: '',
        });
      }
    }
  }, [isOpen]);

  const handleValidate = async () => {
    if (!coordinatorUrl || !apiKey) {
      setError('Please enter both URL and API key');
      return;
    }

    setIsValidating(true);
    setError(null);

    // Temporarily save settings for validation
    const tempSettings: StudioSettings = {
      coordinatorUrl: coordinatorUrl.replace(/\/$/, ''), // Remove trailing slash
      apiKey,
    };
    saveSettings(tempSettings);

    try {
      const dev = await validateCredentials();
      setDeveloper(dev);

      // Save complete settings
      const completeSettings: StudioSettings = {
        ...tempSettings,
        developerName: dev.name,
        developerId: dev.id,
      };
      saveSettings(completeSettings);
      onSettingsChange(completeSettings);

      // Auto-close after successful validation (if not forced open)
      if (!forceOpen) {
        setTimeout(() => onClose(), 1000);
      }
    } catch (err) {
      clearSettings();
      setDeveloper(null);
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDisconnect = () => {
    clearSettings();
    setDeveloper(null);
    setApiKey('');
    onSettingsChange(null);
  };

  const handleClose = () => {
    if (forceOpen && !developer) {
      setError('Please configure API settings to continue');
      return;
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                       w-full max-w-md bg-[#12121a] border border-white/10 rounded-xl
                       shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <Settings size={18} className="text-cyan-400" />
                </div>
                <div>
                  <h2 className="font-mono text-sm uppercase tracking-wider text-white">
                    api_settings
                  </h2>
                  <p className="text-xs text-slate-500">Connect to coordinator</p>
                </div>
              </div>
              {!forceOpen && (
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white
                           transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Coordinator URL */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-mono text-[10px] uppercase
                                tracking-wider text-slate-500">
                  <Server size={12} />
                  coordinator_url
                </label>
                <input
                  type="text"
                  value={coordinatorUrl}
                  onChange={(e) => setCoordinatorUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700/50
                           rounded-lg text-sm text-slate-200 placeholder-slate-600
                           focus:outline-none focus:border-cyan-500/40 focus:ring-1
                           focus:ring-cyan-500/20 font-mono transition-colors"
                />
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-mono text-[10px] uppercase
                                tracking-wider text-slate-500">
                  <Key size={12} />
                  api_key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700/50
                           rounded-lg text-sm text-slate-200 placeholder-slate-600
                           focus:outline-none focus:border-cyan-500/40 focus:ring-1
                           focus:ring-cyan-500/20 font-mono transition-colors"
                />
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border
                             border-red-500/30 rounded-lg text-sm text-red-400"
                  >
                    <AlertCircle size={16} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Connected Developer */}
              <AnimatePresence>
                {developer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border
                             border-green-500/30 rounded-lg"
                  >
                    <div className="p-2 rounded-full bg-green-500/20">
                      <User size={16} className="text-green-400" />
                    </div>
                    <div className="flex-1">
                      <div className="font-mono text-sm text-green-400">{developer.name}</div>
                      <div className="text-xs text-green-400/60">Connected</div>
                    </div>
                    <Check size={18} className="text-green-400" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-white/10 bg-black/20">
              {developer ? (
                <>
                  <button
                    onClick={handleDisconnect}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-red-500/30
                             text-red-400 hover:bg-red-500/10 font-mono text-xs uppercase
                             tracking-wider transition-colors"
                  >
                    disconnect
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-500/20 border
                             border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30
                             font-mono text-xs uppercase tracking-wider transition-colors"
                  >
                    done
                  </button>
                </>
              ) : (
                <button
                  onClick={handleValidate}
                  disabled={isValidating || !coordinatorUrl || !apiKey}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                           rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400
                           hover:bg-cyan-500/30 font-mono text-xs uppercase tracking-wider
                           transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isValidating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      validating...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      connect
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
