/**
 * Prompt Truncation Utilities
 *
 * Provides smart truncation for Leonardo AI prompts to ensure they fit
 * within API limits while preserving semantic meaning.
 *
 * Limits:
 * - Leonardo prompt: 1500 characters
 */

/** Maximum characters for Leonardo prompt */
export const LEONARDO_MAX_PROMPT_LENGTH = 1500;

/**
 * Truncate a prompt for Leonardo AI with smart boundary detection.
 *
 * Truncation strategy:
 * 1. If under limit, return as-is
 * 2. Try to truncate at the last comma before the limit (comma-aware)
 * 3. Fall back to word boundary (last space)
 * 4. Hard truncate if no good boundary found
 *
 * @param prompt - The prompt text to truncate
 * @param maxLength - Maximum length (defaults to 1500)
 * @returns Truncated prompt
 */
export function truncatePromptForLeonardo(
  prompt: string,
  maxLength: number = LEONARDO_MAX_PROMPT_LENGTH
): string {
  if (!prompt) return '';
  if (prompt.length <= maxLength) return prompt;

  const truncated = prompt.substring(0, maxLength);

  // Try comma-aware truncation (prompts are often comma-separated descriptors)
  // Look for comma in the last 30% of the allowed length
  const commaThreshold = maxLength * 0.7;
  const lastComma = truncated.lastIndexOf(',');

  if (lastComma > commaThreshold) {
    const result = truncated.substring(0, lastComma).trim();
    logTruncation(prompt.length, result.length, 'comma');
    return result;
  }

  // Fall back to word boundary (space)
  // Look for space in the last 20% of the allowed length
  const spaceThreshold = maxLength * 0.8;
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > spaceThreshold) {
    const result = truncated.substring(0, lastSpace).trim();
    logTruncation(prompt.length, result.length, 'space');
    return result;
  }

  // Hard truncate as last resort
  const result = truncated.trim();
  logTruncation(prompt.length, result.length, 'hard');
  return result;
}

/**
 * Log truncation events for debugging/monitoring
 */
function logTruncation(
  originalLength: number,
  truncatedLength: number,
  method: 'comma' | 'space' | 'hard'
): void {
  console.warn(
    `[Leonardo] Prompt truncated: ` +
    `${originalLength} -> ${truncatedLength} chars (${method} boundary)`
  );
}

/**
 * Check if a prompt would be truncated
 *
 * @param prompt - The prompt to check
 * @param maxLength - Maximum length to check against
 * @returns true if prompt would be truncated
 */
export function wouldTruncate(
  prompt: string,
  maxLength: number = LEONARDO_MAX_PROMPT_LENGTH
): boolean {
  return prompt.length > maxLength;
}

/**
 * Get truncation info for a prompt without actually truncating
 *
 * @param prompt - The prompt to analyze
 * @param maxLength - Maximum length
 * @returns Object with truncation details
 */
export function getTruncationInfo(
  prompt: string,
  maxLength: number = LEONARDO_MAX_PROMPT_LENGTH
): {
  originalLength: number;
  wouldTruncate: boolean;
  charsOver: number;
  percentOver: number;
} {
  const originalLength = prompt.length;
  const charsOver = Math.max(0, originalLength - maxLength);
  const percentOver = charsOver > 0 ? Math.round((charsOver / maxLength) * 100) : 0;

  return {
    originalLength,
    wouldTruncate: charsOver > 0,
    charsOver,
    percentOver,
  };
}
