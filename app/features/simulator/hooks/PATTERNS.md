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
