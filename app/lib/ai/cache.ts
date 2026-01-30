/**
 * In-Memory Cache for AI Responses
 *
 * LRU cache with TTL support for reducing duplicate API calls
 */

import type { CacheEntry, CacheStats } from './types';

export class AICache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: 1000,
  };

  constructor(private maxSize: number = 1000) {
    this.stats.maxSize = maxSize;
  }

  /**
   * Generate a cache key from request parameters
   *
   * @param params - Request parameters to include in key
   * @returns JSON string cache key
   */
  static generateKey(params: Record<string, unknown>): string {
    // Sort keys for consistent hashing
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        const value = params[key];
        // Skip non-serializable values
        if (value !== undefined && value !== null) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, unknown>);

    return JSON.stringify(sortedParams);
  }

  /**
   * Generate a user-isolated cache key
   *
   * Includes userId in the cache key to prevent cross-user cache leakage.
   * Anonymous users (no userId) share a common cache namespace.
   *
   * Key format: {provider}:{model}:{userId|'anonymous'}:{contentHash}
   *
   * @param provider - AI provider type
   * @param model - Model identifier
   * @param userId - Optional user ID for isolation (undefined = shared cache)
   * @param params - Additional request parameters to hash
   * @returns Formatted cache key string
   *
   * @example
   * // User-isolated key
   * AICache.generateUserIsolatedKey('claude', 'sonnet', 'user123', { prompt: 'hello' });
   * // => 'claude:sonnet:user123:{"prompt":"hello"}'
   *
   * @example
   * // Anonymous/shared key
   * AICache.generateUserIsolatedKey('gemini', 'flash', undefined, { prompt: 'hello' });
   * // => 'gemini:flash:anonymous:{"prompt":"hello"}'
   */
  static generateUserIsolatedKey(
    provider: string,
    model: string,
    userId: string | undefined,
    params: Record<string, unknown>
  ): string {
    const userPart = userId || 'anonymous';
    const contentHash = AICache.generateKey(params);
    return `${provider}:${model}:${userPart}:${contentHash}`;
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return undefined;
    }

    // Update hit count and move to end (LRU)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (first in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
      hits: 0,
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Clear all expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }

    this.stats.size = this.cache.size;
    return cleared;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get hit rate as percentage
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return (this.stats.hits / total) * 100;
  }
}

// Singleton cache instance
let cacheInstance: AICache | null = null;

export function getAICache(): AICache {
  if (!cacheInstance) {
    cacheInstance = new AICache(1000);
  }
  return cacheInstance;
}

/**
 * Decorator/wrapper for caching function results
 */
export function withCache<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  ttlSeconds: number = 300
): (...args: T) => Promise<R> {
  const cache = getAICache();

  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args);

    // Check cache
    const cached = cache.get<R>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute and cache
    const result = await fn(...args);
    cache.set(key, result, ttlSeconds);
    return result;
  };
}
