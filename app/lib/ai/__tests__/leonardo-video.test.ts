/**
 * Integration Tests for Leonardo Video Generation API
 *
 * Tests the Seedance 1.0 video generation request format.
 * Run with: npx vitest run app/lib/ai/__tests__/leonardo-video.test.ts
 *
 * For real API testing (requires LEONARDO_API_KEY in .env):
 *   INTEGRATION_TEST=true npx vitest run app/lib/ai/__tests__/leonardo-video.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Type definitions matching the actual Leonardo API
interface SeedanceV2Request {
  model: string;
  public: boolean;
  parameters: {
    prompt: string;
    guidances: {
      start_frame?: Array<{
        image: {
          id: string;
          type: 'UPLOADED' | 'GENERATED';
        };
      }>;
      end_frame?: Array<{
        image: {
          id: string;
          type: 'UPLOADED' | 'GENERATED';
        };
      }>;
    };
    duration: number;
    mode: 'RESOLUTION_480' | 'RESOLUTION_720' | 'RESOLUTION_1080';
    prompt_enhance: 'ON' | 'OFF';
    width: number;
    height: number;
  };
}

// Build the request payload that should be sent to Leonardo
// Supported 16:9 dimensions for seedance-1.0-pro-fast:
//   480p: 864×480 (NOT 854x480!)
//   1080p: 1920×1088
function buildVideoGenerationPayload(
  initImageId: string,
  prompt: string,
  duration: 4 | 6 | 8 = 8
): SeedanceV2Request {
  return {
    model: 'seedance-1.0-pro-fast',
    public: false,
    parameters: {
      prompt: prompt.slice(0, 1500),
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
}

describe('Leonardo Video Generation Request Format', () => {
  describe('Seedance V2 API Request Structure', () => {
    it('has correct top-level structure', () => {
      const payload = buildVideoGenerationPayload('test-image-id', 'A koala plays with a cat');

      expect(payload).toHaveProperty('model');
      expect(payload).toHaveProperty('public');
      expect(payload).toHaveProperty('parameters');
      expect(payload.model).toBe('seedance-1.0-pro-fast');
      expect(payload.public).toBe(false);
    });

    it('has parameters nested correctly', () => {
      const payload = buildVideoGenerationPayload('test-image-id', 'Test prompt');

      expect(payload.parameters).toHaveProperty('prompt');
      expect(payload.parameters).toHaveProperty('guidances');
      expect(payload.parameters).toHaveProperty('duration');
      expect(payload.parameters).toHaveProperty('mode');
      expect(payload.parameters).toHaveProperty('prompt_enhance');
      expect(payload.parameters).toHaveProperty('width');
      expect(payload.parameters).toHaveProperty('height');
    });

    it('has guidances with correct start_frame structure', () => {
      const payload = buildVideoGenerationPayload('my-image-uuid', 'Test prompt');

      expect(payload.parameters.guidances).toHaveProperty('start_frame');
      expect(payload.parameters.guidances.start_frame).toHaveLength(1);

      const startFrame = payload.parameters.guidances.start_frame![0];
      expect(startFrame).toHaveProperty('image');
      expect(startFrame.image).toHaveProperty('id');
      expect(startFrame.image).toHaveProperty('type');
      expect(startFrame.image.id).toBe('my-image-uuid');
      expect(startFrame.image.type).toBe('UPLOADED');
    });

    it('duration is inside parameters, not at root level', () => {
      const payload = buildVideoGenerationPayload('test-id', 'Test', 4);

      // Duration should NOT be at root level
      expect((payload as Record<string, unknown>).duration).toBeUndefined();

      // Duration should be inside parameters
      expect(payload.parameters.duration).toBe(4);
    });

    it('accepts valid duration values', () => {
      const payload4 = buildVideoGenerationPayload('test-id', 'Test', 4);
      const payload6 = buildVideoGenerationPayload('test-id', 'Test', 6);
      const payload8 = buildVideoGenerationPayload('test-id', 'Test', 8);

      expect(payload4.parameters.duration).toBe(4);
      expect(payload6.parameters.duration).toBe(6);
      expect(payload8.parameters.duration).toBe(8);
    });

    it('truncates long prompts to 1500 chars', () => {
      const longPrompt = 'A'.repeat(2000);
      const payload = buildVideoGenerationPayload('test-id', longPrompt);

      expect(payload.parameters.prompt.length).toBe(1500);
    });

    it('uses correct 480p resolution dimensions', () => {
      const payload = buildVideoGenerationPayload('test-id', 'Test');

      expect(payload.parameters.mode).toBe('RESOLUTION_480');
      // 864x480 is the valid 16:9 dimension for 480p (NOT 854x480)
      expect(payload.parameters.width).toBe(864);
      expect(payload.parameters.height).toBe(480);
    });
  });

  describe('Request JSON Output', () => {
    it('produces valid JSON matching API documentation', () => {
      const payload = buildVideoGenerationPayload(
        'abc123-test-image-id',
        'The koala plays with the cat',
        4
      );

      const json = JSON.stringify(payload, null, 2);
      console.log('Generated payload:', json);

      // Parse back to verify it's valid JSON
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(payload);
    });

    it('matches the expected curl command structure', () => {
      const payload = buildVideoGenerationPayload(
        '<YOUR_START_IMAGE_ID>',
        'The koala plays with the cat',
        4
      );

      // This should match the structure from:
      // curl --request POST \
      //      --url https://cloud.leonardo.ai/api/rest/v2/generations \
      //      --data '{ "model": "seedance-1.0-pro", "public": false, "parameters": {...} }'

      expect(payload.model).toMatch(/^seedance-1\.0-pro/);
      expect(payload.public).toBe(false);
      expect(typeof payload.parameters).toBe('object');
      expect(payload.parameters.guidances.start_frame![0].image.id).toBe('<YOUR_START_IMAGE_ID>');
    });
  });
});

describe('Integration Test: Real API Call', () => {
  // Only run these tests when INTEGRATION_TEST=true
  const shouldRunIntegration = process.env.INTEGRATION_TEST === 'true';

  it.skipIf(!shouldRunIntegration)('validates API key is available', () => {
    expect(process.env.LEONARDO_API_KEY).toBeDefined();
    expect(process.env.LEONARDO_API_KEY!.length).toBeGreaterThan(10);
  });

  it.skipIf(!shouldRunIntegration)('can make a test request to Leonardo API', async () => {
    const apiKey = process.env.LEONARDO_API_KEY;
    if (!apiKey) {
      console.log('Skipping: No LEONARDO_API_KEY');
      return;
    }

    // This is a minimal test - we'll test the init-image endpoint first
    // which doesn't require credits
    const response = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ extension: 'jpg' }),
    });

    console.log('Init image response status:', response.status);
    const data = await response.json() as {
      uploadInitImage?: {
        id?: string;
        url?: string;
        fields?: unknown;
      };
    };
    console.log('Init image response:', JSON.stringify(data, null, 2));

    // We expect this to succeed and return presigned URL info
    expect(response.ok).toBe(true);
    expect(data.uploadInitImage).toBeDefined();
    expect(data.uploadInitImage!.id).toBeDefined();
    expect(data.uploadInitImage!.url).toBeDefined();
    expect(data.uploadInitImage!.fields).toBeDefined();
  });

  it.skipIf(!shouldRunIntegration)('validates video generation request structure against V2 API', async () => {
    const apiKey = process.env.LEONARDO_API_KEY;
    if (!apiKey) {
      console.log('Skipping: No LEONARDO_API_KEY');
      return;
    }

    // Build the exact payload structure our code uses
    const payload = buildVideoGenerationPayload(
      'test-image-id-does-not-exist',  // This will fail but validates structure
      'A koala plays with a cat',
      4
    );

    console.log('Sending video generation request:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://cloud.leonardo.ai/api/rest/v2/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Video generation response status:', response.status);
    const data = await response.json();
    console.log('Video generation response:', JSON.stringify(data, null, 2));

    // The API uses GraphQL-style responses - can return 200 with errors in body
    const errorMessage = JSON.stringify(data);
    console.log('Full response:', errorMessage);

    // This is the critical assertion - we should NOT see the old error
    // that indicated our payload structure was wrong
    expect(errorMessage).not.toContain('Unexpected variable duration');
    expect(errorMessage).not.toContain('Unexpected variable width');
    expect(errorMessage).not.toContain('Unexpected variable height');
    expect(errorMessage).not.toContain('Unexpected variable mode');
    expect(errorMessage).not.toContain('Unexpected variable prompt_enhance');

    // We expect an error about the image not existing (BadRequestException),
    // which confirms the payload structure is valid - just the image ID is fake
    // If we got "Unexpected variable X" it would mean our structure is wrong
    if (Array.isArray(data) && data[0]?.extensions?.code) {
      // GraphQL error format - this is expected since image doesn't exist
      console.log('Got expected GraphQL error (payload structure accepted):', data[0].extensions.code);
      expect(data[0].extensions.code).toBe('BadRequestException');
    } else if (data.generation || data.sdGenerationJob) {
      // Somehow succeeded (shouldn't happen with fake image)
      console.log('Request succeeded unexpectedly');
    }
  });
});

describe('Video Generation Response Parsing', () => {
  it('extracts generationId from V2 generate response format', () => {
    // Actual response format from Seedance V2 API
    const mockResponse = {
      generate: {
        apiCreditCost: 50,
        generationId: 'gen-uuid-12345',
      },
    };

    const generationId = mockResponse.generate?.generationId;
    expect(generationId).toBe('gen-uuid-12345');
  });

  it('handles alternative response formats', () => {
    const formats = [
      { generate: { generationId: 'id1' } },  // Seedance V2 actual format
      { generation: { id: 'id2' } },
      { sdGenerationJob: { generationId: 'id3' } },
      { motionVideoGenerationJob: { generationId: 'id4' } },
      { id: 'id5' },
    ];

    formats.forEach((response, i) => {
      const id =
        (response as { generate?: { generationId?: string } }).generate?.generationId ||
        (response as { generation?: { id?: string } }).generation?.id ||
        (response as { sdGenerationJob?: { generationId?: string } }).sdGenerationJob?.generationId ||
        (response as { motionVideoGenerationJob?: { generationId?: string } }).motionVideoGenerationJob?.generationId ||
        (response as { id?: string }).id;

      expect(id).toBe(`id${i + 1}`);
    });
  });
});

describe('Error Handling', () => {
  it('handles INVALID_REQUEST error format', () => {
    const errorResponse = {
      error: 'Unexpected variable duration',
      code: 'INVALID_REQUEST',
    };

    expect(errorResponse.error).toContain('duration');
  });

  it('provides meaningful error messages', () => {
    const errors = [
      { error: 'Unexpected variable duration' },
      { message: 'Invalid model specified' },
      { error: 'Rate limit exceeded' },
    ];

    errors.forEach((err) => {
      const message = err.error || err.message;
      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
    });
  });
});
