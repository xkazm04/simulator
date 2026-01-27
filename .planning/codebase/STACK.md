# Technology Stack

**Analysis Date:** 2026-01-27

## Languages

**Primary:**
- TypeScript 5 - All application code, API routes, and utilities
- JavaScript - Configuration files (eslint.config.mjs, vitest.config.ts compiled)

**Secondary:**
- SQL - SQLite database schema in `db/simulator-schema.sql`

## Runtime

**Environment:**
- Node.js (version from package.json: latest compatible)
- Next.js 16.1.1 - Full-stack React framework with built-in API routes

**Package Manager:**
- npm
- Lockfile: package-lock.json (implied by package.json)

## Frameworks

**Core:**
- Next.js 16.1.1 - Server-side rendering, API routes, image optimization
- React 19.2.3 - Component library and UI
- Tailwind CSS 4 - Utility-first CSS framework

**Animation & Interaction:**
- Framer Motion 12.25.0 - Component animations, transitions
- @use-gesture/react 10.3.1 - Gesture handling for touch/mouse events
- Matter.js 0.20.0 - Physics simulation engine (for interactive features)

**Testing:**
- Vitest 4.0.17 - Unit and component testing
- @playwright/test 1.57.0 - End-to-end browser testing
- @testing-library/react 16.3.1 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - DOM assertion matchers

**Build & Dev:**
- Tailwind CSS 4 (PostCSS integration)
- ESLint 9 - Code linting with Next.js and TypeScript configs
- TypeScript 5 - Type checking and compilation

## Key Dependencies

**Critical:**
- @google/genai 1.35.0 - Google Gemini API client (image analysis)
- better-sqlite3 12.6.0 - Synchronous SQLite database client for project persistence
- lucide-react 0.562.0 - Icon library (UI component icons)
- uuid 13.0.0 - Unique ID generation for resources

**Infrastructure:**
- tailwind-merge 3.4.0 - Smart Tailwind class merging
- clsx 2.1.1 - Conditional className utility
- @types/matter-js 0.20.2 - Physics engine types

**HTTP:**
- Native fetch API via Next.js (no axios or node-fetch installed)

## Configuration

**TypeScript:**
- `tsconfig.json` - ES2017 target, JSX react-jsx, path aliasing with `@/*`
- Module resolution: bundler strategy
- Strict mode enabled

**Next.js:**
- `next.config.ts - Image optimization for Leonardo CDN (cdn.leonardo.ai)
- Image remotePatterns configured for external providers

**Linting:**
- `eslint.config.mjs` - ESLint 9 flat config with Next.js core-web-vitals and TypeScript support
- Ignores: .next/, out/, build/, next-env.d.ts

**Testing:**
- `vitest.config.ts` - jsdom environment, React plugin, path aliasing
- `playwright.config.ts` - Chromium, Firefox, WebKit browsers, 30s timeout
- Coverage targets: 70% statements/lines, 60% branches, 70% functions
- Test setup file: `test/setup.tsx`

**Environment:**
- `.env` file (dev only) with API keys
- Required: ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, LEONARDO_API_KEY
- Next.js public env vars prefixed with NEXT_PUBLIC_

## Platform Requirements

**Development:**
- Node.js runtime (no version specified, assumes LTS)
- npm for dependency management
- Chromium, Firefox, WebKit for browser testing
- SQLite3 (system or bundled with better-sqlite3)

**Production:**
- Node.js runtime (same as development)
- SQLite database file (data/simulator.db)
- External API keys for Claude, Gemini, Leonardo

## Scripts

**Development:**
- `npm run dev` - Start Next.js development server on localhost:3000
- `npm run build` - Production build
- `npm run start` - Start production server

**Testing:**
- `npm test` - Run Vitest in watch mode
- `npm run test:run` - Single test run
- `npm run test:coverage` - Generate coverage report
- `npm run test:ui` - Vitest UI dashboard
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run test:e2e:ui` - Playwright UI mode

**Linting:**
- `npm run lint` - Run ESLint across codebase

---

*Stack analysis: 2026-01-27*
