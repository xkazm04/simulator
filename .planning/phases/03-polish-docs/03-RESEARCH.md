# Phase 3: Polish & Documentation - Research

**Researched:** 2026-02-05
**Domain:** UI Consistency, Architecture Documentation, React Hooks Patterns
**Confidence:** HIGH

## Summary

This research analyzes the existing codebase to support Phase 3's goal of achieving visual consistency between the Activity Modal and main page, plus documenting the orchestrator architecture. The analysis covers:

1. **Orchestrator Effect Chain:** The multi-phase autoplay system uses a well-structured two-layer orchestration pattern with `useAutoplay` (state machine) + `useAutoplayOrchestrator` (effects) + `useMultiPhaseAutoplay` (multi-phase coordinator). The chain is complex but well-documented inline.

2. **Existing PATTERNS.md:** Already documents the orchestrator pattern and undo stack pattern. Needs updates with lessons learned from Phase 1/2 implementation.

3. **Styling Analysis:** The Activity Modal components largely follow main page patterns but have several inconsistencies in typography sizes, spacing tokens, and component structure that need alignment.

**Primary recommendation:** Focus on updating PATTERNS.md with data flow diagrams, align Activity Modal typography/spacing with design tokens, and ensure critical callback wiring is documented.

## Standard Stack

The codebase already has established patterns - no new libraries needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI Framework | Next.js standard |
| Framer Motion | Latest | Animations | Already established in codebase |
| Tailwind CSS | 4.x | Styling | Design token system already in place |
| Lucide React | Latest | Icons | Consistent iconography |

### Supporting (Documentation)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Mermaid | Data flow diagrams | PATTERNS.md architecture diagrams |
| Markdown | Documentation | All .md files |

## Architecture Patterns

### Current Orchestrator Chain Structure

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

### Data Flow (Documented from Code Analysis)

**Phase Transitions:**
```
idle -> sketch -> gameplay -> poster -> hud -> complete
                      |
                      v (if error)
                    error
```

**Single-Phase Iteration Flow:**
```
generating -> evaluating -> polishing (optional) -> refining -> (next iteration or complete)
```

### Callback Wiring Critical Points

From analysis of `useAutoplayOrchestrator.ts` (lines 82-95):

| Callback | Source | Purpose | Critical |
|----------|--------|---------|----------|
| `onRegeneratePrompts` | SimulatorContext | Triggers prompt + image generation | YES |
| `saveImageToPanel` | useImageGeneration | Saves approved images | YES |
| `setFeedback` | useBrain | Applies refinement feedback | YES |
| `generateImagesFromPrompts` | useImageGeneration | Direct image generation | YES |
| `onLogEvent` | Optional | Activity logging | NO |

**Key Wiring Pattern (from lines 196-218):**
- Generation uses callback with `onPromptsReady` to avoid React state timing issues
- Feedback stored in ref (`pendingFeedbackRef`) for next iteration before state updates
- Prompts tracked via ref (`generatedPromptsRef`) to avoid stale closures

## Design Token System (HIGH Confidence)

From `globals.css` and `semanticColors.ts`:

### Typography Scale
| Token | Size | Use Case |
|-------|------|----------|
| `type-label` | 11px | Smallest labels, hints (WCAG AA) |
| `type-body-sm` | 12px | Compact text |
| `text-sm` | 14px | Primary text (Tailwind) |
| `text-md` | 14px | Standard text |
| `type-heading` | 18px | Section headings |
| `type-title` | 22px | Major headings |

### Spacing Scale
| Token | Size | Utility Class |
|-------|------|---------------|
| `--space-xs` | 4px | `p-xs`, `gap-xs` |
| `--space-sm` | 8px | `p-sm`, `gap-sm` |
| `--space-md` | 16px | `p-md`, `gap-md` |
| `--space-lg` | 24px | `p-lg`, `gap-lg` |
| `--space-xl` | 32px | `p-xl`, `gap-xl` |

### Border Radius
| Token | Size | Use Case |
|-------|------|----------|
| `radius-sm` | 6px | Chips, badges |
| `radius-md` | 8px | Cards, buttons |
| `radius-lg` | 12px | Modals, overlays |

### Semantic Colors
| Context | Border | Background | Text |
|---------|--------|------------|------|
| Primary (cyan) | `border-cyan-500/30` | `bg-cyan-500/10` | `text-cyan-400` |
| Success (green) | `border-green-500/30` | `bg-green-500/10` | `text-green-400` |
| Warning (amber) | `border-amber-500/30` | `bg-amber-500/10` | `text-amber-400` |
| Error (red) | `border-red-500/30` | `bg-red-500/10` | `text-red-400` |
| Processing (purple) | `border-purple-500/30` | `bg-purple-500/10` | `text-purple-400` |

## Styling Inconsistencies Found

### AutoplaySetupModal.tsx Issues

| Line | Current | Should Be | Impact |
|------|---------|-----------|--------|
| 115, 122 | `font-medium text-slate-200` | `font-medium text-slate-200` (OK) | None |
| 123 | `type-label text-slate-500` | Use design token system | Minor |
| 264 | `text-sm font-medium text-slate-400` | `type-body-sm font-medium text-slate-400` | Consistency |
| 355-358 | Header uses `text-md` directly | Match `CentralBrain.tsx` header pattern | Visual |

### ActivityProgressCenter.tsx Issues

| Line | Current | Should Be | Impact |
|------|---------|-----------|--------|
| 126-127 | `text-sm font-medium` | Use typography tokens | Consistency |
| 130 | `font-mono text-sm` | `font-mono type-body-sm` | Consistency |
| 189 | `text-xs` | `type-label` | Typography scale |
| 225-242 | Multiple `text-purple-300` | Use semantic color system | Consistency |

### ActivityLogSidebar.tsx Issues

| Line | Current | Should Be | Impact |
|------|---------|-----------|--------|
| 203-204 | `text-xs`, `text-[10px]` | `type-label` (11px) | WCAG AA compliance |
| 220-247 | Mixed `text-[10px]` | `type-label` for all small text | Accessibility |
| 275 | `text-xs font-medium` | `type-label font-medium` | Typography scale |

### Comparison with Main Page Components

**CentralBrain.tsx Headers (Reference Pattern):**
```tsx
// Line 190-191
<span className="text-md uppercase tracking-widest text-white font-medium
  flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
  <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
```

**DirectorControl.tsx Headers (Reference Pattern):**
```tsx
// Line 355-357
<span className="text-md uppercase tracking-widest text-white font-medium
  flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
```

**Activity Modal Headers (Should Match):**
- Should use same header pattern with colored dot indicator
- Should use same drop-shadow effect for emphasis

## Don't Hand-Roll

| Problem | Existing Solution | Why |
|---------|-------------------|-----|
| Typography sizes | Design token system (`type-label`, etc.) | WCAG compliance, consistency |
| Semantic colors | `semanticColors` object | Tailwind detection, consistency |
| Spacing | Design token classes (`p-lg`, `gap-md`) | Unified spacing scale |
| Border radius | `radius-sm/md/lg` classes | Visual hierarchy |
| Animations | `fadeIn`, `expandCollapse` from `lib/motion.ts` | Consistent transitions |

## Common Pitfalls

### Pitfall 1: Typography Size Drift
**What goes wrong:** Using arbitrary sizes like `text-[10px]` instead of design tokens
**Why it happens:** Quick fixes without checking token system
**How to avoid:** Always use `type-label` (11px min), `type-body-sm` (12px), or Tailwind `text-sm` (14px)
**Warning signs:** Any `text-[Xpx]` syntax in code

### Pitfall 2: Semantic Color Inconsistency
**What goes wrong:** Using raw Tailwind colors (`text-purple-300`) instead of semantic system
**Why it happens:** Not aware of `semanticColors` object
**How to avoid:** Import and use `semanticColors.processing.text` etc.
**Warning signs:** Hard-coded color values not matching semantic intent

### Pitfall 3: Missing Design Token Classes
**What goes wrong:** Using `rounded-lg` instead of `radius-lg`
**Why it happens:** Tailwind defaults are familiar
**How to avoid:** Use project's radius classes for visual consistency
**Warning signs:** Mixed `rounded-*` and `radius-*` usage

### Pitfall 4: Stale Closure in Orchestrator Effects
**What goes wrong:** Using state values that are outdated in useEffect callbacks
**Why it happens:** React's closure semantics with async operations
**How to avoid:** Use refs for values needed in effects (see `generatedPromptsRef`, `pendingFeedbackRef`)
**Warning signs:** State values that seem "one step behind"

## Code Examples

### Typography Usage Pattern
```typescript
// Source: globals.css + semanticColors.ts

// Label text (11px) - for hints, timestamps, meta
<span className="type-label text-slate-400">Timestamp</span>

// Body small (12px) - for compact info
<span className="type-body-sm text-slate-300">Secondary info</span>

// Standard text (14px) - primary content
<span className="text-sm text-slate-200">Primary content</span>
```

### Semantic Color Pattern
```typescript
// Source: semanticColors.ts

import { semanticColors } from '../../lib/semanticColors';

// Container with semantic color
<div className={`${semanticColors.success.border} ${semanticColors.success.bg}`}>
  <span className={semanticColors.success.text}>Success!</span>
</div>
```

### Main Page Header Pattern
```typescript
// Source: CentralBrain.tsx, DirectorControl.tsx

// Standard section header with indicator dot
<span className="text-md uppercase tracking-widest text-white font-medium
  flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
  <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
  Section Title
</span>
```

### Orchestrator Callback Wiring Pattern
```typescript
// Source: useAutoplayOrchestrator.ts lines 210-214

// Pass callback to avoid state timing issues
onRegeneratePrompts({
  feedback: feedbackOverride || undefined,
  onPromptsReady: (newPrompts) => {
    // Immediately use fresh prompts, don't wait for state
    generateImagesFromPrompts(newPrompts.map(p => ({ id: p.id, prompt: p.prompt })));
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Arbitrary `text-[Xpx]` | Design token typography | Phase 1 | WCAG compliance |
| Raw Tailwind colors | Semantic color system | Phase 1 | Consistency |
| Mixed effects+state | Orchestrator pattern | Phase 1 | Testability |

## Open Questions

1. **PATTERNS.md Diagram Format**
   - What we know: Markdown with code blocks works
   - What's unclear: Should we use Mermaid for diagrams or ASCII art?
   - Recommendation: Use ASCII art for now (simpler, no tooling needed)

2. **Modal Z-Index Stacking**
   - What we know: Modal uses inline styles with `zIndex: 9999`
   - What's unclear: Is this the best approach vs. Tailwind z-index?
   - Recommendation: Keep current approach (portal-safe rendering)

## Sources

### Primary (HIGH confidence)
- `hooks/PATTERNS.md` - Existing pattern documentation
- `hooks/useAutoplay.ts` - State machine implementation
- `hooks/useAutoplayOrchestrator.ts` - Orchestration layer
- `hooks/useMultiPhaseAutoplay.ts` - Multi-phase coordination
- `lib/semanticColors.ts` - Design token system
- `globals.css` - Typography and spacing tokens

### Secondary (MEDIUM confidence)
- `components/variants/OnionLayout.tsx` - Main layout structure
- `subfeature_brain/components/DirectorControl.tsx` - Reference styling
- `subfeature_brain/components/CentralBrain.tsx` - Reference styling
- `subfeature_brain/components/AutoplaySetupModal.tsx` - Modal to update
- `subfeature_brain/components/ActivityProgressCenter.tsx` - Component to update
- `subfeature_brain/components/ActivityLogSidebar.tsx` - Component to update

## Metadata

**Confidence breakdown:**
- Design token system: HIGH - Directly from source code
- Orchestrator architecture: HIGH - Code analysis complete
- Styling inconsistencies: HIGH - Line-by-line comparison
- Pattern documentation: HIGH - Existing PATTERNS.md analyzed

**Research date:** 2026-02-05
**Valid until:** 60 days (stable patterns, internal documentation)

---

## Appendix: Detailed Orchestrator Data Flow

### Effect Chain Sequence

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
10. onPromptsReady fires with new prompts
    |
    v
11. generateImagesFromPrompts called
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

### Critical Callback Dependencies

```
SimulatorContext
    |
    +---> handleGenerate(overrides?)
              |
              +---> overrides.onPromptsReady?(prompts)
                        |
                        v (immediate)
              useAutoplayOrchestrator.generateImagesFromPrompts()
```

This avoids the React state update delay that would occur if we waited for `generatedPrompts` state to update.
