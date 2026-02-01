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
import { truncatePromptForLeonardo } from '../promptTruncation';

// Leonardo model constants
const LUCIDE_ORIGIN_MODEL_ID = '7b592283-e8a7-4c5a-9ba6-d18c31f258b9';
const LUCIDE_ORIGIN_STYLE_ID = '111dc692-d470-4eec-b791-3475abac4c46';
// Leonardo Diffusion XL - recommended for canvas inpainting (Lucide Origin doesn't support it)
const LEONARDO_DIFFUSION_XL_MODEL_ID = '1e60896f-3c26-4296-8ecc-53e2afecc132';
const BASE_URL = 'https://cloud.leonardo.ai/api/rest/v1';
const BASE_URL_V2 = 'https://cloud.leonardo.ai/api/rest/v2';
const SEEDANCE_MODEL_ID = 'seedance-1.0-pro-fast';
const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes for image generation
const MAX_POLL_ATTEMPTS = 60;
const MAX_VIDEO_POLL_ATTEMPTS = 120; // Videos take longer - up to 4 minutes
const POLL_INTERVAL_MS = 2000;

// Video generation types
export interface VideoGenerationRequest {
  initImageId: string;
  prompt: string;
  duration?: 4 | 6 | 8;
}

export interface VideoGenerationResult {
  status: 'pending' | 'complete' | 'failed';
  videoUrl?: string;
  error?: string;
}

// Canvas inpainting types
export interface CanvasInpaintingRequest {
  canvasInitId: string;
  canvasMaskId: string;
  prompt: string;
  initStrength?: number;  // 0-1, default 0.15 (lower = more change)
  width: number;
  height: number;
}

export interface CanvasInpaintingResult {
  status: 'pending' | 'complete' | 'failed';
  imageUrl?: string;
  error?: string;
}

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
      () => this.startGenerationAPI(request.prompt, width, height, request.numImages || 1),
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

  // ============================================================================
  // VIDEO GENERATION (Seedance 1.0)
  // ============================================================================

  /**
   * Upload an image to Leonardo for use as init/start frame
   * Returns the init image ID for use in video generation
   */
  async uploadInitImage(imageBuffer: Buffer, extension: string = 'jpg'): Promise<string> {
    if (!this.isAvailable()) {
      throw new AIError(
        'Leonardo API key not configured',
        'PROVIDER_UNAVAILABLE',
        'leonardo'
      );
    }

    // Step 1: Get presigned URL
    const initResponse = await fetch(`${BASE_URL}/init-image`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ extension }),
    });

    if (!initResponse.ok) {
      const errorData = await initResponse.json().catch(() => ({}));
      throw new AIError(
        errorData.error || `Failed to get upload URL: ${initResponse.statusText}`,
        this.mapHttpErrorCode(initResponse.status),
        'leonardo',
        initResponse.status
      );
    }

    const initData = await initResponse.json();
    const { uploadInitImage } = initData;

    console.log('[Leonardo] Init image response:', JSON.stringify(uploadInitImage, null, 2).substring(0, 500));

    if (!uploadInitImage?.id || !uploadInitImage?.url || !uploadInitImage?.fields) {
      throw new AIError(
        `Invalid response from init-image endpoint: ${JSON.stringify(initData)}`,
        'GENERATION_FAILED',
        'leonardo'
      );
    }

    const { id: imageId, url: presignedUrl, fields: fieldsRaw, key } = uploadInitImage;
    console.log('[Leonardo] Got presigned URL for image ID:', imageId);
    console.log('[Leonardo] S3 key:', key);
    console.log('[Leonardo] Fields type:', typeof fieldsRaw);
    console.log('[Leonardo] Presigned URL:', presignedUrl);

    // Parse fields - it comes as a JSON string from the API
    let fields: Record<string, string>;
    try {
      fields = typeof fieldsRaw === 'string' ? JSON.parse(fieldsRaw) : fieldsRaw;
      console.log('[Leonardo] Parsed fields:', JSON.stringify(fields, null, 2));
    } catch (e) {
      console.error('[Leonardo] Failed to parse fields:', fieldsRaw);
      throw new AIError(
        'Failed to parse upload fields from Leonardo API',
        'GENERATION_FAILED',
        'leonardo'
      );
    }

    // Step 2: Upload image to S3 presigned URL using multipart form data
    // S3 presigned POST requires specific field ordering - all policy fields first, then file last

    // Build multipart form data manually for more control
    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    // Add all presigned fields (these must come before the file)
    for (const [fieldKey, value] of Object.entries(fields)) {
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fieldKey}"\r\n\r\n` +
        `${value}\r\n`
      ));
      console.log('[Leonardo] Added form field:', fieldKey, '=', value.substring(0, 50) + (value.length > 50 ? '...' : ''));
    }

    // Add the file last (must be named 'file' for S3 presigned uploads)
    const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="image.${extension}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    ));
    parts.push(imageBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const bodyBuffer = Buffer.concat(parts);
    console.log('[Leonardo] Form data size:', bodyBuffer.length, 'bytes');
    console.log('[Leonardo] Uploading to presigned URL:', presignedUrl);

    const uploadResponse = await fetch(presignedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(bodyBuffer.length),
      },
      body: bodyBuffer,
    });

    console.log('[Leonardo] Upload response status:', uploadResponse.status, uploadResponse.statusText);

    // S3 returns 204 on success, but some presigned URLs return 200
    if (!uploadResponse.ok && uploadResponse.status !== 204) {
      const errorText = await uploadResponse.text().catch(() => 'Unknown error');
      console.error('[Leonardo] S3 upload error response:', errorText);
      throw new AIError(
        `Failed to upload image to S3: ${uploadResponse.statusText} - ${errorText}`,
        'GENERATION_FAILED',
        'leonardo',
        uploadResponse.status
      );
    }

    console.log('[Leonardo] Image uploaded successfully, ID:', imageId);

    return imageId;
  }

  /**
   * Start video generation using Seedance 1.0 model
   * Uses a previously uploaded init image as the start frame
   */
  async startVideoGeneration(request: VideoGenerationRequest): Promise<{ generationId: string }> {
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

    const { initImageId, prompt, duration = 8 } = request;

    // Apply smart truncation to video prompt
    const truncatedPrompt = truncatePromptForLeonardo(prompt);

    // Seedance 1.0 video generation payload
    // Based on API docs: https://docs.leonardo.ai/docs/generate-with-seedance-1-0
    // Supported 16:9 dimensions for seedance-1.0-pro-fast:
    //   480p: 864×480
    //   1080p: 1920×1088
    // Note: 854x480 is NOT valid - must use 864x480 for 480p 16:9
    const payload = {
      model: SEEDANCE_MODEL_ID,
      public: false,
      parameters: {
        prompt: truncatedPrompt,
        guidances: {
          start_frame: [
            {
              image: {
                id: initImageId,
                type: 'UPLOADED',
              },
            },
          ],
        },
        duration,
        mode: 'RESOLUTION_480',
        prompt_enhance: 'OFF',
        width: 864,
        height: 480,
      },
    };

    console.log('[Leonardo] Video generation payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${BASE_URL_V2}/generations`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Leonardo] Video generation error response:', JSON.stringify(errorData, null, 2));
      throw new AIError(
        errorData.error || errorData.message || `Video generation failed: ${response.statusText}`,
        this.mapHttpErrorCode(response.status),
        'leonardo',
        response.status,
        response.status === 429 || response.status >= 500
      );
    }

    const data = await response.json();
    console.log('[Leonardo] Video generation response:', JSON.stringify(data, null, 2));

    // V2 API response structure - try different paths
    // Actual response format: { "generate": { "apiCreditCost": 50, "generationId": "uuid" } }
    const generationId = data.generate?.generationId ||
      data.generation?.id ||
      data.sdGenerationJob?.generationId ||
      data.motionVideoGenerationJob?.generationId ||
      data.id;

    if (!generationId) {
      console.error('[Leonardo] Could not extract generationId from response:', data);
      throw new AIError(
        `Failed to get generation ID from video API. Response: ${JSON.stringify(data)}`,
        'GENERATION_FAILED',
        'leonardo'
      );
    }

    console.log('[Leonardo] Video generation started, ID:', generationId);
    return { generationId };
  }

  /**
   * Check video generation status
   * Returns video URL when complete
   */
  async checkVideoGeneration(generationId: string): Promise<VideoGenerationResult> {
    try {
      // Try V2 endpoint first, fall back to V1 if needed
      const response = await fetch(`${BASE_URL_V2}/generations/${generationId}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        // Fall back to V1 endpoint
        const v1Response = await fetch(`${BASE_URL}/generations/${generationId}`, {
          method: 'GET',
          headers: this.headers,
        });

        if (!v1Response.ok) {
          return { status: 'failed', error: `API error: ${response.statusText}` };
        }

        const v1Data = await v1Response.json();
        return this.parseVideoGenerationResponse(v1Data);
      }

      const data = await response.json();
      return this.parseVideoGenerationResponse(data);
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse video generation response from either V1 or V2 API
   */
  private parseVideoGenerationResponse(data: Record<string, unknown>): VideoGenerationResult {
    // V2 response structure
    const generation = data.generation as Record<string, unknown> | undefined;
    // V1 response structure
    const generationsByPk = data.generations_by_pk as Record<string, unknown> | undefined;

    const genData = generation || generationsByPk || {};
    const status = genData.status as string | undefined;

    if (status === 'FAILED') {
      return { status: 'failed', error: 'Video generation failed' };
    }

    // Check for video assets
    const assets = (genData.assets as Array<Record<string, unknown>>) || [];
    const generatedImages = (genData.generated_images as Array<Record<string, unknown>>) || [];

    // Video URL might be in assets (V2) or generated_images (V1)
    const videoAsset = assets.find(a => a.type === 'VIDEO' || a.url?.toString().includes('.mp4'));
    const videoFromImages = generatedImages.find(img =>
      img.url?.toString().includes('.mp4') ||
      img.motionMP4URL ||
      img.video_url
    );

    const videoUrl = videoAsset?.url ||
      videoFromImages?.motionMP4URL ||
      videoFromImages?.video_url ||
      videoFromImages?.url;

    if (videoUrl && typeof videoUrl === 'string') {
      return { status: 'complete', videoUrl };
    }

    // Check if generation is complete but video URL not yet available
    if (status === 'COMPLETE' || status === 'COMPLETED') {
      // Sometimes the video URL takes a moment to propagate
      return { status: 'pending' };
    }

    return { status: 'pending' };
  }

  /**
   * Poll for video generation completion
   */
  async pollVideoGeneration(generationId: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_VIDEO_POLL_ATTEMPTS; attempt++) {
      const result = await this.checkVideoGeneration(generationId);

      if (result.status === 'complete' && result.videoUrl) {
        return result.videoUrl;
      }

      if (result.status === 'failed') {
        throw new AIError(
          result.error || 'Video generation failed',
          'GENERATION_FAILED',
          'leonardo'
        );
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new AIError(
      `Video generation timed out after ${MAX_VIDEO_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000} seconds`,
      'TIMEOUT',
      'leonardo'
    );
  }

  // ============================================================================
  // CANVAS INPAINTING
  // ============================================================================

  /**
   * Upload both init image and mask for canvas inpainting
   * Uses the dedicated /canvas-init-image endpoint which returns IDs
   * that are recognized for canvas operations.
   *
   * Mask format: white = edit area, black = preserve area
   */
  async uploadCanvasImages(
    initBuffer: Buffer,
    maskBuffer: Buffer,
    initExtension: string = 'jpg',
    maskExtension: string = 'png'
  ): Promise<{ initImageId: string; maskImageId: string }> {
    if (!this.isAvailable()) {
      throw new AIError(
        'Leonardo API key not configured',
        'PROVIDER_UNAVAILABLE',
        'leonardo'
      );
    }

    // Step 1: Get presigned URLs for both images via canvas-init-image endpoint
    console.log('[Leonardo] Getting presigned URLs for canvas images...');
    const initResponse = await fetch(`${BASE_URL}/canvas-init-image`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        initExtension,
        maskExtension,
      }),
    });

    if (!initResponse.ok) {
      const errorData = await initResponse.json().catch(() => ({}));
      throw new AIError(
        errorData.error || `Failed to get canvas upload URLs: ${initResponse.statusText}`,
        this.mapHttpErrorCode(initResponse.status),
        'leonardo',
        initResponse.status
      );
    }

    const data = await initResponse.json();
    const canvasData = data.uploadCanvasInitImage;

    // Note: API returns "masksImageId" (plural), not "maskImageId"
    if (!canvasData?.initImageId || !canvasData?.masksImageId) {
      throw new AIError(
        `Invalid response from canvas-init-image endpoint: ${JSON.stringify(data).substring(0, 500)}`,
        'GENERATION_FAILED',
        'leonardo'
      );
    }

    const {
      initImageId,
      initFields: initFieldsRaw,
      initUrl,
      masksImageId: maskImageId,
      masksFields: maskFieldsRaw,
      masksUrl: maskUrl,
    } = canvasData;

    console.log('[Leonardo] Got canvas image IDs - init:', initImageId, 'mask:', maskImageId);

    // Parse fields
    let initFields: Record<string, string>;
    let maskFields: Record<string, string>;
    try {
      initFields = typeof initFieldsRaw === 'string' ? JSON.parse(initFieldsRaw) : initFieldsRaw;
      maskFields = typeof maskFieldsRaw === 'string' ? JSON.parse(maskFieldsRaw) : maskFieldsRaw;
    } catch (e) {
      console.error('[Leonardo] Failed to parse canvas fields');
      throw new AIError(
        'Failed to parse upload fields from Leonardo API for canvas',
        'GENERATION_FAILED',
        'leonardo'
      );
    }

    // Step 2: Upload init image to S3
    console.log('[Leonardo] Uploading init image to S3...');
    await this.uploadToS3(initUrl, initFields, initBuffer, initExtension, 'init');

    // Step 3: Upload mask to S3
    console.log('[Leonardo] Uploading mask to S3...');
    await this.uploadToS3(maskUrl, maskFields, maskBuffer, maskExtension, 'mask');

    console.log('[Leonardo] Canvas images uploaded successfully');
    return { initImageId, maskImageId };
  }

  /**
   * Helper to upload a file to S3 presigned URL
   */
  private async uploadToS3(
    presignedUrl: string,
    fields: Record<string, string>,
    buffer: Buffer,
    extension: string,
    type: 'init' | 'mask'
  ): Promise<void> {
    const boundary = `----FormBoundary${Date.now()}${Math.random()}`;
    const parts: Buffer[] = [];

    for (const [fieldKey, value] of Object.entries(fields)) {
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fieldKey}"\r\n\r\n` +
        `${value}\r\n`
      ));
    }

    const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${type}.${extension}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    ));
    parts.push(buffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const bodyBuffer = Buffer.concat(parts);
    console.log(`[Leonardo] Uploading ${type}, size:`, bodyBuffer.length, 'bytes');

    const uploadResponse = await fetch(presignedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(bodyBuffer.length),
      },
      body: bodyBuffer,
    });

    if (!uploadResponse.ok && uploadResponse.status !== 204) {
      const errorText = await uploadResponse.text().catch(() => 'Unknown error');
      console.error(`[Leonardo] ${type} S3 upload error:`, errorText);
      throw new AIError(
        `Failed to upload ${type} to S3: ${uploadResponse.statusText} - ${errorText}`,
        'GENERATION_FAILED',
        'leonardo',
        uploadResponse.status
      );
    }
  }

  /**
   * @deprecated Use uploadCanvasImages instead for canvas inpainting
   * Upload a mask image for inpainting using the standard init-image endpoint.
   * Note: This creates IDs that may not work with canvas operations.
   */
  async uploadMaskImage(maskBuffer: Buffer, extension: string = 'png'): Promise<string> {
    if (!this.isAvailable()) {
      throw new AIError(
        'Leonardo API key not configured',
        'PROVIDER_UNAVAILABLE',
        'leonardo'
      );
    }

    // Step 1: Get presigned URL (same endpoint as init-image)
    const initResponse = await fetch(`${BASE_URL}/init-image`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ extension }),
    });

    if (!initResponse.ok) {
      const errorData = await initResponse.json().catch(() => ({}));
      throw new AIError(
        errorData.error || `Failed to get mask upload URL: ${initResponse.statusText}`,
        this.mapHttpErrorCode(initResponse.status),
        'leonardo',
        initResponse.status
      );
    }

    const initData = await initResponse.json();
    const { uploadInitImage } = initData;

    if (!uploadInitImage?.id || !uploadInitImage?.url || !uploadInitImage?.fields) {
      throw new AIError(
        `Invalid response from init-image endpoint for mask: ${JSON.stringify(initData)}`,
        'GENERATION_FAILED',
        'leonardo'
      );
    }

    const { id: imageId, url: presignedUrl, fields: fieldsRaw } = uploadInitImage;
    console.log('[Leonardo] Got presigned URL for mask ID:', imageId);

    // Parse fields
    let fields: Record<string, string>;
    try {
      fields = typeof fieldsRaw === 'string' ? JSON.parse(fieldsRaw) : fieldsRaw;
    } catch (e) {
      console.error('[Leonardo] Failed to parse mask fields:', fieldsRaw);
      throw new AIError(
        'Failed to parse upload fields from Leonardo API for mask',
        'GENERATION_FAILED',
        'leonardo'
      );
    }

    // Step 2: Upload mask to S3
    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    for (const [fieldKey, value] of Object.entries(fields)) {
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fieldKey}"\r\n\r\n` +
        `${value}\r\n`
      ));
    }

    const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="mask.${extension}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    ));
    parts.push(maskBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const bodyBuffer = Buffer.concat(parts);
    console.log('[Leonardo] Uploading mask, size:', bodyBuffer.length, 'bytes');

    const uploadResponse = await fetch(presignedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(bodyBuffer.length),
      },
      body: bodyBuffer,
    });

    if (!uploadResponse.ok && uploadResponse.status !== 204) {
      const errorText = await uploadResponse.text().catch(() => 'Unknown error');
      console.error('[Leonardo] Mask S3 upload error:', errorText);
      throw new AIError(
        `Failed to upload mask to S3: ${uploadResponse.statusText} - ${errorText}`,
        'GENERATION_FAILED',
        'leonardo',
        uploadResponse.status
      );
    }

    console.log('[Leonardo] Mask uploaded successfully, ID:', imageId);
    return imageId;
  }

  /**
   * Start canvas inpainting generation
   * Uses canvasRequest mode with init image and mask
   */
  async startCanvasInpainting(request: CanvasInpaintingRequest): Promise<{ generationId: string }> {
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

    const { canvasInitId, canvasMaskId, prompt, initStrength = 0.15, width, height } = request;

    // Canvas inpainting payload
    // Note: Must use Leonardo Diffusion XL for inpainting - Lucide Origin doesn't support it
    const payload = {
      prompt,
      modelId: LEONARDO_DIFFUSION_XL_MODEL_ID,
      canvasRequest: true,
      canvasRequestType: 'INPAINT',
      canvasInitId,
      canvasMaskId,
      init_strength: initStrength,
      width,
      height,
      num_images: 1,
    };

    console.log('[Leonardo] Canvas inpainting payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${BASE_URL}/generations`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Leonardo] Canvas inpainting error:', JSON.stringify(errorData, null, 2));
      throw new AIError(
        errorData.error || errorData.message || `Canvas inpainting failed: ${response.statusText}`,
        this.mapHttpErrorCode(response.status),
        'leonardo',
        response.status,
        response.status === 429 || response.status >= 500
      );
    }

    const data = await response.json();
    const generationId = data.sdGenerationJob?.generationId;

    if (!generationId) {
      console.error('[Leonardo] Could not extract generationId from inpainting response:', data);
      throw new AIError(
        `Failed to get generation ID from inpainting API. Response: ${JSON.stringify(data)}`,
        'GENERATION_FAILED',
        'leonardo'
      );
    }

    console.log('[Leonardo] Canvas inpainting started, ID:', generationId);
    return { generationId };
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
    width: number,
    height: number,
    numImages: number
  ): Promise<string> {
    // Apply truncation to prompt before sending to API
    const truncatedPrompt = truncatePromptForLeonardo(prompt);

    const payload = {
      alchemy: false,
      height,
      width,
      modelId: this.modelId,
      styleUUID: this.styleId,
      prompt: truncatedPrompt,
      num_images: Math.min(Math.max(numImages, 1), 4),
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

/**
 * Convenience function to upload an image for video generation
 */
export async function uploadImageForVideo(
  imageBuffer: Buffer,
  extension?: string
): Promise<string> {
  const provider = getLeonardoProvider();
  return provider.uploadInitImage(imageBuffer, extension);
}

/**
 * Convenience function to start video generation
 */
export async function startVideoGenerationWithLeonardo(
  request: VideoGenerationRequest
): Promise<string> {
  const provider = getLeonardoProvider();
  const response = await provider.startVideoGeneration(request);
  return response.generationId;
}

/**
 * Convenience function to check video generation status
 */
export async function checkVideoGenerationStatus(
  generationId: string
): Promise<VideoGenerationResult> {
  const provider = getLeonardoProvider();
  return provider.checkVideoGeneration(generationId);
}

/**
 * Convenience function to upload both init and mask images for canvas inpainting
 * Uses the dedicated /canvas-init-image endpoint
 */
export async function uploadCanvasImagesForInpainting(
  initBuffer: Buffer,
  maskBuffer: Buffer,
  initExtension?: string,
  maskExtension?: string
): Promise<{ initImageId: string; maskImageId: string }> {
  const provider = getLeonardoProvider();
  return provider.uploadCanvasImages(initBuffer, maskBuffer, initExtension, maskExtension);
}

/**
 * @deprecated Use uploadCanvasImagesForInpainting instead
 * Convenience function to upload a mask image for inpainting
 */
export async function uploadMaskForInpainting(
  maskBuffer: Buffer,
  extension?: string
): Promise<string> {
  const provider = getLeonardoProvider();
  return provider.uploadMaskImage(maskBuffer, extension);
}

/**
 * Convenience function to start canvas inpainting
 */
export async function startInpaintingWithLeonardo(
  request: CanvasInpaintingRequest
): Promise<string> {
  const provider = getLeonardoProvider();
  const response = await provider.startCanvasInpainting(request);
  return response.generationId;
}

/**
 * Convenience function to check inpainting generation status
 * Reuses the standard generation check endpoint
 */
export async function checkInpaintingGenerationStatus(
  generationId: string
): Promise<CanvasInpaintingResult> {
  const provider = getLeonardoProvider();
  const result = await provider.checkGeneration(generationId);
  return {
    status: result.status,
    imageUrl: result.images?.[0]?.url,
    error: result.error,
  };
}
