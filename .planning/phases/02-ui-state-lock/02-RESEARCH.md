# Phase 2: UI State & Lock - Research

**Researched:** 2026-02-05
**Domain:** React UI State Reflection & Input Locking
**Confidence:** HIGH

## Summary

Phase 2 focuses on making the UI accurately reflect the autoplay orchestration state and preventing user interference during autoplay operations. This is a **codebase-internal phase** that requires no external libraries - it's about wiring existing state machines to UI components.

The codebase already has all the infrastructure needed:
1. **State machines** (`useAutoplay.ts`, `useMultiPhaseAutoplay.ts`) with status fields (`idle`, `generating`, `evaluating`, `refining`, `polishing`, `complete`, `error`)
2. **Activity Modal** (`AutoplaySetupModal.tsx`) with `ActivityModeContent` that shows progress
3. **UI components** (`DirectorControl.tsx`, `DimensionCard.tsx`, `SmartBreakdown.tsx`) that accept `disabled`/`isDisabled` props
4. **Context providers** (`SimulatorContext`, `BrainContext`, `DimensionsContext`) for cross-component state sharing

The work is about **connecting the dots**: piping autoplay status through to button labels, disabling inputs when autoplay is running, and ensuring the Activity Modal receives real-time progress updates.

**Primary recommendation:** Add `isAutoplayRunning` to `SimulatorContext` and wire it to all components that need locking. The generate button label should derive from `multiPhaseAutoplay.status` or fall back to `simulator.isGenerating` state.

## Standard Stack

This phase uses **only existing codebase infrastructure** - no new libraries required.

### Core (Already In Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | UI framework | Project foundation |
| React Context | Built-in | Cross-component state sharing | Already used for subfeatures |
| TypeScript | 5.x | Type safety | Project standard |

### Supporting (Already In Use)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Framer Motion | 11.x | Button state transitions | Already used in DirectorControl |
| Lucide React | 0.x | Loading/status icons | Already used throughout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Context for lock state | Zustand store | Context already used for similar state; would add complexity |
| Prop drilling | Event emitter | Context is cleaner for this use case |

**Installation:** None required - all dependencies already installed.

## Architecture Patterns

### Current State Flow
```
useMultiPhaseAutoplay (state machine)
    |
    v
OnionLayout (receives multiPhaseAutoplay prop)
    |
    v
CmdCore (passes to DirectorControl)
    |
    v
DirectorControl (checks multiPhaseAutoplay.isRunning)
```

### Recommended State Reflection Pattern
```
SimulatorContext
    |-- isAutoplayRunning: boolean (from multiPhaseAutoplay.isRunning)
    |-- autoplayStatus: string (from multiPhaseAutoplay.phase + singlePhase.status)
    |
    v
Components check context for:
    - Button labels (GENERATE / GENERATING / EVALUATING / REFINING)
    - Input disabled state
    - UI lock state
```

### Pattern 1: Derived Status Label
**What:** Compute human-readable status from orchestration state
**When to use:** Generate button needs to show current operation
**Example:**
```typescript
// Source: Codebase pattern from DirectorControl.tsx lines 596-607
function getStatusLabel(
  multiPhase: { isRunning: boolean; phase: string } | undefined,
  singlePhase: { status: string } | undefined,
  isGenerating: boolean
): string {
  if (multiPhase?.isRunning) {
    // During multi-phase, check single-phase status for granularity
    const phase = multiPhase.phase;
    if (phase === 'sketch' || phase === 'gameplay') {
      // Delegate to single-phase status
      const status = singlePhase?.status;
      switch (status) {
        case 'generating': return 'GENERATING...';
        case 'evaluating': return 'EVALUATING...';
        case 'polishing': return 'POLISHING...';
        case 'refining': return 'REFINING...';
        default: return 'SIMULATING...';
      }
    }
    if (phase === 'poster') return 'SELECTING POSTER...';
    if (phase === 'hud') return 'GENERATING HUD...';
  }
  if (isGenerating) return 'SIMULATING...';
  return 'GENERATE';
}
```

### Pattern 2: UI Lock via Context
**What:** Expose lock state through SimulatorContext for all components
**When to use:** Multiple components need to disable during autoplay
**Example:**
```typescript
// Source: Codebase pattern from SimulatorContext.tsx
export interface SimulatorContextValue {
  // ... existing fields
  isAutoplayRunning: boolean;  // NEW: derived from multiPhaseAutoplay
}

// In provider:
const isAutoplayRunning = multiPhaseAutoplay?.isRunning ?? false;

// In components:
const { isAutoplayRunning } = useSimulatorContext();
<textarea disabled={isGenerating || isAutoplayRunning} />
```

### Pattern 3: Component-Level Disabled Prop
**What:** Pass disabled state as prop to maintain component independence
**When to use:** Components that already accept `isDisabled` or `disabled`
**Example:**
```typescript
// Source: SmartBreakdown.tsx already has this pattern (line 63)
interface SmartBreakdownProps {
  onApply: (...) => void;
  initialVisionSentence?: string | null;
  isDisabled?: boolean;  // Already exists!
}

// Usage in CentralBrain or parent:
<SmartBreakdown
  isDisabled={isGenerating || isAutoplayRunning}
  ...
/>
```

### Anti-Patterns to Avoid
- **Checking multiple state sources in every component:** Centralize in context, expose single `isAutoplayRunning` flag
- **Locking abort button:** LOCK-04 requires abort to remain clickable always
- **Hardcoded status strings:** Use constants or derive from state machine status

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State derivation | Custom hook for each component | SimulatorContext enhancement | Context already exists for this purpose |
| Status labels | Inline conditionals everywhere | Centralized utility function | DRY, easier to test |
| Progress updates | Custom polling | Existing event log callbacks | `onLogEvent` already wired |

**Key insight:** The existing state machines (`useAutoplay`, `useMultiPhaseAutoplay`) already have all the state needed. The problem is purely **exposure** - getting that state to the right UI components.

## Common Pitfalls

### Pitfall 1: Stale Closure in Status Callback
**What goes wrong:** Status label shows old value because callback captures stale state
**Why it happens:** Callbacks passed to child components close over state at creation time
**How to avoid:** Use refs for values that change frequently, or ensure callbacks are recreated when status changes
**Warning signs:** Button shows "GENERATING" after operation completes

### Pitfall 2: Missing Abort Button Enablement
**What goes wrong:** Abort button gets disabled along with everything else
**Why it happens:** Blanket `isAutoplayRunning` check on all buttons
**How to avoid:** Explicit exception for abort button: `disabled={isAutoplayRunning && !isAbortButton}`
**Warning signs:** User cannot stop runaway autoplay

### Pitfall 3: Progress Updates Not Reaching Modal
**What goes wrong:** Activity Modal shows stale progress
**Why it happens:** Modal receives initial state but doesn't subscribe to updates
**How to avoid:** Pass live state props (progress, events) that change on each update
**Warning signs:** Progress bar stuck at initial value

### Pitfall 4: Race Between Lock and User Action
**What goes wrong:** User clicks generate just as autoplay starts
**Why it happens:** Small window between autoplay start and UI lock
**How to avoid:** Check autoplay state at the START of generation handler, not just for disabled prop
**Warning signs:** Double generation, conflicting operations

## Code Examples

### Generate Button Label (STATE-01)
```typescript
// Location: DirectorControl.tsx, modify the button label section
// Source: Existing codebase pattern

// Add this function or inline the logic:
const getButtonLabel = (): string => {
  if (isRefining) return 'REFINING...';
  if (isGeneratingPoster) return 'GENERATING POSTER...';

  // Multi-phase autoplay status takes priority
  if (multiPhaseAutoplay?.isRunning) {
    const { phase } = multiPhaseAutoplay;
    if (phase === 'sketch' || phase === 'gameplay') {
      // Check single-phase orchestrator status if available
      // For now, use phase as proxy
      return 'SIMULATING...';  // Can be enhanced with finer status
    }
    if (phase === 'poster') return 'SELECTING POSTER...';
    if (phase === 'hud') return 'GENERATING HUD...';
  }

  if (simulator.isGenerating) return 'SIMULATING...';
  return 'GENERATE';
};

// In render:
<span>{getButtonLabel()}</span>
```

### Dimension Input Lock (LOCK-01)
```typescript
// Location: DimensionCard.tsx
// Add disabled state to textarea

// Option A: Via prop
interface DimensionCardProps {
  // ... existing props
  disabled?: boolean;  // NEW
}

// In component:
<textarea
  value={dimension.reference}
  onChange={(e) => onChange(dimension.id, e.target.value)}
  disabled={disabled}  // NEW
  className={`... ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
/>

// Option B: Via context (if context is enhanced)
const { isAutoplayRunning } = useSimulatorContext();
<textarea disabled={isAutoplayRunning} />
```

### Smart Breakdown Lock (LOCK-03)
```typescript
// Location: Where SmartBreakdown is rendered (CentralBrain or similar)
// SmartBreakdown already accepts isDisabled prop!

<SmartBreakdown
  onApply={handleSmartBreakdownApply}
  initialVisionSentence={visionSentence}
  isDisabled={isGenerating || isAutoplayRunning}  // Enhanced check
/>
```

### Abort Button Always Enabled (LOCK-04)
```typescript
// Location: AutoplaySetupModal.tsx, activity mode footer
// Source: Lines 628-637

{onStop && isRunning && currentPhase !== 'complete' && currentPhase !== 'error' && (
  <button
    onClick={onStop}
    // NO disabled prop - abort is ALWAYS clickable
    className={`... ${semanticColors.error.border} ...`}
  >
    <Square size={14} />
    Stop Autoplay
  </button>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prop drilling isRunning to every component | Context-based state sharing | Project patterns | Single source of truth |
| Effect-based state watching | Callback pattern | Phase 1 decisions | More predictable flow |

**Already implemented correctly:**
- `multiPhaseAutoplay.isRunning` derived state
- Event logging via `onLogEvent` callback
- Activity Modal showing progress bars

## Open Questions

1. **Single-phase status granularity**
   - What we know: `useAutoplay` has `status` field with values `idle/generating/evaluating/polishing/refining/complete/error`
   - What's unclear: Whether this status is accessible from `useMultiPhaseAutoplay` consumer
   - Recommendation: Check if `singlePhaseOrchestrator` is exposed, or add a status passthrough

2. **Iteration counter location**
   - What we know: `useAutoplay` tracks `currentIteration`, `useMultiPhaseAutoplay` does not expose this
   - What's unclear: Where iteration counter should display (Activity Modal? Generate button area?)
   - Recommendation: Add to Activity Modal's progress center, derive from single-phase state

3. **Component hierarchy for lock propagation**
   - What we know: DirectorControl uses context, DimensionCard receives props
   - What's unclear: Cleanest path to get lock state to DimensionCard
   - Recommendation: Enhance `DimensionsContext` or pass via `DimensionColumn`

## Sources

### Primary (HIGH confidence)
- Codebase files directly read:
  - `useAutoplay.ts` - State machine with status field
  - `useMultiPhaseAutoplay.ts` - Multi-phase orchestration
  - `DirectorControl.tsx` - Generate button implementation
  - `AutoplaySetupModal.tsx` - Activity Modal with progress
  - `DimensionCard.tsx` - Input component with existing disabled patterns
  - `SmartBreakdown.tsx` - Already has `isDisabled` prop
  - `SimulatorContext.tsx` - Cross-component state sharing
  - `types.ts` - Type definitions including AutoplayStatus

### Secondary (MEDIUM confidence)
- `PATTERNS.md` - Established orchestrator pattern documentation

### Tertiary (LOW confidence)
- None - this is entirely codebase-internal work

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using only existing codebase infrastructure
- Architecture: HIGH - patterns already established in codebase
- Pitfalls: HIGH - based on direct code review and React best practices

**Research date:** 2026-02-05
**Valid until:** Indefinite (codebase-internal, no external dependencies)

## Implementation Checklist

Based on requirements, here's what needs to be done:

### STATE-01: Generate button shows accurate state
- [ ] Create status label derivation function
- [ ] Wire `multiPhaseAutoplay.phase` and optionally single-phase `status`
- [ ] Replace hardcoded "SIMULATING..." with derived label

### STATE-02: Activity Modal displays real-time progress
- [ ] Verify event log is being populated (may already work from Phase 1)
- [ ] Ensure `textEvents` and `imageEvents` are passed through
- [ ] Check ActivityProgressCenter receives live progress props

### STATE-03: Iteration count updates
- [ ] Determine display location (Activity Modal recommended)
- [ ] Wire `currentIteration` from single-phase autoplay
- [ ] Display "Iteration X of Y" in progress center

### LOCK-01: Dimension inputs read-only
- [ ] Add `disabled` prop to DimensionCard or use context
- [ ] Pass `isAutoplayRunning` through component hierarchy
- [ ] Add visual indicator for locked state (opacity, cursor)

### LOCK-02: Manual generate button disabled
- [ ] Already partially implemented via `isAnyGenerating` check
- [ ] Verify `isAutoplayLocked` is included in check

### LOCK-03: Smart Breakdown disabled
- [ ] Pass `isAutoplayRunning` to `isDisabled` prop (already supported)

### LOCK-04: Abort button remains clickable
- [ ] Verify no `disabled` prop on abort button
- [ ] Test that abort works during all phases
