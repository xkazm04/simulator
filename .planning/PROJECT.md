# Simulator

## What This Is

A "What If" image visualization tool that combines cultural references (games, movies, art) to generate unique prompts for AI image generators. Users describe a vision through Smart Breakdown, adjust dimensions, and generate images in Gameplay (mechanics-focused) or Concept (artstyle-focused) modes. Autoplay automates the generate-evaluate-refine loop with full progress tracking and UI locking.

## Core Value

Transform fuzzy creative visions into concrete, curated AI-generated imagery through intelligent prompt building and automated refinement.

## Current State (v1.3 Shipped)

**Shipped:** 2026-02-05

Video Showcase complete with Remotion integration:
- ShowcaseVideo composition with TransitionSeries (fade, slide, clockWipe)
- TitleCard with spring-animated text reveal
- ShowcasePlayer wrapper for in-browser playback
- Video preloading with progress tracking (useVideoPreloader)
- ExportButton with progress indicator
- Client-side MP4 export via @remotion/web-renderer WebCodecs API
- Upgraded to Next.js 16

**Codebase:** ~22,000 LOC TypeScript/React (Next.js 16, Tailwind, Framer Motion, Remotion)

## Next Milestone Goals (v1.4)

(Define with /gsd:new-milestone)

## Requirements

### Validated

<!-- Shipped capabilities -->

- [x] Image generation via Leonardo AI — v1.0
- [x] Dimension-based prompt building — v1.0
- [x] Smart Breakdown vision parsing — v1.0
- [x] Direction center for refinement feedback — v1.0
- [x] Panel image saving system — v1.0
- [x] Gemini AI provider integration — v1.0
- [x] Autoplay orchestration (API calls fire on state transitions) — v1.2
- [x] Generate button reflects autoplay progress — v1.2
- [x] UI lock during autoplay (dimensions, SmartBreakdown, generate) — v1.2
- [x] Activity Modal visual polish (WCAG typography) — v1.2
- [x] Orchestrator architecture documented (PATTERNS.md) — v1.2
- [x] Remotion Player integration for video playback — v1.3
- [x] ShowcaseVideo composition with cinematic transitions — v1.3
- [x] Video preloading with progress tracking — v1.3
- [x] Client-side MP4 export via WebCodecs — v1.3
- [x] Next.js 16 upgrade — v1.3

### Active

<!-- v1.4 scope — define in /gsd:new-milestone -->

(None yet — run /gsd:new-milestone to define v1.4 requirements)

### Out of Scope

- New autoplay features beyond stability — stability shipped, enhancements in future
- Autoplay performance optimization — correctness achieved, performance later
- Mobile app — web-first approach

## Context

**Video Showcase Architecture (v1.3):**
- Remotion composition: `ShowcaseVideo` with TransitionSeries
- Player wrapper: `ShowcasePlayer` with memoized inputProps (prevents re-render cascade)
- Export: `useVideoExport` hook using @remotion/web-renderer WebCodecs API
- Preloading: `useVideoPreloader` tracks individual video load progress

**Key Video Files:**
- `remotion/compositions/ShowcaseVideo.tsx` — Main composition with cover + videos
- `remotion/compositions/TitleCard.tsx` — Animated title card
- `app/posters/components/cinematic/ShowcasePlayer.tsx` — Remotion Player wrapper
- `app/posters/hooks/useVideoExport.ts` — Client-side MP4 export
- `app/posters/hooks/useVideoPreloader.ts` — Video preloading with progress
- `app/posters/components/cinematic/ExportButton.tsx` — Download button with progress

**Autoplay Architecture (v1.2):**
- Three-layer pattern: `useAutoplay.ts` (state) → `useAutoplayOrchestrator.ts` (effects) → `useMultiPhaseAutoplay.ts` (coordination)
- Callback-based prompt propagation bypasses React state batching
- 120s timeouts for slow AI services
- Full documentation in `app/features/simulator/hooks/PATTERNS.md`

**Key Autoplay Files:**
- `SimulatorContext.tsx` — Central state with onPromptsReady callback
- `useAutoplayOrchestrator.ts` — Effect chain for generate→evaluate→refine
- `useMultiPhaseAutoplay.ts` — Multi-phase coordination with delegation
- `DirectorControl.tsx` — Generate button with status labels
- `AutoplaySetupModal.tsx` — Activity Modal with progress tracking

## Constraints

- **Tech stack**: Next.js / React / Tailwind / Framer Motion
- **AI Provider**: Gemini for evaluation, Leonardo for generation
- **Backward compatibility**: Existing saved projects must load

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gemini for evaluation | Already integrated, vision capable | ✓ Good |
| 3 iteration limit | Balance automation vs cost | ✓ Good |
| useReducer state machine | Matches codebase patterns | ✓ Good |
| Callback-based prompt propagation | Bypasses React async batching | ✓ Good (v1.2) |
| Multi-phase delegates to single-phase | Reuses generate→evaluate→refine loop | ✓ Good (v1.2) |
| Thread disabled prop (not context) | Explicit data flow, simpler | ✓ Good (v1.2) |
| type-label for smallest text | WCAG AA compliance (11px min) | ✓ Good (v1.2) |
| Defer Video Showcase to v1.3 | Autoplay stability was prerequisite | ✓ Good (v1.2) |
| Remotion for video composition | Industry-standard React video, client-side rendering | ✓ Good (v1.3) |
| WebCodecs for MP4 export | No server required, browser-native encoding | ✓ Good (v1.3) |
| TransitionSeries for transitions | Proper overlap handling, multiple transition types | ✓ Good (v1.3) |

---
*Last updated: 2026-02-05 after v1.3 milestone completion*
