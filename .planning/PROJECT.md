# Simulator

## What This Is

A "What If" image visualization tool that combines cultural references (games, movies, art) to generate unique prompts for AI image generators. Users describe a vision through Smart Breakdown, adjust dimensions, and generate images in Gameplay (mechanics-focused) or Concept (artstyle-focused) modes. Autoplay automates the generate-evaluate-refine loop.

## Core Value

Transform fuzzy creative visions into concrete, curated AI-generated imagery through intelligent prompt building and automated refinement.

## Current Milestone: v1.2 Video Showcase

**Goal:** Transform the project showcase into an automated video experience using Remotion, creating shareable cinematic presentations from project images.

**Target features:**
- Remotion integration for video composition
- On-demand video generation from project images
- Full-screen immersive video showcase (replaces static hero card)
- MP4 export for sharing on social/portfolio
- Cinematic transitions and effects between images

## Requirements

### Validated

<!-- Shipped capabilities -->

- [x] Image generation via Leonardo AI — v1.0
- [x] Dimension-based prompt building — v1.0
- [x] Smart Breakdown vision parsing — v1.0
- [x] Direction center for refinement feedback — v1.0
- [x] Panel image saving system — v1.0
- [x] Gemini AI provider integration — v1.0
- [x] Autoplay orchestration loop (generate → evaluate → refine) — v1.0
- [x] Autoplay UI controls with target picker — v1.0
- [x] Step indicator and progress display — v1.0
- [x] UI lock during autoplay — v1.0

### Active

<!-- v1.2 Video Showcase scope -->

- [ ] Remotion integration for programmatic video generation
- [ ] Video composition from project panel images
- [ ] On-demand "Generate Video" button in showcase
- [ ] Full-screen video player replacing static hero card
- [ ] MP4 export functionality for sharing
- [ ] Cinematic transitions between images

### Out of Scope

- Poster mode changes — separate workflow, working as intended
- Natural language goal input for autoplay — keeping number picker
- Live video streaming — pre-rendered videos only
- User-customizable video templates — automated composition only for v1.2
- Audio/music integration — visual-only for initial release

## Context

**Current Showcase Architecture:**
- `/posters` page with grid gallery of saved projects
- `ProjectShowcaseModal` opens full-screen portal on click
- `ShowcaseCinematic` renders hero zone, floating gallery, dimension ribbon
- `MediaSkeleton` shows gray loading state before content
- Existing `CinematicVideo` component for HTML5 video playback
- `ShowcaseLightbox` for full-screen image viewing with navigation

**Video Showcase Goal:**
- Replace static hero card with dynamically generated video
- Compose all project panel images into cinematic sequence
- Use Remotion for programmatic video composition
- Trigger: On-demand button (not automatic)
- Output: Both in-app playback AND MP4 export

**Key integration points:**
- `app/posters/components/ShowcaseCinematic.tsx` — main showcase view
- `app/posters/components/cinematic/HeroZone.tsx` — will become video player
- `app/posters/components/ProjectShowcaseModal.tsx` — modal wrapper
- `app/api/projects/[id]/route.ts` — project data with panelImages

## Constraints

- **Tech stack**: Existing Next.js / React / Tailwind / Framer Motion
- **AI Provider**: Use existing Gemini provider
- **Backward compatibility**: Existing saved projects should still load

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gemini for evaluation | Already integrated, vision capable | ✓ Good |
| 3 iteration limit | Balance automation vs cost | ✓ Good |
| useReducer state machine | Matches codebase patterns | ✓ Good |
| Delete Presets entirely | Reduces complexity, user preference | — Pending |
| Smart Breakdown as source of truth | Richer evaluation context | — Pending |

---
*Last updated: 2026-01-31 after v1.2 milestone initialization*
