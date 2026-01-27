# Testing Patterns

**Analysis Date:** 2026-01-27

## Test Framework

**Runner:**
- Vitest 4.0.17
- Config: `C:\Users\kazda\kiro\simulator\vitest.config.ts`

**Assertion Library:**
- Vitest built-in assertions + `@testing-library/jest-dom` matchers

**Run Commands:**
```bash
npm test                    # Run tests in watch mode
npm run test:run           # Run all tests once (CI mode)
npm run test:coverage      # Run tests with coverage report
npm run test:ui            # Run with Vitest UI
npm run test:e2e           # Run Playwright E2E tests
npm run test:e2e:ui        # Run E2E tests with UI
```

## Test File Organization

**Location:**
- **Unit tests:** Co-located with source files in `__tests__` directories
  - Example: `app/api/ai/__tests__/generate-images.test.ts`
  - Tests placed in subdirectory relative to route
- **Setup files:** `test/setup.tsx` and `test/test-utils.tsx`
- **E2E tests:** Separate from unit tests (not in `__tests__/`)

**Naming:**
- Pattern: `[module-name].test.ts` or `[module-name].spec.ts`
- Example: `generate-images.test.ts`

**Structure:**
```
app/
├── api/
│   └── ai/
│       └── __tests__/
│           └── generate-images.test.ts
└── features/
    └── simulator/
        ├── __tests__/
        │   └── [component].test.tsx
```

## Test Structure

**Suite Organization:**
From `app/api/ai/__tests__/generate-images.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('/api/ai/generate-images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('accepts valid request with prompts', async () => {
      const validRequest = { ... };
      expect(validRequest.prompts).toHaveLength(2);
    });

    it('accepts request without negativePrompt', () => {
      // Test implementation
    });
  });

  describe('Negative Prompt Flow', () => {
    // Related tests grouped together
  });
});
```

**Patterns:**
- **Setup:** `beforeEach()` clears mocks and state
- **Teardown:** Not explicitly used; `afterEach()` available if needed
- **Assertion:** `expect()` with jest-dom matchers

## Mocking

**Framework:** Vitest's native `vi` module

**Patterns:**
From test setup (`test/setup.tsx`):
```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

// Mock service with spies
vi.mock('@/app/lib/services/leonardo', () => ({
  LeonardoService: vi.fn().mockImplementation(() => ({
    startGeneration: vi.fn().mockResolvedValue({ generationId: 'test-gen-id' }),
    checkGenerationStatus: vi.fn().mockResolvedValue({
      status: 'COMPLETE',
      images: [{ url: 'https://example.com/image.png' }],
    }),
    deleteGeneration: vi.fn().mockResolvedValue(true),
  })),
}));
```

**What to Mock:**
- External API calls (Leonardo, Anthropic, Google)
- Next.js navigation and routing: `next/navigation`, `next/image`
- Browser APIs: `window.matchMedia`, `navigator.clipboard`, `IndexedDB`
- Service classes that make HTTP requests
- Global objects: `ResizeObserver`, `IntersectionObserver`

**What NOT to Mock:**
- Core business logic (pure functions, validation)
- State management logic
- Component rendering and interaction
- Data transformation utilities

**Mock Implementation:**
- Use `vi.fn().mockResolvedValue()` for async operations
- Use `vi.fn().mockReturnValue()` for synchronous operations
- Use `vi.spyOn()` to spy on existing implementations
- Clear mocks with `vi.clearAllMocks()` in `beforeEach()`

## Fixtures and Factories

**Test Data:**
From `test/test-utils.tsx`:
```typescript
export function createMockDimension(overrides: Partial<Dimension> = {}): Dimension {
  return {
    id: generateId(),
    type: 'environment' as DimensionType,
    label: 'Environment',
    icon: 'Globe',
    placeholder: 'Enter environment reference...',
    reference: '',
    weight: 100,
    filterMode: 'preserve_structure',
    transformMode: 'replace',
    ...overrides,
  };
}

export function createMockPrompt(overrides: Partial<GeneratedPrompt> = {}): GeneratedPrompt {
  return {
    id: generateId(),
    sceneNumber: 1,
    sceneType: 'Cinematic Wide Shot',
    prompt: 'A cinematic wide shot of a fantasy landscape',
    negativePrompt: 'blurry, low quality, watermark',
    copied: false,
    rating: null,
    locked: false,
    elements: [
      createMockElement({ category: 'composition', text: 'wide shot' }),
      createMockElement({ category: 'setting', text: 'fantasy landscape' }),
    ],
    ...overrides,
  };
}

export function createDefaultDimensions(): Dimension[] {
  return [
    createMockDimension({ type: 'environment', label: 'Environment', reference: 'Star Wars cantina' }),
    createMockDimension({ type: 'characters', label: 'Characters', reference: 'Jedi knights' }),
    createMockDimension({ type: 'artStyle', label: 'Art Style', reference: 'Anime cel-shaded' }),
    createMockDimension({ type: 'mood', label: 'Mood', reference: 'Epic and mysterious' }),
  ];
}
```

**Location:**
- Factory functions: `test/test-utils.tsx`
- Mock API responses: same file with `mockGenerateWithFeedbackResponse()`, `mockImageGenerationResponse()`, etc.
- Used via: `import { createMockDimension, createMockPrompt, render } from '@/test/test-utils'`

## Coverage

**Requirements:**
From `vitest.config.ts`:
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: [
    'app/features/simulator/**/*.{ts,tsx}',
    'app/lib/**/*.ts',
    'app/api/**/*.ts',
  ],
  exclude: [
    '**/*.test.{ts,tsx}',
    '**/types.ts',
    '**/index.ts',
    '**/*.d.ts',
  ],
  thresholds: {
    statements: 70,
    branches: 60,
    functions: 70,
    lines: 70,
  },
}
```

**Thresholds Enforced:**
- Statements: 70%
- Branches: 60%
- Functions: 70%
- Lines: 70%

**View Coverage:**
```bash
npm run test:coverage    # Generates HTML report in ./coverage/
open coverage/index.html # View in browser
```

**Excluded from Coverage:**
- Type definition files (`*.d.ts`)
- Barrel files (`index.ts`)
- Type files (`types.ts`)
- Test files themselves

## Test Types

**Unit Tests:**
- Scope: Individual functions, components in isolation
- Approach: Mock dependencies, test pure logic
- Example: `generate-images.test.ts` tests API endpoint request validation
- Location: `app/api/ai/__tests__/`

**Integration Tests:**
- Scope: Multiple components/services working together
- Approach: Use real test doubles (factories) for data, mock external APIs
- Approach: Test context providers and hook interactions
- Example: Component tests using `render()` with `AllProviders` wrapper from `test/test-utils.tsx`

**Component Tests:**
- Uses custom `render()` from `test/test-utils.tsx`
- Wraps in all necessary providers: `BrainProvider`, `DimensionsProvider`, `PromptsProvider`, `SimulatorProvider`
- Tests user interactions with `userEvent` from testing-library
- Example:
  ```typescript
  import { render, screen } from '@/test/test-utils';

  describe('MyComponent', () => {
    it('renders with default props', () => {
      render(<MyComponent />);
      expect(screen.getByText('Expected text')).toBeInTheDocument();
    });
  });
  ```

**E2E Tests:**
- Framework: Playwright 1.57
- Config: `playwright.config.ts`
- Run: `npm run test:e2e` or `npm run test:e2e:ui`
- Scope: Full user workflows in real browser

## Common Patterns

**Async Testing:**
```typescript
// Example from generate-images.test.ts
it('accepts valid request with prompts', async () => {
  const validRequest = {
    prompts: [
      { id: 'prompt-1', text: 'A fantasy landscape', negativePrompt: 'blurry' },
    ],
  };

  // Assertions on async result
  expect(validRequest.prompts).toHaveLength(1);
});

// With actual async operations
it('handles async operations', async () => {
  const result = await asyncFunction();
  expect(result).toEqual({ success: true });
});
```

**Error Testing:**
```typescript
// Structure validation
it('validates required fields', () => {
  const invalidRequest = {
    prompts: [] // Empty, should fail
  };

  expect(invalidRequest.prompts).toHaveLength(0);
  // In real test: would call endpoint and check error response
});

// Error handling
it('returns error for invalid input', async () => {
  const response = await callAPI({ invalid: true });
  expect(response.ok).toBe(false);
  expect(response.status).toBe(400);
});
```

**Mocking Context and Providers:**
```typescript
// From test/test-utils.tsx - AllProviders wrapper
function AllProviders({ children }: { children: ReactNode }) {
  return (
    <BrainProvider>
      <DimensionsProvider>
        <PromptsProvider>
          <SimulatorProvider>
            {children}
          </SimulatorProvider>
        </PromptsProvider>
      </DimensionsProvider>
    </BrainProvider>
  );
}

// Use in tests
it('renders with all providers', () => {
  render(<MyComponent />, { wrapper: AllProviders });
  // Component now has access to all contexts
});
```

**Waiting for Conditions:**
```typescript
// Helper from test/test-utils.tsx
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Condition not met within timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// Usage in tests
it('waits for async state update', async () => {
  render(<Component />);
  await waitForCondition(() => screen.queryByText('Loaded') !== null);
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

**Testing Hooks:**
```typescript
// React Testing Library pattern
import { renderHook, act } from '@testing-library/react';

it('updates state on action', () => {
  const { result } = renderHook(() => useMyHook());

  act(() => {
    result.current.handleUpdate('new value');
  });

  expect(result.current.value).toBe('new value');
});
```

## Test Timeout and Hooks

**Timeout Configuration:**
```typescript
testTimeout: 10000,    // 10 seconds
hookTimeout: 10000,    // 10 seconds for hook setup
```

**Standard Timeout:** 10 seconds for all tests
- Increase if testing slow operations: `it('test', async () => { ... }, 20000)`

## Global Test Setup

**File:** `test/setup.tsx`

**Includes:**
1. Testing Library Jest-DOM matchers: `import '@testing-library/jest-dom'`
2. Next.js mocks: `next/navigation`, `next/image`
3. Browser API mocks: `window.matchMedia`, `ResizeObserver`, `IntersectionObserver`
4. Node.js global mocks: `navigator.clipboard`, `fetch`, `indexedDB`
5. Cleanup hooks: `afterEach` clears mocks, `beforeAll`/`afterAll` manage console spies

**Console Mocking:**
```typescript
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
```

## Best Practices

1. **Isolate Units:** Mock external dependencies, test core logic
2. **Use Factories:** Create test data with `createMock*` functions
3. **Clear Mocks:** Always call `vi.clearAllMocks()` in `beforeEach()`
4. **Test Behavior:** Test what components/functions DO, not implementation
5. **Meaningful Names:** Test names should describe the scenario clearly
6. **Group Tests:** Use nested `describe()` blocks by feature area
7. **Avoid Flakiness:** Don't depend on timing; use explicit waits
8. **Maintain Coverage:** Keep coverage above thresholds; exclude only necessary files

---

*Testing analysis: 2026-01-27*
