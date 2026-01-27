# Codebase Concerns

**Analysis Date:** 2026-01-27

## Tech Debt

### Large Component/Hook Files

**Issue:** Multiple files exceed 500+ lines, creating maintenance and testing burden
- Files: `app/features/simulator/lib/preferenceEngine.ts` (1448 lines), `app/features/simulator/hooks/useProject.ts` (660 lines), `app/features/simulator/hooks/useImageGeneration.ts` (536 lines), `app/features/simulator/subfeature_interactive/lib/mechanicsTemplates.ts` (809 lines), `app/features/simulator/lib/feedbackLearning.ts` (764 lines)
- Impact: Difficult to test, high cognitive load, increased risk of bugs, slower navigation and refactoring
- Fix approach: Extract utility functions, separate concerns (preferences, feedback, learning), split into focused modules. Consider extracting a `PreferenceManager` class and separate feedback analysis into its own service

### IndexedDB Usage Without Fallback

**Issue:** Preference engine relies on IndexedDB without proper fallback strategy
- Files: `app/features/simulator/lib/preferenceEngine.ts`, `app/features/simulator/subfeature_dimensions/lib/dimensionPersistence.ts`
- Impact: SSR incompatibility, data loss on private browsing, quota exceeded errors not handled gracefully, profile operations fail silently on server
- Current mitigation: Basic `typeof window` checks but no recovery mechanism
- Recommendations:
  1. Implement fallback to in-memory storage
  2. Add quota monitoring and graceful degradation
  3. Provide user feedback when storage fails
  4. Consider session-based alternatives for non-essential data

### Database Schema Migrations Without Versioning

**Issue:** Schema updates applied ad-hoc via conditional table existence checks
- Files: `app/lib/db.ts` (lines 57-136)
- Impact: No clear migration history, difficult to track schema evolution, potential for missed migrations in production, hard to rollback
- Fix approach: Implement proper migration framework (e.g., Drizzle ORM migrations or custom migration registry with version tracking)

### Default Profile ID Undefined Reference

**Issue:** `preferenceEngine.ts` references `DEFAULT_PROFILE_ID` without definition
- Files: `app/features/simulator/lib/preferenceEngine.ts` (line 50)
- Impact: Undefined variable error at runtime when default profile is created
- Fix approach: Define constant or require explicit profile ID

## Known Bugs

### Silent Error Handling in API Endpoints

**Issue:** Catch blocks log but don't preserve error context effectively
- Files: Multiple in `app/api/**/route.ts` (45+ occurrences of bare catch blocks)
- Symptoms: Error logs show generic "Failed to X" messages without stack traces or details, difficult debugging in production
- Trigger: Any error in API handlers (e.g., database connection failure, API call timeout)
- Workaround: Check browser console or server logs for stack traces separately
- Fix approach: Use structured logging with error context, include error code/stack in response

### Type Safety Issues - Unsafe Type Assertions

**Issue:** Use of `as unknown` and `as any` for unsafe type conversions
- Files: `app/features/simulator/hooks/usePoster.ts`, `app/features/simulator/components/variants/MobileLayout.tsx`, `app/features/simulator/lib/feedbackLearning.ts`
- Impact: Bypasses TypeScript checking, can cause runtime errors with mismatched data
- Current mitigation: Runtime checks in some places
- Recommendations: Replace with proper type guards, use discriminated unions, implement validation schemas (Zod/Yup)

### Incomplete TODO Comment

**Issue:** TODO comment indicates unimplemented feature
- Files: `app/features/character-studio/CharacterStudioFeature.tsx` (line 119)
- Symptoms: "Open wizard modal" functionality missing
- Impact: Character studio wizard cannot be launched from context
- Fix approach: Complete modal implementation or remove TODO

## Security Considerations

### API Key Exposure in Cost Tracking

**Issue:** Pricing data and model names exposed in cost tracker
- Files: `app/lib/ai/cost-tracker.ts` (lines 9-34)
- Risk: Hardcoded pricing may reveal business logic; model names expose tech choices
- Current mitigation: Cost data only accessed server-side
- Recommendations: Move pricing to environment config, don't expose cost estimates to client

### Cross-Provider Error Handling Inconsistency

**Issue:** Different error handling across Claude, Gemini, Leonardo providers
- Files: `app/lib/ai/providers/*.ts`
- Risk: Provider-specific error codes may leak sensitive information, inconsistent rate limit handling
- Current mitigation: Circuit breaker and rate limiter wrap providers
- Recommendations: Normalize error responses across providers, sanitize error messages before client transmission

### Environment Variable Validation Missing

**Issue:** No validation that required API keys are present at startup
- Files: `app/lib/ai/index.ts` (lines 119-142)
- Impact: App starts without validation, fails at first API call, user sees unclear errors
- Fix approach: Add validation in `getDb()` and AI provider initialization, fail fast with clear messages

### Unvalidated JSON in Database

**Issue:** JSON strings stored directly without validation
- Files: `app/api/projects/route.ts` (line 65), multiple other locations
- Impact: Malformed JSON in database can cause parsing errors, no schema validation for stored structures
- Fix approach: Validate JSON structure before storage using Zod or similar

## Performance Bottlenecks

### Preference Engine Full Scan Performance

**Issue:** IndexedDB operations scan entire stores without filtering
- Files: `app/features/simulator/lib/preferenceEngine.ts` (preference loading functions)
- Problem: `getAllFeedback()` and similar functions may scan thousands of records
- Cause: No cursor-based iteration or pagination implemented
- Current state: Loads all data into memory for processing
- Improvement path:
  1. Add cursor-based iteration for large datasets
  2. Implement pagination for UI display
  3. Add aggregate indexes for common queries (e.g., feedback count by dimension)
  4. Cache computed patterns with TTL

### Physics World Update Frequency

**Issue:** Matter.js physics updates may run at uncapped rate
- Files: `app/features/simulator/subfeature_interactive/lib/physicsWorld.ts`
- Problem: Could cause high CPU usage on weaker devices
- Current state: Uses requestAnimationFrame but timestep is fixed (1000/60ms)
- Improvement path: Monitor frame rate, adapt timestep for variable performance

### Image Generation Polling Without Backoff

**Issue:** Status checks may spam Leonardo API without exponential backoff
- Files: `app/features/simulator/hooks/useImageGeneration.ts`
- Impact: Hits rate limits unnecessarily
- Fix approach: Implement exponential backoff with jitter in polling logic

### LRU Cache Without Eviction Strategy

**Issue:** AI cache has max size but eviction order not clearly specified
- Files: `app/lib/ai/cache.ts` (lines 100-120)
- Problem: When cache is full, oldest entry removed but no consideration for frequently accessed items
- Fix approach: Implement true LRU with last-access-time tracking

## Fragile Areas

### useProject Hook - Complex State Management

**Issue:** Central hook managing multiple persistent entities (state, images, posters, prototypes, prompts)
- Files: `app/features/simulator/hooks/useProject.ts` (660 lines)
- Why fragile:
  - Multiple API calls orchestrated without clear dependency ordering
  - No transaction-like semantics (partial failures possible)
  - Debounced autosave creates race conditions with manual saves
- Safe modification:
  1. Add request deduplication
  2. Use request queuing for dependent operations
  3. Document the save ordering guarantees
- Test coverage: Gaps in integration tests for save failures

### CircuitBreaker with Hard-Coded Timing

**Issue:** Circuit breaker uses fixed timeouts without adaptation
- Files: `app/lib/ai/circuit-breaker.ts` (lines 43-47)
- Why fragile: 30-second cooldown may be too short/long depending on actual provider recovery time
- Safe modification: Make timings configurable per-provider, add metrics collection
- Test coverage: No tests for half-open state recovery scenarios

### Preference Engine Database Initialization Race Condition

**Issue:** Multiple concurrent calls to `openPreferenceDB()` could create race condition
- Files: `app/features/simulator/lib/preferenceEngine.ts` (lines 65-85)
- Why fragile: dbInstance assigned after async promise resolves, concurrent calls might create multiple DB instances
- Safe modification: Use proper Promise-based singleton pattern or add mutex
- Test coverage: No concurrent initialization tests

## Scaling Limits

### IndexedDB Storage Quota

**Issue:** No quota monitoring or cleanup strategy
- Current capacity: Typically 50MB-1GB per origin depending on browser
- Limit: User data (preferences, feedback, patterns) grows unbounded per user
- Scaling path:
  1. Implement data archival strategy (cleanup old sessions)
  2. Add quota monitoring with user alerts
  3. Implement data compression for large fields
  4. Consider server-side persistence with sync

### SQLite Database Single File

**Issue:** All application state in single `simulator.db` file
- Current capacity: Limited by filesystem, no replication
- Limit: Performance degrades with large project counts (thousands)
- Scaling path:
  1. Add connection pooling (multiple connections)
  2. Implement query caching
  3. Consider read replicas for public data
  4. Plan for eventual migration to PostgreSQL if needed

### In-Memory AI Cache

**Issue:** LRU cache stores responses in Node.js memory
- Current capacity: 1000 entries (configurable)
- Limit: Each response could be large; memory unbounded without monitoring
- Scaling path:
  1. Implement cache metrics/monitoring
  2. Add Redis-based distributed cache
  3. Implement response streaming for large prompts

### Concurrent Image Generation Polling

**Issue:** All users polling Leonardo API simultaneously for status
- Current capacity: No rate limiting per user, only global circuit breaker
- Limit: Can trigger provider rate limits quickly
- Scaling path:
  1. Add per-user request budgets
  2. Implement webhook-based status updates (replace polling)
  3. Add server-side deduplication for same generation IDs

## Dependencies at Risk

### better-sqlite3 with Next.js Server Components

**Risk:** Synchronous database access in async context
- Files: `app/lib/db.ts`, multiple API routes
- Impact: Can block event loop, cause slowdowns with concurrent requests
- Current mitigation: WAL mode enabled for better concurrency
- Migration plan: Consider async SQLite driver (sql.js, libsql client) or async wrapper layer

### matter-js in Browser Context

**Risk:** Large physics library loaded for experimental features
- Files: `app/features/simulator/subfeature_interactive/lib/physicsWorld.ts`
- Impact: Increases bundle size, may not be needed for all users
- Current mitigation: Only loaded when interactive mode enabled
- Migration plan: Lazy load physics library, consider lightweight alternatives

### IndexedDB Deprecation Risk

**Risk:** Browser storage APIs evolve, IndexedDB may face deprecation or quota changes
- Files: Multiple preference/dimension persistence files
- Impact: Data loss if API changes
- Current mitigation: None
- Recommendations:
  1. Implement storage abstraction layer (switch providers easily)
  2. Add data export/import functionality
  3. Monitor browser API changes

## Missing Critical Features

### Distributed Lock for Concurrent Saves

**Issue:** No mechanism to prevent conflicting saves from multiple tabs/windows
- Problem: Two save operations could overwrite each other's data
- Blocks: Multi-tab project synchronization
- Fix approach: Implement optimistic locking with version numbers in database schema

### Graceful Degradation When APIs Unavailable

**Issue:** Features requiring Claude, Gemini, Leonardo fully fail without API keys
- Problem: User cannot use app at all, even basic prompt generation
- Blocks: Offline-first usage, fallback to local LLM
- Fix approach: Implement fallback prompt templates, suggestion engines

### Comprehensive Error Recovery UI

**Issue:** API errors result in generic error messages
- Problem: Users don't know if temporary or permanent failure, can't retry manually
- Blocks: Good error recovery experience
- Fix approach: Implement retry UI with exponential backoff button, show error status dashboard

### Data Consistency Validation

**Issue:** No checksums or validation for persisted complex objects
- Problem: Corrupted JSON in database could cause silent failures
- Blocks: Data integrity guarantees
- Fix approach: Add versioned schemas, implement migration validators

## Test Coverage Gaps

### API Error Handling

**Untested area:** Error paths in API endpoints (rate limits, timeouts, provider failures)
- Files: `app/api/ai/**/*.ts`, `app/api/projects/**/*.ts` (45+ catch blocks)
- Risk: Error scenarios fail silently, users get vague error messages
- Priority: **High** - These are critical user flows

### Database Migration Edge Cases

**Untested area:** Schema migrations for databases with existing data
- Files: `app/lib/db.ts` (lines 46-136)
- Risk: Migrations could fail on production databases with unexpected states
- Priority: **High** - Data loss risk

### Preference Engine Concurrent Access

**Untested area:** Multiple concurrent reads/writes to IndexedDB stores
- Files: `app/features/simulator/lib/preferenceEngine.ts`
- Risk: Race conditions, data corruption
- Priority: **Medium** - Only affects multi-tab scenarios

### Circuit Breaker State Transitions

**Untested area:** Half-open state recovery, rapid failure cycling
- Files: `app/lib/ai/circuit-breaker.ts`
- Risk: Circuit stuck in wrong state, preventing provider recovery
- Priority: **Medium** - Affects resilience

### Image Generation Long-Running Operations

**Untested area:** Leonardo image generation timeout handling, webhook callback parsing
- Files: `app/features/simulator/hooks/useImageGeneration.ts`, `app/lib/ai/providers/leonardo.ts`
- Risk: Generations appear stuck, webhook callbacks not validated
- Priority: **Medium** - Core feature reliability

### Type Safety in Database Queries

**Untested area:** Runtime validation of database query results
- Files: `app/api/projects/**/route.ts`, `app/lib/db.ts`
- Risk: Schema changes cause type mismatches
- Priority: **Medium** - Data correctness

---

*Concerns audit: 2026-01-27*
