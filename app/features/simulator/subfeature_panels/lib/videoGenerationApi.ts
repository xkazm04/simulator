/**
 * videoGenerationApi - API functions for Leonardo Seedance video generation
 */

export type VideoDuration = 4 | 6 | 8;

export interface VideoGenerationRequest {
  sourceImageUrl: string;  // The saved panel image URL
  prompt: string;
  duration?: VideoDuration;  // seconds, default 8
}

export interface VideoGenerationResponse {
  success: boolean;
  generationId?: string;
  videoUrl?: string;
  status?: 'pending' | 'complete' | 'failed';
  error?: string;
}

/**
 * Start video generation from an image using Leonardo Seedance API
 */
export async function generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
  const { sourceImageUrl, prompt, duration = 8 } = request;

  try {
    const response = await fetch('/api/ai/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceImageUrl,
        prompt: prompt.trim(),
        duration,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to start video generation',
      };
    }

    return {
      success: true,
      generationId: data.generationId,
      status: data.status || 'pending',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Video generation failed',
    };
  }
}

/**
 * Check video generation status
 */
export async function checkVideoStatus(generationId: string): Promise<VideoGenerationResponse> {
  try {
    const response = await fetch(`/api/ai/generate-video?generationId=${encodeURIComponent(generationId)}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to check video status',
      };
    }

    return {
      success: true,
      generationId: data.generationId,
      status: data.status,
      videoUrl: data.videoUrl,
      error: data.error,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to check video status',
    };
  }
}

/**
 * Poll for video completion
 * @param generationId - The generation ID to poll
 * @param onProgress - Callback for status updates
 * @param maxAttempts - Maximum poll attempts (default 120 = ~4 minutes)
 * @param intervalMs - Poll interval in ms (default 2000)
 */
export async function pollVideoCompletion(
  generationId: string,
  onProgress?: (status: string) => void,
  maxAttempts: number = 120,
  intervalMs: number = 2000
): Promise<VideoGenerationResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await checkVideoStatus(generationId);

    if (result.status === 'complete' && result.videoUrl) {
      return result;
    }

    if (result.status === 'failed' || result.error) {
      return {
        success: false,
        error: result.error || 'Video generation failed',
      };
    }

    // Report progress
    if (onProgress) {
      const progress = Math.round((attempt / maxAttempts) * 100);
      onProgress(`Generating video... ${progress}%`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return {
    success: false,
    error: 'Video generation timed out',
  };
}
