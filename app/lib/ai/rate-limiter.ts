/**
 * Rate Limiter for AI Providers
 *
 * Token bucket algorithm with sliding window for accurate rate limiting
 */

import type { AIProviderType, RateLimitStatus } from './types';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per second
}

export class RateLimiter {
  private buckets: Map<AIProviderType, RateLimitBucket> = new Map();

  // Default limits per provider (requests per minute)
  private static readonly DEFAULT_LIMITS: Record<AIProviderType, number> = {
    claude: 50, // Anthropic tier 1 default
    gemini: 60, // Google AI free tier
    leonardo: 30, // Leonardo standard
  };

  constructor(customLimits?: Partial<Record<AIProviderType, number>>) {
    // Initialize buckets for all providers
    for (const provider of ['claude', 'gemini', 'leonardo'] as AIProviderType[]) {
      const limitPerMinute = customLimits?.[provider] ?? RateLimiter.DEFAULT_LIMITS[provider];
      this.buckets.set(provider, {
        tokens: limitPerMinute,
        lastRefill: Date.now(),
        maxTokens: limitPerMinute,
        refillRate: limitPerMinute / 60, // Convert to per-second
      });
    }
  }

  /**
   * Try to acquire a token for making a request
   * Returns true if allowed, false if rate limited
   */
  tryAcquire(provider: AIProviderType): boolean {
    const bucket = this.buckets.get(provider);
    if (!bucket) return true; // Unknown provider, allow

    this.refillBucket(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Wait until a token is available (with timeout)
   */
  async waitForToken(provider: AIProviderType, timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.tryAcquire(provider)) {
        return true;
      }

      // Wait for estimated refill time
      const status = this.getStatus(provider);
      const waitTime = Math.min(
        status.resetAt - Date.now(),
        1000, // Check at least every second
        timeoutMs - (Date.now() - startTime)
      );

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    return false;
  }

  /**
   * Get current rate limit status for a provider
   */
  getStatus(provider: AIProviderType): RateLimitStatus {
    const bucket = this.buckets.get(provider);
    if (!bucket) {
      return {
        remaining: Infinity,
        limit: Infinity,
        resetAt: Date.now(),
        isLimited: false,
      };
    }

    this.refillBucket(bucket);

    // Calculate when bucket will be full
    const tokensNeeded = bucket.maxTokens - bucket.tokens;
    const timeToFull = tokensNeeded > 0 ? (tokensNeeded / bucket.refillRate) * 1000 : 0;

    return {
      remaining: Math.floor(bucket.tokens),
      limit: bucket.maxTokens,
      resetAt: Date.now() + timeToFull,
      isLimited: bucket.tokens < 1,
    };
  }

  /**
   * Manually add tokens (e.g., when rate limit header indicates more capacity)
   */
  addTokens(provider: AIProviderType, tokens: number): void {
    const bucket = this.buckets.get(provider);
    if (bucket) {
      bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokens);
    }
  }

  /**
   * Update limit for a provider based on API response headers
   */
  updateLimit(provider: AIProviderType, newLimit: number): void {
    const bucket = this.buckets.get(provider);
    if (bucket) {
      bucket.maxTokens = newLimit;
      bucket.refillRate = newLimit / 60;
      // Don't exceed new max
      bucket.tokens = Math.min(bucket.tokens, newLimit);
    }
  }

  /**
   * Handle rate limit response from API (429)
   */
  handleRateLimitResponse(provider: AIProviderType, retryAfterSeconds?: number): void {
    const bucket = this.buckets.get(provider);
    if (bucket) {
      // Empty the bucket
      bucket.tokens = 0;
      // If we know when to retry, adjust the refill time
      if (retryAfterSeconds) {
        bucket.lastRefill = Date.now() - (60 - retryAfterSeconds) * 1000;
      }
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillBucket(bucket: RateLimitBucket): void {
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * bucket.refillRate;

    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
}

// Singleton instance
let rateLimiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}
