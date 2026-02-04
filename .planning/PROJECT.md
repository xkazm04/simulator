# Simulator

## What This Is

A "What If" image visualization tool that combines cultural references (games, movies, art) to generate unique prompts for AI image generators. Users describe a vision through Smart Breakdown, adjust dimensions, and generate images in Gameplay (mechanics-focused) or Concept (artstyle-focused) modes. Autoplay automates the generate-evaluate-refine loop.

## Core Value

Transform fuzzy creative visions into concrete, curated AI-generated imagery through intelligent prompt building and automated refinement.

## Current Milestone: v1.2 Autoplay Stability & Polish

**Goal:** Fix the broken autoplay orchestration so the automated generate-evaluate-refine loop actually works, with proper UI state reflection and visual polish.

**Target features:**
- Fix orchestration chain so API calls fire on state transitions
- Generate button state reflects actual autoplay progress
- UI components lock during autoplay (view-only mode)
- Review and fix autoplay architecture design flaws
- Activity Modal UI matches main page visual quality

## Requirements

### Validated

<!-- Shipped capabilities -->

- [x] Image generation via Leonardo AI — v1.0
- [x] Dimension-based prompt building — v1.0
- [x] Smart Breakdown vision parsing — v1.0
- [x] Direction center for refinement feedback — v1.0
- [x] Panel image saving system — v1.0
- [x] Gemini AI provider integration — v1.0

### Active

<!-- v1.2 Autoplay Stability & Polish scope -->

- [ ] Fix autoplay orchestration chain (API calls fire on state transitions)
- [ ] Generate button state reflects actual autoplay progress
- [ ] UI components lock during autoplay (view-only mode)
- [ ] Review and fix autoplay architecture design flaws
- [ ] Activity Modal UI visual polish (match main page quality)

### Out of Scope

- Video Showcase features — deferred to v1.3
- New autoplay features — stability first, enhancements later
- Autoplay performance optimization — focus on correctness first
- Additional autoplay modes — fix existing multi-phase flow first

## Context

**Current Autoplay Architecture:**
- Two-hook pattern: state machine (`useAutoplay.ts`) + orchestrator (`useAutoplayOrchestrator.ts`)
- Multi-phase coordinator: `useMultiPhaseAutoplay.ts` manages concept→gameplay→poster→HUD phases
- Activity logging: `useAutoplayEventLog.ts` tracks events for modal display
- Modal: `AutoplaySetupModal.tsx` with Setup Mode → Activity Mode transition

**Known Issues:**
- Modal stays open but orchestrator doesn't trigger API calls
- State machine transitions (button shows "simulating") but no actual generation
- "sketch" phase times out after 2 minutes because API never fires
- UI components not locked during autoplay
- Activity Modal UI visually behind main page quality

**Key integration points:**
- `app/features/simulator/hooks/useAutoplayOrchestrator.ts` — effect chain that should trigger APIs
- `app/features/simulator/hooks/useMultiPhaseAutoplay.ts` — phase coordination
- `app/features/simulator/subfeature_brain/components/AutoplaySetupModal.tsx` — modal UI
- `app/features/simulator/subfeature_brain/components/DirectorControl.tsx` — autoplay trigger
- `app/features/simulator/SimulatorFeature.tsx` — root wiring of hooks and contexts

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
| Defer Video Showcase to v1.3 | Autoplay stability is prerequisite for meaningful showcase | — Pending |

---
*Last updated: 2026-02-05 after v1.2 milestone pivot to Autoplay Stability*
