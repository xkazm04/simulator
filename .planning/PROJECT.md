# Simulator

## What This Is

A "What If" image visualization tool that combines cultural references (games, movies, art) to generate unique prompts for AI image generators. Users describe a vision through Smart Breakdown, adjust dimensions, and generate images in Gameplay (mechanics-focused) or Concept (artstyle-focused) modes. Autoplay automates the generate-evaluate-refine loop.

## Core Value

Transform fuzzy creative visions into concrete, curated AI-generated imagery through intelligent prompt building and automated refinement.

## Current Milestone: v1.2 Video Showcase

**Goal:** Transform the project showcase into an automated video experience using Remotion, with client-side rendering and no server infrastructure.

**Target features:**
- Remotion integration for video composition (client-side)
- Poster image as default, video on button click
- On-demand video generation from project images
- Full-screen video player in showcase modal
- MP4 download to user's device (no server storage)
- Cinematic transitions between images (fade, slide, clockWipe)

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

- Server-side video storage — client-only for v1.2
- AWS Lambda rendering — keeping it simple with browser rendering
- Video persistence/history — no database storage needed
- Auto-play on showcase open — poster first, user triggers video
- Background music — licensing complexity, defer to v2+
- Custom video templates UI — automated composition only

## Context

**Current Showcase Architecture:**
- `/posters` page with grid gallery of saved projects
- `ProjectShowcaseModal` opens full-screen portal on click
- `ShowcaseCinematic` renders hero zone, floating gallery, dimension ribbon
- `MediaSkeleton` shows gray loading state before content
- Existing `CinematicVideo` component for HTML5 video playback
- `ShowcaseLightbox` for full-screen image viewing with navigation

**Video Showcase Goal:**
- Poster image displays by default when opening showcase
- "Generate Video" button triggers video composition
- Compose project panel images into cinematic sequence
- Use Remotion Player for preview, WebCodecs for export
- Client-side only: no server storage, no AWS infrastructure
- Output: In-app playback + MP4 download to user's device

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
