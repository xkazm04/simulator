/**
 * ShowcaseCinematic - Full viewport immersive project showcase
 *
 * Reimagines the Simulator's Onion Ring layout for view-only mode:
 * - Hero Zone: Massive ambient poster with glow effects
 * - Floating Gallery: Images arranged in orbital positions
 * - Dimension Ribbon: Glowing tags as decorative sidebar
 * - Prompt Narrative: Elegant scrolling quote display
 * - Cinematic Video: Letterboxed video section
 */

'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/app/features/simulator/lib/motion';
import { ProjectWithState } from './ProjectShowcaseModal';
import { HeroZone } from './cinematic/HeroZone';
import { FloatingGallery } from './cinematic/FloatingGallery';
import { DimensionRibbon } from './cinematic/DimensionRibbon';
import { DimensionSpotlight } from './cinematic/DimensionSpotlight';
import { BasePromptBanner } from './cinematic/BasePromptBanner';
import { PromptNarrative } from './cinematic/PromptNarrative';
import { CinematicVideo } from './cinematic/CinematicVideo';
import { ShowcasePlayer } from './cinematic/ShowcasePlayer';
import { AmbientEffects } from './cinematic/AmbientEffects';
import { StatsBar } from './cinematic/StatsBar';

interface Dimension {
  id: string;
  type: string;
  label: string;
  reference: string;
  weight?: number;
}

interface ShowcaseCinematicProps {
  project: ProjectWithState;
  onImageClick: (imageId: string) => void;
}

export function ShowcaseCinematic({ project, onImageClick }: ShowcaseCinematicProps) {
  const [activeSection, setActiveSection] = useState<'showcase' | 'gallery' | 'prompts' | 'video'>('showcase');
  const [selectedDimension, setSelectedDimension] = useState<Dimension | null>(null);

  // Parse dimensions from JSON
  const dimensions = useMemo(() => {
    if (!project.state?.dimensions_json) return [];
    try {
      return JSON.parse(project.state.dimensions_json);
    } catch {
      return [];
    }
  }, [project.state?.dimensions_json]);

  // Filter images with videos
  const imagesWithVideos = useMemo(() => {
    return project.panelImages.filter(img => img.video_url);
  }, [project.panelImages]);

  // Hero image - poster or first panel image
  const heroImage = project.poster?.image_url || project.panelImages[0]?.image_url;

  // All viewable images (poster + panel images)
  const allImages = useMemo(() => {
    const images = [];
    if (project.poster) {
      images.push({
        id: project.poster.id,
        url: project.poster.image_url,
        label: 'Project Poster',
        isPoster: true,
      });
    }
    project.panelImages.forEach(img => {
      images.push({
        id: img.id,
        url: img.image_url,
        label: `${img.side} • Slot ${img.slot_index + 1}`,
        isPoster: false,
        hasVideo: Boolean(img.video_url),
      });
    });
    return images;
  }, [project.poster, project.panelImages]);

  // Stats for display
  const stats = {
    images: project.panelImages.length,
    dimensions: dimensions.filter((d: { reference?: string }) => d.reference).length,
    prompts: project.generatedPrompts.length,
    videos: imagesWithVideos.length,
  };

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-[#030303]">
      {/* Ambient Background Effects */}
      <AmbientEffects heroImageUrl={heroImage} />

      {/* Main Content Grid - Onion Ring Inspired */}
      <motion.div
        className="relative z-10 w-full h-full flex flex-col"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Top Ring: Stats Bar */}
        <StatsBar
          projectName={project.name}
          createdAt={project.created_at}
          stats={stats}
        />

        {/* Center Ring: Main Content Area */}
        <div className="flex-1 flex min-h-0 min-w-0">
          {/* Left Ribbon: Dimensions */}
          <DimensionRibbon
            dimensions={dimensions}
            onDimensionClick={setSelectedDimension}
          />

          {/* Center: Hero + Gallery/Content */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
            {/* Base Prompt Banner - Absolute top inside center area */}
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-2">
              <BasePromptBanner prompt={project.state?.base_prompt || null} />
            </div>

            {/* Hero Zone - Always visible as ambient background */}
            <HeroZone
              imageUrl={heroImage}
              projectName={project.name}
              onImageClick={() => heroImage && onImageClick(project.poster?.id || project.panelImages[0]?.id)}
            />

            {/* Content Overlay - Section Navigation */}
            <div className="absolute bottom-0 left-0 right-0 z-20 overflow-hidden">
              {/* Section Tabs */}
              <div className="flex justify-center gap-2 mb-4">
                {['showcase', 'gallery', 'prompts', 'video'].map((section) => {
                  const isActive = activeSection === section;
                  const count = section === 'showcase' ? allImages.length
                    : section === 'gallery' ? stats.images
                    : section === 'prompts' ? stats.prompts
                    : stats.videos;

                  // Hide video tab if no individual videos, hide showcase if no images
                  if (section === 'video' && count === 0) return null;
                  if (section === 'showcase' && allImages.length === 0) return null;

                  return (
                    <button
                      key={section}
                      onClick={() => setActiveSection(section as typeof activeSection)}
                      className={`
                        px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider
                        transition-all duration-300 backdrop-blur-sm
                        ${isActive
                          ? 'bg-white/10 text-white border border-white/20'
                          : 'bg-black/20 text-slate-500 border border-transparent hover:text-slate-300 hover:border-slate-700/50'
                        }
                      `}
                    >
                      {section} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Active Section Content */}
              <div className="h-[280px] overflow-hidden bg-gradient-to-t from-black via-black/95 to-transparent">
                {activeSection === 'showcase' && (
                  <div className="h-full flex items-center justify-center px-4">
                    <ShowcasePlayer
                      projectName={project.name}
                      images={allImages.map(img => ({
                        id: img.id,
                        url: img.url,
                        label: img.label,
                      }))}
                      className="w-full max-w-2xl"
                    />
                  </div>
                )}
                {activeSection === 'gallery' && (
                  <FloatingGallery
                    images={allImages}
                    onImageClick={onImageClick}
                  />
                )}
                {activeSection === 'prompts' && (
                  <PromptNarrative prompts={project.generatedPrompts} />
                )}
                {activeSection === 'video' && (
                  <CinematicVideo
                    videos={imagesWithVideos.map(img => ({
                      id: img.id,
                      videoUrl: img.video_url!,
                      thumbnailUrl: img.image_url,
                      label: `${img.side} • Slot ${img.slot_index + 1}`,
                    }))}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Ribbon: Mirror for balance (or prompts preview) */}
          <div className="w-16 lg:w-20 shrink-0 border-l border-white/5 bg-black/20 backdrop-blur-sm hidden lg:flex flex-col items-center py-8 gap-4">
            {/* Decorative elements */}
            <div className="w-1 h-full bg-gradient-to-b from-transparent via-rose-500/20 to-transparent rounded-full" />
          </div>
        </div>
      </motion.div>

      {/* Cinematic Letterbox Bars */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black to-transparent pointer-events-none z-30" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black to-transparent pointer-events-none z-30" />

      {/* Dimension Spotlight Overlay */}
      <DimensionSpotlight
        dimension={selectedDimension}
        onClose={() => setSelectedDimension(null)}
      />
    </div>
  );
}

export default ShowcaseCinematic;
