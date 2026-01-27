# Codebase Structure

**Analysis Date:** 2026-01-27

## Directory Layout

```
simulator/
├── app/
│   ├── layout.tsx                          # Root layout (fonts, metadata, dark mode)
│   ├── page.tsx                            # Home page entry point
│   ├── globals.css                         # Global Tailwind + CSS custom properties
│   ├── api/
│   │   ├── ai/                             # AI provider API routes
│   │   │   ├── simulator/route.ts          # Claude text generation (breakdown, element-to-dimension, etc.)
│   │   │   ├── image-describe/route.ts     # Gemini Vision image analysis
│   │   │   ├── generate-images/route.ts    # Leonardo image generation
│   │   │   ├── generate-poster/route.ts    # Poster-specific image generation
│   │   │   ├── generate-video/route.ts     # Leonardo video generation (Seedance)
│   │   │   ├── gemini/route.ts             # Raw Gemini endpoint
│   │   │   ├── health/route.ts             # Provider health check endpoint
│   │   │   └── ai/
│   │   │       ├── providers/              # Individual provider implementations
│   │   │       ├── cache.ts                # LRU response cache with TTL
│   │   │       ├── rate-limiter.ts         # Token bucket rate limiter
│   │   │       ├── retry.ts                # Exponential backoff retry wrapper
│   │   │       ├── circuit-breaker.ts      # Circuit breaker for failing providers
│   │   │       ├── cost-tracker.ts         # Cost/token tracking
│   │   │       ├── health-check.ts         # Provider health monitoring
│   │   │       ├── types.ts                # Unified AI request/response types
│   │   │       └── unified-provider.ts     # Provider abstraction layer
│   │   ├── projects/                       # Project CRUD operations
│   │   │   ├── route.ts                    # List/create projects
│   │   │   └── [id]/                       # Project-specific endpoints
│   │   │       ├── route.ts                # Get/update/delete project
│   │   │       ├── prompts/route.ts        # Save/load prompts
│   │   │       ├── images/route.ts         # Save/load panel images
│   │   │       ├── prototypes/route.ts     # Interactive prototype metadata
│   │   │       └── poster/route.ts         # Save project poster
│   │   └── posters/                        # Poster gallery endpoints
│   ├── components/
│   │   └── ui/                             # Shared UI components
│   │       ├── Toast.tsx                   # Toast notification component
│   │       └── IconButton.tsx              # Reusable icon button
│   ├── features/
│   │   └── simulator/                      # Main simulator feature
│   │       ├── SimulatorFeature.tsx        # Root orchestrator (provider nesting, lazy modals)
│   │       ├── SimulatorContext.tsx        # Coordinator context for cross-subfeature communication
│   │       ├── types.ts                    # Core type definitions (Dimension, GeneratedPrompt, OutputMode, etc.)
│   │       ├── components/
│   │       │   ├── variants/
│   │       │   │   ├── OnionLayout.tsx     # Main UI composition (left/center/right layout)
│   │       │   │   ├── MobileLayout.tsx    # Mobile-specific layout
│   │       │   │   └── ResponsiveLayout.tsx # Responsive wrapper
│   │       │   ├── interactive/            # Interactive demo components
│   │       │   ├── mobile/                 # Mobile-specific components
│   │       │   ├── ElementToDimensionButton.tsx
│   │       │   ├── FeedbackAnalytics.tsx
│   │       │   ├── SmartSuggestionPanel.tsx
│   │       │   ├── NegativePromptInput.tsx
│   │       │   ├── PosterGallery.tsx
│   │       │   ├── PosterModal.tsx
│   │       │   ├── ModalLoadingFallback.tsx
│   │       │   └── __tests__/              # Component tests
│   │       ├── hooks/
│   │       │   ├── useProjectManager.ts    # Project selection, creation, deletion
│   │       │   ├── useImageGeneration.ts   # Generated image state and Leonardo API
│   │       │   ├── useImageEffects.ts      # Image effect application
│   │       │   ├── useInteractivePrototype.ts # Interactive mode state
│   │       │   ├── usePoster.ts            # Poster generation state
│   │       │   ├── usePosterHandlers.ts    # Poster event handlers
│   │       │   ├── useProject.ts           # Project data fetching
│   │       │   ├── useAutosave.ts          # Auto-save to database
│   │       │   ├── useLocalPersistedEntity.ts # Generic localStorage persistence
│   │       │   ├── usePersistedEntity.ts   # Generic database persistence
│   │       │   ├── useCopyFeedback.ts      # Copy to clipboard feedback
│   │       │   ├── useElementInteraction.ts # Element click handlers
│   │       │   ├── useResponsive.ts        # Responsive breakpoint detection
│   │       │   └── [others...]             # Various domain-specific hooks
│   │       ├── lib/
│   │       │   ├── promptBuilder.ts        # Generate prompt text with elements
│   │       │   ├── simulatorAI.ts          # API calls to simulator endpoint
│   │       │   ├── llmPrompts.ts           # LLM prompt templates
│   │       │   ├── defaultDimensions.ts    # Initial dimension presets + examples
│   │       │   ├── gameUIPresets.ts        # Game genre UI presets
│   │       │   ├── concept.ts              # Dimension transformation utilities
│   │       │   ├── preferenceEngine.ts     # Learning from user feedback
│   │       │   ├── feedbackLearning.ts     # Enhanced feedback processing
│   │       │   ├── comparison.ts           # Prompt comparison logic
│   │       │   ├── motion.ts               # Framer Motion animation configs
│   │       │   ├── gestureController.ts    # Gesture input handling
│   │       │   ├── interactiveModeHelpers.ts # Interactive prototype helpers
│   │       │   ├── semanticColors.ts       # Color semantics for output
│   │       │   ├── useResponsivePanels.ts  # Responsive panel logic
│   │       │   └── generationPresets.ts    # Generation preset configurations
│   │       ├── subfeature_brain/           # Brain subfeature (base image + generation control)
│   │       │   ├── BrainContext.tsx        # Context provider
│   │       │   ├── index.ts                # Public exports
│   │       │   ├── hooks/
│   │       │   │   └── useBrain.ts         # Brain state management (baseImage, feedback, outputMode, imageParseState)
│   │       │   ├── components/
│   │       │   │   ├── CentralBrain.tsx    # Main brain UI component
│   │       │   │   ├── BaseImageInput.tsx  # Image upload with Gemini parsing
│   │       │   │   ├── DirectorControl.tsx # Generation button + mode selector
│   │       │   │   ├── SmartBreakdown.tsx  # Vision-text parsing interface
│   │       │   │   ├── FeedbackPanel.tsx   # Positive/negative feedback input
│   │       │   │   ├── PresetSelector.tsx  # Preset dimension selection
│   │       │   │   ├── PosterOverlay.tsx   # Poster display overlay
│   │       │   │   └── PosterFullOverlay.tsx # Full-screen poster view
│   │       │   └── lib/
│   │       │       ├── simulatorAI.ts      # Brain-specific AI calls (describeImage, labelToDimension, etc.)
│   │       │       ├── llmPrompts.ts       # Brain-specific prompt templates
│   │       │       └── visionExamples.ts   # Vision API example text
│   │       ├── subfeature_dimensions/      # Dimensions subfeature (transformation lenses)
│   │       │   ├── DimensionsContext.tsx   # Context with localStorage persistence
│   │       │   ├── index.ts                # Public exports
│   │       │   ├── hooks/
│   │       │   │   └── useDimensions.ts    # Dimension state CRUD (add, update, remove, reorder)
│   │       │   ├── components/
│   │       │   │   ├── DimensionColumn.tsx # Left/right column layout
│   │       │   │   ├── DimensionGrid.tsx   # 2/3/4-column grid for multiple dimensions
│   │       │   │   ├── DimensionCard.tsx   # Single dimension input card
│   │       │   │   └── WeightIndicator.tsx # Weight/intensity visualization
│   │       │   └── lib/
│   │       │       ├── defaultDimensions.ts # Dimension presets + example simulations
│   │       │       ├── concept.ts          # Apply concept/feedback to dimensions
│   │       │       └── dimensionPersistence.ts # localStorage management with debounce
│   │       ├── subfeature_prompts/         # Prompts subfeature (generation outputs)
│   │       │   ├── PromptsContext.tsx      # Context provider
│   │       │   ├── index.ts                # Public exports
│   │       │   ├── hooks/
│   │       │   │   ├── usePrompts.ts       # Prompt state CRUD + rating/locking
│   │       │   │   └── usePromptHistory.ts # Undo/redo history stack
│   │       │   ├── components/
│   │       │   │   ├── PromptSection.tsx   # Container for prompt grid
│   │       │   │   ├── PromptOutput.tsx    # Prompt display area
│   │       │   │   ├── PromptCard.tsx      # Single prompt card with copy/rate/lock
│   │       │   │   ├── ElementChip.tsx     # Individual element label with lock toggle
│   │       │   │   ├── PromptDetailModal.tsx # Full prompt detail + element editor
│   │       │   │   └── PromptSection.tsx   # Prompt grid wrapper
│   │       │   └── lib/
│   │       │       └── promptBuilder.ts    # Build prompt text with elements + negative prompts
│   │       ├── subfeature_panels/          # Panels subfeature (side image panels)
│   │       │   ├── index.ts
│   │       │   ├── components/
│   │       │   │   ├── SidePanel.tsx       # Left/right panel container
│   │       │   │   ├── SidePanelSlot.tsx   # Individual slot in panel
│   │       │   │   ├── SavedImageModal.tsx # View/edit saved panel image
│   │       │   │   ├── SavedImageComparison.tsx # Side-by-side comparison
│   │       │   │   ├── SavedImageRegeneration.tsx # Regenerate image
│   │       │   │   └── VideoCreation.tsx   # Video generation UI
│   │       │   └── lib/
│   │       │       ├── regenerationApi.ts  # Image regeneration API
│   │       │       └── videoGenerationApi.ts # Video generation API
│   │       ├── subfeature_project/         # Project subfeature (save/load/manage)
│   │       │   ├── index.ts
│   │       │   └── components/
│   │       │       ├── SimulatorHeader.tsx # Project selector + save status
│   │       │       └── ProjectSelector.tsx # Project dropdown/menu
│   │       ├── subfeature_interactive/     # Interactive prototype subfeature
│   │       │   ├── index.ts
│   │       │   ├── components/
│   │       │   │   ├── InteractivePreviewModal.tsx # Interactive demo viewer
│   │       │   │   ├── InteractiveModeToggle.tsx  # Mode selection (static/clickable/physics)
│   │       │   │   ├── ClickablePrototype.tsx     # Clickable hotspot implementation
│   │       │   │   ├── PhysicsWebGLDemo.tsx       # WebGL physics demo (matter.js)
│   │       │   │   ├── CameraPresetBar.tsx        # Camera angle presets
│   │       │   │   ├── HotspotEditor.tsx          # Edit interactive hotspots
│   │       │   │   ├── MechanicsSelector.tsx      # Select interactive mechanics
│   │       │   │   └── ExportButton.tsx           # Export interactive demo
│   │       │   └── lib/
│   │       │       ├── cameraController.ts # Camera movement logic
│   │       │       ├── cameraPresets.ts    # Named camera angles
│   │       │       ├── hotspotTypes.ts     # Hotspot definition types
│   │       │       ├── mechanicsTemplates.ts # Interactive mechanics presets
│   │       │       ├── physicsWorld.ts     # Matter.js world setup
│   │       │       ├── inputManager.ts     # Gesture/input handling
│   │       │       └── demoExporter.ts     # Export to code/iframe
│   │       └── subfeature_comparison/      # Comparison subfeature
│   │           ├── index.ts
│   │           └── components/
│   │               ├── ComparisonModal.tsx # Side-by-side prompt comparison
│   │               └── ComparisonCard.tsx  # Individual comparison card
│   ├── lib/
│   │   ├── db.ts                           # SQLite database setup and utilities
│   │   ├── utils.ts                        # cn() class merging utility
│   │   └── ai/                             # Unified AI provider layer (see above)
│   └── utils/
│       └── apiErrorHandling.ts             # createErrorResponse() + HTTP status codes
├── public/
│   └── [assets]                            # Static files (images, icons, etc.)
├── test/                                   # Test utilities and fixtures
├── e2e/                                    # Playwright E2E tests
├── db/                                     # Database migration/schema files
├── data/                                   # Data files (simulator.db, simulator.db-shm)
├── docs/                                   # Documentation
├── .planning/
│   └── codebase/                           # Analysis documents (this file, ARCHITECTURE.md, etc.)
├── package.json                            # Dependencies and scripts
├── tsconfig.json                           # TypeScript configuration
├── next.config.ts                          # Next.js configuration
├── vitest.config.ts                        # Vitest configuration
├── playwright.config.ts                    # E2E test configuration
├── eslint.config.mjs                       # ESLint configuration
└── postcss.config.mjs                      # PostCSS/Tailwind configuration
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js app directory (routing, API routes, components, pages)
- Contains: All application code organized by feature and layer
- Key files: `layout.tsx` (root layout), `page.tsx` (home page entry point)

**`app/api/`:**
- Purpose: Server-side request handlers for external APIs and data persistence
- Contains: AI provider routes, project CRUD routes
- Key pattern: Route handlers import unified AI provider and delegate to specific providers

**`app/api/ai/`:**
- Purpose: LLM and image generation endpoints
- Contains: Claude text generation, Gemini vision analysis, Leonardo image generation
- Implementation: Each route imports from `app/lib/ai/` for provider logic

**`app/features/simulator/`:**
- Purpose: Main feature container with orchestration logic
- Contains: SimulatorFeature (root), SimulatorContext (coordinator), types, all subfeatures
- Architecture: Modular subfeatures communicate through context + coordinator

**`app/features/simulator/subfeature_*/`:**
- Purpose: Independent state domains for specific feature areas
- Pattern: Each subfeature contains `{Feature}Context.tsx`, `hooks/use{Feature}.ts`, `components/`, `lib/`
- Isolation: Each subfeature manages only its state; communication via parent context

**`app/features/simulator/components/variants/`:**
- Purpose: Layout composition components
- Contains: OnionLayout (main), MobileLayout, ResponsiveLayout wrappers
- Responsibility: Compose subfeature components into final UI structure

**`app/lib/ai/`:**
- Purpose: Unified abstraction over multiple AI providers
- Contains: Provider implementations, caching, rate-limiting, retry logic, circuit breaker
- Pattern: Each provider (Claude, Gemini, Leonardo) has dedicated module; `unified-provider.ts` coordinates

**`app/lib/db.ts`:**
- Purpose: SQLite database connection and utilities
- Contains: Database schema, query builders, transaction helpers
- Usage: Called from `app/api/projects/` routes for project persistence

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout with metadata, fonts, dark mode setup
- `app/page.tsx`: Home page that mounts SimulatorFeature
- `app/features/simulator/SimulatorFeature.tsx`: Feature root with provider nesting and modal orchestration

**Configuration:**
- `tsconfig.json`: TypeScript configuration with path aliases (`@/`)
- `next.config.ts`: Next.js configuration
- `postcss.config.mjs`: Tailwind CSS 4 setup
- `vitest.config.ts`: Unit test configuration
- `playwright.config.ts`: E2E test configuration

**Core Logic:**
- `app/features/simulator/types.ts`: All core TypeScript definitions (Dimension, GeneratedPrompt, OutputMode, DimensionType, etc.)
- `app/features/simulator/lib/promptBuilder.ts`: Generates prompt text from dimensions + elements
- `app/features/simulator/subfeature_brain/lib/simulatorAI.ts`: Calls to Claude API for image description, dimension extraction, etc.
- `app/features/simulator/lib/preferenceEngine.ts`: Learns from user feedback to improve future generations

**Testing:**
- `app/features/simulator/components/__tests__/`: Component unit tests (Vitest + Testing Library)
- `app/lib/ai/__tests__/`: AI provider utility tests (cache, rate-limiter, retry, cost-tracker)
- `e2e/`: Playwright E2E test files
- `test/`: Test utilities and fixtures

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `OnionLayout.tsx`, `DimensionCard.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useBrain.ts`, `useProjectManager.ts`)
- Utilities: camelCase (e.g., `promptBuilder.ts`, `dimensionPersistence.ts`)
- Contexts: `{Feature}Context.tsx` (e.g., `BrainContext.tsx`, `DimensionsContext.tsx`)
- API routes: `route.ts` in directory matching endpoint path
- Types/Interfaces: PascalCase (Dimension, GeneratedPrompt, etc.)
- Type files: `types.ts` or `{domain}.types.ts`

**Directories:**
- Feature containers: `subfeature_{name}` (e.g., `subfeature_brain`, `subfeature_dimensions`)
- Component groups: lowercase plural (e.g., `components/`, `hooks/`, `lib/`)
- Layout variants: `variants/` inside components
- Provider implementations: `providers/` inside `lib/ai/`
- Tests: `__tests__/` at same level as code

**Functions:**
- Handlers: `handle{Action}` (e.g., `handleGenerate`, `handleProjectSelect`)
- Getters: `get{Resource}` (e.g., `getUnifiedProvider`, `getAICache`)
- Setters: `set{Property}` (e.g., `setBaseImage`, `setDimensions`)
- Creators: `create{Object}` (e.g., `createPersistenceManager`, `createDimensionFromElement`)
- Processors: `process{Data}` (e.g., `processFeedback`, `processEnhancedFeedback`)

## Where to Add New Code

**New Feature (Subfeature):**
1. Create `app/features/simulator/subfeature_{name}/` directory
2. Create `{Feature}Context.tsx` with provider component
3. Create `hooks/use{Feature}.ts` with state and actions
4. Create `components/` subdirectory for UI components
5. Create `lib/` subdirectory for business logic
6. Export public API from `index.ts`
7. Wire provider into SimulatorFeature component nesting
8. Update SimulatorContext if cross-feature communication needed

**New API Endpoint:**
1. Create route file at `app/api/{resource}/route.ts` or `app/api/{resource}/[id]/route.ts`
2. Import from `app/lib/ai/` for AI operations or `app/lib/db.ts` for database operations
3. Use `createErrorResponse()` from `app/utils/apiErrorHandling.ts` for errors
4. Return JSON response with consistent structure
5. Add TypeScript types for request/response at top of route file or in `types.ts`

**New Component:**
1. Determine if it belongs to a subfeature (in `subfeature_{name}/components/`) or shared UI (`app/components/ui/`)
2. Use functional component with TypeScript interface for props
3. Use `'use client'` directive if component uses hooks or interacts with browser APIs
4. Import context hooks if accessing subfeature state
5. Use Tailwind CSS classes with `cn()` utility for conditional styling
6. Add JSDoc comment block describing purpose

**New Utility/Helper:**
1. Determine domain: Feature-specific goes in `subfeature_{name}/lib/`, general utilities go in `app/features/simulator/lib/` or `app/lib/`
2. Export as named function with JSDoc comments
3. Add TypeScript types for parameters and return values
4. Add unit tests in `__tests__/` subdirectory
5. Re-export from parent `index.ts` if it's part of public API

**New Hook:**
1. Determine domain: Feature-specific goes in `subfeature_{name}/hooks/`, general hooks go in `app/features/simulator/hooks/`
2. Use custom hook naming convention: `use{Purpose}.ts`
3. Document with JSDoc comment and exported interfaces for state and actions
4. Use TypeScript for all parameter and return types
5. Leverage context hooks if accessing subfeature state
6. Use useCallback for memoized functions, useMemo for expensive calculations

## Special Directories

**`app/lib/ai/`:**
- Purpose: Unified AI provider abstraction layer
- Generated: No
- Committed: Yes
- Pattern: Each provider type (Claude, Gemini, Leonardo) has dedicated module; utilities (cache, rate-limiter, etc.) are cross-cutting concerns

**`data/`:**
- Purpose: SQLite database files
- Generated: Yes (created on first database write)
- Committed: No (git-ignored)
- Files: `simulator.db` (main), `simulator.db-shm` (shared memory), `simulator.db-wal` (write-ahead log)

**`public/`:**
- Purpose: Static assets served directly by Next.js
- Generated: No
- Committed: Yes
- Usage: Images, icons, manifest files

**`.planning/codebase/`:**
- Purpose: GSD analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by GSD mapper agents)
- Committed: Yes
- Pattern: Documents regenerated when codebase significantly changes

**`e2e/`:**
- Purpose: Playwright end-to-end tests
- Generated: No
- Committed: Yes
- Pattern: Test files should mirror app structure; name tests descriptively (e.g., `simulator-generation.spec.ts`)

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No (git-ignored)
- Contents: Compiled code, optimized bundles, static export

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes
- Committed: No (git-ignored)
- Management: Install with `npm install`
