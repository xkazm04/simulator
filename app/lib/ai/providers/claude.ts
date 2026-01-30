/**
 * Claude (Anthropic) AI Provider Adapter
 *
 * Unified adapter for Claude text generation via Anthropic API
 */

import {
  AIProvider,
  AICapability,
  AIError,
  AIRequest,
  AIResponseForRequest,
  TextGenerationRequest,
  TextGenerationResponse,
  RateLimitStatus,
  AIUsage,
} from '../types';
import { getRateLimiter } from '../rate-limiter';
import { getCostTracker } from '../cost-tracker';
import { getAICache, AICache } from '../cache';
import { withRetry } from '../retry';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_TIMEOUT_MS = 60000;

export interface ClaudeConfig {
  apiKey?: string;
  model?: string;
  defaultMaxTokens?: number;
  defaultTimeout?: number;
  enableCache?: boolean;
  cacheTtlSeconds?: number;
}

export class ClaudeProvider implements AIProvider {
  readonly type = 'claude' as const;
  readonly capabilities: AICapability[] = ['text-generation'];

  private apiKey: string;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTimeout: number;
  private enableCache: boolean;
  private cacheTtlSeconds: number;
  private cache: AICache;

  constructor(config: ClaudeConfig = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = config.model || DEFAULT_MODEL;
    this.defaultMaxTokens = config.defaultMaxTokens || DEFAULT_MAX_TOKENS;
    this.defaultTimeout = config.defaultTimeout || DEFAULT_TIMEOUT_MS;
    this.enableCache = config.enableCache ?? true;
    this.cacheTtlSeconds = config.cacheTtlSeconds ?? 300; // 5 minutes default
    this.cache = getAICache();
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getRateLimitStatus(): RateLimitStatus {
    return getRateLimiter().getStatus('claude');
  }

  async execute<T extends AIRequest>(request: T): Promise<AIResponseForRequest<T>> {
    if (request.type !== 'text-generation') {
      throw new AIError(
        `Claude provider does not support request type: ${request.type}`,
        'INVALID_REQUEST',
        'claude'
      );
    }

    const textRequest = request as TextGenerationRequest;
    return this.generateText(textRequest) as Promise<AIResponseForRequest<T>>;
  }

  /**
   * Generate text using Claude
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const requestId = request.requestId || `claude-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();
    const costTracker = getCostTracker();
    const rateLimiter = getRateLimiter();

    // Check availability
    if (!this.isAvailable()) {
      throw new AIError(
        'Claude API key not configured',
        'PROVIDER_UNAVAILABLE',
        'claude'
      );
    }

    // Check cache (unless skipped)
    const userId = request.metadata?.userId as string | undefined;
    if (this.enableCache && !request.skipCache) {
      const cacheKey = AICache.generateUserIsolatedKey('claude', this.model, userId, {
        systemPrompt: request.systemPrompt,
        userPrompt: request.userPrompt,
        maxTokens: request.maxTokens || this.defaultMaxTokens,
        temperature: request.temperature,
      });

      const cached = this.cache.get<TextGenerationResponse>(cacheKey);
      if (cached) {
        const latency = Date.now() - startTime;
        costTracker.trackRequest('claude', true, latency, cached.usage, request.metadata?.feature as string, true);
        return {
          ...cached,
          requestId,
          cached: true,
          latencyMs: latency,
        };
      }
    }

    // Check rate limit
    if (!rateLimiter.tryAcquire('claude')) {
      costTracker.trackRateLimitHit('claude');
      const status = rateLimiter.getStatus('claude');
      throw new AIError(
        'Rate limit exceeded for Claude API',
        'RATE_LIMITED',
        'claude',
        429,
        true,
        status.resetAt - Date.now()
      );
    }

    // Execute with retry
    const result = await withRetry(
      () => this.callAnthropicAPI(request),
      'claude',
      {
        maxRetries: 3,
        onRetry: (attempt, error, delay) => {
          console.warn(`Claude API retry ${attempt}: ${error.message}, waiting ${delay}ms`);
          if (error.code === 'RATE_LIMITED') {
            costTracker.trackRateLimitHit('claude');
          }
        },
      }
    );

    const latency = Date.now() - startTime;

    // Build response
    const response: TextGenerationResponse = {
      type: 'text-generation',
      requestId,
      provider: 'claude',
      latencyMs: latency,
      cached: false,
      text: result.text,
      usage: result.usage,
    };

    // Track metrics
    costTracker.trackRequest('claude', true, latency, result.usage, request.metadata?.feature as string, false);

    // Cache response
    if (this.enableCache && !request.skipCache) {
      const cacheKey = AICache.generateUserIsolatedKey('claude', this.model, userId, {
        systemPrompt: request.systemPrompt,
        userPrompt: request.userPrompt,
        maxTokens: request.maxTokens || this.defaultMaxTokens,
        temperature: request.temperature,
      });
      this.cache.set(cacheKey, response, this.cacheTtlSeconds);
    }

    return response;
  }

  /**
   * Make raw API call to Anthropic
   */
  private async callAnthropicAPI(
    request: TextGenerationRequest
  ): Promise<{ text: string; usage: AIUsage }> {
    const controller = new AbortController();
    const timeout = request.timeout || this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxTokens || this.defaultMaxTokens,
          ...(request.temperature !== undefined && { temperature: request.temperature }),
          ...(request.systemPrompt && { system: request.systemPrompt }),
          messages: [
            {
              role: 'user',
              content: request.userPrompt,
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const errorCode = this.mapHttpErrorCode(response.status);

        // Check for rate limit headers
        const retryAfter = response.headers.get('retry-after');
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;

        if (response.status === 429) {
          getRateLimiter().handleRateLimitResponse('claude', retryAfterMs ? retryAfterMs / 1000 : undefined);
        }

        throw new AIError(
          `Anthropic API error: ${response.status} - ${errorText}`,
          errorCode,
          'claude',
          response.status,
          response.status === 429 || response.status >= 500,
          retryAfterMs
        );
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      // Extract usage info
      const usage: AIUsage = {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        raw: data.usage,
      };

      // Calculate estimated cost
      const costEstimate = getCostTracker().estimateCost(
        'claude',
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        0,
        this.model
      );
      usage.estimatedCostUsd = costEstimate.estimatedCostUsd;

      return { text, usage };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AIError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIError(
          `Claude API request timed out after ${timeout}ms`,
          'TIMEOUT',
          'claude',
          undefined,
          true
        );
      }

      throw new AIError(
        error instanceof Error ? error.message : 'Unknown error calling Claude API',
        'NETWORK_ERROR',
        'claude',
        undefined,
        true
      );
    }
  }

  /**
   * Map HTTP status codes to AIErrorCode
   */
  private mapHttpErrorCode(status: number): import('../types').AIErrorCode {
    switch (status) {
      case 400:
        return 'INVALID_REQUEST';
      case 401:
        return 'AUTHENTICATION_FAILED';
      case 403:
        return 'CONTENT_FILTERED';
      case 429:
        return 'RATE_LIMITED';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'NETWORK_ERROR';
      default:
        return 'UNKNOWN_ERROR';
    }
  }
}

// Singleton instance
let claudeProviderInstance: ClaudeProvider | null = null;

export function getClaudeProvider(config?: ClaudeConfig): ClaudeProvider {
  if (!claudeProviderInstance || config) {
    claudeProviderInstance = new ClaudeProvider(config);
  }
  return claudeProviderInstance;
}

/**
 * Convenience function for simple text generation
 */
export async function generateTextWithClaude(
  userPrompt: string,
  systemPrompt?: string,
  options?: Partial<TextGenerationRequest>
): Promise<string> {
  const provider = getClaudeProvider();
  const response = await provider.generateText({
    type: 'text-generation',
    userPrompt,
    systemPrompt,
    ...options,
  });
  return response.text;
}
