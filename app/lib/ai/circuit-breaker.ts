/**
 * Circuit Breaker Pattern for AI Provider Resilience
 *
 * Prevents cascade failures when an AI provider experiences sustained issues.
 * Automatically routes requests to fallback providers and recovers after cooldown.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail fast
 * - HALF_OPEN: Testing recovery, one request allowed
 */

import type { AIProviderType } from './types';

// ============================================================================
// TYPES
// ============================================================================

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before tripping (default: 5) */
  failureThreshold: number;
  /** Cooldown period in ms before attempting recovery (default: 30000) */
  cooldownMs: number;
  /** Time window for counting failures in ms (default: 60000) */
  failureWindowMs: number;
}

export interface CircuitStatus {
  state: CircuitState;
  failures: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  openedAt: number | null;
  nextAttemptAt: number | null;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30000, // 30 seconds
  failureWindowMs: 60000, // 1 minute
};

// ============================================================================
// CIRCUIT BREAKER CLASS
// ============================================================================

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private openedAt: number | null = null;
  private config: CircuitBreakerConfig;

  constructor(
    public readonly provider: AIProviderType,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a request is allowed through the circuit
   */
  canExecute(): boolean {
    this.updateState();

    switch (this.state) {
      case 'closed':
        return true;
      case 'open':
        return false;
      case 'half_open':
        // Allow one request through in half-open state
        return true;
      default:
        return true;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.lastSuccessAt = Date.now();
    this.failures = 0;

    if (this.state === 'half_open') {
      // Recovery successful - close circuit
      this.state = 'closed';
      this.openedAt = null;
      console.log(`[CircuitBreaker] ${this.provider}: Circuit CLOSED (recovered)`);
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    const now = Date.now();
    this.lastFailureAt = now;

    // Reset failures if outside the window
    if (this.lastFailureAt && now - this.lastFailureAt > this.config.failureWindowMs) {
      this.failures = 0;
    }

    this.failures++;

    if (this.state === 'half_open') {
      // Recovery failed - reopen circuit
      this.state = 'open';
      this.openedAt = now;
      console.log(`[CircuitBreaker] ${this.provider}: Circuit OPEN (recovery failed)`);
    } else if (this.state === 'closed' && this.failures >= this.config.failureThreshold) {
      // Trip the circuit
      this.state = 'open';
      this.openedAt = now;
      console.log(
        `[CircuitBreaker] ${this.provider}: Circuit OPEN (${this.failures} consecutive failures)`
      );
    }
  }

  /**
   * Get current circuit status
   */
  getStatus(): CircuitStatus {
    this.updateState();

    return {
      state: this.state,
      failures: this.failures,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      openedAt: this.openedAt,
      nextAttemptAt:
        this.state === 'open' && this.openedAt
          ? this.openedAt + this.config.cooldownMs
          : null,
    };
  }

  /**
   * Manually reset the circuit (for testing/debugging)
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureAt = null;
    this.openedAt = null;
    console.log(`[CircuitBreaker] ${this.provider}: Circuit manually RESET`);
  }

  /**
   * Update state based on cooldown timer
   */
  private updateState(): void {
    if (this.state === 'open' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.config.cooldownMs) {
        // Transition to half-open to test recovery
        this.state = 'half_open';
        console.log(`[CircuitBreaker] ${this.provider}: Circuit HALF_OPEN (testing recovery)`);
      }
    }
  }
}

// ============================================================================
// CIRCUIT BREAKER MANAGER
// ============================================================================

const circuitBreakers: Map<AIProviderType, CircuitBreaker> = new Map();

/**
 * Get or create a circuit breaker for a provider
 */
export function getCircuitBreaker(
  provider: AIProviderType,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  let breaker = circuitBreakers.get(provider);
  if (!breaker) {
    breaker = new CircuitBreaker(provider, config);
    circuitBreakers.set(provider, breaker);
  }
  return breaker;
}

/**
 * Get status of all circuit breakers
 */
export function getAllCircuitStatus(): Record<AIProviderType, CircuitStatus> {
  const providers: AIProviderType[] = ['claude', 'gemini', 'leonardo'];
  const status: Record<AIProviderType, CircuitStatus> = {} as Record<
    AIProviderType,
    CircuitStatus
  >;

  for (const provider of providers) {
    status[provider] = getCircuitBreaker(provider).getStatus();
  }

  return status;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuits(): void {
  for (const breaker of circuitBreakers.values()) {
    breaker.reset();
  }
}

// ============================================================================
// WRAPPER FUNCTION
// ============================================================================

/**
 * Wrap an async function with circuit breaker protection
 *
 * @param provider - The AI provider this function calls
 * @param fn - The async function to wrap
 * @param config - Optional circuit breaker configuration
 * @returns Wrapped function that respects circuit breaker state
 *
 * @throws Error with code 'CIRCUIT_OPEN' when circuit is open
 */
export function withCircuitBreaker<T extends unknown[], R>(
  provider: AIProviderType,
  fn: (...args: T) => Promise<R>,
  config?: Partial<CircuitBreakerConfig>
): (...args: T) => Promise<R> {
  const breaker = getCircuitBreaker(provider, config);

  return async (...args: T): Promise<R> => {
    if (!breaker.canExecute()) {
      const status = breaker.getStatus();
      const error = new Error(
        `Circuit breaker open for ${provider}. Next attempt at ${new Date(status.nextAttemptAt || 0).toISOString()}`
      );
      (error as Error & { code: string }).code = 'CIRCUIT_OPEN';
      (error as Error & { provider: string }).provider = provider;
      throw error;
    }

    try {
      const result = await fn(...args);
      breaker.recordSuccess();
      return result;
    } catch (error) {
      breaker.recordFailure();
      throw error;
    }
  };
}
