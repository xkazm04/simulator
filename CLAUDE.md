# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Simulator is a "What If" image visualization tool that combines cultural references (games, movies, art) to generate unique prompts for AI image generators like Leonardo AI or Midjourney.

**Core Concept:** Content-Swap Transformation
- PRESERVE the base visual FORMAT (camera angles, UI layout, medium)
- SWAP the CONTENT within that structure

## Common Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
```

## Architecture Overview

### File Structure

```
app/
├── features/simulator/
│   ├── SimulatorFeature.tsx      # Thin wrapper component
│   ├── types.ts                   # TypeScript definitions
│   ├── components/
│   │   ├── variants/OnionLayout.tsx  # Main layered ring UI
│   │   ├── SmartBreakdown.tsx        # AI vision parser (text)
│   │   ├── BaseImageInput.tsx        # Image upload with AI parsing
│   │   ├── DimensionCard.tsx         # Individual dimension input
│   │   ├── DimensionGrid.tsx         # Grid of dimensions
│   │   ├── FeedbackPanel.tsx         # Generate/feedback controls
│   │   ├── PromptOutput.tsx          # Generated prompts display
│   │   ├── PromptCard.tsx            # Individual prompt card
│   │   ├── PromptDetailModal.tsx     # Full prompt view modal
│   │   ├── ElementChip.tsx           # Lockable element label
│   │   └── ElementToDimensionButton.tsx
│   ├── hooks/
│   │   └── useSimulator.ts       # Central state management
│   └── lib/
│       ├── promptBuilder.ts      # Prompt generation logic
│       ├── simulatorAI.ts        # API client for LLM calls
│       ├── llmPrompts.ts         # LLM prompt templates
│       ├── defaultDimensions.ts  # Dimension presets
│       └── gameUIPresets.ts      # Game UI genre presets
├── api/ai/
│   ├── simulator/route.ts        # Anthropic Claude API endpoint
│   └── image-describe/route.ts   # Gemini Vision API endpoint
├── lib/
│   ├── gemini.ts                 # Universal Gemini AI provider
│   └── utils.ts                  # General utilities (cn helper)
└── utils/apiErrorHandling.ts     # API utilities
```

### State Management

The app uses a **custom hook pattern** with `useSimulator`:

```typescript
// hooks/useSimulator.ts exports both state and actions
const simulator = useSimulator();

// State
simulator.baseImage           // Required foundation reference
simulator.dimensions          // Array of remix dimensions
simulator.generatedPrompts    // Generated scene prompts
simulator.isGenerating        // Loading state
simulator.outputMode          // 'gameplay' | 'concept'
simulator.lockedElements      // Elements locked for preservation

// Actions
simulator.handleGenerate()
simulator.handleDimensionChange(id, value)
simulator.handlePromptLock(id)
simulator.handleElementLock(promptId, elementId)
simulator.handleAcceptElement(element)
```

### Key Types

```typescript
// Dimension - a remix aspect with cultural reference
interface Dimension {
  id: string;
  type: DimensionType;  // 'environment' | 'artStyle' | 'characters' | etc.
  label: string;
  icon: string;
  placeholder: string;
  reference: string;    // The cultural reference text
}

// GeneratedPrompt - output scene prompt
interface GeneratedPrompt {
  id: string;
  sceneType: string;
  prompt: string;
  elements: PromptElement[];
  locked: boolean;
  rating: 'up' | 'down' | null;
}

// PromptElement - individual aspect within a prompt
interface PromptElement {
  id: string;
  category: string;
  text: string;
  locked: boolean;
}

// OutputMode - affects prompt structure
type OutputMode = 'gameplay' | 'concept';
```

### AI Integration

Four AI-powered features using Anthropic Claude and Google Gemini:

1. **Image Description** (`BaseImageInput.tsx` + `app/lib/gemini.ts`)
   - Input: Uploaded image file
   - Output: Structured description with format, swappable content, suggested dimensions
   - Uses Google Gemini Vision (`gemini-2.5-flash-preview-05-20`)
   - Automatically populates base description and dimensions on upload

2. **Smart Breakdown** (`SmartBreakdown.tsx`)
   - Input: Vision sentence like "Baldur's Gate in Star Wars"
   - Output: Structured dimensions extracted by AI
   - Uses Anthropic Claude

3. **Element-to-Dimension** (`ElementToDimensionButton.tsx`)
   - Convert locked elements into reusable dimension cards
   - Uses Anthropic Claude

4. **Label-to-Dimension** (`simulatorAI.ts: labelToDimension`)
   - Accept an element and refine dimensions based on it
   - Supports undo via `handleUndoDimensionChange`
   - Uses Anthropic Claude

### API Layer

```typescript
// Text-based AI: app/api/ai/simulator/route.ts
// Uses Anthropic Claude API with fallback to mock

// Vision AI: app/api/ai/image-describe/route.ts
// Uses Google Gemini Vision API (always attempts real API, shows error on failure)

// Environment variables:
ANTHROPIC_API_KEY                    // Required for Claude features
GOOGLE_AI_API_KEY                    // Required for Gemini Vision
NEXT_PUBLIC_USE_REAL_SIMULATOR_AI    // Set to 'true' for Claude features (optional)
```

### Universal Gemini Provider

`app/lib/gemini.ts` provides a reusable server-side Gemini client:

```typescript
import { analyzeImage, generateContent, createImagePart, createTextPart } from '@/app/lib/gemini';

// Analyze an image with a prompt
const description = await analyzeImage(imageDataUrl, 'Describe this image');

// Or use the lower-level API for complex prompts
const response = await generateContent([
  createImagePart(imageDataUrl),
  createTextPart('What is in this image?'),
], { temperature: 0.3, maxTokens: 1500 });
```

## Key Patterns

### Async Workflow Pattern (Orchestrator Separation)

For complex async workflows involving API calls, use a two-hook separation:

1. **State Machine Hook** (`use<Feature>.ts`) - Pure state with `useReducer`
   - Handles all state transitions
   - No side effects or API calls
   - Testable in isolation

2. **Orchestrator Hook** (`use<Feature>Orchestrator.ts`) - Side effects
   - Listens to state changes
   - Triggers API calls based on state
   - Wires external services together

**Example:** `useAutoplay.ts` (state machine) + `useAutoplayOrchestrator.ts` (effects)

See `app/features/simulator/hooks/PATTERNS.md` for full documentation.

### Adding a New Dimension Type

1. Add type to `types.ts`:
   ```typescript
   export type DimensionType = '...' | 'newType';
   ```

2. Add preset to `lib/defaultDimensions.ts`:
   ```typescript
   export const DIMENSION_PRESETS: DimensionPreset[] = [
     // ...
     { type: 'newType', label: 'New Type', icon: 'IconName', placeholder: '...' }
   ];
   ```

### Adding a New Scene Type

Add to `types.ts`:
```typescript
export const SCENE_TYPES = ['...', 'New Scene Type'];
```

Then update `lib/promptBuilder.ts` with variations for the new scene type.

### Component Composition

Components follow a thin-wrapper pattern:
- `SimulatorFeature.tsx` - Orchestrates layout and modal
- `OnionLayout.tsx` - Main UI composition with rings
- Individual components receive props from `useSimulator` hook

### Styling Conventions

- Tailwind CSS 4 with dark theme
- Color palette: slate backgrounds, cyan/purple accents
- Font: System sans-serif with monospace accents
- Class merging: `cn()` from `lib/utils.ts`

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  'base-classes',
  condition && 'conditional-classes'
)} />
```

### Animation Patterns

Uses Framer Motion for:
- Panel expand/collapse (`AnimatePresence`)
- Element transitions
- Loading states

```typescript
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {isVisible && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    />
  )}
</AnimatePresence>
```

## File Size Guidelines

Keep files under 200-300 lines:
- Extract complex logic to `lib/` utilities
- Extract state management to `hooks/`
- Split large components into smaller ones

## Environment Variables

```env
# Required for real AI (optional, falls back to mock)
ANTHROPIC_API_KEY=your_anthropic_key      # For Claude (text breakdown, element conversion)
GOOGLE_AI_API_KEY=your_google_key         # For Gemini Vision (image description)
NEXT_PUBLIC_USE_REAL_SIMULATOR_AI=true    # Enable real AI calls (false = mock mode)
```

## Design Philosophy

1. **Reference-Based**: Uses cultural references users know, not abstract terms
2. **Content-Swap**: Preserves visual structure, transforms content
3. **Iterative**: Feedback loop for refining results
4. **Clean Manuscript Style**: Dark theme, monospace accents, cyan/purple highlights
