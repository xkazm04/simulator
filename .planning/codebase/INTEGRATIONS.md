# External Integrations

**Analysis Date:** 2026-01-27

## APIs & External Services

**Text Generation (LLM):**
- **Anthropic Claude** - Multi-capability text-based AI for smart breakdown, element conversion, dimension refinement
  - SDK/Client: Direct REST API via fetch (no SDK installed)
  - Models: claude-sonnet-4-5-20250929 (default), claude-3-opus, claude-3-haiku supported
  - Auth: ANTHROPIC_API_KEY
  - Endpoint: https://api.anthropic.com/v1/messages
  - Capabilities: Text generation via `app/lib/ai/providers/claude.ts`
  - Features: Rate limiting, caching, cost tracking, circuit breaker

- **Google Gemini** - Vision and text generation capabilities
  - SDK/Client: @google/genai 1.35.0
  - Models: gemini-3-flash-preview (default), gemini-1.5-pro supported
  - Auth: GOOGLE_AI_API_KEY
  - Capabilities: Text generation and vision (image analysis)
  - Implementation: `app/lib/ai/providers/gemini.ts`
  - Features: Rate limiting, caching, cost tracking, circuit breaker

**Image Generation:**
- **Leonardo AI** - Text-to-image generation with async polling
  - SDK/Client: Direct REST API via fetch
  - Base URLs: https://cloud.leonardo.ai/api/rest/v1 and /v2
  - Models: Lucide Origin (fixed ID: 7b592283-e8a7-4c5a-9ba6-d18c31f258b9)
  - Auth: LEONARDO_API_KEY (Bearer token)
  - Capabilities: Synchronous and async image generation
  - Polling: Max 60 attempts every 2 seconds (2-minute timeout)
  - Implementation: `app/lib/ai/providers/leonardo.ts`

- **Leonardo Seedance (Video)** - Text-to-video from image+prompt
  - Model ID: seedance-1.0-pro-fast
  - Polling: Max 120 attempts every 2 seconds (4-minute timeout for videos)
  - URL endpoints: https://cdn.leonardo.ai/ (image host)

## Data Storage

**Primary Database:**
- **SQLite** (better-sqlite3 12.6.0)
  - File location: `data/simulator.db`
  - Synchronous client for server-side access
  - Schema: `db/simulator-schema.sql`
  - Tables:
    - projects - Project metadata
    - project_state - Current dimensions, base image, output mode
    - panel_images - Saved generated images per project
    - project_posters - Single poster per project
    - interactive_prototypes - WebGL/clickable/trailer configs
    - generated_prompts - Generated scene prompts with ratings
  - Indexes for performance on project lookups

**File Storage:**
- Local filesystem (data/simulator.db-shm journal file observed)
- Image URLs stored as text references (external CDNs: Leonardo)
- Base images stored as data URLs in database

**Caching:**
- In-memory LRU cache with TTL: `app/lib/ai/cache.ts`
  - Max 1000 entries by default
  - 5-minute default TTL per cached response
  - User-isolated cache keys to prevent cross-user leakage
  - Implementations: AICache class with hit/miss tracking

## Authentication & Identity

**Auth Provider:**
- Custom (API key-based)
  - No user authentication system implemented
  - API key management via environment variables only
  - Per-provider authentication:
    - Claude: ANTHROPIC_API_KEY
    - Gemini: GOOGLE_AI_API_KEY
    - Leonardo: LEONARDO_API_KEY

**Session Management:**
- None implemented (stateless API design)
- All operations are anonymous or project-scoped

## Monitoring & Observability

**Error Tracking:**
- Unified error handling via `app/lib/ai/types.ts` (AIError class)
- Error codes: PROVIDER_UNAVAILABLE, RATE_LIMITED, TIMEOUT, INVALID_REQUEST, AUTHENTICATION_FAILED, etc.
- API endpoints return structured error responses via `app/utils/apiErrorHandling.ts`
- Circuit breaker pattern: `app/lib/ai/circuit-breaker.ts` (automatic provider falloff)

**Logs:**
- Server-side: Standard console logging (no structured logging library installed)
- Client-side: Browser console (no client error tracking)

**Health Checks:**
- Dedicated health endpoint: `app/api/ai/health/route.ts`
- Provides per-provider status: availability, error rate, rate limit status, last success/failure times
- Query params: ?provider={claude|gemini|leonardo} for specific provider checks

**Metrics & Cost Tracking:**
- Cost Tracker: `app/lib/ai/cost-tracker.ts`
  - Pricing data for Claude, Gemini, Leonardo
  - Tracks: requests, successes, failures, latency, cache hits, estimated costs
  - Model-specific overrides for pricing accuracy
  - Metadata support for cost attribution by feature/user

**Rate Limiting:**
- Token bucket algorithm: `app/lib/ai/rate-limiter.ts`
- Per-provider rate limits (requests per minute)
- Configurable limits with status reporting

**Retry Logic:**
- Exponential backoff: `app/lib/ai/retry.ts`
- Default: 3 max retries, 1s initial delay, 10s max delay, 2x multiplier
- Retryable error codes: RATE_LIMITED, TIMEOUT, NETWORK_ERROR

## CI/CD & Deployment

**Hosting:**
- Not explicitly configured (supports any Node.js host)
- Likely candidates: Vercel (Next.js native), AWS, Heroku, self-hosted

**CI Pipeline:**
- None detected in codebase
- Playwright config supports CI via `process.env.CI` flag (2 retries, 1 worker)

**Build Process:**
- `npm run build` generates .next/ directory
- Static export not configured (uses server-side rendering)

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - Anthropic Claude API key
- `GOOGLE_AI_API_KEY` - Google Gemini API key (used in `.env` and code)
- `LEONARDO_API_KEY` - Leonardo AI API key

**Optional env vars:**
- `NEXT_PUBLIC_USE_REAL_SIMULATOR_AI` - Enable/disable real Claude calls (mock fallback available)
- `NODE_ENV` - development/production (Next.js standard)
- `CI` - Set by CI systems for test configuration

**Secrets location:**
- Development: `.env` file (git-ignored, contains plaintext keys)
- Production: Environment variables (via hosting platform)

## Webhooks & Callbacks

**Incoming:**
- None implemented

**Outgoing:**
- Leonardo image generation: Synchronous polling (no webhook callbacks)
- Leonardo video generation: Synchronous polling (no webhook callbacks)

## API Layer Architecture

**Unified Provider Pattern:**
Located in `app/lib/ai/`:
- `unified-provider.ts` - Single entry point with automatic provider selection
- `providers/` - Individual provider implementations (Claude, Gemini, Leonardo)
- `types.ts` - Shared types for requests/responses/errors
- `cache.ts` - Response caching layer
- `cost-tracker.ts` - Cost estimation and metrics
- `rate-limiter.ts` - Token bucket rate limiting
- `retry.ts` - Exponential backoff retry wrapper
- `circuit-breaker.ts` - Automatic provider falloff on failures
- `health-check.ts` - Provider status monitoring

**Fallback Chains:**
- Text generation: Claude → Gemini (if Claude unavailable)
- Vision: Gemini (primary)
- Image generation: Leonardo (primary)

**API Routes:**
- `app/api/ai/simulator/route.ts` - Smart breakdown, element conversion, label refinement (Claude)
- `app/api/ai/image-describe/route.ts` - Image analysis and format detection (Gemini)
- `app/api/ai/generate-images/route.ts` - Start image generations (Leonardo)
- `app/api/ai/generate-video/route.ts` - Start video generation (Leonardo Seedance)
- `app/api/ai/generate-poster/route.ts` - Generate project posters
- `app/api/ai/health/route.ts` - Provider health status
- `app/api/ai/gemini/route.ts` - Generic Gemini endpoint
- `app/api/projects/route.ts` - Project CRUD operations
- `app/api/posters/route.ts` - Poster management

---

*Integration audit: 2026-01-27*
