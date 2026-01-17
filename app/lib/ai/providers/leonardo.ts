/**
 * Leonardo AI Provider Adapter
 *
 * Unified adapter for Leonardo image generation
 */

import {
  AIProvider,
  AICapability,
  AIError,
  AIRequest,
  AIResponseForRequest,
  ImageGenerationRequest,
  ImageGenerationResponse,
  AsyncImageGenerationResponse,
  GeneratedImage,
  RateLimitStatus,
  AIUsage,
} from '../types';
import { getRateLimiter } from '../rate-limiter';
import { getCostTracker } from '../cost-tracker';
import { withRetry } from '../retry';

// Leonardo model constants
const LUCIDE_ORIGIN_MODEL_ID = '7b592283-e8a7-4c5a-9ba6-d18c31f258b9';
const LUCIDE_ORIGIN_STYLE_ID = '111dc692-d470-4eec-b791-3475abac4c46';
const BASE_URL = 'https://cloud.leonardo.ai/api/rest/v1';
const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes for image generation
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 2000;

export interface LeonardoConfig {
  apiKey?: string;
  modelId?: string;
  styleId?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultTimeout?: number;
}

export class LeonardoProvider implements AIProvider {
  readonly type = 'leonardo' as const;
  readonly capabilities: AICapability[] = ['image-generation', 'text-to-image'];

  private apiKey: string;
  private modelId: string;
  private styleId: string;
  private defaultWidth: number;
  private defaultHeight: number;
  private defaultTimeout: number;

  constructor(config: LeonardoConfig = {}) {
    this.apiKey = config.apiKey || process.env.LEONARDO_API_KEY || '';
    this.modelId = config.modelId || LUCIDE_ORIGIN_MODEL_ID;
    this.styleId = config.styleId || LUCIDE_ORIGIN_STYLE_ID;
    this.defaultWidth = config.defaultWidth || 768;
    this.defaultHeight = config.defaultHeight || 768;
    this.defaultTimeout = config.defaultTimeout || DEFAULT_TIMEOUT_MS;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getRateLimitStatus(): RateLimitStatus {
    return getRateLimiter().getStatus('leonardo');
  }

  async execute<T extends AIRequest>(request: T): Promise<AIResponseForRequest<T>> {
    if (request.type !== 'image-generation') {
      throw new AIError(
        `Leonardo provider does not support request type: ${request.type}`,
        'INVALID_REQUEST',
        'leonardo'
      );
    }

    const imageRequest = request as ImageGenerationRequest;

    if (imageRequest.async) {
      return this.startGeneration(imageRequest) as Promise<AIResponseForRequest<T>>;
    }

    return this.generateImages(imageRequest) as Promise<AIResponseForRequest<T>>;
  }

  /**
   * Generate images synchronously (start + poll until complete)
   */
  async generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const requestId = request.requestId || `leonardo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();
    const costTracker = getCostTracker();
    const rateLimiter = getRateLimiter();

    if (!this.isAvailable()) {
      throw new AIError(
        'Leonardo API key not configured',
        'PROVIDER_UNAVAILABLE',
        'leonardo'
      );
    }

    // Check rate limit
    if (!rateLimiter.tryAcquire('leonardo')) {
      costTracker.trackRateLimitHit('leonardo');
      const status = rateLimiter.getStatus('leonardo');
      throw new AIError(
        'Rate limit exceeded for Leonardo API',
        'RATE_LIMITED',
        'leonardo',
        429,
        true,
        status.resetAt - Date.now()
      );
    }

    // Normalize dimensions
    const { width, height } = this.normalizeDimensions(
      request.width || this.defaultWidth,
      request.height || this.defaultHeight
    );

    // Start generation with retry
    const generationId = await withRetry(
      () => this.startGenerationAPI(request.prompt, request.negativePrompt, width, height, request.numImages || 1),
      'leonardo',
      {
        maxRetries: 2,
        onRetry: (attempt, error, delay) => {
          console.warn(`Leonardo start retry ${attempt}: ${error.message}, waiting ${delay}ms`);
        },
      }
    );

    // Poll for completion
    const images = await this.pollGeneration(generationId, width, height);

    const latency = Date.now() - startTime;

    const usage: AIUsage = {
      estimatedCostUsd: 0.02 * images.length, // ~$0.02 per image
      raw: { generationId, imageCount: images.length },
    };

    costTracker.trackRequest('leonardo', true, latency, usage, request.metadata?.feature as string, false);

    return {
      type: 'image-generation',
      requestId,
      provider: 'leonardo',
      latencyMs: latency,
      cached: false,
      images,
      generationId,
      usage,
    };
  }

  /**
   * Start generation without waiting (async mode)
   */
  async startGeneration(request: ImageGenerationRequest): Promise<AsyncImageGenerationResponse> {
    const requestId = request.requestId || `leonardo-async-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();
    const rateLimiter = getRateLimiter();

    if (!this.isAvailable()) {
      throw new AIError(
        'Leonardo API key not configured',
        'PROVIDER_UNAVAILABLE',
        'leonardo'
      );
    }

    // Check rate limit
    if (!rateLimiter.tryAcquire('leonardo')) {
      const status = rateLimiter.getStatus('leonardo');
      throw new AIError(
        'Rate limit exceeded for Leonardo API',
        'RATE_LIMITED',
        'leonardo',
        429,
        true,
        status.resetAt - Date.now()
      );
    }

    const { width, height } = this.normalizeDimensions(
      request.width || this.defaultWidth,
      request.height || this.defaultHeight
    );

    const generationId = await this.startGenerationAPI(
      request.prompt,
      request.negativePrompt,
      width,
      height,
      request.numImages || 1
    );

    return {
      type: 'image-generation-async',
      requestId,
      provider: 'leonardo',
      latencyMs: Date.now() - startTime,
      cached: false,
      generationId,
      status: 'pending',
    };
  }

  /**
   * Check generation status
   */
  async checkGeneration(generationId: string): Promise<{
    status: 'pending' | 'complete' | 'failed';
    images?: GeneratedImage[];
    error?: string;
  }> {
    try {
      const response = await fetch(`${BASE_URL}/generations/${generationId}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        return { status: 'failed', error: `API error: ${response.statusText}` };
      }

      const data = await response.json();
      const generationData = data.generations_by_pk || {};
      const generatedImages = generationData.generated_images || [];
      const status = generationData.status;

      if (status === 'FAILED') {
        return { status: 'failed', error: 'Generation failed' };
      }

      if (generatedImages.length > 0) {
        return {
          status: 'complete',
          images: generatedImages.map((img: { url: string; id: string; width?: number; height?: number }) => ({
            url: img.url,
            id: img.id,
            width: img.width || 768,
            height: img.height || 768,
          })),
        };
      }

      return { status: 'pending' };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a generation (cleanup)
   */
  async deleteGeneration(generationId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/generations/${generationId}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok && response.status !== 404) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIError(
        errorData.error || `Delete failed: ${response.statusText}`,
        'UNKNOWN_ERROR',
        'leonardo',
        response.status
      );
    }
  }

  /**
   * Normalize dimensions to Leonardo requirements
   */
  private normalizeDimensions(width: number, height: number): { width: number; height: number } {
    return {
      width: Math.max(32, Math.min(1536, Math.floor(width / 8) * 8)),
      height: Math.max(32, Math.min(1536, Math.floor(height / 8) * 8)),
    };
  }

  /**
   * Start generation via API
   */
  private async startGenerationAPI(
    prompt: string,
    negativePrompt: string | undefined,
    width: number,
    height: number,
    numImages: number
  ): Promise<string> {
    const payload = {
      alchemy: false,
      height,
      width,
      modelId: this.modelId,
      styleUUID: this.styleId,
      prompt,
      num_images: Math.min(Math.max(numImages, 1), 4),
      ...(negativePrompt && { negativePrompt }),
    };

    const response = await fetch(`${BASE_URL}/generations`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorCode = this.mapHttpErrorCode(response.status);

      throw new AIError(
        errorData.error || `Leonardo API error: ${response.statusText}`,
        errorCode,
        'leonardo',
        response.status,
        response.status === 429 || response.status >= 500
      );
    }

    const data = await response.json();
    const generationId = data.sdGenerationJob?.generationId;

    if (!generationId) {
      throw new AIError(
        'Failed to get generation ID from Leonardo API',
        'GENERATION_FAILED',
        'leonardo'
      );
    }

    return generationId;
  }

  /**
   * Poll for generation completion
   */
  private async pollGeneration(
    generationId: string,
    width: number,
    height: number
  ): Promise<GeneratedImage[]> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const result = await this.checkGeneration(generationId);

      if (result.status === 'complete' && result.images) {
        return result.images.map(img => ({
          ...img,
          width: img.width || width,
          height: img.height || height,
        }));
      }

      if (result.status === 'failed') {
        throw new AIError(
          result.error || 'Generation failed',
          'GENERATION_FAILED',
          'leonardo'
        );
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new AIError(
      `Generation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000} seconds`,
      'TIMEOUT',
      'leonardo'
    );
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
      case 402:
        return 'INSUFFICIENT_QUOTA';
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
let leonardoProviderInstance: LeonardoProvider | null = null;

export function getLeonardoProvider(config?: LeonardoConfig): LeonardoProvider {
  if (!leonardoProviderInstance || config) {
    leonardoProviderInstance = new LeonardoProvider(config);
  }
  return leonardoProviderInstance;
}

/**
 * Convenience function for image generation
 */
export async function generateImagesWithLeonardo(
  prompt: string,
  options?: Partial<ImageGenerationRequest>
): Promise<GeneratedImage[]> {
  const provider = getLeonardoProvider();
  const response = await provider.generateImages({
    type: 'image-generation',
    prompt,
    ...options,
  });
  return response.images;
}

/**
 * Convenience function for async image generation
 */
export async function startImageGenerationWithLeonardo(
  prompt: string,
  options?: Partial<ImageGenerationRequest>
): Promise<string> {
  const provider = getLeonardoProvider();
  const response = await provider.startGeneration({
    type: 'image-generation',
    prompt,
    async: true,
    ...options,
  });
  return response.generationId;
}
