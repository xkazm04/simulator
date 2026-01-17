/**
 * Test Setup - Global configuration for Vitest
 *
 * Sets up:
 * - jsdom environment
 * - Testing Library custom matchers
 * - Global mocks for Next.js and browser APIs
 */

import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  callback: IntersectionObserverCallback;
  root = null;
  rootMargin = '';
  thresholds = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock IndexedDB for preference storage
const mockIndexedDB = {
  open: vi.fn().mockReturnValue({
    result: {
      objectStoreNames: { contains: vi.fn().mockReturnValue(true) },
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ onsuccess: null, onerror: null, result: null }),
          put: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
          getAll: vi.fn().mockReturnValue({ onsuccess: null, onerror: null, result: [] }),
          index: vi.fn().mockReturnValue({
            getAll: vi.fn().mockReturnValue({ onsuccess: null, onerror: null, result: [] }),
          }),
        }),
      }),
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  }),
};
global.indexedDB = mockIndexedDB as unknown as IDBFactory;

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Suppress console errors during tests (optional, remove for debugging)
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
