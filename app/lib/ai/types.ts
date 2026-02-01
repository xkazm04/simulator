/**
 * Unified AI Provider Types
 *
 * Common types and interfaces for all AI providers (Claude, Gemini, Leonardo)
 */

// ============================================================================
// PROVIDER IDENTIFICATION
// ============================================================================

export type AIProviderType = 'claude' | 'gemini' | 'leonardo';

export type AICapability =
  | 'text-generation'
  | 'vision'
  | 'image-generation'
  | 'text-to-image';

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface BaseAIRequest {
  /** Optional request ID for tracking */
  requestId?: string;
  /** Override default timeout (ms) */
  timeout?: number;
  /** Skip cache lookup */
  skipCache?: boolean;
  /** Metadata for cost tracking */
  metadata?: {
    feature?: string;
    userId?: string;
    [key: string]: unknown;
  };
}

export interface TextGenerationRequest extends BaseAIRequest {
  type: 'text-generation';
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface VisionRequest extends BaseAIRequest {
  type: 'vision';
  imageDataUrl: string;
  prompt: string;
  systemInstruction?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface MultiImageVisionRequest extends BaseAIRequest {
  type: 'vision';
  imageDataUrls: string[];
  prompt: string;
  systemInstruction?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ImageGenerationRequest extends BaseAIRequest {
  type: 'image-generation';
  prompt: string;
  width?: number;
  height?: number;
  numImages?: number;
  /** If true, start async and return generation ID */
  async?: boolean;
}

export type AIRequest = TextGenerationRequest | VisionRequest | ImageGenerationRequest;

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface BaseAIResponse {
  /** Request ID (echoed from request or generated) */
  requestId: string;
  /** Provider that handled the request */
  provider: AIProviderType;
  /** Time taken in ms */
  latencyMs: number;
  /** Whether result came from cache */
  cached: boolean;
  /** Usage/cost tracking info */
  usage?: AIUsage;
}

export interface TextGenerationResponse extends BaseAIResponse {
  type: 'text-generation';
  text: string;
}

export interface VisionResponse extends BaseAIResponse {
  type: 'vision';
  text: string;
}

export interface ImageGenerationResponse extends BaseAIResponse {
  type: 'image-generation';
  images: GeneratedImage[];
  generationId: string;
}

export interface AsyncImageGenerationResponse extends BaseAIResponse {
  type: 'image-generation-async';
  generationId: string;
  status: 'pending';
}

export interface GeneratedImage {
  url: string;
  id: string;
  width: number;
  height: number;
}

export type AIResponse =
  | TextGenerationResponse
  | VisionResponse
  | ImageGenerationResponse
  | AsyncImageGenerationResponse;

// ============================================================================
// ERROR TYPES
// ============================================================================

export type AIErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'AUTHENTICATION_FAILED'
  | 'INSUFFICIENT_QUOTA'
  | 'CONTENT_FILTERED'
  | 'GENERATION_FAILED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly provider: AIProviderType,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'AIError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      provider: this.provider,
      statusCode: this.statusCode,
      retryable: this.retryable,
      retryAfterMs: this.retryAfterMs,
    };
  }
}

// ============================================================================
// USAGE & COST TRACKING
// ============================================================================

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /** Estimated cost in USD */
  estimatedCostUsd?: number;
  /** Provider-specific data */
  raw?: Record<string, unknown>;
}

export interface CostEstimate {
  provider: AIProviderType;
  model: string;
  inputTokens: number;
  outputTokens: number;
  imageCount?: number;
  estimatedCostUsd: number;
}

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

export interface AIProviderConfig {
  /** Provider identifier */
  provider: AIProviderType;
  /** Whether provider is enabled */
  enabled: boolean;
  /** API key (if required) */
  apiKey?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Rate limit: requests per minute */
  rateLimit?: number;
  /** Default timeout in ms */
  defaultTimeout?: number;
  /** Enable caching */
  cacheEnabled?: boolean;
  /** Cache TTL in seconds */
  cacheTtlSeconds?: number;
}

export interface RetryConfig {
  /** Maximum retry attempts */
  maxRetries: number;
  /** Initial backoff delay in ms */
  initialDelayMs: number;
  /** Maximum backoff delay in ms */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Error codes that should trigger retry */
  retryableCodes: AIErrorCode[];
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

export interface AIProvider {
  /** Provider type identifier */
  readonly type: AIProviderType;

  /** Capabilities this provider supports */
  readonly capabilities: AICapability[];

  /** Check if provider is available (has API key, etc.) */
  isAvailable(): boolean;

  /** Execute a request */
  execute<T extends AIRequest>(request: T): Promise<AIResponseForRequest<T>>;

  /** Get current rate limit status */
  getRateLimitStatus(): RateLimitStatus;
}

// Type helper: maps request type to response type
export type AIResponseForRequest<T extends AIRequest> =
  T extends TextGenerationRequest ? TextGenerationResponse :
  T extends VisionRequest ? VisionResponse :
  T extends ImageGenerationRequest ? (ImageGenerationResponse | AsyncImageGenerationResponse) :
  never;

export interface RateLimitStatus {
  /** Remaining requests in current window */
  remaining: number;
  /** Total limit */
  limit: number;
  /** When limit resets (Unix timestamp ms) */
  resetAt: number;
  /** Whether currently rate limited */
  isLimited: boolean;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
}

// ============================================================================
// METRICS & OBSERVABILITY
// ============================================================================

export interface AIMetrics {
  /** Total requests made */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Requests served from cache */
  cacheHits: number;
  /** Average latency in ms */
  avgLatencyMs: number;
  /** Requests by provider */
  byProvider: Record<AIProviderType, ProviderMetrics>;
  /** Requests by feature */
  byFeature: Record<string, number>;
  /** Estimated total cost USD */
  estimatedTotalCostUsd: number;
}

export interface ProviderMetrics {
  requests: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  rateLimitHits: number;
  estimatedCostUsd: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
}
