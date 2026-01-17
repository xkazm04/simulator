/**
 * Test Utilities - Custom render functions and mock factories
 *
 * Provides:
 * - Custom render with all context providers
 * - Mock factories for common data structures
 * - Test helpers for async operations
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Re-export everything from testing-library
export * from '@testing-library/react';
export { userEvent };

// Import simulator providers
import { BrainProvider } from '@/app/features/simulator/subfeature_brain/BrainContext';
import { DimensionsProvider } from '@/app/features/simulator/subfeature_dimensions/DimensionsContext';
import { PromptsProvider } from '@/app/features/simulator/subfeature_prompts/PromptsContext';
import { SimulatorProvider } from '@/app/features/simulator/SimulatorContext';

// Import types
import {
  Dimension,
  DimensionType,
  GeneratedPrompt,
  PromptElement,
  NegativePromptItem,
  OutputMode,
} from '@/app/features/simulator/types';

/**
 * All providers wrapper for simulator components
 */
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

/**
 * Custom render that wraps components in all necessary providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Override the default render
export { customRender as render };

// ============================================================================
// Mock Factories
// ============================================================================

let idCounter = 0;
const generateId = () => `test-id-${++idCounter}`;

/**
 * Create a mock dimension
 */
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

/**
 * Create a mock prompt element
 */
export function createMockElement(overrides: Partial<PromptElement> = {}): PromptElement {
  return {
    id: generateId(),
    text: 'Test element',
    category: 'composition',
    locked: false,
    ...overrides,
  };
}

/**
 * Create a mock generated prompt
 */
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

/**
 * Create a mock negative prompt item
 */
export function createMockNegativePrompt(overrides: Partial<NegativePromptItem> = {}): NegativePromptItem {
  return {
    id: generateId(),
    text: 'blurry',
    scope: 'global',
    isAutoSuggested: false,
    ...overrides,
  };
}

/**
 * Create a set of default dimensions
 */
export function createDefaultDimensions(): Dimension[] {
  return [
    createMockDimension({ type: 'environment', label: 'Environment', reference: 'Star Wars cantina' }),
    createMockDimension({ type: 'characters', label: 'Characters', reference: 'Jedi knights' }),
    createMockDimension({ type: 'artStyle', label: 'Art Style', reference: 'Anime cel-shaded' }),
    createMockDimension({ type: 'mood', label: 'Mood', reference: 'Epic and mysterious' }),
  ];
}

// ============================================================================
// API Mock Helpers
// ============================================================================

/**
 * Create a mock successful API response
 */
export function mockApiResponse<T>(data: T, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

/**
 * Create a mock failed API response
 */
export function mockApiError(message: string, status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(message),
  });
}

/**
 * Mock the generate-with-feedback API response
 */
export function mockGenerateWithFeedbackResponse(prompts: Partial<GeneratedPrompt>[] = []) {
  const defaultPrompts = prompts.length > 0 ? prompts : [
    { sceneType: 'Cinematic Wide Shot' },
    { sceneType: 'Hero Portrait' },
    { sceneType: 'Action Sequence' },
    { sceneType: 'Environmental Storytelling' },
  ];

  return {
    success: true,
    adjustedDimensions: [],
    prompts: defaultPrompts.map((p, i) => ({
      id: `prompt-${i}`,
      sceneNumber: i + 1,
      sceneType: p.sceneType || 'Cinematic Wide Shot',
      prompt: p.prompt || `Generated prompt ${i + 1}`,
      negativePrompt: p.negativePrompt || 'blurry, low quality',
      elements: p.elements || [
        { id: `elem-${i}-0`, text: 'element 1', category: 'composition', locked: false },
      ],
    })),
    reasoning: 'Mock generation successful',
  };
}

/**
 * Mock the image generation API response
 */
export function mockImageGenerationResponse(promptIds: string[]) {
  return {
    success: true,
    generations: promptIds.map((id) => ({
      promptId: id,
      generationId: `gen-${id}`,
      status: 'started' as const,
    })),
  };
}

/**
 * Mock the image status check response
 */
export function mockImageStatusResponse(status: 'PENDING' | 'COMPLETE' | 'FAILED', imageUrl?: string) {
  return {
    success: true,
    status,
    images: status === 'COMPLETE' ? [{ url: imageUrl || 'https://example.com/image.png' }] : [],
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Wait for a condition to be true
 */
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

/**
 * Create a deferred promise for controlling async flow in tests
 */
export function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Reset the ID counter (call in beforeEach)
 */
export function resetIdCounter() {
  idCounter = 0;
}
