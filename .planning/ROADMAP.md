# Roadmap: Simulator v1.2 Autoplay Stability & Polish

## Overview

This milestone fixes the broken autoplay orchestration chain so the automated generate-evaluate-refine loop actually works. The core issue is that state transitions happen but API calls never fire. We'll fix orchestration first, then wire up accurate UI state and locking, then polish the Activity Modal visuals and document the architecture.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Orchestration Fix** - Make API calls fire on state transitions
- [ ] **Phase 2: UI State & Lock** - Accurate state reflection and view-only mode
- [ ] **Phase 3: Polish & Documentation** - Visual consistency and architecture docs

## Phase Details

### Phase 1: Orchestration Fix
**Goal**: Autoplay generates images without manual intervention
**Depends on**: Nothing (first phase)
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04
**Success Criteria** (what must be TRUE):
  1. Starting autoplay triggers image generation within 5 seconds
  2. A single iteration completes generate, evaluate, and refine steps without stalling
  3. Multi-phase mode progresses through all configured phases automatically
  4. No timeout errors appear during normal autoplay operation
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Fix single-phase orchestration with callback-based prompt propagation
- [ ] 01-02-PLAN.md — Wire multi-phase to delegate to single-phase orchestrator

### Phase 2: UI State & Lock
**Goal**: User sees accurate progress and cannot interfere with running autoplay
**Depends on**: Phase 1
**Requirements**: STATE-01, STATE-02, STATE-03, LOCK-01, LOCK-02, LOCK-03, LOCK-04
**Success Criteria** (what must be TRUE):
  1. Generate button label reflects current operation (idle/generating/evaluating/refining)
  2. Activity Modal shows real-time progress updates as operations complete
  3. Iteration counter increments each time a cycle completes
  4. Dimension inputs, manual generate button, and Smart Breakdown are disabled during autoplay
  5. Abort button remains clickable and stops autoplay immediately
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Polish & Documentation
**Goal**: Activity Modal matches main page visual quality and architecture is documented
**Depends on**: Phase 2
**Requirements**: ARCH-01, ARCH-02, ARCH-03, UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. Activity Modal typography (fonts, sizes, weights) matches main page
  2. Activity Modal spacing and layout follows main page patterns
  3. Activity Modal color scheme is consistent with app theme (slate backgrounds, cyan/purple accents)
  4. Orchestrator effect chain is documented with data flow diagram
  5. PATTERNS.md includes lessons learned from this milestone
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Orchestration Fix | 0/2 | Planned | - |
| 2. UI State & Lock | 0/TBD | Not started | - |
| 3. Polish & Documentation | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-05*
*Last updated: 2026-02-05*
