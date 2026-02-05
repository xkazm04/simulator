# Hook Patterns for Async Workflows

This document establishes the standard patterns for implementing async workflows in the simulator.

## The Orchestrator Pattern

**For any async workflow involving API calls or external services, use a two-hook separation:**

### 1. State Machine Hook (`use<Feature>.ts`)

Pure state management with `useReducer`. No side effects.

**Responsibilities:**
- Define state shape and action types
- Handle all state transitions via reducer
- Expose state and action dispatchers
- Manage derived state (computed values)

**Characteristics:**
- ✅ Testable in isolation (no mocking needed)
- ✅ Reusable across different contexts
- ✅ Predictable state transitions
- ❌ Does NOT call APIs
- ❌ Does NOT have `useEffect` with side effects

**Example:** `useAutoplay.ts`
```typescript
// Pure state machine - no API calls
function autoplayReducer(state: AutoplayState, action: AutoplayAction): AutoplayState {
  switch (action.type) {
    case 'START': return { ...state, status: 'generating' };
    case 'GENERATION_COMPLETE': return { ...state, status: 'evaluating' };
    // ... pure state transitions
  }
}

export function useAutoplay() {
  const [state, dispatch] = useReducer(autoplayReducer, initialState);

  // Actions just dispatch - no side effects
  const start = useCallback((config) => dispatch({ type: 'START', config }), []);

  return { state, start, /* ... */ };
}
```

### 2. Orchestrator Hook (`use<Feature>Orchestrator.ts`)

Wires state machine to external services. All side effects live here.

**Responsibilities:**
- Listen to state machine state changes
- Trigger API calls based on state transitions
- Handle async operations (fetch, timeouts, retries)
- Transform external data for state machine consumption
- Coordinate multiple services

**Characteristics:**
- ✅ Clear separation of concerns
- ✅ Testable with service mocks
- ✅ Single place for side effect logic
- ✅ Can be swapped for different implementations

**Example:** `useAutoplayOrchestrator.ts`
```typescript
export function useAutoplayOrchestrator(deps: OrchestratorDeps) {
  const autoplay = useAutoplay(); // Use the state machine

  // Effect: React to state changes and call services
  useEffect(() => {
    switch (autoplay.state.status) {
      case 'generating':
        deps.generateImages().then(/* ... */);
        break;
      case 'evaluating':
        deps.evaluateImages().then(/* ... */);
        break;
    }
  }, [autoplay.state.status]);

  return { /* expose state + actions */ };
}
```

## When to Apply This Pattern

**Use orchestrator separation when:**
- Workflow involves multiple async steps
- State machine has 3+ states
- External services (APIs) are involved
- Testing in isolation is valuable

**Skip orchestrator for simple cases:**
- Single async call (e.g., simple fetch)
- No complex state transitions
- Purely UI state (modals, toggles)

## File Organization

```
hooks/
├── useFeature.ts              # State machine (pure)
├── useFeatureOrchestrator.ts  # Orchestration (side effects)
├── useFeatureEventLog.ts      # Optional: event logging
└── PATTERNS.md                # This file
```

## Testing Strategy

**State Machine Tests (`useFeature.test.ts`):**
- Test reducer directly with action/state pairs
- No mocking needed
- Fast, synchronous tests

**Orchestrator Tests (`useFeatureOrchestrator.test.ts`):**
- Mock external dependencies
- Test state→effect mapping
- Verify service calls are triggered correctly

## Existing Implementations

| Feature | State Machine | Orchestrator | Status |
|---------|--------------|--------------|--------|
| Autoplay | `useAutoplay.ts` | `useAutoplayOrchestrator.ts` | ✅ Complete |
| Multi-Phase Autoplay | `useMultiPhaseAutoplay.ts` | (integrated) | Partial |
| Image Generation | `useImageGeneration.ts` | (mixed) | Candidate |
| Brain/Prompts | `useBrain.ts` | (mixed) | Candidate |

## Migration Guide

When refactoring existing hooks:

1. Identify state shape and transitions
2. Extract reducer to new state machine hook
3. Move API calls to orchestrator hook
4. Update consumers to use orchestrator
5. Add tests for both hooks

---

## Autoplay Orchestrator Deep Dive

This section documents the autoplay orchestrator architecture in detail, including data flow diagrams and critical callback wiring patterns.

### Architecture Overview

The autoplay system uses a three-layer orchestration pattern:

```
SimulatorContext (Root Coordinator)
        |
        v
useMultiPhaseAutoplay (Multi-Phase State + Orchestration)
        |
        +--> useAutoplayOrchestrator (Single-Phase Effects)
        |           |
        |           +--> useAutoplay (State Machine)
        |
        +--> useAutoHudGeneration (HUD Phase)
        +--> posterEvaluator (Poster Phase)
```

**Layer Responsibilities:**

| Layer | Role | Side Effects? |
|-------|------|---------------|
| `useAutoplay` | Pure state machine (status, iteration, totals) | NO |
| `useAutoplayOrchestrator` | Single-phase effect orchestration | YES |
| `useMultiPhaseAutoplay` | Multi-phase coordination + delegation | YES |

### Effect Chain Sequence

The complete sequence from user action to image generation:

```
1. User clicks "Start Autoplay" in AutoplaySetupModal
   |
   v
2. multiPhaseAutoplay.onStart(config) dispatches START
   |
   v
3. useMultiPhaseAutoplay reducer sets phase='sketch' or 'gameplay'
   |
   v
4. useEffect in useMultiPhaseAutoplay detects phase change
   |
   v
5. Calls singlePhaseOrchestrator.startAutoplay()
   |
   v
6. useAutoplay reducer sets status='generating'
   |
   v
7. useAutoplayOrchestrator effect detects status='generating'
   |
   v
8. Calls onRegeneratePrompts with onPromptsReady callback
   |
   v
9. SimulatorContext.handleGenerate generates prompts
   |
   v
10. onPromptsReady fires with new prompts (synchronous!)
    |
    v
11. generateImagesFromPrompts called with fresh prompts
    |
    v
12. useAutoplayOrchestrator effect detects isGeneratingImages=false
    |
    v
13. autoplay.onGenerationComplete(promptIds)
    |
    v
14. useAutoplay reducer sets status='evaluating'
    |
    v
15. useAutoplayOrchestrator effect calls evaluateImages()
    |
    v
16. autoplay.onEvaluationComplete(evaluations, polishCandidates?)
    |
    v
17. If polishCandidates: status='polishing', else status='refining'
    |
    v
18. Polish phase (optional): polishImageWithTimeout() for each candidate
    |
    v
19. autoplay.onPolishComplete(results)
    |
    v
20. status='refining': save approved images, apply feedback
    |
    v
21. autoplay.onIterationComplete()
    |
    v
22. Check completion conditions:
    - totalSaved >= targetSavedCount? -> complete
    - currentIteration >= maxIterations? -> complete
    - abortRequested? -> complete
    - else -> status='generating' (next iteration)
    |
    v
23. Loop back to step 7 OR complete
    |
    v
24. Multi-phase: advance to next phase or complete
```

**Single-Phase State Transitions:**
```
idle -> generating -> evaluating -> polishing (optional) -> refining -> (loop or complete)
```

**Multi-Phase Transitions:**
```
idle -> sketch -> gameplay -> poster -> hud -> complete
                      |
                      v (if error)
                    error
```

### Critical Callback Wiring

These callbacks MUST be wired correctly for autoplay to function:

| Callback | Source | Purpose | Critical |
|----------|--------|---------|----------|
| `onRegeneratePrompts` | SimulatorContext | Triggers prompt + image generation | YES |
| `saveImageToPanel` | useImageGeneration | Saves approved images to panel | YES |
| `setFeedback` | useBrain | Applies refinement feedback for next iteration | YES |
| `generateImagesFromPrompts` | useImageGeneration | Direct image generation from prompts | YES |
| `onLogEvent` | Optional | Activity logging for sidebar | NO |

**Callback Wiring in SimulatorContext:**

```typescript
// SimulatorContext.tsx
const handleGenerate = useCallback(async (overrides?: {
  feedback?: { positive: string; negative: string };
  onPromptsReady?: (prompts: GeneratedPrompt[]) => void;
}) => {
  // ... generate prompts ...
  setGeneratedPrompts(newPrompts);

  // Fire callback AFTER setState but BEFORE waiting for React's state update
  overrides?.onPromptsReady?.(newPrompts);
}, [/* deps */]);
```

### Key Wiring Pattern: onPromptsReady

The `onPromptsReady` callback pattern solves React's async state update timing issue:

```typescript
// PROBLEM: Effect-based approach has timing issues
// The orchestrator would need to wait for state to propagate
useEffect(() => {
  if (status === 'generating' && generatedPrompts.length > 0) {
    // BUG: generatedPrompts might be stale due to React batching
    generateImagesFromPrompts(generatedPrompts);
  }
}, [status, generatedPrompts]);

// SOLUTION: Callback gets fresh data synchronously
onRegeneratePrompts({
  feedback: feedbackOverride || undefined,
  onPromptsReady: (newPrompts) => {
    // newPrompts is fresh - came directly from handleGenerate
    // No waiting for React state update
    generateImagesFromPrompts(newPrompts.map(p => ({ id: p.id, prompt: p.prompt })));
  },
});
```

**Why this works:**
1. `handleGenerate` computes new prompts
2. Calls `setState(newPrompts)` to update React state
3. Immediately calls `onPromptsReady(newPrompts)` with the same data
4. Orchestrator receives fresh prompts synchronously
5. React state update happens eventually (for UI), but orchestrator doesn't wait

### Critical Refs Pattern

The orchestrator uses refs to avoid stale closure issues in effects:

```typescript
// Track current prompts via ref
const generatedPromptsRef = useRef(generatedPrompts);
generatedPromptsRef.current = generatedPrompts; // Update every render

// Track pending feedback between iterations
const pendingFeedbackRef = useRef<Feedback | null>(null);

// In effects, use ref instead of state:
const currentPrompts = generatedPromptsRef.current; // Always fresh
```

---

## The State Snapshot Pattern (Undo/Memento)

**For operations that need undo support, use the unified `useUndoStack` hook.**

### Problem

Multiple features need undo functionality:
- Image parsing should allow restoring previous dimensions
- Element-to-dimension drops should be reversible
- Smart breakdown application should be undoable

Without a unified pattern, each feature implements bespoke undo logic:
- Scattered `preSnapshot` state across hooks
- Inconsistent undo behavior
- No cross-feature undo support

### Solution: `useUndoStack<T>`

A generalized undo stack implementing the Memento pattern:

```typescript
import { useUndoStack, UNDO_TAGS } from './useUndoStack';

// Define your snapshot type
interface MySnapshot {
  dimensions: Dimension[];
  baseImage: string;
}

function useMyFeature() {
  const undoStack = useUndoStack<MySnapshot>({ maxSize: 10 });
  const [state, setState] = useState<MyState>(initialState);

  // Before making a change, push current state to stack
  const makeChange = useCallback((newValue: string) => {
    undoStack.pushSnapshot(
      { dimensions: state.dimensions, baseImage: state.baseImage },
      UNDO_TAGS.DIMENSION_CHANGE,  // Optional tag for selective undo
      'User changed dimension'      // Optional description
    );
    setState(prev => ({ ...prev, value: newValue }));
  }, [state, undoStack]);

  // Undo restores the previous state
  const undo = useCallback(() => {
    const snapshot = undoStack.undo();
    if (snapshot) {
      setState(prev => ({
        ...prev,
        dimensions: snapshot.state.dimensions,
        baseImage: snapshot.state.baseImage,
      }));
    }
  }, [undoStack]);

  return { ...state, canUndo: undoStack.canUndo, undo };
}
```

### API Reference

```typescript
interface UndoStackReturn<T> {
  canUndo: boolean;              // Whether undo is available
  stackSize: number;             // Number of snapshots
  pushSnapshot(state: T, tag?: string, description?: string): void;
  undo(): StateSnapshot<T> | null;              // Pop and return last snapshot
  peek(): StateSnapshot<T> | null;              // Look at last snapshot
  undoByTag(tag: string): StateSnapshot<T> | null;  // Undo to specific tag
  clear(): void;                                 // Clear all snapshots
  getStack(): ReadonlyArray<StateSnapshot<T>>;  // Debug: get all snapshots
}
```

### Standard Tags

Use predefined tags from `UNDO_TAGS` for consistency:

```typescript
export const UNDO_TAGS = {
  IMAGE_PARSE: 'image-parse',
  DIMENSION_CHANGE: 'dimension-change',
  ELEMENT_LOCK: 'element-lock',
  PROMPT_REGENERATE: 'prompt-regenerate',
  SMART_BREAKDOWN: 'smart-breakdown',
  FEEDBACK_APPLY: 'feedback-apply',
  PROJECT_LOAD: 'project-load',
};
```

### Options

```typescript
useUndoStack<T>({
  maxSize: 10,                    // Max snapshots to keep (default: 10)
  deduplicateConsecutive: true,   // Skip duplicate snapshots (default: true)
  isEqual: (a, b) => a === b,     // Custom equality for deduplication
});
```

### Existing Implementations

| Feature | Hook | Tags Used | Status |
|---------|------|-----------|--------|
| Image Parse | `useBrain.ts` | `IMAGE_PARSE` | ✅ Migrated |
| Element Drop | `useDimensions.ts` | `ELEMENT_LOCK`, `DIMENSION_CHANGE` | ✅ Migrated |
| Smart Breakdown | `useBrain.ts` | `SMART_BREAKDOWN` | Candidate |
| Prompt Regenerate | `usePrompts.ts` | `PROMPT_REGENERATE` | Candidate |

### When to Use

**Use `useUndoStack` when:**
- User can make destructive changes that may need reversal
- AI operations overwrite user data
- Drag-and-drop or batch operations affect state
- Cross-feature operations need consistent undo

**Skip undo for:**
- Simple toggles (modal open/close)
- Additive operations (adding items to a list)
- Operations with explicit confirmation dialogs

---

## Lessons Learned (v1.2 Autoplay)

This section captures key insights from implementing the autoplay orchestration fix in v1.2. These lessons apply broadly to any async workflow in React.

### Lesson 1: Callback Over Effect for Async Chains

**Problem:** Effect-based state watching caused timing issues due to React batching.

When the orchestrator watched `generatedPrompts` state to trigger image generation:
- The effect fired, but `generatedPrompts` was stale (previous render's value)
- React's concurrent rendering batched the state update, delaying effect execution
- Result: 2-minute timeouts with no image generation

**Solution:** Pass callbacks (`onPromptsReady`) to get fresh data synchronously.

```typescript
// BEFORE: Effect-based (broken)
useEffect(() => {
  if (status === 'generating') {
    // generatedPrompts might be stale!
    generateImages(generatedPrompts);
  }
}, [status, generatedPrompts]);

// AFTER: Callback-based (works)
onRegeneratePrompts({
  onPromptsReady: (freshPrompts) => {
    // freshPrompts came directly from the source
    generateImages(freshPrompts);
  },
});
```

**When to apply:** Any time you need immediate access to freshly-computed state in an async chain. If "state seems one step behind," consider a callback pattern.

**v1.2 implementation:** `SimulatorContext.handleGenerate` now accepts `onPromptsReady` callback, fired synchronously after `setGeneratedPrompts`.

### Lesson 2: Delegation Pattern for Multi-Level Orchestration

**Problem:** Multi-phase autoplay duplicated single-phase logic.

Initial implementation had `useMultiPhaseAutoplay` reimplementing the entire generate-evaluate-refine loop, leading to:
- Duplicated timeout handling
- Inconsistent callback wiring
- Bugs in one layer not fixed in the other

**Solution:** Multi-phase instantiates and controls single-phase orchestrator.

```typescript
// useMultiPhaseAutoplay.ts
const singlePhaseOrchestrator = useAutoplayOrchestrator(deps);

// Delegation effect: when phase changes, start single-phase
useEffect(() => {
  if (phase === 'sketch' || phase === 'gameplay') {
    singlePhaseOrchestrator.startAutoplay(config);
  }
}, [phase]);

// Completion effect: when single-phase finishes, advance
useEffect(() => {
  if (!singlePhaseOrchestrator.isRunning && completionReason) {
    advanceToNextPhase();
    singlePhaseOrchestrator.resetAutoplay();
  }
}, [singlePhaseOrchestrator.isRunning, completionReason]);
```

**Benefit:** Single-phase logic tested once, multi-phase just manages transitions.

**Key insight:** Watch `isRunning` + `completionReason` for orchestrator state, not individual status values.

**v1.2 implementation:** `useMultiPhaseAutoplay` now delegates to `useAutoplayOrchestrator` for all image generation phases.

### Lesson 3: Refs for Values in Effects

**Problem:** State values in effects are stale due to closure semantics.

```typescript
// BUG: generatedPrompts captured at effect creation time
useEffect(() => {
  const prompt = generatedPrompts.find(p => p.id === targetId);
  // prompt might be from a previous render!
}, [someOtherDep]);
```

**Solution:** Use refs (`generatedPromptsRef`, `pendingFeedbackRef`) for effect-accessed values.

```typescript
// Track state in ref, update every render
const generatedPromptsRef = useRef(generatedPrompts);
generatedPromptsRef.current = generatedPrompts;

// In effects, read from ref (always current)
useEffect(() => {
  const currentPrompts = generatedPromptsRef.current;
  const prompt = currentPrompts.find(p => p.id === targetId);
  // prompt is always from latest state
}, [someOtherDep]);
```

**Warning signs:** State values that seem "one step behind," effects using state that doesn't match what UI shows.

**Pattern:** Update ref in same render cycle as state update (before return statement).

**v1.2 implementation:** `useAutoplayOrchestrator` uses `generatedPromptsRef`, `pendingFeedbackRef`, and `generatedImagesRef`.

### Lesson 4: Generous Timeouts for AI Services

**Problem:** 60s timeout was too aggressive for slow AI providers.

Image generation through Leonardo AI can take 30-90 seconds depending on:
- Queue depth
- Model complexity
- Server load

A 60-second timeout caused legitimate operations to abort.

**Solution:** 120s timeout as safety net, not primary control.

```typescript
// Safety net timeout - generous to avoid false positives
const TIMEOUT_MS = 120000; // 120 seconds

const timeoutId = setTimeout(() => {
  // This should rarely fire - it's a safety net
  autoplay.setError('Generation timed out - please try again');
}, TIMEOUT_MS);
```

**Principle:** Timeouts prevent hangs, not control flow. Let the actual operation complete, use timeout only to recover from true failures.

**v1.2 implementation:** Both `useAutoplayOrchestrator` (120s) and `useMultiPhaseAutoplay` (120s per phase) use generous timeouts.

### Common Pitfalls

A quick reference for debugging autoplay-related issues:

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Stale closures in effects | State seems "one step behind" | Use refs to track current state |
| Relying on state updates for chain propagation | Async chain breaks between steps | Use callbacks for immediate data delivery |
| Tight timeouts for external services | Legitimate operations abort | Use generous safety-net timeouts (120s+) |
| Duplicating logic across orchestration levels | Same bug appears in multiple places | Delegate lower-level orchestrators |
| Watching too-specific state for completion | Miss completion in edge cases | Watch `isRunning` + `completionReason` |

**Debugging checklist:**
1. Is the state value being read from a ref? (check closure staleness)
2. Is there a callback path for immediate data? (check async chain)
3. Is the timeout long enough? (check AI service latency)
4. Is there duplication between orchestrators? (check delegation)
