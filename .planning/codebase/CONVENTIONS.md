# Coding Conventions

**Analysis Date:** 2026-01-27

## Naming Patterns

**Files:**
- Components: PascalCase (`OnionLayout.tsx`, `PromptDetailModal.tsx`, `DimensionCard.tsx`)
- Utilities: camelCase (`motion.ts`, `promptBuilder.ts`, `simulatorAI.ts`)
- Hooks: prefixed with `use`, camelCase (`useBrain.ts`, `useImageGeneration.ts`, `useProjectManager.ts`)
- API routes: lowercase with hyphens (`generate-images`, `image-describe`, `simulator`)
- Contexts: PascalCase with `Context` suffix (`BrainContext.tsx`, `DimensionsContext.tsx`, `SimulatorContext.tsx`)
- Test files: same name as source with `.test.ts` or `.spec.ts` suffix (`generate-images.test.ts`)

**Functions:**
- PascalCase for React components: `function OnionLayoutComponent()` → exported as `OnionLayout` (often wrapped with `memo()`)
- camelCase for utility functions: `createDimensionWithDefaults()`, `parseJsonResponse()`, `handleSmartBreakdown()`
- camelCase for async handlers: `handleGenerate()`, `handleElementLock()`, `onAcceptElement()`
- Prefix with `use` for custom hooks: `useReducedMotion()`, `useResponsivePanels()`

**Variables:**
- camelCase for all variables and constants
- SCREAMING_SNAKE_CASE for immutable constants: `const HTTP_STATUS = { ... }`, `const DURATION = { ... }`
- Descriptive names with domain context: `generatedPrompts`, `simulatedDimensions`, `baseImageDescription`
- Boolean variables/props prefixed with `is`, `can`, `has`, `show`: `isGenerating`, `canGenerate`, `hasEnoughData`, `showPosterOverlay`

**Types:**
- PascalCase for interfaces and types: `interface Dimension`, `type DimensionType`, `interface GeneratedPrompt`
- Descriptive union type names: `type OutputMode = 'gameplay' | 'concept' | 'poster'`
- Props interfaces suffixed with `Props`: `interface OnionLayoutProps`, `interface SimulatorLayoutProps`
- Request/Response interfaces use action-specific names: `SmartBreakdownRequest`, `ElementToDimensionRequest`, `GenerateWithFeedbackResponse`

## Code Style

**Formatting:**
- ESLint 9 with Next.js configuration (`eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`)
- No explicit Prettier config; ESLint handles style enforcement
- Indentation: 2 spaces (implicit from codebase style)
- Line breaks: `\n` (Unix-style)

**Linting:**
- ESLint configuration: `C:\Users\kazda\kiro\simulator\eslint.config.mjs`
- Enforces Next.js core web vitals and TypeScript best practices
- Custom ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`
- Run with: `npm run lint`

**TypeScript:**
- Strict mode enabled: `"strict": true`
- Target: ES2017
- JSX mode: `react-jsx`
- Module resolution: `bundler`
- Path alias: `@/*` → root directory
- ESM modules: `"module": "esnext"`

## Import Organization

**Order:**
1. React and framework imports: `import React, { useState } from 'react'`
2. Third-party library imports: `import { motion, AnimatePresence } from 'framer-motion'`
3. Type imports: `import { Dimension, GeneratedPrompt } from './types'`
4. Relative component imports: `import { OnionLayout } from './components/variants/OnionLayout'`
5. Relative utility/lib imports: `import { cn } from '@/lib/utils'`
6. Styles (implicit Tailwind via className)

**Path Aliases:**
- `@/` resolves to project root
- `@/app/` available explicitly but usually just `@/` is sufficient
- Example: `import { cn } from '@/lib/utils'` (from anywhere in codebase)
- Example: `import { createDimensionWithDefaults } from '@/app/features/simulator/types'`

**Re-exports:**
- Barrel files use `export *` pattern: `index.ts` files re-export from subfeatures
- Example: `app/features/simulator/index.ts` exports `SimulatorFeature`
- Example: `app/components/ui/index.ts` re-exports UI primitives

## Error Handling

**API Error Patterns:**
- Centralized error handler: `createErrorResponse()` from `@/app/utils/apiErrorHandling`
- Example: `createErrorResponse('Input too short', HTTP_STATUS.BAD_REQUEST)`
- HTTP status constants defined as: `const HTTP_STATUS = { BAD_REQUEST: 400, INTERNAL_SERVER_ERROR: 500 }`
- All API routes wrap in try-catch with console.error logging

**Function-Level Error Handling:**
- Validation at entry points before processing
- Example pattern from `app/api/ai/simulator/route.ts`:
  ```typescript
  if (!userInput || userInput.trim().length < 5) {
    return createErrorResponse('Input too short', HTTP_STATUS.BAD_REQUEST);
  }
  ```
- JSON parsing with error capture: `parseJsonResponse()` wraps JSON.parse with regex fallback

**React Component Error Boundaries:**
- Not explicitly implemented; relies on Next.js error handling
- Component-level try-catch used in async event handlers
- Errors typically propagate to parent or toast notifications

## Logging

**Framework:** `console` (built-in browser/Node.js logging)

**Patterns:**
- `console.error()` for errors in API routes and async operations
- Example: `console.error('Simulator AI error:', error);`
- No structured logging (Pino, Winston, etc.)
- Error context includes: error message + relevant request data

**When to Log:**
- API route errors: always log on server side
- Async operation failures: log before returning error response
- Example line: `console.error('Failed to generate:', error);`

## Comments

**When to Comment:**
- JSDoc for exported functions and complex logic
- Inline comments for non-obvious algorithms or domain-specific decisions
- Section headers for logical groupings: `// ============================================`
- Example headers: `// Key Abstractions`, `// Panel image saved to side panel slot`

**JSDoc/TSDoc:**
- Used extensively in `types.ts` for interface/type explanations
- Example from `app/features/simulator/types.ts`:
  ```typescript
  /**
   * Dimension - A LENS for viewing and transforming the base image
   *
   * Conceptually, a Dimension is not just a label but a transformation lens:
   * 1. FILTER: What to preserve from the base image
   * 2. TRANSFORM: How to apply the reference content
   * 3. WEIGHT: How strongly to apply (0-100, enables graduated transformations)
   */
  export interface Dimension {
    // ...
  }
  ```
- Function JSDoc shows parameters and return type
- Block comments for explaining "why" not "what"

## Function Design

**Size Guidelines:** Keep under 200-300 lines per file
- Extracted complex logic to `lib/` utilities
- Extracted state management to custom hooks
- Split large components into smaller ones
- Example: `SimulatorFeature.tsx` (~200 lines) delegates to multiple hooks

**Parameters:**
- Prefer object parameters over multiple positional arguments for 3+ params
- Example: `function handleRequest(body: SmartBreakdownRequest)`
- Optional props grouped in interfaces: `interface OnionLayoutProps { ... }`
- Default values in function signature: `leftPanelSlots = []`

**Return Values:**
- Explicit return types for all functions
- Example: `function cn(...inputs: ClassValue[]): string`
- Async functions return Promises with generic type: `async function handleGenerate(): Promise<void>`
- API routes return `NextResponse` or error response

## Module Design

**Exports:**
- Default export for single main component: `export default SimulatorFeature`
- Named exports for utilities and types: `export function cn(...)`
- Barrel file pattern for subfeature organization:
  - `app/features/simulator/subfeature_brain/index.ts` exports both `BrainProvider` and components
  - `app/features/simulator/subfeature_prompts/index.ts` exports context and modal

**Barrel Files:**
- Used for organizing features into cohesive units
- Example: `app/features/simulator/subfeature_brain/index.ts` re-exports:
  - `export { BrainProvider } from './BrainContext'`
  - `export { CentralBrain } from './components/CentralBrain'`
- Client components explicitly marked with `'use client'` at top

## File Organization Patterns

**Component Files:**
- Single exported component per file (with rare exceptions)
- Internal helper functions placed above component
- Props interface placed near top after imports
- Memoization applied to exported components when appropriate: `export const OnionLayout = memo(OnionLayoutComponent, arePropsEqual)`

**Hook Files:**
- Named exports for all hooks
- Helper functions (non-React) extracted to separate utility files
- Hooks return objects with both state and action functions: `{ generatedPrompts, handlePromptRate, ... }`

**API Route Files:**
- All handler functions defined before main POST/GET export
- Query parameter parsing at start of main handler
- Action-specific helper functions prefixed with `handle`: `handleSmartBreakdown()`, `handleElementToDimension()`
- Response formatting consistent across all actions

## Async Patterns

**Promise Handling:**
- Use async/await exclusively (no `.then()` chains)
- Wrap in try-catch blocks
- Example:
  ```typescript
  async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const response = await provider.generateText({ ... });
      return response.text;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
  ```

**useCallback Pattern:**
- Event handlers wrapped with `useCallback` when passed to children
- Example: `const handleGenerate = useCallback(() => { ... }, [dependencies])`
- Dependencies array carefully maintained to prevent stale closures

---

*Convention analysis: 2026-01-27*
