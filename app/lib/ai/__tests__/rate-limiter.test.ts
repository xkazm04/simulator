import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, getRateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  describe('tryAcquire', () => {
    it('should allow requests when under limit', () => {
      expect(limiter.tryAcquire('claude')).toBe(true);
      expect(limiter.tryAcquire('claude')).toBe(true);
    });

    it('should deny requests when limit exceeded', () => {
      // Exhaust all tokens
      const claudeLimit = 50; // Default Claude limit
      for (let i = 0; i < claudeLimit; i++) {
        limiter.tryAcquire('claude');
      }

      expect(limiter.tryAcquire('claude')).toBe(false);
    });

    it('should work with different providers independently', () => {
      // Exhaust Claude tokens
      for (let i = 0; i < 50; i++) {
        limiter.tryAcquire('claude');
      }

      // Gemini should still work
      expect(limiter.tryAcquire('gemini')).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = limiter.getStatus('claude');

      expect(status).toHaveProperty('remaining');
      expect(status).toHaveProperty('limit');
      expect(status).toHaveProperty('resetAt');
      expect(status).toHaveProperty('isLimited');
      expect(status.isLimited).toBe(false);
    });

    it('should show isLimited when exhausted', () => {
      // Exhaust all tokens
      for (let i = 0; i < 50; i++) {
        limiter.tryAcquire('claude');
      }

      const status = limiter.getStatus('claude');
      expect(status.isLimited).toBe(true);
      expect(status.remaining).toBe(0);
    });
  });

  describe('token refill', () => {
    it('should refill tokens over time', () => {
      vi.useFakeTimers();

      // Use some tokens
      for (let i = 0; i < 30; i++) {
        limiter.tryAcquire('claude');
      }

      const statusBefore = limiter.getStatus('claude');
      expect(statusBefore.remaining).toBeLessThanOrEqual(20);

      // Advance time by 30 seconds (should refill ~25 tokens for 50/min rate)
      vi.advanceTimersByTime(30000);

      const statusAfter = limiter.getStatus('claude');
      expect(statusAfter.remaining).toBeGreaterThan(statusBefore.remaining);

      vi.useRealTimers();
    });
  });

  describe('waitForToken', () => {
    it('should return true immediately when tokens available', async () => {
      const result = await limiter.waitForToken('claude', 100);
      expect(result).toBe(true);
    });

    it('should timeout when no tokens available', async () => {
      // Exhaust all tokens
      for (let i = 0; i < 50; i++) {
        limiter.tryAcquire('claude');
      }

      const result = await limiter.waitForToken('claude', 100);
      expect(result).toBe(false);
    });
  });

  describe('addTokens', () => {
    it('should add tokens to bucket', () => {
      // Use some tokens
      for (let i = 0; i < 30; i++) {
        limiter.tryAcquire('claude');
      }

      const statusBefore = limiter.getStatus('claude');
      limiter.addTokens('claude', 10);
      const statusAfter = limiter.getStatus('claude');

      expect(statusAfter.remaining).toBeGreaterThan(statusBefore.remaining);
    });

    it('should not exceed max tokens', () => {
      limiter.addTokens('claude', 1000);
      const status = limiter.getStatus('claude');
      expect(status.remaining).toBeLessThanOrEqual(status.limit);
    });
  });

  describe('updateLimit', () => {
    it('should update the limit for a provider', () => {
      limiter.updateLimit('claude', 100);
      const status = limiter.getStatus('claude');
      expect(status.limit).toBe(100);
    });
  });

  describe('handleRateLimitResponse', () => {
    it('should empty the bucket on rate limit', () => {
      limiter.handleRateLimitResponse('claude');
      const status = limiter.getStatus('claude');
      expect(status.remaining).toBe(0);
      expect(status.isLimited).toBe(true);
    });
  });

  describe('custom limits', () => {
    it('should accept custom limits', () => {
      const customLimiter = new RateLimiter({
        claude: 100,
        gemini: 200,
        leonardo: 10,
      });

      expect(customLimiter.getStatus('claude').limit).toBe(100);
      expect(customLimiter.getStatus('gemini').limit).toBe(200);
      expect(customLimiter.getStatus('leonardo').limit).toBe(10);
    });
  });
});

describe('getRateLimiter', () => {
  it('should return singleton instance', () => {
    const limiter1 = getRateLimiter();
    const limiter2 = getRateLimiter();
    expect(limiter1).toBe(limiter2);
  });
});
