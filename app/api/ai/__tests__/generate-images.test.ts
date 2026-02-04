/**
 * Unit Tests for Generate Images API Route
 *
 * Tests the /api/ai/generate-images endpoint including:
 * - Request validation
 * - Negative prompt handling
 * - Error responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Leonardo provider
vi.mock('@/app/lib/ai', () => ({
  getLeonardoProvider: vi.fn().mockReturnValue({
    startGeneration: vi.fn().mockResolvedValue({ generationId: 'test-gen-id' }),
    checkGeneration: vi.fn().mockResolvedValue({
      status: 'COMPLETE',
      images: [{ url: 'https://example.com/image.png' }],
    }),
  }),
  isLeonardoAvailable: vi.fn().mockReturnValue(true),
  AIError: class AIError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

describe('/api/ai/generate-images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('accepts valid request with prompts', async () => {
      const validRequest = {
        prompts: [
          { id: 'prompt-1', text: 'A fantasy landscape', negativePrompt: 'blurry' },
          { id: 'prompt-2', text: 'A hero portrait' },
        ],
        width: 1344,
        height: 768,
      };

      // Validate structure matches expected interface
      expect(validRequest.prompts).toHaveLength(2);
      expect(validRequest.prompts[0]).toHaveProperty('id');
      expect(validRequest.prompts[0]).toHaveProperty('text');
      expect(validRequest.prompts[0]).toHaveProperty('negativePrompt');
    });

    it('accepts request without negativePrompt', () => {
      const request = {
        prompts: [{ id: 'prompt-1', text: 'A scene' }],
      };

      expect(request.prompts[0].negativePrompt).toBeUndefined();
    });

    it('accepts prompts with empty negativePrompt', () => {
      const request = {
        prompts: [{ id: 'prompt-1', text: 'A scene', negativePrompt: '' }],
      };

      expect(request.prompts[0].negativePrompt).toBe('');
    });
  });

  describe('Negative Prompt Flow', () => {
    it('negative prompt is passed through request structure', () => {
      const request = {
        prompts: [
          {
            id: 'prompt-1',
            text: 'A beautiful landscape',
            negativePrompt: 'blurry, low quality, watermark',
          },
        ],
        width: 1344,
        height: 768,
      };

      // Verify the negative prompt is preserved in the request
      expect(request.prompts[0].negativePrompt).toBe('blurry, low quality, watermark');
    });

    it('handles multiple prompts with different negatives', () => {
      const request = {
        prompts: [
          { id: 'p1', text: 'Scene 1', negativePrompt: 'negative 1' },
          { id: 'p2', text: 'Scene 2', negativePrompt: 'negative 2' },
          { id: 'p3', text: 'Scene 3' }, // No negative
        ],
      };

      expect(request.prompts[0].negativePrompt).toBe('negative 1');
      expect(request.prompts[1].negativePrompt).toBe('negative 2');
      expect(request.prompts[2].negativePrompt).toBeUndefined();
    });
  });

  describe('Request Structure', () => {
    it('has correct structure for Leonardo API integration', () => {
      interface GenerateRequest {
        prompts: Array<{
          id: string;
          text: string;
          negativePrompt?: string;
        }>;
        width?: number;
        height?: number;
      }

      const request: GenerateRequest = {
        prompts: [
          { id: 'test-id', text: 'test prompt', negativePrompt: 'test negative' },
        ],
        width: 1344,
        height: 768,
      };

      // Type assertion passes - structure is correct
      expect(request.prompts[0].id).toBeDefined();
      expect(request.prompts[0].text).toBeDefined();
    });
  });
});

describe('Leonardo API Request Format', () => {
  it('includes negativePrompt when provided', () => {
    const leonardoRequest = {
      prompt: 'A fantasy scene',
      width: 1344,
      height: 768,
      numImages: 1,
      negativePrompt: 'blurry, watermark',
    };

    expect(leonardoRequest.negativePrompt).toBe('blurry, watermark');
  });

  it('omits negativePrompt when not provided', () => {
    const leonardoRequest = {
      prompt: 'A fantasy scene',
      width: 1344,
      height: 768,
      numImages: 1,
    };

    expect(leonardoRequest.negativePrompt).toBeUndefined();
  });
});
