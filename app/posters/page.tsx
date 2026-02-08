/**
 * Posters Gallery Page
 * Public gallery displaying all project posters
 * Click on a poster to open full project showcase modal
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PosterGallery, GalleryPoster } from '../features/simulator/components/PosterGallery';
import { ProjectShowcaseModal } from './components';

export default function PostersPage() {
  const [posters, setPosters] = useState<GalleryPoster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

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

  // --- Poster error cleanup: collect 403 failures, debounce, call cleanup API ---
  const failedPosterIdsRef = useRef<Set<string>>(new Set());
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePosterError = useCallback((posterId: string) => {
    failedPosterIdsRef.current.add(posterId);

    if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    cleanupTimerRef.current = setTimeout(async () => {
      const ids = Array.from(failedPosterIdsRef.current);
      failedPosterIdsRef.current.clear();
      if (ids.length === 0) return;

      try {
        const res = await fetch('/api/posters/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ posterIds: ids }),
        });
        const data = await res.json();
        if (data.success && data.deleted.length > 0) {
          const deletedSet = new Set<string>(data.deleted);
          setPosters(prev => prev.filter(p => !deletedSet.has(p.id)));
        }
      } catch (err) {
        console.error('Poster cleanup failed:', err);
      }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans">
      {/* Floating Back Button */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2
                   bg-slate-900/80 backdrop-blur-sm border border-slate-700/50
                   rounded-lg text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} />
        <span className="text-sm font-mono">Back to Simulator</span>
      </Link>

      {/* Gallery */}
      <main className="max-w-7xl mx-auto py-8">
        <PosterGallery
          posters={posters}
          isLoading={isLoading}
          onPosterClick={(poster) => setSelectedProjectId(poster.project_id)}
          onPosterError={handlePosterError}
        />
      </main>

      {/* Project Showcase Modal */}
      <ProjectShowcaseModal
        projectId={selectedProjectId}
        isOpen={!!selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
      />
    </div>
  );
}
