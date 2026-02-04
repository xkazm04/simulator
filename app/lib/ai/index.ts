/**
 * Unified AI Provider Layer
 *
 * Central export for all AI functionality with consistent patterns
 * for Claude, Gemini, and Leonardo APIs.
 *
 * Features:
 * - Unified request/response types
 * - Consistent error handling
 * - Rate limiting with token bucket algorithm
 * - Response caching (LRU with TTL)
 * - Retry logic with exponential backoff
 * - Cost tracking and metrics
 * - Automatic fallback strategies
 *
 * @example
 * ```typescript
 * import { generateText, analyzeImage, generateImages } from '@/app/lib/ai';
 *
 * // Text generation (uses Claude by default, falls back to Gemini)
 * const text = await generateText('Describe a sunset', 'Be poetic');
 *
 * // Image analysis (uses Gemini)
 * const description = await analyzeImage(imageDataUrl, 'What is in this image?');
 *
 * // Image generation (uses Leonardo)
 * const images = await generateImages('A cyberpunk cityscape at night');
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export * from './types';

// ============================================================================
// CORE UTILITIES
// ============================================================================

export { AICache, getAICache, withCache } from './cache';
export { RateLimiter, getRateLimiter } from './rate-limiter';
export { withRetry, shouldRetry, calculateDelay, createRetryWrapper } from './retry';
export { CostTracker, getCostTracker } from './cost-tracker';
export { parseAIJsonResponse, parseJsonFromGeminiResponse } from './parse-json';
export {
  checkGenerationStatus,
  deleteGenerations,
  type GenerationType,
  type GenerationStatusResult,
  type DeleteGenerationsResult,
} from './leonardo-utils';
export {
  healthCheck,
  getProviderHealth,
  isProviderAvailable,
  type ProviderHealth,
  type HealthStatus,
  type HealthCheckResponse,
} from './health-check';
export {
  CircuitBreaker,
  getCircuitBreaker,
  getAllCircuitStatus,
  resetAllCircuits,
  withCircuitBreaker,
  type CircuitState,
  type CircuitStatus,
  type CircuitBreakerConfig,
} from './circuit-breaker';

// ============================================================================
// PROVIDERS
// ============================================================================

export {
  // Claude
  ClaudeProvider,
  getClaudeProvider,
  generateTextWithClaude,
  // Gemini
  GeminiProvider,
  getGeminiProvider,
  generateTextWithGemini,
  analyzeImageWithGemini,
  // Leonardo - Images
  LeonardoProvider,
  getLeonardoProvider,
  generateImagesWithLeonardo,
  startImageGenerationWithLeonardo,
  // Leonardo - Videos (Seedance)
  uploadImageForVideo,
  startVideoGenerationWithLeonardo,
  checkVideoGenerationStatus,
} from './providers';

export type {
  ClaudeConfig,
  GeminiConfig,
  LeonardoConfig,
  VideoGenerationRequest,
  VideoGenerationResult,
} from './providers';

// ============================================================================
// UNIFIED PROVIDER
// ============================================================================

export {
  UnifiedAIProvider,
  getUnifiedProvider,
  // Convenience functions
  generateText,
  analyzeImage,
  generateImages,
} from './unified-provider';

export type { UnifiedProviderConfig } from './unified-provider';

// ============================================================================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Check if Claude is available
 */
export function isClaudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Check if Gemini is available
 */
export function isGeminiAvailable(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY;
}

/**
 * Check if Leonardo is available
 */
export function isLeonardoAvailable(): boolean {
  return !!process.env.LEONARDO_API_KEY;
}

/**
 * Check if any AI provider is available
 */
export function isAnyProviderAvailable(): boolean {
  return isClaudeAvailable() || isGeminiAvailable() || isLeonardoAvailable();
}
