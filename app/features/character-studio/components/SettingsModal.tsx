'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Check, Loader2, AlertCircle, Server, Key, User } from 'lucide-react';
import type { StudioSettings, Developer } from '../types';
import { getSettings, saveSettings, clearSettings, validateCredentials } from '../lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: StudioSettings | null) => void;
  forceOpen?: boolean;
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
  const [mounted, setMounted] = useState(false);

  // Track client-side mount for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load existing settings when modal opens
  useEffect(() => {
    if (!isOpen) return;
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

    const tempSettings: StudioSettings = {
      coordinatorUrl: coordinatorUrl.replace(/\/$/, ''),
      apiKey,
    };
    saveSettings(tempSettings);

    try {
      const dev = await validateCredentials();
      setDeveloper(dev);

      const completeSettings: StudioSettings = {
        ...tempSettings,
        developerName: dev.name,
        developerId: dev.id,
      };
      saveSettings(completeSettings);
      onSettingsChange(completeSettings);

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
      setError('Please configure API settings to continue, or click "Skip" for demo mode');
      return;
    }
    onClose();
  };

  const handleBypass = () => {
    const mockSettings: StudioSettings = {
      coordinatorUrl: 'http://localhost:8000',
      apiKey: 'demo-mode',
      developerName: 'Demo User',
      developerId: 'demo',
    };
    saveSettings(mockSettings);
    onSettingsChange(mockSettings);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: '28rem',
          background: '#12121a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
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
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border
                          border-red-500/30 rounded-lg text-sm text-red-400">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Connected Developer */}
          {developer && (
            <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border
                          border-green-500/30 rounded-lg">
              <div className="p-2 rounded-full bg-green-500/20">
                <User size={16} className="text-green-400" />
              </div>
              <div className="flex-1">
                <div className="font-mono text-sm text-green-400">{developer.name}</div>
                <div className="text-xs text-green-400/60">Connected</div>
              </div>
              <Check size={18} className="text-green-400" />
            </div>
          )}
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
            <div className="w-full flex flex-col gap-2">
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
              {forceOpen && (
                <button
                  onClick={handleBypass}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 text-slate-500
                           hover:bg-slate-800 hover:text-slate-400 font-mono text-[10px] uppercase
                           tracking-wider transition-colors"
                >
                  skip (demo mode)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
