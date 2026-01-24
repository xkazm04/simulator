/**
 * regenerationApi - API functions for Gemini image regeneration
 */

export type RegenerationMode = 'transform' | 'overlay';

export interface RegenerationRequest {
  prompt: string;
  sourceImageUrl: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  mode?: RegenerationMode; // 'transform' = redesign image, 'overlay' = add HUD/elements on top
}

export interface RegenerationResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

/**
 * Regenerate an image using Gemini API
 */
export async function regenerateImage(request: RegenerationRequest): Promise<RegenerationResponse> {
  const { prompt, sourceImageUrl, aspectRatio = '16:9', mode = 'transform' } = request;

  try {
    const response = await fetch('/api/ai/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.trim(),
        sourceImageUrl,
        aspectRatio,
        mode,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to generate image',
      };
    }

    return {
      success: true,
      imageUrl: data.imageUrl,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Generation failed',
    };
  }
}

/**
 * Build a HUD overlay prompt
 * @param gameUIDimension - The game UI reference to apply
 * @param existingPrompt - Optional existing prompt to append to
 * @param append - If true, append to existing prompt; if false, replace
 */
export function buildHudPrompt(
  gameUIDimension: string,
  existingPrompt?: string,
  append: boolean = true
): string {
  const hudPrompt = `Add game UI overlay: ${gameUIDimension}. Keep the same scene and composition.`;

  if (append && existingPrompt?.trim()) {
    return `${existingPrompt.trim()} ${hudPrompt}`;
  }

  return hudPrompt;
}
