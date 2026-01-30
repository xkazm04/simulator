/**
 * CinematicVideo - Letterboxed video section
 * Displays generated videos in a cinema-style layout
 */

'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize, ChevronLeft, ChevronRight, Film } from 'lucide-react';
import { fadeIn, transitions } from '@/app/features/simulator/lib/motion';

interface VideoItem {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  label: string;
}

interface CinematicVideoProps {
  videos: VideoItem[];
}

export function CinematicVideo({ videos }: CinematicVideoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (videos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Film size={24} className="text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-mono text-slate-600">No videos generated</p>
        </div>
      </div>
    );
  }

  const currentVideo = videos[currentIndex];

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
    setIsPlaying(false);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
    setIsPlaying(false);
  };

  return (
    <div className="h-full flex flex-col justify-center px-4 sm:px-8 lg:px-16">
      {/* Section Label */}
      <motion.div
        className="text-center mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          Generated Videos • {currentIndex + 1} of {videos.length}
        </span>
      </motion.div>

      {/* Video Container */}
      <div className="relative max-w-4xl mx-auto w-full">
        {/* Navigation Buttons */}
        {videos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 p-2 rounded-full bg-black/60 border border-white/10 text-white/60 hover:text-white hover:bg-black/80 transition-all backdrop-blur-sm"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 p-2 rounded-full bg-black/60 border border-white/10 text-white/60 hover:text-white hover:bg-black/80 transition-all backdrop-blur-sm"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Video Player */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentVideo.id}
            className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-purple-500/10"
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.normal}
          >
            {/* Letterbox bars */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-black z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-black z-10" />

            {/* Video */}
            <div className="relative aspect-video bg-black">
              <video
                ref={videoRef}
                src={currentVideo.videoUrl}
                poster={currentVideo.thumbnailUrl}
                muted={isMuted}
                loop
                playsInline
                className="w-full h-full object-contain"
                onEnded={() => setIsPlaying(false)}
              />

              {/* Play button overlay */}
              {!isPlaying && (
                <button
                  onClick={handlePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                >
                  <div className="p-4 rounded-full bg-purple-500/30 border border-purple-500/50 backdrop-blur-sm hover:bg-purple-500/40 transition-colors">
                    <Play size={32} className="text-white" fill="currentColor" />
                  </div>
                </button>
              )}

              {/* Controls overlay */}
              <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between opacity-0 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayPause}
                    className="p-2 rounded-lg bg-black/60 border border-white/10 text-white hover:bg-black/80 transition-colors"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                  </button>
                  <button
                    onClick={handleMute}
                    className="p-2 rounded-lg bg-black/60 border border-white/10 text-white hover:bg-black/80 transition-colors"
                  >
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                </div>
                <button
                  onClick={handleFullscreen}
                  className="p-2 rounded-lg bg-black/60 border border-white/10 text-white hover:bg-black/80 transition-colors"
                >
                  <Maximize size={16} />
                </button>
              </div>

              {/* Video badge */}
              <div className="absolute top-8 left-4 z-20 px-2 py-1 rounded bg-purple-500/30 border border-purple-500/50 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <Film size={10} className="text-purple-300" />
                  <span className="text-[10px] font-mono text-purple-300 uppercase tracking-wider">
                    {currentVideo.label}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Pagination dots */}
        {videos.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {videos.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setIsPlaying(false);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-purple-400 w-6'
                    : 'bg-slate-600 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CinematicVideo;
