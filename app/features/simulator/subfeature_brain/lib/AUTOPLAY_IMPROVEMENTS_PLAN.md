# Autoplay Intelligent Generation - Implementation Plan

## Overview

This document outlines 5 improvement directions to make autoplay intelligently generate diverse, high-quality images across multiple phases.

## Current Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│  useMultiPhaseAutoplay (orchestrates phases)                        │
│    ↓                                                                 │
│  useAutoplayOrchestrator (manages generate→evaluate→refine loop)    │
│    ↓                                                                 │
│  imageEvaluator.ts (Gemini Vision evaluation)                        │
│    ↓                                                                 │
│  extractRefinementFeedback() → feedback applied to next iteration    │
└─────────────────────────────────────────────────────────────────────┘
```

Current flow:
1. Generate prompts from dimensions + feedback
2. Generate images via Leonardo AI
3. Evaluate images via Gemini Vision
4. Save approved images (score >= 70)
5. Apply refinement feedback
6. Repeat until target met

---

## Direction 1: Diversity Director

### Purpose
Track visual inventory across generated images and guide generation toward diverse, non-duplicate content.

### Architecture

```typescript
// New file: diversityDirector.ts

interface VisualFingerprint {
  promptId: string;
  imageUrl: string;
  features: {
    dominantColors: string[];      // From Gemini analysis
    composition: 'wide' | 'medium' | 'close' | 'portrait' | 'action';
    subjectType: string;           // "character", "landscape", "scene"
    mood: string;                  // "dramatic", "peaceful", "action"
    timeOfDay: string;             // "day", "night", "dusk", "dawn"
    cameraAngle: string;           // "eye-level", "low", "high", "aerial"
  };
  timestamp: Date;
}

interface DiversityInventory {
  fingerprints: VisualFingerprint[];

  // Counters for diversity tracking
  compositionCounts: Record<string, number>;
  moodCounts: Record<string, number>;
  timeOfDayCounts: Record<string, number>;

  // What's missing/underrepresented
  gaps: string[];
}

interface DiversityGuidance {
  /** Prompt modifications to encourage diversity */
  promptPrefix: string;
  /** What to avoid (already have enough of) */
  avoidAspects: string[];
  /** What to emphasize (underrepresented) */
  emphasizeAspects: string[];
}
```

### Key Functions

1. **`extractVisualFingerprint(imageUrl, promptId)`**
   - Uses Gemini Vision to analyze image characteristics
   - Returns structured fingerprint for inventory

2. **`updateDiversityInventory(inventory, fingerprint)`**
   - Adds fingerprint to inventory
   - Updates counts and identifies gaps

3. **`generateDiversityGuidance(inventory, targetCount)`**
   - Analyzes what's missing
   - Returns guidance for next generation

4. **`applyDiversityGuidance(prompt, guidance)`**
   - Modifies prompt to encourage diversity

### Integration Point
In `useAutoplayOrchestrator.ts`:
- After evaluation, extract fingerprints from saved images
- Before generation, get diversity guidance
- Inject guidance into `onRegeneratePrompts` override

---

## Direction 2: Adaptive Prompt Evolution

### Purpose
Extract success patterns from approved images and evolve prompts based on what works.

### Architecture

```typescript
// New file: promptEvolution.ts

interface SuccessPattern {
  id: string;
  type: 'element' | 'modifier' | 'structure';
  pattern: string;
  successCount: number;
  failureCount: number;
  confidence: number; // successCount / (successCount + failureCount)
}

interface SuccessFormula {
  /** High-confidence patterns to always include */
  corePatterns: SuccessPattern[];
  /** Medium-confidence patterns to sometimes include */
  optionalPatterns: SuccessPattern[];
  /** Patterns that correlate with failure */
  avoidPatterns: string[];
}

interface PromptMutation {
  type: 'emphasize' | 'de-emphasize' | 'substitute' | 'add' | 'remove';
  target: string;
  replacement?: string;
  reason: string;
}
```

### Key Functions

1. **`extractSuccessPatterns(evaluations, prompts)`**
   - Analyzes approved vs rejected images
   - Extracts common patterns from successes
   - Identifies patterns correlated with failures

2. **`buildSuccessFormula(patterns, minConfidence)`**
   - Filters patterns by confidence threshold
   - Builds formula with core/optional/avoid categories

3. **`generatePromptMutations(prompt, formula, history)`**
   - Creates smart mutations based on success formula
   - Avoids repeating failed mutations

4. **`applyPromptMutations(prompt, mutations)`**
   - Applies mutations to create evolved prompt

### Integration Point
In `useAutoplayOrchestrator.ts`:
- After each iteration, extract patterns
- Build cumulative success formula
- Apply mutations to prompts in subsequent iterations

---

## Direction 3: Shot List Generator (Future)

### Purpose
Generate a curated shot list before generation starts, ensuring comprehensive coverage.

### Architecture

```typescript
interface ShotListConfig {
  totalShots: number;
  outputMode: OutputMode;
  visionSentence: string;
  dimensions: Dimension[];
}

interface Shot {
  id: string;
  description: string;
  composition: string;
  mood: string;
  priority: 'essential' | 'recommended' | 'optional';
  generated: boolean;
  approved: boolean;
}

interface ShotList {
  shots: Shot[];
  coverage: {
    moods: string[];
    compositions: string[];
    subjects: string[];
  };
}
```

### Key Functions

1. **`generateShotList(config)`** - LLM generates comprehensive shot list
2. **`prioritizeShots(shotList, targetCount)`** - Orders by importance
3. **`markShotComplete(shotList, shotId)`** - Tracks completion
4. **`getShotGuidance(shotList)`** - Returns next shot to attempt

---

## Direction 4: Quality Escalation Strategy (Future)

### Purpose
Three-tier generation: exploration → refinement → polish

### Tiers

1. **Exploration (iterations 1-2)**
   - Lower approval threshold (60)
   - Broader diversity
   - Faster iteration

2. **Refinement (iterations 3-4)**
   - Standard threshold (70)
   - Focus on successful patterns
   - Targeted improvements

3. **Polish (iterations 5+)**
   - Higher threshold (80)
   - Minimal changes
   - Excellence polish enabled

### Integration
- Modify `useAutoplay.ts` to support dynamic thresholds
- Adjust polish config based on tier

---

## Direction 5: Style Coherence Lock (Future)

### Purpose
Extract and lock visual style from first successful image.

### Architecture

```typescript
interface StyleLock {
  enabled: boolean;
  referenceImageUrl: string;
  extractedStyle: {
    colorPalette: string[];
    renderingStyle: string;
    lightingCharacter: string;
    textureQuality: string;
  };
  stylePromptFragment: string;
}
```

### Key Functions

1. **`extractStyleFromImage(imageUrl)`** - Gemini extracts style elements
2. **`generateStyleLockPrompt(style)`** - Creates consistent style instructions
3. **`applyStyleLock(prompt, styleLock)`** - Injects style consistency

---

## Implementation Priority

### Phase 1 (Now): Directions 1 & 2
- Diversity Director - Prevents repetitive content
- Adaptive Prompt Evolution - Learns from success

### Phase 2 (Future): Directions 3 & 5
- Shot List Generator - Planned comprehensive coverage
- Style Coherence Lock - Visual consistency

### Phase 3 (Future): Direction 4
- Quality Escalation - Advanced iteration strategy

---

## File Structure

```
app/features/simulator/subfeature_brain/lib/
├── diversityDirector.ts      # Direction 1
├── promptEvolution.ts        # Direction 2
├── shotListGenerator.ts      # Direction 3 (future)
├── qualityEscalation.ts      # Direction 4 (future)
├── styleCoherence.ts         # Direction 5 (future)
└── imageEvaluator.ts         # Enhanced with fingerprinting
```

---

## API Endpoints (if needed)

- `/api/ai/analyze-diversity` - Gemini fingerprinting
- `/api/ai/extract-patterns` - Pattern extraction
- `/api/ai/generate-shot-list` - Shot list generation
- `/api/ai/extract-style` - Style extraction
