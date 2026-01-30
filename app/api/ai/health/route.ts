/**
 * AI Provider Health Status Endpoint
 *
 * Returns real-time health status for all AI providers including
 * availability, error rates, rate limit status, and last success timestamps.
 */

import { NextResponse } from 'next/server';
import { healthCheck, getProviderHealth } from '@/app/lib/ai/health-check';
import type { AIProviderType } from '@/app/lib/ai/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/ai/health
 * Returns health status for all providers
 *
 * Query params:
 * - provider: (optional) Get health for specific provider only
 *
 * Response format:
 * {
 *   timestamp: number,
 *   overall: 'healthy' | 'degraded' | 'down',
 *   providers: {
 *     claude: { status, errorRate, rateLimit, ... },
 *     gemini: { status, errorRate, rateLimit, ... },
 *     leonardo: { status, errorRate, rateLimit, ... }
 *   }
 * }
 */
export async function GET(request: Request): Promise<NextResponse> {
  const startTime = performance.now();

  try {
    const { searchParams } = new URL(request.url);
    const providerParam = searchParams.get('provider');

    // If specific provider requested, return only that
    if (providerParam) {
      const validProviders: AIProviderType[] = ['claude', 'gemini', 'leonardo'];
      if (!validProviders.includes(providerParam as AIProviderType)) {
        return NextResponse.json(
          {
            error: 'Invalid provider',
            message: `Provider must be one of: ${validProviders.join(', ')}`,
          },
          { status: 400 }
        );
      }

      const health = getProviderHealth(providerParam as AIProviderType);
      const latencyMs = performance.now() - startTime;

      return NextResponse.json(
        {
          timestamp: Date.now(),
          latencyMs: Math.round(latencyMs * 100) / 100,
          provider: health,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // Return health for all providers
    const healthStatus = healthCheck();
    const latencyMs = performance.now() - startTime;

    return NextResponse.json(
      {
        ...healthStatus,
        latencyMs: Math.round(latencyMs * 100) / 100,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    const latencyMs = performance.now() - startTime;

    console.error('[Health Check Error]', error);

    return NextResponse.json(
      {
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Math.round(latencyMs * 100) / 100,
      },
      { status: 500 }
    );
  }
}
