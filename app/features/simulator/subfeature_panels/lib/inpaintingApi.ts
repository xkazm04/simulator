/**
 * inpaintingApi - API functions for Leonardo canvas inpainting
 */

export interface InpaintingRequest {
  sourceImageUrl: string;  // The saved panel image URL
  maskDataUrl: string;     // Data URL of mask (white = edit, black = preserve)
  prompt: string;          // What to generate in the masked area
  inpaintStrength?: number;  // 0-100, default 85 (higher = more change)
}

export interface InpaintingResponse {
  success: boolean;
  generationId?: string;
  imageUrl?: string;
  status?: 'pending' | 'complete' | 'failed';
  error?: string;
}

/**
 * Start canvas inpainting using Leonardo API
 */
export async function generateInpainting(request: InpaintingRequest): Promise<InpaintingResponse> {
  const { sourceImageUrl, maskDataUrl, prompt, inpaintStrength = 85 } = request;

  try {
    const response = await fetch('/api/ai/inpainting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceImageUrl,
        maskDataUrl,
        prompt: prompt.trim(),
        inpaintStrength,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to start inpainting',
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
      error: err instanceof Error ? err.message : 'Inpainting failed',
    };
  }
}

/**
 * Check inpainting generation status
 */
export async function checkInpaintingStatus(generationId: string): Promise<InpaintingResponse> {
  try {
    const response = await fetch(`/api/ai/inpainting?generationId=${encodeURIComponent(generationId)}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to check inpainting status',
      };
    }

    return {
      success: true,
      generationId: data.generationId,
      status: data.status,
      imageUrl: data.imageUrl,
      error: data.error,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to check inpainting status',
    };
  }
}

/**
 * Poll for inpainting completion
 * @param generationId - The generation ID to poll
 * @param onProgress - Callback for status updates
 * @param maxAttempts - Maximum poll attempts (default 60 = ~2 minutes)
 * @param intervalMs - Poll interval in ms (default 2000)
 */
export async function pollInpaintingCompletion(
  generationId: string,
  onProgress?: (status: string) => void,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<InpaintingResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await checkInpaintingStatus(generationId);

    if (result.status === 'complete' && result.imageUrl) {
      return result;
    }

    if (result.status === 'failed' || result.error) {
      return {
        success: false,
        error: result.error || 'Inpainting failed',
      };
    }

    // Report progress
    if (onProgress) {
      const progress = Math.round((attempt / maxAttempts) * 100);
      onProgress(`Inpainting... ${progress}%`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return {
    success: false,
    error: 'Inpainting timed out',
  };
}
