/**
 * Posters Gallery Page
 * Public gallery displaying all project posters
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Film, ArrowLeft } from 'lucide-react';
import { PosterGallery, GalleryPoster } from '../features/simulator/components/PosterGallery';
import { PosterModal } from '../features/simulator/components/PosterModal';

export default function PostersPage() {
  const [posters, setPosters] = useState<GalleryPoster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPoster, setSelectedPoster] = useState<GalleryPoster | null>(null);

  // Fetch all posters on mount
  useEffect(() => {
    const fetchPosters = async () => {
      try {
        const response = await fetch('/api/posters');
        const data = await response.json();
        if (data.success) {
          setPosters(data.posters);
        }
      } catch (error) {
        console.error('Failed to fetch posters:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosters();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/50 bg-[#050505]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Back to Simulator */}
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={16} />
            <span className="text-sm font-mono">Back to Simulator</span>
          </Link>

          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-rose-500/20 border border-rose-500/30">
              <Film size={20} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Poster Gallery</h1>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                {posters.length} poster{posters.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center p-1 bg-slate-900/80 rounded-lg border border-slate-800/50">
            <Link href="/">
              <button className="px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
                Simulator
              </button>
            </Link>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <Link href="/character-studio">
              <button className="px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
                Characters
              </button>
            </Link>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <button className="px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider shadow-sm transition-all shadow-rose-900/20 text-rose-400 bg-rose-950/30 border border-rose-500/20">
              Posters
            </button>
          </div>
        </div>
      </header>

      {/* Gallery */}
      <main className="max-w-7xl mx-auto py-8">
        <PosterGallery
          posters={posters}
          isLoading={isLoading}
          onPosterClick={setSelectedPoster}
        />
      </main>

      {/* Modal */}
      <PosterModal
        poster={selectedPoster}
        isOpen={!!selectedPoster}
        onClose={() => setSelectedPoster(null)}
      />
    </div>
  );
}
