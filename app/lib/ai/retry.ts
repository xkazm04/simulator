/**
 * Retry Logic with Exponential Backoff
 *
 * Unified retry handling for all AI providers
 */

import { AIError, AIErrorCode, AIProviderType } from './types';

export interface RetryOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to delays (default: true) */
  jitter?: boolean;
  /** Callback when retrying */
  onRetry?: (attempt: number, error: AIError, nextDelayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

// Error codes that should trigger a retry
const RETRYABLE_CODES: AIErrorCode[] = [
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK_ERROR',
];

/**
 * Determine if an error should be retried
 */
export function shouldRetry(error: AIError, attempt: number, maxRetries: number): boolean {
  // Don't retry if we've exceeded max retries
  if (attempt >= maxRetries) {
    return false;
  }

  // Check if error is retryable
  if (error.retryable) {
    return true;
  }

  // Check if error code is in retryable list
  if (RETRYABLE_CODES.includes(error.code)) {
    return true;
  }

  // HTTP status codes that should retry
  if (error.statusCode) {
    // 429 = rate limited, 5xx = server errors
    if (error.statusCode === 429 || error.statusCode >= 500) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate delay for next retry attempt
 */
export function calculateDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, 'onRetry'>>,
  retryAfterMs?: number
): number {
  // If server specified retry-after, use that
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, options.maxDelayMs);
  }

  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  let delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);

  // Add jitter (0-25% of delay)
  if (options.jitter) {
    const jitterAmount = delay * 0.25 * Math.random();
    delay += jitterAmount;
  }

  // Cap at max delay
  return Math.min(delay, options.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  provider: AIProviderType,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: AIError | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Convert to AIError if not already
      const aiError = error instanceof AIError
        ? error
        : new AIError(
            error instanceof Error ? error.message : 'Unknown error',
            'UNKNOWN_ERROR',
            provider,
            undefined,
            true
          );

      lastError = aiError;

      // Check if we should retry
      if (!shouldRetry(aiError, attempt, opts.maxRetries)) {
        throw aiError;
      }

      // Calculate delay
      const delay = calculateDelay(attempt, opts, aiError.retryAfterMs);

      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(attempt + 1, aiError, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // Should not reach here, but TypeScript needs it
  throw lastError || new AIError('Max retries exceeded', 'UNKNOWN_ERROR', provider);
}

/**
 * Create a retry wrapper for a function
 */
export function createRetryWrapper<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  provider: AIProviderType,
  options: RetryOptions = {}
): (...args: T) => Promise<R> {
  return (...args: T) => withRetry(() => fn(...args), provider, options);
}
