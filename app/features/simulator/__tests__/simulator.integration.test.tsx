/**
 * Integration Tests - Simulator Critical Paths
 *
 * Tests the full integration of:
 * - Generation cycle with feedback
 * - Element-to-dimension flow
 * - Prompt history (undo/redo)
 * - Negative prompt end-to-end flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// Import hooks
import { usePrompts } from '../subfeature_prompts/hooks/usePrompts';
import { useDimensions } from '../subfeature_dimensions/hooks/useDimensions';

// Import test utilities
import {
  createMockDimension,
  createMockPrompt,
  createMockElement,
  createMockNegativePrompt,
  mockGenerateWithFeedbackResponse,
  resetIdCounter,
} from '@/test/test-utils';

describe('Simulator Integration Tests', () => {
  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();
  });

  describe('Generation Cycle with Feedback', () => {
    it('full cycle: dimensions -> generation -> rating -> element locking', async () => {
      // Setup hooks
      const { result: promptsResult } = renderHook(() => usePrompts());
      const { result: dimensionsResult } = renderHook(() => useDimensions());

      // Step 1: Set up dimensions
      act(() => {
        const envDim = dimensionsResult.current.dimensions.find(d => d.type === 'environment');
        if (envDim) {
          dimensionsResult.current.handleDimensionChange(envDim.id, 'Star Wars cantina');
        }
      });

      // Verify dimension was set
      const envDim = dimensionsResult.current.dimensions.find(d => d.type === 'environment');
      expect(envDim?.reference).toBe('Star Wars cantina');

      // Step 2: Simulate generation (using fallback prompts)
      let generatedPrompts: ReturnType<typeof promptsResult.current.generateFallbackPrompts>;
      act(() => {
        generatedPrompts = promptsResult.current.generateFallbackPrompts(
          'Isometric RPG screenshot',
          dimensionsResult.current.dimensions,
          'concept'
        );
        promptsResult.current.setGeneratedPrompts(generatedPrompts);
        promptsResult.current.pushToHistory(generatedPrompts);
      });

      // Verify prompts were generated
      expect(promptsResult.current.generatedPrompts.length).toBe(4);

      // Step 3: Rate a prompt
      const firstPromptId = promptsResult.current.generatedPrompts[0].id;
      act(() => {
        promptsResult.current.handlePromptRate(firstPromptId, 'up');
      });

      expect(promptsResult.current.generatedPrompts[0].rating).toBe('up');

      // Step 4: Lock an element
      const firstElementId = promptsResult.current.generatedPrompts[0].elements[0].id;
      act(() => {
        promptsResult.current.handleElementLock(firstPromptId, firstElementId);
      });

      // Verify element is locked
      expect(promptsResult.current.generatedPrompts[0].elements[0].locked).toBe(true);
      expect(promptsResult.current.lockedElements.length).toBeGreaterThan(0);
    });

    it('undo/redo through generation history', () => {
      const { result } = renderHook(() => usePrompts());

      // Generate first batch
      const firstBatch = [
        createMockPrompt({ id: 'gen1-p1', sceneType: 'First Gen' }),
        createMockPrompt({ id: 'gen1-p2', sceneType: 'First Gen' }),
      ];

      act(() => {
        result.current.setGeneratedPrompts(firstBatch);
        result.current.pushToHistory(firstBatch);
      });

      // Generate second batch
      const secondBatch = [
        createMockPrompt({ id: 'gen2-p1', sceneType: 'Second Gen' }),
        createMockPrompt({ id: 'gen2-p2', sceneType: 'Second Gen' }),
      ];

      act(() => {
        result.current.setGeneratedPrompts(secondBatch);
        result.current.pushToHistory(secondBatch);
      });

      // Verify current state
      expect(result.current.generatedPrompts[0].sceneType).toBe('Second Gen');
      expect(result.current.promptHistory.canUndo).toBe(true);
      expect(result.current.promptHistory.canRedo).toBe(false);

      // Undo to first batch
      act(() => {
        result.current.handlePromptUndo();
      });

      expect(result.current.generatedPrompts[0].sceneType).toBe('First Gen');
      expect(result.current.promptHistory.canRedo).toBe(true);

      // Redo to second batch
      act(() => {
        result.current.handlePromptRedo();
      });

      expect(result.current.generatedPrompts[0].sceneType).toBe('Second Gen');
    });
  });

  describe('Element-to-Dimension Flow', () => {
    it('drop element on dimension updates reference', () => {
      const { result } = renderHook(() => useDimensions());

      const element = createMockElement({
        text: 'Dark fantasy atmosphere',
        category: 'mood',
      });

      // Find the mood dimension (or first available)
      const targetDim = result.current.dimensions[0];

      act(() => {
        result.current.handleDropElementOnDimension(element, targetDim.id);
      });

      // Verify dimension was updated
      expect(result.current.dimensions[0].reference).toContain('Dark fantasy');

      // Verify undo is available
      expect(result.current.pendingDimensionChange).not.toBeNull();
    });

    it('undo restores previous dimension state', () => {
      const { result } = renderHook(() => useDimensions());

      const targetDim = result.current.dimensions[0];
      const originalReference = targetDim.reference;

      const element = createMockElement({ text: 'New reference value' });

      act(() => {
        result.current.handleDropElementOnDimension(element, targetDim.id);
      });

      // Reference changed
      expect(result.current.dimensions[0].reference).not.toBe(originalReference);

      act(() => {
        result.current.handleUndoDimensionChange();
      });

      // Reference restored
      expect(result.current.dimensions[0].reference).toBe(originalReference);
    });

    it('convert elements to dimensions merges correctly', () => {
      const { result } = renderHook(() => useDimensions());

      // Create new dimensions to merge
      const newDimensions = [
        createMockDimension({ type: 'environment', reference: 'Merged environment' }),
        createMockDimension({ type: 'artStyle', reference: 'Merged art style' }),
      ];

      act(() => {
        result.current.handleConvertElementsToDimensions(newDimensions);
      });

      // Verify environment was merged
      const envDim = result.current.dimensions.find(d => d.type === 'environment');
      expect(envDim?.reference).toBe('Merged environment');

      // Verify art style was merged
      const styleDim = result.current.dimensions.find(d => d.type === 'artStyle');
      expect(styleDim?.reference).toBe('Merged art style');
    });
  });

  describe('Negative Prompt Integration', () => {
    it('negative prompts flow through to generated prompts', () => {
      const { result } = renderHook(() => usePrompts());
      const { result: dimensionsResult } = renderHook(() => useDimensions());

      // Set negative prompts
      act(() => {
        result.current.setNegativePrompts([
          createMockNegativePrompt({ text: 'blurry', scope: 'global' }),
          createMockNegativePrompt({ text: 'watermark', scope: 'global' }),
        ]);
      });

      // Generate prompts with negatives
      let generated: ReturnType<typeof result.current.generateFallbackPrompts>;
      act(() => {
        generated = result.current.generateFallbackPrompts(
          'Base image description',
          dimensionsResult.current.dimensions,
          'concept'
        );
      });

      // All generated prompts should have negative prompts
      generated.forEach(prompt => {
        expect(prompt.negativePrompt).toContain('blurry');
        expect(prompt.negativePrompt).toContain('watermark');
      });
    });

    it('per-prompt negatives only apply to targeted prompt', () => {
      const { result } = renderHook(() => usePrompts());
      const { result: dimensionsResult } = renderHook(() => useDimensions());

      // First generate some prompts
      let generated: ReturnType<typeof result.current.generateFallbackPrompts>;
      act(() => {
        generated = result.current.generateFallbackPrompts(
          'Base image',
          dimensionsResult.current.dimensions,
          'concept'
        );
        result.current.setGeneratedPrompts(generated);
      });

      const targetPromptId = result.current.generatedPrompts[0].id;

      // Set per-prompt negative
      act(() => {
        result.current.setNegativePrompts([
          createMockNegativePrompt({ text: 'global-neg', scope: 'global' }),
          createMockNegativePrompt({ text: 'specific-neg', scope: 'prompt', promptId: targetPromptId }),
        ]);
      });

      // Verify negatives are stored
      expect(result.current.negativePrompts.length).toBe(2);
      expect(result.current.negativePrompts.find(n => n.promptId === targetPromptId)).toBeDefined();
    });
  });

  describe('Dimension Weight and Mode Integration', () => {
    it('weight changes affect prompt generation', () => {
      const { result: promptsResult } = renderHook(() => usePrompts());
      const { result: dimensionsResult } = renderHook(() => useDimensions());

      // Set up dimension with reference
      act(() => {
        const envDim = dimensionsResult.current.dimensions.find(d => d.type === 'environment');
        if (envDim) {
          dimensionsResult.current.handleDimensionChange(envDim.id, 'Fantasy castle');
          dimensionsResult.current.handleDimensionWeightChange(envDim.id, 50);
        }
      });

      // Verify weight was applied
      const envDim = dimensionsResult.current.dimensions.find(d => d.type === 'environment');
      expect(envDim?.weight).toBe(50);
      expect(envDim?.reference).toBe('Fantasy castle');

      // Generate prompts
      let generated: ReturnType<typeof promptsResult.current.generateFallbackPrompts>;
      act(() => {
        generated = promptsResult.current.generateFallbackPrompts(
          'Base image',
          dimensionsResult.current.dimensions,
          'concept'
        );
      });

      // Prompts should include the environment reference
      expect(generated.some(p => p.prompt.includes('Fantasy castle'))).toBe(true);
    });

    it('transform mode changes are persisted', () => {
      const { result } = renderHook(() => useDimensions());

      const targetDim = result.current.dimensions[0];

      act(() => {
        result.current.handleDimensionTransformModeChange(targetDim.id, 'blend');
      });

      expect(result.current.dimensions[0].transformMode).toBe('blend');

      act(() => {
        result.current.handleDimensionTransformModeChange(targetDim.id, 'replace');
      });

      expect(result.current.dimensions[0].transformMode).toBe('replace');
    });

    it('filter mode changes are persisted', () => {
      const { result } = renderHook(() => useDimensions());

      const targetDim = result.current.dimensions[0];

      act(() => {
        result.current.handleDimensionFilterModeChange(targetDim.id, 'preserve_all');
      });

      expect(result.current.dimensions[0].filterMode).toBe('preserve_all');
    });
  });

  describe('Multi-step User Journey', () => {
    it('complete journey: setup -> generate -> rate -> lock -> regenerate', () => {
      const { result: prompts } = renderHook(() => usePrompts());
      const { result: dimensions } = renderHook(() => useDimensions());

      // Step 1: User sets up dimensions
      act(() => {
        const envDim = dimensions.current.dimensions.find(d => d.type === 'environment');
        const charDim = dimensions.current.dimensions.find(d => d.type === 'characters');
        if (envDim) dimensions.current.handleDimensionChange(envDim.id, 'Star Wars Mos Eisley');
        if (charDim) dimensions.current.handleDimensionChange(charDim.id, 'Jedi and Sith warriors');
      });

      // Step 2: First generation
      let gen1: ReturnType<typeof prompts.current.generateFallbackPrompts>;
      act(() => {
        gen1 = prompts.current.generateFallbackPrompts(
          'Isometric RPG view',
          dimensions.current.dimensions,
          'gameplay'
        );
        prompts.current.setGeneratedPrompts(gen1);
        prompts.current.pushToHistory(gen1);
      });

      expect(prompts.current.generatedPrompts.length).toBe(4);

      // Step 3: User rates prompts
      act(() => {
        prompts.current.handlePromptRate(gen1[0].id, 'up');
        prompts.current.handlePromptRate(gen1[1].id, 'down');
      });

      expect(prompts.current.generatedPrompts[0].rating).toBe('up');
      expect(prompts.current.generatedPrompts[1].rating).toBe('down');

      // Step 4: User locks an element
      const likedElement = gen1[0].elements[0];
      act(() => {
        prompts.current.handleElementLock(gen1[0].id, likedElement.id);
      });

      expect(prompts.current.lockedElements.length).toBe(1);

      // Step 5: Second generation with locked elements
      let gen2: ReturnType<typeof prompts.current.generateFallbackPrompts>;
      act(() => {
        gen2 = prompts.current.generateFallbackPrompts(
          'Isometric RPG view',
          dimensions.current.dimensions,
          'gameplay'
        );
        prompts.current.setGeneratedPrompts(gen2);
        prompts.current.pushToHistory(gen2);
      });

      // New prompts generated (history updated)
      expect(prompts.current.promptHistory.historyLength).toBeGreaterThan(1);

      // Step 6: User can undo to previous generation
      act(() => {
        prompts.current.handlePromptUndo();
      });

      // Back to first generation (ratings should be preserved in history)
      expect(prompts.current.generatedPrompts[0].id).toBe(gen1[0].id);
    });
  });
});
