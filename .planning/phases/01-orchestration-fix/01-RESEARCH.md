# Phase 1: Orchestration Fix - Research

**Researched:** 2026-02-05
**Domain:** React State Machine / Effect Orchestration
**Confidence:** HIGH

## Summary

This research investigates why autoplay fails to trigger image generation despite the two-hook pattern (state machine + orchestrator) being correctly architected. The investigation revealed a **broken chain** between state transitions and side effects, caused by:

1. **Multi-phase hook creates but does not use the orchestrator** - `useMultiPhaseAutoplay` builds `orchestratorDeps` (line 291) but never instantiates `useAutoplayOrchestrator`, leaving the single-phase orchestrator orphaned
2. **React state update timing** - The orchestrator effect (lines 512-534) watches `generatedPrompts` but state updates from `onRegeneratePrompts()` are asynchronous and may not propagate before timeout checks
3. **Ref/state desync** - `generatedPromptsRef.current` is updated from closure but the effect dependency on `generatedPrompts` may see stale values

**Primary recommendation:** Fix the multi-phase integration to properly delegate to the single-phase orchestrator, and ensure the callback chain propagates state synchronously or uses refs consistently throughout.

## Standard Stack

The existing architecture is correct - no new libraries needed.

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ | State management via hooks | Native React patterns |
| useReducer | N/A | State machine for autoplay | Official React hook for complex state |
| useEffect | N/A | Side effect orchestration | Official React hook for effects |

### Patterns (Already Documented)
| Pattern | Location | Status |
|---------|----------|--------|
| State Machine + Orchestrator | `hooks/PATTERNS.md` | Documented, partially implemented |
| Ref for fresh values | Throughout codebase | Used inconsistently |

### No New Dependencies Required
This is a wiring/integration fix, not a library gap.

## Architecture Patterns

### Existing Architecture (Correct Design)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SimulatorFeature.tsx                         │
├─────────────────────────────────────────────────────────────────┤
│  useAutoplayOrchestrator ──────────► useAutoplay (state)        │
│         │                                   │                   │
│         │ watches state.status              │ START action      │
│         ▼                                   │                   │
│  Effect triggers:                           │                   │
│  - onRegeneratePrompts() ─────────► handleGenerate()            │
│                                       │                         │
│                                       ▼                         │
│                          prompts.setGeneratedPrompts()          │
│                                       │                         │
│                          [ASYNC STATE UPDATE]                   │
│                                       │                         │
│                                       ▼                         │
│  Effect (512-534) watches:    generatedPrompts change           │
│         │                                                       │
│         ▼                                                       │
│  generateImagesFromPrompts() ◄───── [BREAKS HERE]               │
└─────────────────────────────────────────────────────────────────┘
```

### Where the Chain Breaks

**Break Point 1: Multi-Phase Not Using Single-Phase Orchestrator**

`useMultiPhaseAutoplay.ts` line 291-332:
```typescript
// Creates deps but NEVER uses them with useAutoplayOrchestrator
const orchestratorDeps: AutoplayOrchestratorDeps = useMemo(() => ({
  generatedImages,
  isGeneratingImages,
  generateImagesFromPrompts,
  // ... more deps
}), [/* deps */]);

// Missing: const orchestrator = useAutoplayOrchestrator(orchestratorDeps);
```

**Break Point 2: Async State Update Timing**

`useAutoplayOrchestrator.ts` lines 512-534:
```typescript
useEffect(() => {
  if (autoplay.state.status !== 'generating') return;
  if (isGeneratingImages) return;

  // Uses ref for "fresh" value but ref is updated AFTER render
  const currentPrompts = generatedPromptsRef.current;
  if (currentPrompts.length === 0) return; // May always be 0 due to timing

  // This code never executes because prompts haven't updated yet
  generateImagesFromPrompts(currentPrompts.map(p => ({ id: p.id, prompt: p.prompt })));
}, [autoplay.state.status, isGeneratingImages, generatedImages, generateImagesFromPrompts, generatedPrompts]);
```

### Recommended Fix Pattern

**Option A: Callback-Based Propagation (Recommended)**

Pass a callback from orchestrator to `handleGenerate` that fires AFTER prompts are set:

```typescript
// In SimulatorContext.tsx
const handleGenerate = useCallback(async (overrides?: GenerateOverrides) => {
  // ... generate prompts ...

  const generatedPrompts = result.prompts.map(/* ... */);
  prompts.setGeneratedPrompts(generatedPrompts);

  // Call orchestrator callback with new prompts directly
  if (overrides?.onPromptsReady) {
    overrides.onPromptsReady(generatedPrompts);
  }
}, [/* deps */]);

// In useAutoplayOrchestrator.ts
const handleAutoplayGenerate = useCallback((overrides) => {
  onRegeneratePrompts({
    ...overrides,
    onPromptsReady: (newPrompts) => {
      // Immediately trigger image generation with fresh prompts
      generateImagesFromPrompts(newPrompts.map(p => ({ id: p.id, prompt: p.prompt })));
    }
  });
}, [onRegeneratePrompts, generateImagesFromPrompts]);
```

**Option B: Return Value Instead of State**

Make `handleGenerate` return the generated prompts directly:

```typescript
// In SimulatorContext.tsx
const handleGenerate = useCallback(async (overrides?: GenerateOverrides): Promise<GeneratedPrompt[]> => {
  // ... generate prompts ...
  prompts.setGeneratedPrompts(generatedPrompts);
  return generatedPrompts; // Return for immediate use
}, [/* deps */]);

// In useAutoplayOrchestrator.ts
const prompts = await onRegeneratePrompts(overrides);
generateImagesFromPrompts(prompts.map(p => ({ id: p.id, prompt: p.prompt })));
```

**Option C: Event-Based Communication**

Use a custom event or callback prop to signal prompt readiness:

```typescript
// Orchestrator subscribes to prompt changes via event
const onPromptsGenerated = useCallback((newPrompts: GeneratedPrompt[]) => {
  if (autoplay.state.status === 'generating') {
    generateImagesFromPrompts(newPrompts.map(p => ({ id: p.id, prompt: p.prompt })));
  }
}, [autoplay.state.status, generateImagesFromPrompts]);
```

### Anti-Patterns to Avoid

- **Relying on refs updated in render for effect dependencies** - Refs update AFTER render, effects run AFTER refs update, but dependency checks happen BEFORE
- **Chaining async state updates across component boundaries** - State updates are batched, effects depend on stale closures
- **Creating orchestrator deps without using the orchestrator** - Dead code that looks functional

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine transitions | Custom event emitter | useReducer | React-native, predictable |
| Effect timing | Manual setTimeout delays | Callback propagation | Deterministic, no race conditions |
| Fresh value access | Multiple ref updates | Single source of truth callback | Avoids desync |

**Key insight:** The existing two-hook pattern is correct. The issue is WIRING, not architecture. Don't add complexity - fix the integration.

## Common Pitfalls

### Pitfall 1: Async State Update Blindness
**What goes wrong:** Effect depends on state that updates asynchronously. Effect fires with stale value.
**Why it happens:** React batches state updates. Effect dependency check uses pre-update value.
**How to avoid:** Pass data directly via callback instead of relying on state propagation.
**Warning signs:** Console logs show correct values in setter but effect sees old values.

### Pitfall 2: Ref/State Desync
**What goes wrong:** Ref updated from state in render, but effect reads ref expecting "fresh" value.
**Why it happens:** `generatedPromptsRef.current = generatedPrompts` runs in render. Effect runs after render but BEFORE next state update propagates.
**How to avoid:** Either use ref exclusively OR state exclusively, not both for same data.
**Warning signs:** Ref shows stale value despite state being updated.

### Pitfall 3: Orphaned Orchestrator Pattern
**What goes wrong:** Orchestrator deps created but orchestrator hook never called.
**Why it happens:** Refactoring leaves dead code that "looks" connected.
**How to avoid:** Trace the full chain from trigger to effect. Test each link.
**Warning signs:** `useMemo` creating deps that are never spread into a hook call.

### Pitfall 4: Multiple Sources of Truth
**What goes wrong:** Multi-phase has its own state, single-phase has its own state, they don't sync.
**Why it happens:** Multi-phase was added later, integration incomplete.
**How to avoid:** Single-phase orchestrator should be the ONLY image generation trigger.
**Warning signs:** Two different code paths that both claim to trigger generation.

## Code Examples

### Verified Fix Pattern: Callback-Based Prompt Propagation

```typescript
// Source: Derived from React patterns, verified against React.dev docs

// SimulatorContext.tsx - Add callback support
export interface GenerateOverrides {
  baseImage?: string;
  dimensions?: Array<{ type: DimensionType; label: string; reference: string }>;
  feedback?: { positive: string; negative: string };
  onPromptsReady?: (prompts: GeneratedPrompt[]) => void; // NEW
}

const handleGenerate = useCallback(async (overrides?: GenerateOverrides) => {
  // ... existing generation logic ...

  const generatedPrompts: GeneratedPrompt[] = result.prompts.map((p) => ({ /* ... */ }));
  prompts.setGeneratedPrompts(generatedPrompts);
  prompts.pushToHistory(generatedPrompts);

  // Fire callback with fresh prompts (bypasses async state)
  overrides?.onPromptsReady?.(generatedPrompts);

  brain.clearFeedback();
}, [/* existing deps */]);
```

```typescript
// useAutoplayOrchestrator.ts - Use callback instead of watching state

// In the effect that handles 'generating' status:
case 'generating': {
  if (currentIterationRef.current !== autoplay.state.currentIteration) {
    currentIterationRef.current = autoplay.state.currentIteration;
    logEvent('image_generating', `Starting image generation (iteration ${autoplay.state.currentIteration})`);

    if (autoplay.state.currentIteration > 1 || generatedPrompts.length === 0) {
      logEvent('prompt_generated', 'Regenerating prompts with feedback');
      const feedbackOverride = pendingFeedbackRef.current;
      pendingFeedbackRef.current = null;

      // Pass callback to receive prompts immediately
      onRegeneratePrompts({
        feedback: feedbackOverride || undefined,
        onPromptsReady: (newPrompts) => {
          // Trigger image generation with fresh prompts
          console.log('[Autoplay] Prompts ready, triggering generation for', newPrompts.length, 'prompts');
          generateImagesFromPrompts(newPrompts.map(p => ({ id: p.id, prompt: p.prompt })));
        },
      });
    } else {
      // First iteration with existing prompts - use current prompts
      generateImagesFromPrompts(generatedPrompts.map(p => ({ id: p.id, prompt: p.prompt })));
    }
  }
  break;
}
```

### Multi-Phase Integration Fix

```typescript
// useMultiPhaseAutoplay.ts - Actually use the single-phase orchestrator

import { useAutoplayOrchestrator } from './useAutoplayOrchestrator';

export function useMultiPhaseAutoplay(deps: MultiPhaseAutoplayDeps): UseMultiPhaseAutoplayReturn {
  // ... existing code ...

  // Create orchestrator deps (existing)
  const orchestratorDeps: AutoplayOrchestratorDeps = useMemo(() => ({ /* ... */ }), [/* ... */]);

  // ACTUALLY USE the orchestrator
  const singlePhaseOrchestrator = useAutoplayOrchestrator(orchestratorDeps);

  // When multi-phase starts a sketch/gameplay phase, delegate to single-phase
  useEffect(() => {
    if (state.phase === 'sketch' || state.phase === 'gameplay') {
      if (!singlePhaseOrchestrator.isRunning) {
        singlePhaseOrchestrator.startAutoplay({
          targetSavedCount: state.phase === 'sketch'
            ? state.config.sketchCount
            : state.config.gameplayCount,
          maxIterations: state.config.maxIterationsPerImage,
        });
      }
    }
  }, [state.phase, state.config, singlePhaseOrchestrator]);

  // ... rest of multi-phase logic ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Watch state in effect | Callback-based propagation | React 18 batching changes | Avoids timing issues |
| Multiple state+ref sources | Single source of truth | Best practice clarification | Eliminates desync |
| Parallel orchestrators | Delegated orchestration | Pattern maturity | Cleaner coordination |

**Deprecated/outdated:**
- Relying on `generatedPromptsRef.current` being "fresh" in effects is unreliable due to React's batching

## Open Questions

1. **Multi-phase architecture decision**
   - What we know: Multi-phase creates deps but doesn't use single-phase orchestrator
   - What's unclear: Was this intentional (multi-phase meant to be independent) or incomplete integration?
   - Recommendation: Treat as incomplete integration. Multi-phase should delegate to single-phase for image generation.

2. **Backward compatibility**
   - What we know: Adding `onPromptsReady` callback to `GenerateOverrides` is additive
   - What's unclear: Any code depending on current (broken) behavior?
   - Recommendation: The behavior is broken, so "breaking" it is fixing it

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `useAutoplayOrchestrator.ts`, `useMultiPhaseAutoplay.ts`, `SimulatorContext.tsx`
- `hooks/PATTERNS.md` - Internal documentation of the two-hook pattern
- React.dev official documentation on [useEffect](https://react.dev/reference/react/useEffect)

### Secondary (MEDIUM confidence)
- [LogRocket: Why React doesn't update state immediately](https://blog.logrocket.com/why-react-doesnt-update-state-immediately/) - Confirms async state update behavior
- [DhiWise: Reasons Why UseEffect Is Not Triggering](https://www.dhiwise.com/post/how-to-fix-useeffect-not-triggering-in-your-react-project) - Confirms dependency array issues
- [GitHub Issue #15240: Dancing between state and effects](https://github.com/facebook/react/issues/15240) - React team discussion on effect timing

### Tertiary (LOW confidence - for pattern reference only)
- [Kyle Shevlin: useReducer as FSM](https://kyleshevlin.com/how-to-use-usereducer-as-a-finite-state-machine/) - State machine patterns
- [TheLinuxCode: State Management 2026](https://thelinuxcode.com/state-management-in-react-2026-hooks-context-api-and-redux-in-practice/) - Modern React patterns

## Metadata

**Confidence breakdown:**
- Root cause identification: HIGH - Direct codebase analysis confirms broken chain
- Fix patterns: HIGH - Standard React patterns, well-documented
- Multi-phase integration: MEDIUM - Unclear if design intent was different

**Research date:** 2026-02-05
**Valid until:** Indefinite (fundamental React patterns, not version-specific)

## Fix Priority Order

Based on impact and risk:

1. **ORCH-01 (5 second trigger)**: Add `onPromptsReady` callback to `GenerateOverrides` and wire in orchestrator - directly fixes the immediate trigger issue

2. **ORCH-02 (full cycle)**: Ensure callback chain completes generate -> evaluate -> refine - builds on fix #1

3. **ORCH-03 (multi-phase)**: Either delegate multi-phase to single-phase orchestrator OR fix multi-phase to independently trigger generation - larger refactor but same pattern

4. **ORCH-04 (no timeouts)**: Remove/increase safety timeouts once flow is fixed - cleanup after main fixes

## Verification Checklist

After implementing fixes, verify:

- [ ] Starting autoplay triggers image generation console log within 5 seconds
- [ ] `generateImagesFromPrompts` is called with correct prompt data
- [ ] Generation completes and transitions to 'evaluating' status
- [ ] Evaluation completes and transitions to 'refining' status
- [ ] Refinement applies feedback and advances iteration
- [ ] Multi-phase mode progresses through all configured phases
- [ ] No timeout errors during normal operation
- [ ] Manual "Generate" button still works correctly (regression test)
