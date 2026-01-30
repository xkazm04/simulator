/**
 * Cost Tracking for AI Providers
 *
 * Estimates and tracks costs for AI API usage
 */

import type { AIProviderType, AIUsage, CostEstimate, AIMetrics, ProviderMetrics } from './types';

// Pricing per 1K tokens (as of late 2024 - update as needed)
const PRICING: Record<AIProviderType, { input: number; output: number; imageGeneration?: number }> = {
  claude: {
    input: 0.003, // Claude 3.5 Sonnet
    output: 0.015,
  },
  gemini: {
    input: 0.000125, // Gemini 1.5 Flash (very cheap)
    output: 0.000375,
  },
  leonardo: {
    input: 0,
    output: 0,
    imageGeneration: 0.02, // ~$0.02 per image (varies by model)
  },
};

// Model-specific pricing overrides
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000125, output: 0.000375 },
  'gemini-3-flash-preview': { input: 0.000125, output: 0.000375 },
};

export class CostTracker {
  private metrics: AIMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    avgLatencyMs: 0,
    byProvider: {
      claude: this.createEmptyProviderMetrics(),
      gemini: this.createEmptyProviderMetrics(),
      leonardo: this.createEmptyProviderMetrics(),
    },
    byFeature: {},
    estimatedTotalCostUsd: 0,
  };

  private latencySum = 0;

  private createEmptyProviderMetrics(): ProviderMetrics {
    return {
      requests: 0,
      successes: 0,
      failures: 0,
      avgLatencyMs: 0,
      rateLimitHits: 0,
      estimatedCostUsd: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
    };
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(
    provider: AIProviderType,
    inputTokens: number = 0,
    outputTokens: number = 0,
    imageCount: number = 0,
    model?: string
  ): CostEstimate {
    // Get pricing (model-specific or provider default)
    const pricing = model && MODEL_PRICING[model]
      ? MODEL_PRICING[model]
      : PRICING[provider];

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    const imageCost = imageCount * (PRICING[provider].imageGeneration || 0);

    return {
      provider,
      model: model || 'default',
      inputTokens,
      outputTokens,
      imageCount: imageCount > 0 ? imageCount : undefined,
      estimatedCostUsd: inputCost + outputCost + imageCost,
    };
  }

  /**
   * Track a completed request
   */
  trackRequest(
    provider: AIProviderType,
    success: boolean,
    latencyMs: number,
    usage?: AIUsage,
    feature?: string,
    cached: boolean = false
  ): void {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    if (cached) {
      this.metrics.cacheHits++;
    }

    // Update latency average
    this.latencySum += latencyMs;
    this.metrics.avgLatencyMs = this.latencySum / this.metrics.totalRequests;

    // Update provider metrics
    const providerMetrics = this.metrics.byProvider[provider];
    providerMetrics.requests++;
    if (success) {
      providerMetrics.successes++;
      providerMetrics.lastSuccessAt = Date.now();
    } else {
      providerMetrics.failures++;
      providerMetrics.lastFailureAt = Date.now();
    }
    providerMetrics.avgLatencyMs =
      (providerMetrics.avgLatencyMs * (providerMetrics.requests - 1) + latencyMs) /
      providerMetrics.requests;

    // Track cost
    if (usage?.estimatedCostUsd) {
      providerMetrics.estimatedCostUsd += usage.estimatedCostUsd;
      this.metrics.estimatedTotalCostUsd += usage.estimatedCostUsd;
    }

    // Track by feature
    if (feature) {
      this.metrics.byFeature[feature] = (this.metrics.byFeature[feature] || 0) + 1;
    }
  }

  /**
   * Track a rate limit hit
   */
  trackRateLimitHit(provider: AIProviderType): void {
    this.metrics.byProvider[provider].rateLimitHits++;
  }

  /**
   * Get current metrics
   */
  getMetrics(): AIMetrics {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  /**
   * Get metrics for a specific provider
   */
  getProviderMetrics(provider: AIProviderType): ProviderMetrics {
    return { ...this.metrics.byProvider[provider] };
  }

  /**
   * Get success rate as percentage
   */
  getSuccessRate(provider?: AIProviderType): number {
    if (provider) {
      const metrics = this.metrics.byProvider[provider];
      if (metrics.requests === 0) return 100;
      return (metrics.successes / metrics.requests) * 100;
    }

    if (this.metrics.totalRequests === 0) return 100;
    return (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;
  }

  /**
   * Get cache hit rate as percentage
   */
  getCacheHitRate(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return (this.metrics.cacheHits / this.metrics.totalRequests) * 100;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      avgLatencyMs: 0,
      byProvider: {
        claude: this.createEmptyProviderMetrics(),
        gemini: this.createEmptyProviderMetrics(),
        leonardo: this.createEmptyProviderMetrics(),
      },
      byFeature: {},
      estimatedTotalCostUsd: 0,
    };
    this.latencySum = 0;
  }

  /**
   * Get a summary report
   */
  getSummary(): string {
    const m = this.metrics;
    const lines = [
      '=== AI Provider Metrics ===',
      `Total Requests: ${m.totalRequests}`,
      `Success Rate: ${this.getSuccessRate().toFixed(1)}%`,
      `Cache Hit Rate: ${this.getCacheHitRate().toFixed(1)}%`,
      `Avg Latency: ${m.avgLatencyMs.toFixed(0)}ms`,
      `Estimated Cost: $${m.estimatedTotalCostUsd.toFixed(4)}`,
      '',
      'By Provider:',
    ];

    for (const [provider, pm] of Object.entries(m.byProvider)) {
      if (pm.requests > 0) {
        lines.push(
          `  ${provider}: ${pm.requests} req, ${pm.avgLatencyMs.toFixed(0)}ms avg, $${pm.estimatedCostUsd.toFixed(4)}, ${pm.rateLimitHits} rate limits`
        );
      }
    }

    if (Object.keys(m.byFeature).length > 0) {
      lines.push('', 'By Feature:');
      for (const [feature, count] of Object.entries(m.byFeature)) {
        lines.push(`  ${feature}: ${count} requests`);
      }
    }

    return lines.join('\n');
  }
}

// Singleton instance
let costTrackerInstance: CostTracker | null = null;

export function getCostTracker(): CostTracker {
  if (!costTrackerInstance) {
    costTrackerInstance = new CostTracker();
  }
  return costTrackerInstance;
}
