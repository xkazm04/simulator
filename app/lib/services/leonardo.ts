/**
 * Leonardo AI Image Generation Service
 * Simplified for Simulator - focused on LUCIDE_ORIGIN model
 */

// LUCIDE ORIGIN model for high-quality image generation
export const LUCIDE_ORIGIN_MODEL_ID = '7b592283-e8a7-4c5a-9ba6-d18c31f258b9';
export const LUCIDE_ORIGIN_STYLE_ID = '111dc692-d470-4eec-b791-3475abac4c46'; // Dynamic style

// Request/Response types
export interface LeonardoGenerateRequest {
  prompt: string;
  width?: number;
  height?: number;
  numImages?: number;
}

export interface LeonardoImage {
  url: string;
  id: string;
  width: number;
  height: number;
}

export interface LeonardoGenerateResponse {
  success: boolean;
  images: LeonardoImage[];
  generationId: string;
  prompt: string;
  error?: string;
}

/**
 * Leonardo AI Service - Simplified for Simulator
 */
export class LeonardoService {
  private apiKey: string;
  private baseUrl = 'https://cloud.leonardo.ai/api/rest/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LEONARDO_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Leonardo API key is required. Set LEONARDO_API_KEY environment variable.');
    }
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Check if Leonardo API is available
   */
  static isAvailable(): boolean {
    return !!process.env.LEONARDO_API_KEY;
  }

  /**
   * Normalize dimensions to Leonardo requirements (divisible by 8, 32-1536 range)
   */
  private normalizeDimensions(width: number, height: number): { width: number; height: number } {
    const normalizedWidth = Math.max(32, Math.min(1536, Math.floor(width / 8) * 8));
    const normalizedHeight = Math.max(32, Math.min(1536, Math.floor(height / 8) * 8));
    return { width: normalizedWidth, height: normalizedHeight };
  }

  /**
   * Poll for generation completion
   */
  private async pollGeneration(
    generationId: string,
    maxAttempts = 60,
    pollInterval = 2000
  ): Promise<LeonardoImage[]> {
    const url = `${this.baseUrl}/generations/${generationId}`;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers,
        });

        if (!response.ok) {
          throw new Error(`Polling failed: ${response.statusText}`);
        }

        const data = await response.json();
        const generationData = data.generations_by_pk || {};
        const generatedImages = generationData.generated_images || [];

        if (generatedImages.length > 0) {
          return generatedImages.map((img: { url: string; id: string }) => ({
            url: img.url,
            id: img.id,
            width: 0, // Will be set from request
            height: 0,
          }));
        }

        const status = generationData.status;
        if (status === 'FAILED') {
          throw new Error('Leonardo generation failed');
        }
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Generation timed out after ${maxAttempts * pollInterval / 1000} seconds`);
  }

  /**
   * Generate images using Leonardo API with LUCIDE ORIGIN model
   */
  async generateImages(request: LeonardoGenerateRequest): Promise<LeonardoGenerateResponse> {
    const { width, height } = this.normalizeDimensions(
      request.width || 768,
      request.height || 768
    );

    const payload = {
      alchemy: false, // LUCIDE_ORIGIN doesn't use alchemy
      height,
      width,
      modelId: LUCIDE_ORIGIN_MODEL_ID,
      styleUUID: LUCIDE_ORIGIN_STYLE_ID,
      prompt: request.prompt,
      num_images: Math.min(Math.max(request.numImages || 1, 1), 4),
    };

    // Start generation
    const generateResponse = await fetch(`${this.baseUrl}/generations`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!generateResponse.ok) {
      const errorData = await generateResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Leonardo API error: ${generateResponse.statusText}`);
    }

    const generateData = await generateResponse.json();
    const generationId = generateData.sdGenerationJob?.generationId;

    if (!generationId) {
      throw new Error('Failed to get generation ID from Leonardo API');
    }

    // Poll for completion
    const images = await this.pollGeneration(generationId);

    return {
      success: true,
      images: images.map(img => ({
        ...img,
        width,
        height,
      })),
      generationId,
      prompt: request.prompt,
    };
  }

  /**
   * Start generation without waiting (returns generation ID)
   */
  async startGeneration(request: LeonardoGenerateRequest): Promise<{ generationId: string; prompt: string }> {
    const { width, height } = this.normalizeDimensions(
      request.width || 768,
      request.height || 768
    );

    const payload = {
      alchemy: false,
      height,
      width,
      modelId: LUCIDE_ORIGIN_MODEL_ID,
      styleUUID: LUCIDE_ORIGIN_STYLE_ID,
      prompt: request.prompt,
      num_images: 1,
    };

    const generateResponse = await fetch(`${this.baseUrl}/generations`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!generateResponse.ok) {
      const errorData = await generateResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Leonardo API error: ${generateResponse.statusText}`);
    }

    const generateData = await generateResponse.json();
    const generationId = generateData.sdGenerationJob?.generationId;

    if (!generationId) {
      throw new Error('Failed to get generation ID from Leonardo API');
    }

    return { generationId, prompt: request.prompt };
  }

  /**
   * Check generation status and get images if complete
   */
  async checkGeneration(generationId: string): Promise<{
    status: 'pending' | 'complete' | 'failed';
    images?: LeonardoImage[];
    error?: string;
  }> {
    const url = `${this.baseUrl}/generations/${generationId}`;

    try {
      const response = await fetch(url, {
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
            width: img.width || 1344,
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
   * Delete a generation from Leonardo (cleanup)
   */
  async deleteGeneration(generationId: string): Promise<void> {
    const url = `${this.baseUrl}/generations/${generationId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok && response.status !== 404) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Delete failed: ${response.statusText}`);
    }
  }
}

/**
 * Get Leonardo service instance
 */
export function getLeonardoService(): LeonardoService {
  return new LeonardoService();
}
