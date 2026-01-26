/**
 * ModalLoadingFallback - Loading state for lazy-loaded modals
 */

'use client';

export function ModalLoadingFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-6 py-4 bg-slate-800 rounded-lg border border-slate-700">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-sm text-slate-300">Loading...</span>
      </div>
    </div>
  );
}
