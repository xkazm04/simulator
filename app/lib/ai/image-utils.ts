/**
 * Image Utilities for AI Operations
 *
 * Shared utility functions for image handling across AI API routes.
 */

/**
 * Fetch an image from URL and convert to base64 data URL
 *
 * Used by vision endpoints (evaluate-image, evaluate-poster, gemini)
 * to prepare images for AI model input.
 *
 * @param imageUrl - URL of the image to fetch
 * @param defaultMimeType - Fallback MIME type if content-type header is missing
 * @returns Data URL string (data:image/...;base64,...)
 * @throws Error if fetch fails
 */
export async function fetchImageAsDataUrl(
  imageUrl: string,
  defaultMimeType: string = 'image/png'
): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || defaultMimeType;
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return `data:${contentType};base64,${base64}`;
}

/**
 * Fetch an image from URL and return raw base64 data with MIME type
 *
 * Alternative format for APIs that need separate mimeType and data fields
 * (e.g., Gemini's native image format).
 *
 * @param imageUrl - URL of the image to fetch
 * @param defaultMimeType - Fallback MIME type if content-type header is missing
 * @returns Object with mimeType and base64 data (no data URL prefix)
 * @throws Error if fetch fails
 */
export async function fetchImageAsBase64(
  imageUrl: string,
  defaultMimeType: string = 'image/jpeg'
): Promise<{ mimeType: string; data: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const mimeType = response.headers.get('content-type') || defaultMimeType;
  const arrayBuffer = await response.arrayBuffer();
  const data = Buffer.from(arrayBuffer).toString('base64');

  return { mimeType, data };
}
