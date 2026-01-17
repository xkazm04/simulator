import { describe, it, expect, vi } from 'vitest';
import { withRetry, shouldRetry, calculateDelay } from '../retry';
import { AIError } from '../types';

describe('shouldRetry', () => {
  it('should return false when max retries exceeded', () => {
    const error = new AIError('test', 'RATE_LIMITED', 'claude', 429, true);
    expect(shouldRetry(error, 3, 3)).toBe(false);
  });

  it('should return true for retryable error codes', () => {
    const rateLimited = new AIError('test', 'RATE_LIMITED', 'claude', 429);
    const timeout = new AIError('test', 'TIMEOUT', 'claude');
    const networkError = new AIError('test', 'NETWORK_ERROR', 'claude');

    expect(shouldRetry(rateLimited, 0, 3)).toBe(true);
    expect(shouldRetry(timeout, 0, 3)).toBe(true);
    expect(shouldRetry(networkError, 0, 3)).toBe(true);
  });

  it('should return false for non-retryable error codes', () => {
    const authError = new AIError('test', 'AUTHENTICATION_FAILED', 'claude', 401);
    const invalidRequest = new AIError('test', 'INVALID_REQUEST', 'claude', 400);

    expect(shouldRetry(authError, 0, 3)).toBe(false);
    expect(shouldRetry(invalidRequest, 0, 3)).toBe(false);
  });

  it('should return true when error.retryable is true', () => {
    const error = new AIError('test', 'UNKNOWN_ERROR', 'claude', undefined, true);
    expect(shouldRetry(error, 0, 3)).toBe(true);
  });

  it('should return true for 5xx status codes', () => {
    const serverError = new AIError('test', 'UNKNOWN_ERROR', 'claude', 500);
    expect(shouldRetry(serverError, 0, 3)).toBe(true);
  });
});

describe('calculateDelay', () => {
  const defaultOptions = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: false,
  };

  it('should use exponential backoff', () => {
    const delay0 = calculateDelay(0, defaultOptions);
    const delay1 = calculateDelay(1, defaultOptions);
    const delay2 = calculateDelay(2, defaultOptions);

    expect(delay0).toBe(1000); // 1000 * 2^0
    expect(delay1).toBe(2000); // 1000 * 2^1
    expect(delay2).toBe(4000); // 1000 * 2^2
  });

  it('should cap at max delay', () => {
    const delay = calculateDelay(10, defaultOptions);
    expect(delay).toBe(30000);
  });

  it('should use retryAfterMs when provided', () => {
    const delay = calculateDelay(0, defaultOptions, 5000);
    expect(delay).toBe(5000);
  });

  it('should cap retryAfterMs at maxDelayMs', () => {
    const delay = calculateDelay(0, defaultOptions, 60000);
    expect(delay).toBe(30000);
  });

  it('should add jitter when enabled', () => {
    const optionsWithJitter = { ...defaultOptions, jitter: true };

    // Run multiple times to check for variance
    const delays = Array.from({ length: 10 }, () => calculateDelay(1, optionsWithJitter));
    const uniqueDelays = new Set(delays);

    // With jitter, we should get varying delays
    expect(uniqueDelays.size).toBeGreaterThan(1);

    // All delays should be within expected range (base to base + 25%)
    delays.forEach(delay => {
      expect(delay).toBeGreaterThanOrEqual(2000);
      expect(delay).toBeLessThanOrEqual(2500);
    });
  });
});

describe('withRetry', () => {
  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, 'claude');
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new AIError('fail', 'RATE_LIMITED', 'claude', 429, true))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, 'claude', { initialDelayMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw immediately on non-retryable errors', async () => {
    const error = new AIError('auth failed', 'AUTHENTICATION_FAILED', 'claude', 401, false);
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, 'claude')).rejects.toThrow('auth failed');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries', async () => {
    const error = new AIError('timeout', 'TIMEOUT', 'claude', undefined, true);
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, 'claude', { maxRetries: 2, initialDelayMs: 10 }))
      .rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should call onRetry callback', async () => {
    const error = new AIError('fail', 'RATE_LIMITED', 'claude', 429, true);
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('success');
    const onRetry = vi.fn();

    await withRetry(fn, 'claude', { initialDelayMs: 10, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, error, expect.any(Number));
  });

  it('should convert non-AIError to AIError', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('generic error'));

    await expect(withRetry(fn, 'claude', { maxRetries: 0 }))
      .rejects.toThrow('generic error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use retryAfterMs from error', async () => {
    const error = new AIError('rate limited', 'RATE_LIMITED', 'claude', 429, true, 100);
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('success');

    const startTime = Date.now();
    await withRetry(fn, 'claude', { maxRetries: 1 });
    const elapsed = Date.now() - startTime;

    // Should have waited approximately the retryAfterMs time
    expect(elapsed).toBeGreaterThanOrEqual(80); // Allow some variance
  });
});
