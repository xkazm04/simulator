# Simulator

## What This Is

A "What If" image visualization tool that combines cultural references (games, movies, art) to generate unique prompts for AI image generators. Users describe a vision through Smart Breakdown, adjust dimensions, and generate images in Gameplay (mechanics-focused) or Concept (artstyle-focused) modes. Autoplay automates the generate-evaluate-refine loop.

## Core Value

Transform fuzzy creative visions into concrete, curated AI-generated imagery through intelligent prompt building and automated refinement.

## Current Milestone: v1.1 Refinement

**Goal:** Make Smart Breakdown the central source of truth and strengthen the distinction between Gameplay and Concept modes.

**Target features:**
- Smart Breakdown autosave (persist format, keyElements, reasoning)
- Autoplay uses Smart Breakdown context for evaluation
- Stronger Gameplay mode (mechanics, UI/HUD focus)
- Stronger Concept mode (artstyle, visualization focus)
- Remove unused Presets system

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

<!-- v1.1 Refinement scope -->

- [ ] Smart Breakdown result autosave (format, keyElements, reasoning)
- [ ] Autoplay evaluation uses Smart Breakdown context
- [ ] Stronger Gameplay mode differentiation (mechanics, authentic UI/HUD)
- [ ] Stronger Concept mode differentiation (artstyle, game visualization)
- [ ] Delete Presets system (generationPresets.ts, PresetSelector.tsx)

### Out of Scope

- Poster mode changes — separate workflow, working as intended
- Natural language goal input for autoplay — keeping number picker
- New presets — removing presets entirely, not replacing them
- Smart Breakdown UI changes — only persistence and integration

## Context

**Smart Breakdown as core:**
- Currently: SmartBreakdownResult metadata (format, keyElements, reasoning) is lost after "Apply to Simulator"
- Goal: Persist full breakdown, use in autoplay evaluation for richer context

**Mode differentiation problem:**
- Currently: Gameplay adds "game UI overlay", Concept adds "concept art" — too subtle
- Goal: Gameplay = in-game feel, mechanics visible, authentic HUD; Concept = artistic interpretation, visual style exploration

**Presets removal:**
- 8 curated presets exist (Cinematic Epic, Cozy RPG, etc.) but add complexity
- User preference: remove entirely, not simplify

**Key integration points:**
- `subfeature_brain/components/SmartBreakdown.tsx` — breakdown UI
- `hooks/useAutosave.ts` — persistence (needs breakdown support)
- `hooks/useAutoplayOrchestrator.ts` — evaluation criteria builder
- `subfeature_brain/lib/imageEvaluator.ts` — evaluation logic
- `lib/promptBuilder.ts` — mode-specific prompt generation

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
*Last updated: 2026-01-29 after v1.1 milestone initialization*
