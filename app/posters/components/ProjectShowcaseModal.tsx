/**
 * ProjectShowcaseModal - Full-screen modal overlay for project showcase
 * Displays all project content in a read-only, immersive masonry layout
 *
 * Features:
 * - React Portal rendering (direct child of document.body)
 * - Focus trap (Tab/Shift+Tab cycles within modal)
 * - Scroll lock with scrollbar compensation (no layout shift)
 * - ESC key closes lightbox first, then modal
 * - Backdrop click to close
 * - Smooth fade animations via Framer Motion
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { fadeIn, modalContent, transitions } from '@/app/features/simulator/lib/motion';
import { useFocusTrap } from '@/app/lib/hooks/useFocusTrap';
import { useScrollLock } from '@/app/lib/hooks/useScrollLock';
import { ShowcaseHeader } from './ShowcaseHeader';
import { ShowcaseCinematic } from './ShowcaseCinematic';
import { ShowcaseLightbox } from './ShowcaseLightbox';

// Types matching the API response
interface PanelImage {
  id: string;
  project_id: string;
  side: 'left' | 'right';
  slot_index: number;
  image_url: string;
  video_url: string | null;
  prompt: string | null;
  type: 'gameplay' | 'trailer' | 'sketch' | 'poster' | 'realistic' | null;
  created_at: string;
}

interface ProjectPoster {
  id: string;
  project_id: string;
  image_url: string;
  prompt: string | null;
  dimensions_json: string | null;
  created_at: string;
}

interface GeneratedPrompt {
  id: string;
  project_id: string;
  scene_number: number;
  scene_type: string;
  prompt: string;
  negative_prompt: string | null;
  copied: number;
  rating: string | null;
  locked: number;
  elements_json: string | null;
  created_at: string;
}

interface Dimension {
  id: string;
  type: string;
  label: string;
  reference: string;
  weight?: number;
}

interface ProjectState {
  project_id: string;
  base_prompt: string | null;
  base_image_file: string | null;
  output_mode: string;
  dimensions_json: Dimension[] | string | null;
  feedback_json: Record<string, unknown> | string | null;
  updated_at: string;
}

export interface ProjectWithState {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  state: ProjectState | null;
  panelImages: PanelImage[];
  poster: ProjectPoster | null;
  generatedPrompts: GeneratedPrompt[];
}

export interface LightboxImage {
  id: string;
  image_url: string;
  video_url: string | null;
  prompt: string | null;
  label: string;
}

interface ProjectShowcaseModalProps {
  projectId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectShowcaseModal({ projectId, isOpen, onClose }: ProjectShowcaseModalProps) {
  const [project, setProject] = useState<ProjectWithState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SSR safety: only render portal after client mount
  const [mounted, setMounted] = useState(false);

  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Focus trap: cycles Tab/Shift+Tab within modal
  const focusTrapRef = useFocusTrap(isOpen);

  // Scroll lock: prevents body scroll with scrollbar compensation
  useScrollLock(isOpen);

  // Client-side mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch project data when modal opens
  useEffect(() => {
    if (!projectId || !isOpen) {
      setProject(null);
      setError(null);
      return;
    }

    const fetchProject = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/projects/${projectId}`);
        const data = await response.json();

        if (data.success) {
          setProject(data.project);

          // Build lightbox images array
          const images: LightboxImage[] = [];

          // Add poster first if exists
          if (data.project.poster) {
            images.push({
              id: data.project.poster.id,
              image_url: data.project.poster.image_url,
              video_url: null,
              prompt: data.project.poster.prompt,
              label: 'Project Poster',
            });
          }

          // Add panel images
          data.project.panelImages.forEach((img: PanelImage) => {
            images.push({
              id: img.id,
              image_url: img.image_url,
              video_url: img.video_url,
              prompt: img.prompt,
              label: `${img.side === 'left' ? 'Left' : 'Right'} Panel - Slot ${img.slot_index + 1}`,
            });
          });

          setLightboxImages(images);
        } else {
          setError(data.error || 'Failed to load project');
        }
      } catch (err) {
        console.error('Failed to fetch project:', err);
        setError('Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [projectId, isOpen]);

  // Handle escape key - lightbox closes first, then modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxIndex !== null) {
          setLightboxIndex(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, lightboxIndex, onClose]);

  // Open lightbox for specific image
  const handleImageClick = useCallback((imageId: string) => {
    const index = lightboxImages.findIndex(img => img.id === imageId);
    if (index !== -1) {
      setLightboxIndex(index);
    }
  }, [lightboxImages]);

  // Navigate lightbox
  const handleLightboxPrev = useCallback(() => {
    setLightboxIndex(prev =>
      prev !== null ? (prev - 1 + lightboxImages.length) % lightboxImages.length : null
    );
  }, [lightboxImages.length]);

  const handleLightboxNext = useCallback(() => {
    setLightboxIndex(prev =>
      prev !== null ? (prev + 1) % lightboxImages.length : null
    );
  }, [lightboxImages.length]);

  // Parse dimensions from state (handles both array and stringified JSON)
  const parsedDimensions = useMemo((): Dimension[] => {
    if (!project?.state?.dimensions_json) return [];
    const raw = project.state.dimensions_json;
    // If already an array, use directly
    if (Array.isArray(raw)) return raw;
    // If string, parse it
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  }, [project?.state?.dimensions_json]);

  // Calculate stats for header
  const stats = useMemo(() => {
    if (!project) return undefined;
    const imagesWithVideos = project.panelImages.filter(img => img.video_url);
    const sketchImages = project.panelImages.filter(img => img.type === 'sketch');
    return {
      images: project.panelImages.length,
      dimensions: parsedDimensions.filter(d => d.reference).length,
      prompts: project.generatedPrompts.length,
      videos: imagesWithVideos.length,
      sketches: sketchImages.length,
    };
  }, [project, parsedDimensions]);

  // Don't render portal until client-side mount (SSR safety)
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col"
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitions.fast}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal Content - Full viewport cinematic experience */}
          <motion.div
            ref={focusTrapRef}
            className="relative w-full h-full"
            variants={modalContent}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.normal}
            role="dialog"
            aria-modal="true"
            aria-label="Project showcase"
          >
            {/* Floating Header - Absolutely positioned */}
            <ShowcaseHeader
              projectName={project?.name || 'Loading...'}
              createdAt={project?.created_at}
              onClose={onClose}
              stats={stats}
            />

            {/* Content Area - Full height */}
            {isLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="p-4 rounded-full bg-rose-500/20 border border-rose-500/30">
                  <Loader2 size={32} className="text-rose-400 animate-spin" />
                </div>
                <p className="text-sm text-slate-400 font-mono">Loading project...</p>
              </div>
            ) : error ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="p-4 rounded-full bg-red-500/20 border border-red-500/30">
                  <AlertCircle size={32} className="text-red-400" />
                </div>
                <p className="text-sm text-red-400 font-mono">{error}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            ) : project ? (
              <ShowcaseCinematic
                project={project}
                onImageClick={handleImageClick}
              />
            ) : null}
          </motion.div>

          {/* Lightbox */}
          <ShowcaseLightbox
            images={lightboxImages}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onPrev={handleLightboxPrev}
            onNext={handleLightboxNext}
            projectName={project?.name || 'Project'}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default ProjectShowcaseModal;
