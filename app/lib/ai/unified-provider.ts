/**
 * Unified AI Provider
 *
 * Single entry point for all AI operations with automatic provider selection,
 * fallback strategies, and cross-cutting concerns (caching, rate limiting, metrics)
 */

import {
  AIProvider,
  AIProviderType,
  AICapability,
  AIRequest,
  AIResponse,
  AIError,
  TextGenerationRequest,
  TextGenerationResponse,
  VisionRequest,
  VisionResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  AsyncImageGenerationResponse,
  AIMetrics,
} from './types';
import { getClaudeProvider, ClaudeConfig } from './providers/claude';
import { getGeminiProvider, GeminiConfig } from './providers/gemini';
import { getLeonardoProvider, LeonardoConfig } from './providers/leonardo';
import { getCostTracker } from './cost-tracker';
import { getAICache } from './cache';
import { getRateLimiter } from './rate-limiter';
import { getCircuitBreaker, getAllCircuitStatus, type CircuitStatus } from './circuit-breaker';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface UnifiedProviderConfig {
  claude?: ClaudeConfig;
  gemini?: GeminiConfig;
  leonardo?: LeonardoConfig;
  /** Fallback chains for each capability */
  fallbacks?: {
    'text-generation'?: AIProviderType[];
    'vision'?: AIProviderType[];
    'image-generation'?: AIProviderType[];
  };
  /** Enable mock fallback when all providers fail */
  enableMockFallback?: boolean;
}

// Default fallback chains
const DEFAULT_FALLBACKS: Record<AICapability, AIProviderType[]> = {
  'text-generation': ['claude', 'gemini'],
  'vision': ['gemini'],
  'image-generation': ['leonardo'],
  'text-to-image': ['leonardo'],
};

// ============================================================================
// UNIFIED PROVIDER
// ============================================================================

export class UnifiedAIProvider {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private fallbacks: Record<string, AIProviderType[]>;
  private enableMockFallback: boolean;

  constructor(config: UnifiedProviderConfig = {}) {
    // Initialize providers
    this.providers.set('claude', getClaudeProvider(config.claude));
    this.providers.set('gemini', getGeminiProvider(config.gemini));
    this.providers.set('leonardo', getLeonardoProvider(config.leonardo));

    // Set fallback chains
    this.fallbacks = {
      ...DEFAULT_FALLBACKS,
      ...config.fallbacks,
    };

    this.enableMockFallback = config.enableMockFallback ?? (process.env.NODE_ENV === 'development');
  }

  /**
   * Get a specific provider
   */
  getProvider(type: AIProviderType): AIProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Check if a specific provider is available
   * Considers both API key availability and circuit breaker state
   */
  isProviderAvailable(type: AIProviderType): boolean {
    const provider = this.providers.get(type);
    if (!provider?.isAvailable()) {
      return false;
    }

    // Check circuit breaker - if circuit is open, provider is not available
    const circuitBreaker = getCircuitBreaker(type);
    return circuitBreaker.canExecute();
  }

  /**
   * Get list of available providers for a capability
   */
  getAvailableProviders(capability: AICapability): AIProviderType[] {
    return Array.from(this.providers.entries())
      .filter(([, provider]) => provider.isAvailable() && provider.capabilities.includes(capability))
      .map(([type]) => type);
  }

  /**
   * Execute a text generation request
   */
  async generateText(
    request: Omit<TextGenerationRequest, 'type'>,
    preferredProvider?: AIProviderType
  ): Promise<TextGenerationResponse> {
    const fullRequest: TextGenerationRequest = { ...request, type: 'text-generation' };
    return this.executeWithFallback(fullRequest, 'text-generation', preferredProvider) as Promise<TextGenerationResponse>;
  }

  /**
   * Execute a vision request
   */
  async analyzeImage(
    request: Omit<VisionRequest, 'type'>,
    preferredProvider?: AIProviderType
  ): Promise<VisionResponse> {
    const fullRequest: VisionRequest = { ...request, type: 'vision' };
    return this.executeWithFallback(fullRequest, 'vision', preferredProvider) as Promise<VisionResponse>;
  }

  /**
   * Execute an image generation request
   */
  async generateImages(
    request: Omit<ImageGenerationRequest, 'type'>,
    preferredProvider?: AIProviderType
  ): Promise<ImageGenerationResponse | AsyncImageGenerationResponse> {
    const fullRequest: ImageGenerationRequest = { ...request, type: 'image-generation' };
    return this.executeWithFallback(fullRequest, 'image-generation', preferredProvider) as Promise<ImageGenerationResponse | AsyncImageGenerationResponse>;
  }

  /**
   * Execute with automatic fallback chain
   */
  private async executeWithFallback(
    request: AIRequest,
    capability: AICapability,
    preferredProvider?: AIProviderType
  ): Promise<AIResponse> {
    // Build provider chain
    const fallbackChain = this.fallbacks[capability] || [];
    const providerOrder: AIProviderType[] = [];

    // Add preferred provider first if specified and available
    if (preferredProvider && this.isProviderAvailable(preferredProvider)) {
      providerOrder.push(preferredProvider);
    }

    // Add fallback providers
    for (const provider of fallbackChain) {
      if (!providerOrder.includes(provider) && this.isProviderAvailable(provider)) {
        providerOrder.push(provider);
      }
    }

    if (providerOrder.length === 0) {
      throw new AIError(
        `No available providers for capability: ${capability}`,
        'PROVIDER_UNAVAILABLE',
        preferredProvider || 'claude'
      );
    }

    // Try each provider in order
    const errors: AIError[] = [];

    for (const providerType of providerOrder) {
      const provider = this.providers.get(providerType);
      if (!provider) continue;

      const circuitBreaker = getCircuitBreaker(providerType);

      // Double-check circuit breaker (state may have changed)
      if (!circuitBreaker.canExecute()) {
        console.warn(`Provider ${providerType} circuit is open, skipping...`);
        continue;
      }

      try {
        const response = await provider.execute(request);
        // Record success with circuit breaker
        circuitBreaker.recordSuccess();
        return response;
      } catch (error) {
        // Record failure with circuit breaker
        circuitBreaker.recordFailure();

        const aiError = error instanceof AIError
          ? error
          : new AIError(
              error instanceof Error ? error.message : 'Unknown error',
              'UNKNOWN_ERROR',
              providerType
            );

        errors.push(aiError);
        console.warn(`Provider ${providerType} failed: ${aiError.message}, trying next...`);

        // Don't try next provider for non-retryable errors (except rate limit which may be transient)
        if (!aiError.retryable && aiError.code !== 'RATE_LIMITED') {
          break;
        }
      }
    }

    // All providers failed - throw the most relevant error
    const lastError = errors[errors.length - 1];
    throw lastError || new AIError(
      `All providers failed for capability: ${capability}`,
      'PROVIDER_UNAVAILABLE',
      preferredProvider || 'claude'
    );
  }

  /**
   * Get metrics for all providers
   */
  getMetrics(): AIMetrics {
    return getCostTracker().getMetrics();
  }

  /**
   * Get metrics summary as string
   */
  getMetricsSummary(): string {
    return getCostTracker().getSummary();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return getAICache().getStats();
  }

  /**
   * Get rate limit status for all providers
   */
  getRateLimitStatus(): Record<AIProviderType, import('./types').RateLimitStatus> {
    const limiter = getRateLimiter();
    return {
      claude: limiter.getStatus('claude'),
      gemini: limiter.getStatus('gemini'),
      leonardo: limiter.getStatus('leonardo'),
    };
  }

  /**
   * Get circuit breaker status for all providers
   */
  getCircuitBreakerStatus(): Record<AIProviderType, CircuitStatus> {
    return getAllCircuitStatus();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    getAICache().clear();
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    getCostTracker().reset();
  }
}

// ============================================================================
// SINGLETON & CONVENIENCE FUNCTIONS
// ============================================================================

let unifiedProviderInstance: UnifiedAIProvider | null = null;

export function getUnifiedProvider(config?: UnifiedProviderConfig): UnifiedAIProvider {
  if (!unifiedProviderInstance || config) {
    unifiedProviderInstance = new UnifiedAIProvider(config);
  }
  return unifiedProviderInstance;
}

/**
 * Convenience: Generate text with automatic provider selection
 */
export async function generateText(
  userPrompt: string,
  systemPrompt?: string,
  options?: Partial<Omit<TextGenerationRequest, 'type' | 'userPrompt' | 'systemPrompt'>>
): Promise<string> {
  const provider = getUnifiedProvider();
  const response = await provider.generateText({
    userPrompt,
    systemPrompt,
    ...options,
  });
  return response.text;
}

/**
 * Convenience: Analyze image with automatic provider selection
 */
export async function analyzeImage(
  imageDataUrl: string,
  prompt: string,
  options?: Partial<Omit<VisionRequest, 'type' | 'imageDataUrl' | 'prompt'>>
): Promise<string> {
  const provider = getUnifiedProvider();
  const response = await provider.analyzeImage({
    imageDataUrl,
    prompt,
    ...options,
  });
  return response.text;
}

/**
 * Convenience: Generate images with automatic provider selection
 */
export async function generateImages(
  prompt: string,
  options?: Partial<Omit<ImageGenerationRequest, 'type' | 'prompt'>>
): Promise<import('./types').GeneratedImage[]> {
  const provider = getUnifiedProvider();
  const response = await provider.generateImages({
    prompt,
    ...options,
  });
  if (response.type === 'image-generation-async') {
    throw new AIError(
      'Async generation started - use startImageGeneration for async mode',
      'INVALID_REQUEST',
      'leonardo'
    );
  }
  return response.images;
}
