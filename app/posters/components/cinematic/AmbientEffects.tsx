/**
 * AmbientEffects - Background visual effects for cinematic atmosphere
 * Creates depth with gradients, blur, and subtle animations
 */

'use client';

import React from 'react';
import Image from 'next/image';

interface AmbientEffectsProps {
  heroImageUrl?: string;
}

export function AmbientEffects({ heroImageUrl }: AmbientEffectsProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-[#030303] to-[#030303]" />

      {/* Hero image as blurred ambient background */}
      {heroImageUrl && (
        <div className="absolute inset-0 opacity-30">
          <Image
            src={heroImageUrl}
            alt=""
            fill
            className="object-cover blur-3xl scale-110"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
        </div>
      )}


      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_50%,rgba(0,0,0,0.8)_100%)]" />

      {/* Scan lines effect (very subtle) */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        }}
      />
    </div>
  );
}

export default AmbientEffects;
