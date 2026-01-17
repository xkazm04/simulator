import { describe, it, expect, beforeEach } from 'vitest';
import { CostTracker, getCostTracker } from '../cost-tracker';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  describe('estimateCost', () => {
    it('should estimate cost for Claude', () => {
      const estimate = tracker.estimateCost('claude', 1000, 500);

      expect(estimate).toHaveProperty('provider', 'claude');
      expect(estimate).toHaveProperty('inputTokens', 1000);
      expect(estimate).toHaveProperty('outputTokens', 500);
      expect(estimate).toHaveProperty('estimatedCostUsd');
      expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('should estimate cost for Gemini (much cheaper)', () => {
      const claudeEstimate = tracker.estimateCost('claude', 1000, 500);
      const geminiEstimate = tracker.estimateCost('gemini', 1000, 500);

      // Gemini should be significantly cheaper
      expect(geminiEstimate.estimatedCostUsd).toBeLessThan(claudeEstimate.estimatedCostUsd);
    });

    it('should include image cost for Leonardo', () => {
      const estimate = tracker.estimateCost('leonardo', 0, 0, 4);

      expect(estimate.imageCount).toBe(4);
      expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('should use model-specific pricing', () => {
      const sonnetEstimate = tracker.estimateCost('claude', 1000, 500, 0, 'claude-3-5-sonnet-20241022');
      const haikuEstimate = tracker.estimateCost('claude', 1000, 500, 0, 'claude-3-haiku');

      // Haiku should be much cheaper than Sonnet
      expect(haikuEstimate.estimatedCostUsd).toBeLessThan(sonnetEstimate.estimatedCostUsd);
    });
  });

  describe('trackRequest', () => {
    it('should track successful requests', () => {
      tracker.trackRequest('claude', true, 500, { estimatedCostUsd: 0.01 }, 'test-feature');

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.byProvider.claude.requests).toBe(1);
      expect(metrics.byProvider.claude.successes).toBe(1);
    });

    it('should track failed requests', () => {
      tracker.trackRequest('claude', false, 100);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.byProvider.claude.failures).toBe(1);
    });

    it('should track cache hits', () => {
      tracker.trackRequest('claude', true, 10, undefined, undefined, true);

      const metrics = tracker.getMetrics();
      expect(metrics.cacheHits).toBe(1);
    });

    it('should track costs', () => {
      tracker.trackRequest('claude', true, 500, { estimatedCostUsd: 0.01 });
      tracker.trackRequest('claude', true, 500, { estimatedCostUsd: 0.02 });

      const metrics = tracker.getMetrics();
      expect(metrics.estimatedTotalCostUsd).toBeCloseTo(0.03);
      expect(metrics.byProvider.claude.estimatedCostUsd).toBeCloseTo(0.03);
    });

    it('should track by feature', () => {
      tracker.trackRequest('claude', true, 500, undefined, 'smart-breakdown');
      tracker.trackRequest('claude', true, 500, undefined, 'smart-breakdown');
      tracker.trackRequest('gemini', true, 500, undefined, 'image-describe');

      const metrics = tracker.getMetrics();
      expect(metrics.byFeature['smart-breakdown']).toBe(2);
      expect(metrics.byFeature['image-describe']).toBe(1);
    });

    it('should calculate average latency', () => {
      tracker.trackRequest('claude', true, 100);
      tracker.trackRequest('claude', true, 200);
      tracker.trackRequest('claude', true, 300);

      const metrics = tracker.getMetrics();
      expect(metrics.avgLatencyMs).toBeCloseTo(200);
    });
  });

  describe('trackRateLimitHit', () => {
    it('should track rate limit hits', () => {
      tracker.trackRateLimitHit('claude');
      tracker.trackRateLimitHit('claude');

      const metrics = tracker.getMetrics();
      expect(metrics.byProvider.claude.rateLimitHits).toBe(2);
    });
  });

  describe('getSuccessRate', () => {
    it('should return 100% when no requests', () => {
      expect(tracker.getSuccessRate()).toBe(100);
    });

    it('should calculate overall success rate', () => {
      tracker.trackRequest('claude', true, 100);
      tracker.trackRequest('claude', true, 100);
      tracker.trackRequest('claude', false, 100);

      expect(tracker.getSuccessRate()).toBeCloseTo(66.67, 1);
    });

    it('should calculate provider-specific success rate', () => {
      tracker.trackRequest('claude', true, 100);
      tracker.trackRequest('claude', false, 100);
      tracker.trackRequest('gemini', true, 100);

      expect(tracker.getSuccessRate('claude')).toBe(50);
      expect(tracker.getSuccessRate('gemini')).toBe(100);
    });
  });

  describe('getCacheHitRate', () => {
    it('should return 0% when no requests', () => {
      expect(tracker.getCacheHitRate()).toBe(0);
    });

    it('should calculate cache hit rate', () => {
      tracker.trackRequest('claude', true, 10, undefined, undefined, true);
      tracker.trackRequest('claude', true, 100, undefined, undefined, false);

      expect(tracker.getCacheHitRate()).toBe(50);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      tracker.trackRequest('claude', true, 500, { estimatedCostUsd: 0.01 });
      tracker.trackRateLimitHit('claude');

      tracker.reset();

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.estimatedTotalCostUsd).toBe(0);
      expect(metrics.byProvider.claude.requests).toBe(0);
      expect(metrics.byProvider.claude.rateLimitHits).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('should return formatted summary', () => {
      tracker.trackRequest('claude', true, 500, { estimatedCostUsd: 0.01 }, 'test');
      tracker.trackRequest('gemini', true, 200, { estimatedCostUsd: 0.001 }, 'test');

      const summary = tracker.getSummary();

      expect(summary).toContain('AI Provider Metrics');
      expect(summary).toContain('Total Requests: 2');
      expect(summary).toContain('claude');
      expect(summary).toContain('gemini');
      expect(summary).toContain('By Feature:');
      expect(summary).toContain('test: 2');
    });
  });
});

describe('getCostTracker', () => {
  it('should return singleton instance', () => {
    const tracker1 = getCostTracker();
    const tracker2 = getCostTracker();
    expect(tracker1).toBe(tracker2);
  });
});
