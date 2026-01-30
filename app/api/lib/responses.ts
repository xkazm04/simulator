/**
 * API Response Utilities
 * Shared helpers for consistent API responses.
 */

import { NextResponse } from 'next/server';

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function error(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function notFound(resource = 'Resource') {
  return error(`${resource} not found`, 404);
}

export function badRequest(message: string) {
  return error(message, 400);
}
