import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AICache, getAICache, withCache } from '../cache';

describe('AICache', () => {
  let cache: AICache;

  beforeEach(() => {
    cache = new AICache(100);
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1', 300);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1', 300);
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete keys', () => {
      cache.set('key1', 'value1', 300);
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1', 300);
      cache.set('key2', 'value2', 300);
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      vi.useFakeTimers();

      cache.set('key1', 'value1', 1); // 1 second TTL
      expect(cache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(1500); // Advance past TTL
      expect(cache.get('key1')).toBeUndefined();

      vi.useRealTimers();
    });

    it('should clear expired entries', () => {
      vi.useFakeTimers();

      cache.set('key1', 'value1', 1);
      cache.set('key2', 'value2', 10);

      vi.advanceTimersByTime(2000);

      const cleared = cache.clearExpired();
      expect(cleared).toBe(1);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');

      vi.useRealTimers();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      const smallCache = new AICache(3);

      smallCache.set('key1', 'value1', 300);
      smallCache.set('key2', 'value2', 300);
      smallCache.set('key3', 'value3', 300);
      smallCache.set('key4', 'value4', 300); // Should evict key1

      expect(smallCache.get('key1')).toBeUndefined();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
      expect(smallCache.get('key4')).toBe('value4');
    });

    it('should move accessed entries to end (LRU)', () => {
      const smallCache = new AICache(3);

      smallCache.set('key1', 'value1', 300);
      smallCache.set('key2', 'value2', 300);
      smallCache.set('key3', 'value3', 300);

      // Access key1, moving it to end
      smallCache.get('key1');

      // Now add new entry - should evict key2 (oldest)
      smallCache.set('key4', 'value4', 300);

      expect(smallCache.get('key1')).toBe('value1');
      expect(smallCache.get('key2')).toBeUndefined();
      expect(smallCache.get('key3')).toBe('value3');
      expect(smallCache.get('key4')).toBe('value4');
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1', 300);

      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('nonexistent'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate', () => {
      cache.set('key1', 'value1', 300);

      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('nonexistent'); // Miss

      expect(cache.getHitRate()).toBeCloseTo(66.67, 1);
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same params', () => {
      const params = { provider: 'claude', prompt: 'test', temperature: 0.7 };
      const key1 = AICache.generateKey(params);
      const key2 = AICache.generateKey(params);
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different params', () => {
      const key1 = AICache.generateKey({ provider: 'claude', prompt: 'test1' });
      const key2 = AICache.generateKey({ provider: 'claude', prompt: 'test2' });
      expect(key1).not.toBe(key2);
    });

    it('should ignore undefined values', () => {
      const key1 = AICache.generateKey({ provider: 'claude', prompt: 'test' });
      const key2 = AICache.generateKey({ provider: 'claude', prompt: 'test', extra: undefined });
      expect(key1).toBe(key2);
    });
  });
});

describe('getAICache', () => {
  it('should return singleton instance', () => {
    const cache1 = getAICache();
    const cache2 = getAICache();
    expect(cache1).toBe(cache2);
  });
});

describe('withCache', () => {
  it('should cache function results', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const keyGen = vi.fn().mockReturnValue('test-key');
    const cachedFn = withCache(fn, keyGen, 300);

    // First call - should execute function
    const result1 = await cachedFn('arg1');
    expect(result1).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    const result2 = await cachedFn('arg1');
    expect(result2).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1); // Still 1, used cache
  });
});
