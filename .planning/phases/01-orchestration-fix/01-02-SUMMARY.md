---
phase: 01-orchestration-fix
plan: 02
subsystem: hooks
tags: [react-hooks, autoplay, orchestration, state-machine]

# Dependency graph
requires:
  - phase: 01-01
    provides: onPromptsReady callback for callback-based prompt propagation
provides:
  - Multi-phase autoplay delegation to single-phase orchestrator
  - Reasonable timeout values (120s) for image generation services
affects: [autoplay, activity-mode, image-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Multi-phase delegates to single-phase for image generation loops
    - Completion detection via orchestrator state watching

key-files:
  created: []
  modified:
    - app/features/simulator/hooks/useMultiPhaseAutoplay.ts
    - app/features/simulator/hooks/useAutoplayOrchestrator.ts

key-decisions:
  - "Multi-phase delegates entire generate->evaluate->refine loop to single-phase"
  - "Phase timeout remains at 120s as safety net (single-phase has its own 120s timeout)"
  - "Single-phase completion detected via isRunning + completionReason state"

patterns-established:
  - "Orchestrator delegation: higher-level hooks instantiate and control lower-level orchestrators"
  - "Completion detection: watch isRunning flag + completionReason for orchestrator state"

# Metrics
duration: 8min
completed: 2026-02-05
---

# Phase 01 Plan 02: Multi-Phase Orchestrator Wiring Summary

**Multi-phase autoplay now properly delegates to single-phase orchestrator with 120s timeouts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-04T23:57:53Z
- **Completed:** 2026-02-05T00:05:53Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Multi-phase hook now instantiates and uses single-phase orchestrator for actual image generation
- Delegation effect starts single-phase when multi-phase enters sketch/gameplay phases
- Completion effect advances multi-phase when single-phase finishes
- Single-phase timeout increased from 60s to 120s to accommodate slow AI services
- Multi-phase timeout documented with explanatory comment

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire multi-phase to use single-phase orchestrator** - `ec491f5` (feat)
2. **Task 2: Increase timeout in single-phase orchestrator** - `49a6a61` (chore)
3. **Task 3: Add explanatory comment to multi-phase timeout** - `3af4605` (docs)

## Files Created/Modified
- `app/features/simulator/hooks/useMultiPhaseAutoplay.ts` - Added orchestrator instantiation, delegation effect, and completion detection effect
- `app/features/simulator/hooks/useAutoplayOrchestrator.ts` - Increased timeout from 60s to 120s

## Decisions Made
- Delegation pattern: Multi-phase orchestrates phase transitions while single-phase handles the complete generate->evaluate->refine loop for each phase
- Completion detection via state watching: Monitor `isRunning` and `completionReason` to know when single-phase finishes
- Reset after completion: Call `resetAutoplay()` after single-phase completes to allow reuse in next phase

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Orchestration fix phase complete
- Both single-phase and multi-phase autoplay should now progress correctly
- Ready for UI State & Lock phase (Phase 2) or testing verification
- Console should show delegation logs: "[MultiPhase] Delegating sketch phase to single-phase orchestrator"

---
*Phase: 01-orchestration-fix*
*Completed: 2026-02-05*
