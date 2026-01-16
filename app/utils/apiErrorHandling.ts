import { NextResponse } from 'next/server';

/**
 * HTTP Status Code Constants
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Standard error response structure
 */
interface ErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
}

/**
 * Logger utility
 */
export const logger = {
  error: (context: string, error: unknown, additionalInfo?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ERROR] ${context}:`, error, additionalInfo || '');
    }
  },

  warn: (context: string, message: string, additionalInfo?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[WARN] ${context}:`, message, additionalInfo || '');
    }
  },

  info: (context: string, message: string, additionalInfo?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] ${context}:`, message, additionalInfo || '');
    }
  },
};

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number,
  message?: string,
  details?: unknown
): NextResponse<ErrorResponse> {
  const responseBody: ErrorResponse = { error };
  if (message) {
    responseBody.message = message;
  }
  if (details) {
    responseBody.details = details;
  }
  return NextResponse.json(responseBody, { status });
}

/**
 * Handles unexpected errors with proper logging
 */
export function handleUnexpectedError(
  endpoint: string,
  error: unknown
): NextResponse<ErrorResponse> {
  logger.error(`Unexpected error in ${endpoint}`, error);

  return createErrorResponse(
    'Internal server error',
    500,
    error instanceof Error ? error.message : 'An unexpected error occurred'
  );
}
