/**
 * Health Check for AI Providers
 *
 * Aggregates metrics from cost tracker and rate limiter to provide
 * real-time health status for each AI provider.
 */

import type { AIProviderType, RateLimitStatus, ProviderMetrics } from './types';
import { getCostTracker } from './cost-tracker';
import { getRateLimiter } from './rate-limiter';

// ============================================================================
// HEALTH STATUS TYPES
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface ProviderHealth {
  provider: AIProviderType;
  status: HealthStatus;
  errorRate: number;
  recentErrors: number;
  recentRequests: number;
  avgLatencyMs: number;
  rateLimit: RateLimitStatus;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
}

export interface HealthCheckResponse {
  timestamp: number;
  overall: HealthStatus;
  providers: Record<AIProviderType, ProviderHealth>;
}

// ============================================================================
// HEALTH STATUS CALCULATION
// ============================================================================

// Thresholds for status calculation
const DEGRADED_ERROR_RATE_THRESHOLD = 0.1; // 10% errors = degraded
const DOWN_ERROR_RATE_THRESHOLD = 0.5; // 50% errors = down
const STALE_DATA_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes without requests

/**
 * Calculate health status from error rate
 */
function calculateStatus(metrics: ProviderMetrics): HealthStatus {
  // No requests yet - assume healthy
  if (metrics.requests === 0) {
    return 'healthy';
  }

  const errorRate = metrics.failures / metrics.requests;

  if (errorRate >= DOWN_ERROR_RATE_THRESHOLD) {
    return 'down';
  }

  if (errorRate >= DEGRADED_ERROR_RATE_THRESHOLD) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * Get health status for a single provider
 */
export function getProviderHealth(provider: AIProviderType): ProviderHealth {
  const costTracker = getCostTracker();
  const rateLimiter = getRateLimiter();

  const metrics = costTracker.getProviderMetrics(provider);
  const rateLimitStatus = rateLimiter.getStatus(provider);

  const errorRate = metrics.requests > 0 ? metrics.failures / metrics.requests : 0;

  // Calculate status - rate limited counts as degraded
  let status = calculateStatus(metrics);
  if (status === 'healthy' && rateLimitStatus.isLimited) {
    status = 'degraded';
  }

  return {
    provider,
    status,
    errorRate,
    recentErrors: metrics.failures,
    recentRequests: metrics.requests,
    avgLatencyMs: metrics.avgLatencyMs,
    rateLimit: rateLimitStatus,
    lastSuccessAt: metrics.lastSuccessAt,
    lastFailureAt: metrics.lastFailureAt,
  };
}

/**
 * Get health status for all providers
 */
export function healthCheck(): HealthCheckResponse {
  const providers: AIProviderType[] = ['claude', 'gemini', 'leonardo'];

  const providerHealths: Record<AIProviderType, ProviderHealth> = {} as Record<
    AIProviderType,
    ProviderHealth
  >;

  let worstStatus: HealthStatus = 'healthy';

  for (const provider of providers) {
    const health = getProviderHealth(provider);
    providerHealths[provider] = health;

    // Track worst status for overall health
    if (health.status === 'down') {
      worstStatus = 'down';
    } else if (health.status === 'degraded' && worstStatus !== 'down') {
      worstStatus = 'degraded';
    }
  }

  return {
    timestamp: Date.now(),
    overall: worstStatus,
    providers: providerHealths,
  };
}

/**
 * Check if a specific provider is available for requests
 */
export function isProviderAvailable(provider: AIProviderType): boolean {
  const health = getProviderHealth(provider);
  return health.status !== 'down' && !health.rateLimit.isLimited;
}
