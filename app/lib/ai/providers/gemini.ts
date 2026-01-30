/**
 * Gemini (Google) AI Provider Adapter
 *
 * Unified adapter for Gemini text and vision capabilities
 */

import { GoogleGenAI } from '@google/genai';
import {
  AIProvider,
  AICapability,
  AIError,
  AIRequest,
  AIResponseForRequest,
  TextGenerationRequest,
  TextGenerationResponse,
  VisionRequest,
  VisionResponse,
  RateLimitStatus,
  AIUsage,
} from '../types';
import { getRateLimiter } from '../rate-limiter';
import { getCostTracker } from '../cost-tracker';
import { getAICache, AICache } from '../cache';
import { withRetry } from '../retry';

// Default models
const DEFAULT_TEXT_MODEL = 'gemini-3-flash-preview';
const DEFAULT_VISION_MODEL = 'gemini-3-flash-preview';
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TIMEOUT_MS = 60000;

export interface GeminiConfig {
  apiKey?: string;
  textModel?: string;
  visionModel?: string;
  defaultMaxTokens?: number;
  defaultTimeout?: number;
  enableCache?: boolean;
  cacheTtlSeconds?: number;
}

export class GeminiProvider implements AIProvider {
  readonly type = 'gemini' as const;
  readonly capabilities: AICapability[] = ['text-generation', 'vision'];

  private apiKey: string;
  private client: GoogleGenAI | null = null;
  private textModel: string;
  private visionModel: string;
  private defaultMaxTokens: number;
  private defaultTimeout: number;
  private enableCache: boolean;
  private cacheTtlSeconds: number;
  private cache: AICache;

  constructor(config: GeminiConfig = {}) {
    this.apiKey = config.apiKey || process.env.GOOGLE_AI_API_KEY || '';
    this.textModel = config.textModel || DEFAULT_TEXT_MODEL;
    this.visionModel = config.visionModel || DEFAULT_VISION_MODEL;
    this.defaultMaxTokens = config.defaultMaxTokens || DEFAULT_MAX_TOKENS;
    this.defaultTimeout = config.defaultTimeout || DEFAULT_TIMEOUT_MS;
    this.enableCache = config.enableCache ?? true;
    this.cacheTtlSeconds = config.cacheTtlSeconds ?? 300;
    this.cache = getAICache();
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      if (!this.apiKey) {
        throw new AIError(
          'GOOGLE_AI_API_KEY not configured',
          'PROVIDER_UNAVAILABLE',
          'gemini'
        );
      }
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getRateLimitStatus(): RateLimitStatus {
    return getRateLimiter().getStatus('gemini');
  }

  async execute<T extends AIRequest>(request: T): Promise<AIResponseForRequest<T>> {
    switch (request.type) {
      case 'text-generation':
        return this.generateText(request as TextGenerationRequest) as Promise<AIResponseForRequest<T>>;
      case 'vision':
        return this.analyzeImage(request as VisionRequest) as Promise<AIResponseForRequest<T>>;
      default:
        throw new AIError(
          `Gemini provider does not support request type: ${(request as AIRequest).type}`,
          'INVALID_REQUEST',
          'gemini'
        );
    }
  }

  /**
   * Generate text using Gemini
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const requestId = request.requestId || `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();
    const costTracker = getCostTracker();
    const rateLimiter = getRateLimiter();

    if (!this.isAvailable()) {
      throw new AIError(
        'Gemini API key not configured',
        'PROVIDER_UNAVAILABLE',
        'gemini'
      );
    }

    // Check cache
    const userId = request.metadata?.userId as string | undefined;
    if (this.enableCache && !request.skipCache) {
      const cacheKey = AICache.generateUserIsolatedKey('gemini', this.textModel, userId, {
        systemPrompt: request.systemPrompt,
        userPrompt: request.userPrompt,
        maxTokens: request.maxTokens || this.defaultMaxTokens,
        temperature: request.temperature,
      });

      const cached = this.cache.get<TextGenerationResponse>(cacheKey);
      if (cached) {
        const latency = Date.now() - startTime;
        costTracker.trackRequest('gemini', true, latency, cached.usage, request.metadata?.feature as string, true);
        return {
          ...cached,
          requestId,
          cached: true,
          latencyMs: latency,
        };
      }
    }

    // Check rate limit
    if (!rateLimiter.tryAcquire('gemini')) {
      costTracker.trackRateLimitHit('gemini');
      const status = rateLimiter.getStatus('gemini');
      throw new AIError(
        'Rate limit exceeded for Gemini API',
        'RATE_LIMITED',
        'gemini',
        429,
        true,
        status.resetAt - Date.now()
      );
    }

    // Execute with retry
    const result = await withRetry(
      () => this.callGeminiTextAPI(request),
      'gemini',
      {
        maxRetries: 3,
        onRetry: (attempt, error, delay) => {
          console.warn(`Gemini API retry ${attempt}: ${error.message}, waiting ${delay}ms`);
          if (error.code === 'RATE_LIMITED') {
            costTracker.trackRateLimitHit('gemini');
          }
        },
      }
    );

    const latency = Date.now() - startTime;

    const response: TextGenerationResponse = {
      type: 'text-generation',
      requestId,
      provider: 'gemini',
      latencyMs: latency,
      cached: false,
      text: result.text,
      usage: result.usage,
    };

    costTracker.trackRequest('gemini', true, latency, result.usage, request.metadata?.feature as string, false);

    // Cache response
    if (this.enableCache && !request.skipCache) {
      const cacheKey = AICache.generateUserIsolatedKey('gemini', this.textModel, userId, {
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
   * Analyze image using Gemini Vision
   */
  async analyzeImage(request: VisionRequest): Promise<VisionResponse> {
    const requestId = request.requestId || `gemini-vision-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();
    const costTracker = getCostTracker();
    const rateLimiter = getRateLimiter();

    if (!this.isAvailable()) {
      throw new AIError(
        'Gemini API key not configured',
        'PROVIDER_UNAVAILABLE',
        'gemini'
      );
    }

    // Check cache (hash image data for key)
    const userId = request.metadata?.userId as string | undefined;
    if (this.enableCache && !request.skipCache) {
      const cacheKey = AICache.generateUserIsolatedKey('gemini-vision', this.visionModel, userId, {
        imageHash: this.hashImageData(request.imageDataUrl),
        prompt: request.prompt,
        systemInstruction: request.systemInstruction,
      });

      const cached = this.cache.get<VisionResponse>(cacheKey);
      if (cached) {
        const latency = Date.now() - startTime;
        costTracker.trackRequest('gemini', true, latency, cached.usage, request.metadata?.feature as string, true);
        return {
          ...cached,
          requestId,
          cached: true,
          latencyMs: latency,
        };
      }
    }

    // Check rate limit
    if (!rateLimiter.tryAcquire('gemini')) {
      costTracker.trackRateLimitHit('gemini');
      const status = rateLimiter.getStatus('gemini');
      throw new AIError(
        'Rate limit exceeded for Gemini API',
        'RATE_LIMITED',
        'gemini',
        429,
        true,
        status.resetAt - Date.now()
      );
    }

    // Execute with retry
    const result = await withRetry(
      () => this.callGeminiVisionAPI(request),
      'gemini',
      {
        maxRetries: 3,
        onRetry: (attempt, error, delay) => {
          console.warn(`Gemini Vision retry ${attempt}: ${error.message}, waiting ${delay}ms`);
        },
      }
    );

    const latency = Date.now() - startTime;

    const response: VisionResponse = {
      type: 'vision',
      requestId,
      provider: 'gemini',
      latencyMs: latency,
      cached: false,
      text: result.text,
      usage: result.usage,
    };

    costTracker.trackRequest('gemini', true, latency, result.usage, request.metadata?.feature as string, false);

    // Cache response
    if (this.enableCache && !request.skipCache) {
      const cacheKey = AICache.generateUserIsolatedKey('gemini-vision', this.visionModel, userId, {
        imageHash: this.hashImageData(request.imageDataUrl),
        prompt: request.prompt,
        systemInstruction: request.systemInstruction,
      });
      this.cache.set(cacheKey, response, this.cacheTtlSeconds);
    }

    return response;
  }

  /**
   * Analyze multiple images using Gemini Vision
   * Used for comparing poster variations or other multi-image analysis
   */
  async analyzeMultipleImages(request: {
    type: 'vision';
    imageDataUrls: string[];
    prompt: string;
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
    metadata?: { feature?: string; userId?: string; [key: string]: unknown };
  }): Promise<VisionResponse> {
    const requestId = `gemini-multi-vision-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();
    const costTracker = getCostTracker();
    const rateLimiter = getRateLimiter();

    if (!this.isAvailable()) {
      throw new AIError(
        'Gemini API key not configured',
        'PROVIDER_UNAVAILABLE',
        'gemini'
      );
    }

    if (request.imageDataUrls.length === 0) {
      throw new AIError(
        'No images provided for analysis',
        'INVALID_REQUEST',
        'gemini'
      );
    }

    // Check rate limit
    if (!rateLimiter.tryAcquire('gemini')) {
      costTracker.trackRateLimitHit('gemini');
      const status = rateLimiter.getStatus('gemini');
      throw new AIError(
        'Rate limit exceeded for Gemini API',
        'RATE_LIMITED',
        'gemini',
        429,
        true,
        status.resetAt - Date.now()
      );
    }

    // Execute with retry
    const result = await withRetry(
      () => this.callGeminiMultiVisionAPI(request),
      'gemini',
      {
        maxRetries: 3,
        onRetry: (attempt, error, delay) => {
          console.warn(`Gemini Multi-Vision retry ${attempt}: ${error.message}, waiting ${delay}ms`);
        },
      }
    );

    const latency = Date.now() - startTime;

    const response: VisionResponse = {
      type: 'vision',
      requestId,
      provider: 'gemini',
      latencyMs: latency,
      cached: false,
      text: result.text,
      usage: result.usage,
    };

    costTracker.trackRequest('gemini', true, latency, result.usage, request.metadata?.feature as string, false);

    return response;
  }

  /**
   * Call Gemini Vision API with multiple images
   */
  private async callGeminiMultiVisionAPI(request: {
    imageDataUrls: string[];
    prompt: string;
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string; usage: AIUsage }> {
    try {
      const client = this.getClient();

      // Build parts array with all images first, then the prompt
      const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

      // Add all images
      for (const imageDataUrl of request.imageDataUrls) {
        parts.push(this.parseImageDataUrl(imageDataUrl));
      }

      // Add the text prompt
      parts.push({ text: request.prompt });

      const response = await client.models.generateContent({
        model: this.visionModel,
        contents: [{
          role: 'user',
          parts,
        }],
        config: {
          temperature: request.temperature ?? 0.3,
          maxOutputTokens: request.maxTokens || this.defaultMaxTokens,
          ...(request.systemInstruction && { systemInstruction: request.systemInstruction }),
        },
      });

      const text = response.text;
      if (!text) {
        throw new AIError(
          'No text response from Gemini Multi-Vision',
          'GENERATION_FAILED',
          'gemini'
        );
      }

      // Estimate usage (multiple images add more tokens)
      const imageTokenEstimate = request.imageDataUrls.length * 1000;
      const usage: AIUsage = {
        inputTokens: Math.ceil((request.prompt.length + imageTokenEstimate) / 4),
        outputTokens: Math.ceil(text.length / 4),
      };

      const costEstimate = getCostTracker().estimateCost(
        'gemini',
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        0,
        this.visionModel
      );
      usage.estimatedCostUsd = costEstimate.estimatedCostUsd;

      return { text, usage };
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }

      throw new AIError(
        error instanceof Error ? error.message : 'Unknown error calling Gemini Multi-Vision API',
        'NETWORK_ERROR',
        'gemini',
        undefined,
        true
      );
    }
  }

  /**
   * Call Gemini text API
   */
  private async callGeminiTextAPI(
    request: TextGenerationRequest
  ): Promise<{ text: string; usage: AIUsage }> {
    try {
      const client = this.getClient();

      const response = await client.models.generateContent({
        model: this.textModel,
        contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
        config: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens || this.defaultMaxTokens,
          ...(request.systemPrompt && { systemInstruction: request.systemPrompt }),
        },
      });

      const text = response.text;
      if (!text) {
        throw new AIError(
          'No text response from Gemini',
          'GENERATION_FAILED',
          'gemini'
        );
      }

      // Estimate usage (Gemini doesn't always return token counts)
      const usage: AIUsage = {
        inputTokens: Math.ceil(request.userPrompt.length / 4), // rough estimate
        outputTokens: Math.ceil(text.length / 4),
      };

      const costEstimate = getCostTracker().estimateCost(
        'gemini',
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        0,
        this.textModel
      );
      usage.estimatedCostUsd = costEstimate.estimatedCostUsd;

      return { text, usage };
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }

      throw new AIError(
        error instanceof Error ? error.message : 'Unknown error calling Gemini API',
        'NETWORK_ERROR',
        'gemini',
        undefined,
        true
      );
    }
  }

  /**
   * Call Gemini Vision API
   */
  private async callGeminiVisionAPI(
    request: VisionRequest
  ): Promise<{ text: string; usage: AIUsage }> {
    try {
      const client = this.getClient();
      const imagePart = this.parseImageDataUrl(request.imageDataUrl);

      const response = await client.models.generateContent({
        model: this.visionModel,
        contents: [{
          role: 'user',
          parts: [
            imagePart,
            { text: request.prompt },
          ],
        }],
        config: {
          temperature: request.temperature ?? 0.3,
          maxOutputTokens: request.maxTokens || this.defaultMaxTokens,
          ...(request.systemInstruction && { systemInstruction: request.systemInstruction }),
        },
      });

      const text = response.text;
      if (!text) {
        throw new AIError(
          'No text response from Gemini Vision',
          'GENERATION_FAILED',
          'gemini'
        );
      }

      const usage: AIUsage = {
        inputTokens: Math.ceil((request.prompt.length + 1000) / 4), // Image adds ~1000 tokens
        outputTokens: Math.ceil(text.length / 4),
      };

      const costEstimate = getCostTracker().estimateCost(
        'gemini',
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        0,
        this.visionModel
      );
      usage.estimatedCostUsd = costEstimate.estimatedCostUsd;

      return { text, usage };
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }

      throw new AIError(
        error instanceof Error ? error.message : 'Unknown error calling Gemini Vision API',
        'NETWORK_ERROR',
        'gemini',
        undefined,
        true
      );
    }
  }

  /**
   * Parse data URL into Gemini image part format
   */
  private parseImageDataUrl(dataUrl: string): { inlineData: { mimeType: string; data: string } } {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new AIError(
        'Invalid image data URL format',
        'INVALID_REQUEST',
        'gemini'
      );
    }

    const [, mimeType, data] = matches;
    return {
      inlineData: {
        mimeType,
        data,
      },
    };
  }

  /**
   * Create a simple hash for image data (for caching)
   */
  private hashImageData(dataUrl: string): string {
    // Simple hash - take first and last 100 chars + length
    const len = dataUrl.length;
    return `${dataUrl.slice(0, 100)}-${len}-${dataUrl.slice(-100)}`;
  }
}

// Singleton instance
let geminiProviderInstance: GeminiProvider | null = null;

export function getGeminiProvider(config?: GeminiConfig): GeminiProvider {
  if (!geminiProviderInstance || config) {
    geminiProviderInstance = new GeminiProvider(config);
  }
  return geminiProviderInstance;
}

/**
 * Convenience function for text generation
 */
export async function generateTextWithGemini(
  userPrompt: string,
  systemPrompt?: string,
  options?: Partial<TextGenerationRequest>
): Promise<string> {
  const provider = getGeminiProvider();
  const response = await provider.generateText({
    type: 'text-generation',
    userPrompt,
    systemPrompt,
    ...options,
  });
  return response.text;
}

/**
 * Convenience function for image analysis
 */
export async function analyzeImageWithGemini(
  imageDataUrl: string,
  prompt: string,
  options?: Partial<VisionRequest>
): Promise<string> {
  const provider = getGeminiProvider();
  const response = await provider.analyzeImage({
    type: 'vision',
    imageDataUrl,
    prompt,
    ...options,
  });
  return response.text;
}
