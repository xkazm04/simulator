import { describe, it, expect } from 'vitest';
import { AIError } from '../types';

describe('AIError', () => {
  it('should create an error with all properties', () => {
    const error = new AIError(
      'Rate limit exceeded',
      'RATE_LIMITED',
      'claude',
      429,
      true,
      5000
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AIError');
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.provider).toBe('claude');
    expect(error.statusCode).toBe(429);
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(5000);
  });

  it('should have default retryable false', () => {
    const error = new AIError('test', 'UNKNOWN_ERROR', 'gemini');
    expect(error.retryable).toBe(false);
  });

  it('should serialize to JSON', () => {
    const error = new AIError(
      'Auth failed',
      'AUTHENTICATION_FAILED',
      'leonardo',
      401,
      false
    );

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'AIError',
      message: 'Auth failed',
      code: 'AUTHENTICATION_FAILED',
      provider: 'leonardo',
      statusCode: 401,
      retryable: false,
      retryAfterMs: undefined,
    });
  });

  it('should be catchable as Error', () => {
    const error = new AIError('test', 'TIMEOUT', 'claude');

    try {
      throw error;
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(AIError);
    }
  });

  describe('error codes', () => {
    const testCases: Array<{ code: string; description: string }> = [
      { code: 'PROVIDER_UNAVAILABLE', description: 'Provider not configured' },
      { code: 'RATE_LIMITED', description: 'Too many requests' },
      { code: 'TIMEOUT', description: 'Request timed out' },
      { code: 'INVALID_REQUEST', description: 'Bad request parameters' },
      { code: 'AUTHENTICATION_FAILED', description: 'Invalid API key' },
      { code: 'INSUFFICIENT_QUOTA', description: 'Quota exceeded' },
      { code: 'CONTENT_FILTERED', description: 'Content blocked' },
      { code: 'GENERATION_FAILED', description: 'Image generation failed' },
      { code: 'NETWORK_ERROR', description: 'Network issue' },
      { code: 'UNKNOWN_ERROR', description: 'Unknown error' },
    ];

    testCases.forEach(({ code, description }) => {
      it(`should support ${code} error code`, () => {
        const error = new AIError(description, code as import('../types').AIErrorCode, 'claude');
        expect(error.code).toBe(code);
      });
    });
  });
});
