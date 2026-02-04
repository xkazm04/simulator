# Requirements: Simulator v1.2 Autoplay Stability & Polish

**Defined:** 2026-02-05
**Core Value:** Transform fuzzy creative visions into concrete, curated AI-generated imagery through intelligent prompt building and automated refinement.

## v1.2 Requirements

Requirements for Autoplay Stability & Polish milestone.

### Orchestration

- [ ] **ORCH-01**: When autoplay starts, orchestrator triggers image generation API within 5 seconds of state transition
- [ ] **ORCH-02**: Each autoplay iteration completes the full cycle: generate → evaluate → refine
- [ ] **ORCH-03**: Multi-phase flow progresses through configured phases without manual intervention
- [ ] **ORCH-04**: No timeout errors during normal autoplay operation

### State Reflection

- [ ] **STATE-01**: Generate button shows accurate state (idle/generating/evaluating/refining)
- [ ] **STATE-02**: Activity Modal displays real-time progress of current operation
- [ ] **STATE-03**: Iteration count updates as cycles complete

### UI Lock

- [ ] **LOCK-01**: Dimension inputs become read-only during autoplay
- [ ] **LOCK-02**: Manual generate button disabled during autoplay
- [ ] **LOCK-03**: Smart Breakdown disabled during autoplay
- [ ] **LOCK-04**: User can abort autoplay at any time

### Architecture

- [ ] **ARCH-01**: Orchestrator effect chain documented with data flow diagram
- [ ] **ARCH-02**: Critical callback wiring verified and tested
- [ ] **ARCH-03**: PATTERNS.md updated with lessons learned

### Visual Polish

- [ ] **UI-01**: Activity Modal typography matches main page
- [ ] **UI-02**: Activity Modal spacing and layout matches main page patterns
- [ ] **UI-03**: Activity Modal color scheme consistent with app theme

## Future Requirements

Deferred to later milestones.

### Video Showcase (v1.3)

- **VIDEO-01**: Remotion integration for programmatic video generation
- **VIDEO-02**: Video composition from project panel images
- **VIDEO-03**: On-demand "Generate Video" button in showcase
- **VIDEO-04**: Full-screen video player replacing static hero card
- **VIDEO-05**: MP4 export functionality for sharing
- **VIDEO-06**: Cinematic transitions between images

## Out of Scope

Explicitly excluded from v1.2.

| Feature | Reason |
|---------|--------|
| New autoplay features | Stability first, enhancements later |
| Performance optimization | Focus on correctness first |
| Additional autoplay modes | Fix existing multi-phase flow first |
| Video Showcase | Deferred to v1.3 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORCH-01 | Phase 1 | Pending |
| ORCH-02 | Phase 1 | Pending |
| ORCH-03 | Phase 1 | Pending |
| ORCH-04 | Phase 1 | Pending |
| STATE-01 | Phase 2 | Pending |
| STATE-02 | Phase 2 | Pending |
| STATE-03 | Phase 2 | Pending |
| LOCK-01 | Phase 2 | Pending |
| LOCK-02 | Phase 2 | Pending |
| LOCK-03 | Phase 2 | Pending |
| LOCK-04 | Phase 2 | Pending |
| ARCH-01 | Phase 3 | Pending |
| ARCH-02 | Phase 3 | Pending |
| ARCH-03 | Phase 3 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |

**Coverage:**
- v1.2 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after roadmap creation*
