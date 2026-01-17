/**
 * Unit Tests for usePrompts Hook
 *
 * Tests the prompts state management including:
 * - Generated prompts state
 * - Prompt rating/locking
 * - Element locking
 * - Negative prompts
 * - Fallback prompt generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePrompts } from '../usePrompts';
import { createMockPrompt, createMockElement, createMockDimension, resetIdCounter } from '@/test/test-utils';
import { GeneratedPrompt } from '../../../types';

describe('usePrompts', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('initial state', () => {
    it('initializes with empty generated prompts', () => {
      const { result } = renderHook(() => usePrompts());

      expect(result.current.generatedPrompts).toEqual([]);
    });

    it('initializes with empty locked elements', () => {
      const { result } = renderHook(() => usePrompts());

      expect(result.current.lockedElements).toEqual([]);
    });

    it('initializes with empty negative prompts', () => {
      const { result } = renderHook(() => usePrompts());

      expect(result.current.negativePrompts).toEqual([]);
    });

    it('initializes hasLockedPrompts as false', () => {
      const { result } = renderHook(() => usePrompts());

      expect(result.current.hasLockedPrompts).toBe(false);
    });
  });

  describe('setGeneratedPrompts', () => {
    it('updates generated prompts', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts: GeneratedPrompt[] = [createMockPrompt()];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      expect(result.current.generatedPrompts).toEqual(prompts);
    });

    it('replaces existing prompts', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts1 = [createMockPrompt({ id: 'prompt-1' })];
      const prompts2 = [createMockPrompt({ id: 'prompt-2' })];

      act(() => {
        result.current.setGeneratedPrompts(prompts1);
      });

      act(() => {
        result.current.setGeneratedPrompts(prompts2);
      });

      expect(result.current.generatedPrompts).toEqual(prompts2);
    });
  });

  describe('handlePromptRate', () => {
    it('sets rating to up', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts = [createMockPrompt({ id: 'prompt-1', rating: null })];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      act(() => {
        result.current.handlePromptRate('prompt-1', 'up');
      });

      expect(result.current.generatedPrompts[0].rating).toBe('up');
    });

    it('sets rating to down', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts = [createMockPrompt({ id: 'prompt-1', rating: null })];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      act(() => {
        result.current.handlePromptRate('prompt-1', 'down');
      });

      expect(result.current.generatedPrompts[0].rating).toBe('down');
    });

    it('clears rating when set to null', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts = [createMockPrompt({ id: 'prompt-1', rating: 'up' })];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      act(() => {
        result.current.handlePromptRate('prompt-1', null);
      });

      expect(result.current.generatedPrompts[0].rating).toBeNull();
    });

    it('only affects the targeted prompt', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts = [
        createMockPrompt({ id: 'prompt-1', rating: null }),
        createMockPrompt({ id: 'prompt-2', rating: null }),
      ];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      act(() => {
        result.current.handlePromptRate('prompt-1', 'up');
      });

      expect(result.current.generatedPrompts[0].rating).toBe('up');
      expect(result.current.generatedPrompts[1].rating).toBeNull();
    });
  });

  describe('handlePromptLock', () => {
    it('locks an unlocked prompt', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts = [createMockPrompt({ id: 'prompt-1', locked: false })];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      act(() => {
        result.current.handlePromptLock('prompt-1');
      });

      expect(result.current.generatedPrompts[0].locked).toBe(true);
    });

    it('unlocks a locked prompt', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts = [createMockPrompt({ id: 'prompt-1', locked: true })];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      act(() => {
        result.current.handlePromptLock('prompt-1');
      });

      expect(result.current.generatedPrompts[0].locked).toBe(false);
    });

    it('updates hasLockedPrompts when prompt is locked', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts = [createMockPrompt({ id: 'prompt-1', locked: false })];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      expect(result.current.hasLockedPrompts).toBe(false);

      act(() => {
        result.current.handlePromptLock('prompt-1');
      });

      expect(result.current.hasLockedPrompts).toBe(true);
    });
  });

  describe('handleElementLock', () => {
    it('locks an element within a prompt', () => {
      const { result } = renderHook(() => usePrompts());
      const element = createMockElement({ id: 'elem-1', locked: false });
      const prompts = [createMockPrompt({ id: 'prompt-1', elements: [element] })];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      act(() => {
        result.current.handleElementLock('prompt-1', 'elem-1');
      });

      expect(result.current.generatedPrompts[0].elements[0].locked).toBe(true);
    });

    it('unlocks a locked element', () => {
      const { result } = renderHook(() => usePrompts());
      const element = createMockElement({ id: 'elem-1', locked: true });
      const prompts = [createMockPrompt({ id: 'prompt-1', elements: [element] })];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      act(() => {
        result.current.handleElementLock('prompt-1', 'elem-1');
      });

      expect(result.current.generatedPrompts[0].elements[0].locked).toBe(false);
    });

    it('updates lockedElements when element is locked', () => {
      const { result } = renderHook(() => usePrompts());
      const element = createMockElement({ id: 'elem-1', locked: false, text: 'Test element' });
      const prompts = [createMockPrompt({ id: 'prompt-1', elements: [element] })];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      expect(result.current.lockedElements).toHaveLength(0);

      act(() => {
        result.current.handleElementLock('prompt-1', 'elem-1');
      });

      expect(result.current.lockedElements).toHaveLength(1);
      expect(result.current.lockedElements[0].text).toBe('Test element');
    });
  });

  describe('handleCopy', () => {
    it('marks prompt as copied', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts = [createMockPrompt({ id: 'prompt-1', copied: false })];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      act(() => {
        result.current.handleCopy('prompt-1');
      });

      expect(result.current.generatedPrompts[0].copied).toBe(true);
    });
  });

  describe('setNegativePrompts', () => {
    it('updates negative prompts', () => {
      const { result } = renderHook(() => usePrompts());
      const negatives = [
        { id: '1', text: 'blurry', scope: 'global' as const },
      ];

      act(() => {
        result.current.setNegativePrompts(negatives);
      });

      expect(result.current.negativePrompts).toEqual(negatives);
    });
  });

  describe('clearPrompts', () => {
    it('clears all prompts', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts = [createMockPrompt()];

      act(() => {
        result.current.setGeneratedPrompts(prompts);
      });

      act(() => {
        result.current.clearPrompts();
      });

      expect(result.current.generatedPrompts).toEqual([]);
    });

    it('clears negative prompts', () => {
      const { result } = renderHook(() => usePrompts());

      act(() => {
        result.current.setNegativePrompts([{ id: '1', text: 'blurry', scope: 'global' }]);
      });

      act(() => {
        result.current.clearPrompts();
      });

      expect(result.current.negativePrompts).toEqual([]);
    });
  });

  describe('generateFallbackPrompts', () => {
    it('generates 4 prompts', () => {
      const { result } = renderHook(() => usePrompts());
      const dimensions = [createMockDimension({ type: 'environment', reference: 'Fantasy world' })];

      let fallbackPrompts: GeneratedPrompt[] = [];
      act(() => {
        fallbackPrompts = result.current.generateFallbackPrompts(
          'Isometric RPG screenshot',
          dimensions,
          'concept'
        );
      });

      expect(fallbackPrompts).toHaveLength(4);
    });

    it('generates prompts with different scene types', () => {
      const { result } = renderHook(() => usePrompts());
      const dimensions = [createMockDimension({ type: 'environment', reference: 'Fantasy world' })];

      let fallbackPrompts: GeneratedPrompt[] = [];
      act(() => {
        fallbackPrompts = result.current.generateFallbackPrompts(
          'Base image',
          dimensions,
          'concept'
        );
      });

      const sceneTypes = fallbackPrompts.map(p => p.sceneType);
      expect(new Set(sceneTypes).size).toBeGreaterThan(1);
    });

    it('includes negative prompts in generated prompts', () => {
      const { result } = renderHook(() => usePrompts());
      const dimensions = [createMockDimension({ type: 'environment', reference: 'Fantasy world' })];

      act(() => {
        result.current.setNegativePrompts([{ id: '1', text: 'custom-negative', scope: 'global' }]);
      });

      let fallbackPrompts: GeneratedPrompt[] = [];
      act(() => {
        fallbackPrompts = result.current.generateFallbackPrompts(
          'Base image',
          dimensions,
          'concept'
        );
      });

      expect(fallbackPrompts[0].negativePrompt).toContain('custom-negative');
    });

    it('generates prompts with elements', () => {
      const { result } = renderHook(() => usePrompts());
      const dimensions = [createMockDimension({ type: 'environment', reference: 'Fantasy world' })];

      let fallbackPrompts: GeneratedPrompt[] = [];
      act(() => {
        fallbackPrompts = result.current.generateFallbackPrompts(
          'Base image',
          dimensions,
          'concept'
        );
      });

      fallbackPrompts.forEach(prompt => {
        expect(prompt.elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('prompt history', () => {
    it('can undo to previous state', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts1 = [createMockPrompt({ id: 'prompt-1', sceneType: 'Scene 1' })];
      const prompts2 = [createMockPrompt({ id: 'prompt-2', sceneType: 'Scene 2' })];

      act(() => {
        result.current.setGeneratedPrompts(prompts1);
        result.current.pushToHistory(prompts1);
      });

      act(() => {
        result.current.setGeneratedPrompts(prompts2);
        result.current.pushToHistory(prompts2);
      });

      expect(result.current.generatedPrompts[0].sceneType).toBe('Scene 2');

      act(() => {
        result.current.handlePromptUndo();
      });

      expect(result.current.generatedPrompts[0].sceneType).toBe('Scene 1');
    });

    it('can redo after undo', () => {
      const { result } = renderHook(() => usePrompts());
      const prompts1 = [createMockPrompt({ id: 'prompt-1', sceneType: 'Scene 1' })];
      const prompts2 = [createMockPrompt({ id: 'prompt-2', sceneType: 'Scene 2' })];

      act(() => {
        result.current.setGeneratedPrompts(prompts1);
        result.current.pushToHistory(prompts1);
      });

      act(() => {
        result.current.setGeneratedPrompts(prompts2);
        result.current.pushToHistory(prompts2);
      });

      act(() => {
        result.current.handlePromptUndo();
      });

      act(() => {
        result.current.handlePromptRedo();
      });

      expect(result.current.generatedPrompts[0].sceneType).toBe('Scene 2');
    });

    it('reports canUndo correctly', () => {
      const { result } = renderHook(() => usePrompts());

      expect(result.current.promptHistory.canUndo).toBe(false);

      act(() => {
        result.current.pushToHistory([createMockPrompt()]);
      });

      act(() => {
        result.current.pushToHistory([createMockPrompt({ id: 'prompt-2' })]);
      });

      expect(result.current.promptHistory.canUndo).toBe(true);
    });
  });
});
