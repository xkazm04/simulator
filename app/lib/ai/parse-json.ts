/**
 * Robust JSON Parser for AI Responses
 *
 * Handles common issues with LLM JSON output:
 * - Markdown code blocks (```json ... ```)
 * - Incomplete responses (finds matching braces)
 * - Trailing commas before } or ]
 * - Unescaped control characters in strings
 */

/**
 * Parse JSON from AI response text
 *
 * @param text - Raw response text from AI
 * @returns Parsed JSON object
 * @throws Error with clean message if parsing fails
 *
 * @example
 * ```typescript
 * const result = parseAIJsonResponse<MyType>(response.text);
 * ```
 */
export function parseAIJsonResponse<T = unknown>(text: string): T {
  // Step 1: Remove markdown code block markers
  let jsonStr = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Step 2: Extract JSON object (find matching braces)
  const startIdx = jsonStr.indexOf('{');
  if (startIdx === -1) {
    throw new Error('No JSON object found in response');
  }

  // Find matching closing brace with proper string handling
  let braceCount = 0;
  let endIdx = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = startIdx; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (braceCount === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx === -1) {
    throw new Error(`Incomplete JSON object (unclosed braces: ${braceCount})`);
  }

  jsonStr = jsonStr.slice(startIdx, endIdx + 1);

  // Step 3: Fix common JSON issues - trailing commas before } or ]
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

  // Step 4: Try to parse
  try {
    return JSON.parse(jsonStr) as T;
  } catch (firstError) {
    // Step 5: Try to fix unescaped control characters in strings
    jsonStr = jsonStr.replace(
      /"([^"\\]*(?:\\.[^"\\]*)*)"/g,
      (match, content) => {
        const fixed = content
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${fixed}"`;
      }
    );

    try {
      return JSON.parse(jsonStr) as T;
    } catch (secondError) {
      const message = firstError instanceof Error ? firstError.message : 'Unknown parse error';
      throw new Error(`Failed to parse AI JSON response: ${message}`);
    }
  }
}

// Alias for backward compatibility with Gemini-specific naming
export const parseJsonFromGeminiResponse = parseAIJsonResponse;
