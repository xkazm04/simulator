# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Next.js 16 with React 19 using a **modular subfeature architecture** based on React Context providers and custom hooks. The application implements a **layered isolation pattern** where independent feature domains (brain, dimensions, prompts, panels, interactive, comparison, project) manage their own state through context and communicate through a coordinator context.

**Key Characteristics:**
- Feature-isolated state management via React Context + custom hooks
- Coordinator pattern (SimulatorContext) for cross-feature communication
- Provider nesting for hierarchical state composition
- Server-side API routes for AI/LLM integration
- Lazy loading of modal components with Suspense boundaries
- Unified AI provider abstraction for Claude, Gemini, and Leonardo

## Layers

**Presentation Layer:**
- Purpose: Renders UI components and handles user interactions
- Location: `app/features/simulator/components/` and `app/features/simulator/subfeature_*/components/`
- Contains: React components consuming context, event handlers, UI composition
- Depends on: Context providers, hooks, utility functions, styling (Tailwind CSS 4)
- Used by: Next.js routing layer (layout.tsx, page.tsx)

**State Management Layer:**
- Purpose: Provides centralized state for each feature domain via React Context
- Location: `app/features/simulator/subfeature_*/` (BrainContext, DimensionsContext, PromptsContext, etc.) + `app/features/simulator/SimulatorContext.tsx`
- Contains: Context definitions, provider components, custom hooks (useBrain, useDimensions, usePrompts, etc.)
- Depends on: React hooks, utility functions, persistence layer
- Used by: Presentation layer components, other hooks

**Business Logic Layer:**
- Purpose: Core transformation and generation logic
- Location: `app/features/simulator/subfeature_*/lib/` and `app/features/simulator/lib/`
- Contains: prompt builders, AI prompt templates, dimension transformations, preference learning, feedback processing
- Depends on: Type definitions, API layer, utility functions
- Used by: Hooks and context providers

**API Layer:**
- Purpose: Server-side request handling for AI providers and data persistence
- Location: `app/api/ai/` (text-generation, image analysis, image generation) + `app/api/projects/` (data persistence)
- Contains: Route handlers, request validation, provider delegation
- Depends on: Unified AI provider abstraction, database layer, utility handlers
- Used by: Frontend hooks via fetch()

**AI Provider Abstraction Layer:**
- Purpose: Unified interface to multiple AI providers (Claude, Gemini, Leonardo) with cross-cutting concerns
- Location: `app/lib/ai/`
- Contains: Provider implementations, caching, rate-limiting, retry logic, circuit-breaker, cost-tracking, health-checks
- Depends on: API keys from environment, provider SDKs
- Used by: API routes, server-side utilities

**Persistence Layer:**
- Purpose: Local storage and database persistence
- Location: `app/lib/db.ts` (SQLite), `app/features/simulator/subfeature_*/lib/dimensionPersistence.ts` (localStorage)
- Contains: Database schema, localStorage utilities, debounced persistence managers
- Depends on: better-sqlite3, localStorage API
- Used by: Hooks, context providers

**Infrastructure:**
- Next.js routing (app directory with dynamic routes)
- Tailwind CSS 4 for styling
- Framer Motion for animations
- Lucide React for icons
- matter-js for physics simulations
- UUID for unique identifiers

## Data Flow

**Generation Flow (Core User Journey):**

1. **Input Phase**: User provides base image text in `CentralBrain` → stored in BrainContext.baseImage
2. **Analysis Phase**: Optional image upload → `BaseImageInput` calls `app/api/ai/image-describe` → Gemini Vision extracts dimensions and format
3. **Dimension Setup**: User adjusts dimensions (environment, characters, style, etc.) in `DimensionColumn` components → stored in DimensionsContext
4. **Generation Request**: User clicks generate → `SimulatorContext.handleGenerate()` orchestrates:
   - Validates baseImage exists
   - Collects current dimensions from DimensionsContext
   - Calls `app/api/ai/simulator` with breakdown/label-to-dimension actions
   - Processes feedback from BrainContext
5. **Prompt Generation**: Claude API processes multi-action flow returning structured prompts
6. **Prompt Storage**: Results stored in PromptsContext.generatedPrompts
7. **Image Generation**: User clicks image button → triggers Leonardo image generation via `app/api/ai/generate-images`
8. **Result Display**: Prompts shown in `PromptSection`, images in `OnionLayout` left/right panels
9. **Refinement Loop**: User can rate, lock elements, and regenerate

**State Persistence Flow:**

1. **Dimensions Auto-Save**: DimensionsContext detects changes → debounced `dimensionPersistence.ts` manager saves to localStorage (500ms debounce)
2. **Project Save**: `useProjectManager` hook detects state changes → calls `app/api/projects/[id]` endpoint
3. **Load on Project Switch**: `SimulatorContent` calls `pm.handleProjectSelect()` → restores dimensions, prompts, images from database

**Feedback-to-Generation Flow:**

1. User provides positive/negative feedback in `FeedbackPanel` → stored in BrainContext
2. User clicks generate → feedback included in LLM prompt template
3. AI refines dimensions based on feedback preferences
4. `preferenceEngine.ts` learns from feedback patterns for future generations

**State Management:**

- **Global Coordinator**: `SimulatorContext` reads from all subfeature contexts and triggers generation
- **Subfeature Isolation**: Each subfeature (brain, dimensions, prompts) owns its state and only exposes public actions
- **Context Nesting**: `SimulatorFeature.tsx` wraps providers in order: DimensionsProvider → BrainProvider → PromptsProvider → SimulatorProvider
- **Cross-Subfeature Communication**: Via SimulatorContext methods (onConvertElementsToDimensions, onDropElementOnDimension, onAcceptElement)

## Key Abstractions

**Dimension (Transformation Lens):**
- Purpose: Represents a single "lens" for transforming the base image
- Examples: `app/features/simulator/types.ts` defines DimensionType (environment, characters, artStyle, mood, etc.)
- Pattern: Each dimension has three components:
  - Filter: What to preserve from base image (preserve_structure, preserve_subject, preserve_mood, preserve_color_palette, none)
  - Transform: How to apply reference (replace, blend, style_transfer, semantic_swap, additive)
  - Weight: Intensity 0-100 (enables graduated transformations like "50% Star Wars, 50% Ghibli")

**GeneratedPrompt:**
- Purpose: Output scene description with locked/rated status
- Location: `app/features/simulator/types.ts`
- Pattern: Contains sceneType, full prompt text, elements array, lock status, and user rating (up/down/null)

**PromptElement:**
- Purpose: Individual aspect within a prompt (composition, lighting, style, etc.)
- Pattern: Can be locked, promoted to dimensions, or used in feedback flow
- Enables: Element-level control and element-to-dimension conversion

**UnifiedAIProvider:**
- Purpose: Abstract away provider differences (Claude, Gemini, Leonardo)
- Location: `app/lib/ai/unified-provider.ts`
- Pattern: Single interface for text generation, vision, and image generation with provider failover

**Context + Hook Pattern:**
- Purpose: Encapsulate state and actions for each feature domain
- Example: BrainContext + useBrain hook manage base image, feedback, output mode
- Pattern: Provider wraps components, hook exposes state and actions to consumers

## Entry Points

**Web Application:**
- Location: `app/page.tsx`
- Triggers: On app load at localhost:3000
- Responsibilities: Renders main Home component which mounts SimulatorFeature

**Feature Root:**
- Location: `app/features/simulator/SimulatorFeature.tsx`
- Triggers: Rendered from app/page.tsx
- Responsibilities: Orchestrates provider nesting, lazy-loads modal components with Suspense, coordinates all subfeatures

**Content Component:**
- Location: `app/features/simulator/SimulatorFeature.tsx::SimulatorContent`
- Triggers: Rendered inside provider stack
- Responsibilities: Manages modal states, wires up all hook callbacks, composes OnionLayout and modals

**Main Layout:**
- Location: `app/features/simulator/components/variants/OnionLayout.tsx`
- Triggers: Rendered in SimulatorContent
- Responsibilities: Composes left/right/center UI sections from subfeature components

**API Endpoints:**
- `POST /api/ai/simulator?action=breakdown` - Smart breakdown of vision text
- `POST /api/ai/simulator?action=element-to-dimension` - Convert element to reusable dimension
- `POST /api/ai/simulator?action=label-to-dimension` - Refine dimension from feedback
- `POST /api/ai/image-describe` - Parse uploaded image with Gemini Vision
- `POST /api/ai/generate-images` - Generate images with Leonardo
- `GET/POST /api/projects` - Project CRUD operations
- `POST /api/projects/[id]/prompts` - Save/load prompts for project

## Error Handling

**Strategy:** Multi-layer error handling with user feedback and graceful degradation

**Patterns:**

- **API Errors**: Routes use `createErrorResponse()` from `app/utils/apiErrorHandling.ts` returning structured {error, code, status}
- **Network Failures**: Frontend hooks catch fetch errors and display via Toast UI component
- **AI Provider Failures**: `CircuitBreaker` in `app/lib/ai/circuit-breaker.ts` stops calls to failing providers; `HealthCheck` monitors availability
- **Validation**: Request handlers validate input structure before delegating to providers
- **Fallbacks**:
  - If Claude unavailable, system can fall back to mock responses (see `NEXT_PUBLIC_USE_REAL_SIMULATOR_AI` env var)
  - Image parsing gracefully handles both AI-parsed and user-entered dimensions
- **User Feedback**: Toast component displays errors, status messages, and successes non-intrusively

## Cross-Cutting Concerns

**Logging:**
- Strategy: Metadata-driven cost/request tracking via `CostTracker` in `app/lib/ai/cost-tracker.ts`
- Each request includes metadata (feature, userId) for monitoring
- No explicit debug logging; relies on console in development

**Validation:**
- Client-side: React component prop validation via TypeScript types
- Server-side: Route handlers validate request body shape before calling providers
- Type safety: Full TypeScript coverage with strict mode

**Authentication:**
- Current: No user authentication; API keys stored in environment variables
- Scope: Shared per-deployment (no per-user API keys)
- UI State: No session management; state lives in memory per browser session

**Persistence:**
- Dimensions: Automatic localStorage persistence (debounced 500ms) via `DimensionsContext`
- Prompts: Saved to SQLite database via `app/api/projects/[id]/prompts` on user action
- Images: Stored as data URLs in projects + Leonardo generation IDs in database
- Project Metadata: Full project snapshots saved to SQLite

**Performance:**
- Code Splitting: Modals lazy-loaded with dynamic import + Suspense (PromptDetailModal, SavedImageModal, etc.)
- Caching: AI response cache in `app/lib/ai/cache.ts` (LRU with TTL)
- Rate Limiting: Token bucket rate limiter in `app/lib/ai/rate-limiter.ts` per provider
- Debouncing: Dimension persistence debounced 500ms to avoid excessive localStorage writes
- Memoization: Context providers memoize computed values (hasLockedPrompts, availableInteractiveModes, etc.)

**State Recovery:**
- Undo/Redo: Prompt history via `usePromptHistory` hook (stack-based)
- Snapshot Restore: `PreParseSnapshot` in useBrain allows reverting after image parse
- Project Reload: Complete state restoration from database on project load
