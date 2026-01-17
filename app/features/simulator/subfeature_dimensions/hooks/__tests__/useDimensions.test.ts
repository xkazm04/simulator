/**
 * Unit Tests for useDimensions Hook
 *
 * Tests the dimension state management including:
 * - Initial dimension state
 * - Dimension CRUD operations
 * - Weight and mode changes
 * - Element-to-dimension flow
 * - Undo functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDimensions } from '../useDimensions';
import { createMockDimension, createMockElement, resetIdCounter } from '@/test/test-utils';
import { Dimension, DimensionPreset } from '../../../types';

describe('useDimensions', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('initial state', () => {
    it('initializes with default dimensions', () => {
      const { result } = renderHook(() => useDimensions());

      expect(result.current.dimensions.length).toBeGreaterThan(0);
      expect(result.current.dimensions[0]).toHaveProperty('id');
      expect(result.current.dimensions[0]).toHaveProperty('type');
      expect(result.current.dimensions[0]).toHaveProperty('label');
    });

    it('initializes pendingDimensionChange as null', () => {
      const { result } = renderHook(() => useDimensions());

      expect(result.current.pendingDimensionChange).toBeNull();
    });

    it('all dimensions have default weight of 100', () => {
      const { result } = renderHook(() => useDimensions());

      result.current.dimensions.forEach((d) => {
        expect(d.weight).toBe(100);
      });
    });

    it('all dimensions have empty reference', () => {
      const { result } = renderHook(() => useDimensions());

      result.current.dimensions.forEach((d) => {
        expect(d.reference).toBe('');
      });
    });
  });

  describe('handleDimensionChange', () => {
    it('updates dimension reference', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;

      act(() => {
        result.current.handleDimensionChange(firstDimId, 'Star Wars universe');
      });

      expect(result.current.dimensions[0].reference).toBe('Star Wars universe');
    });

    it('only updates targeted dimension', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;
      const originalSecond = result.current.dimensions[1].reference;

      act(() => {
        result.current.handleDimensionChange(firstDimId, 'New reference');
      });

      expect(result.current.dimensions[1].reference).toBe(originalSecond);
    });
  });

  describe('handleDimensionWeightChange', () => {
    it('updates dimension weight', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;

      act(() => {
        result.current.handleDimensionWeightChange(firstDimId, 50);
      });

      expect(result.current.dimensions[0].weight).toBe(50);
    });

    it('clamps weight to minimum of 0', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;

      act(() => {
        result.current.handleDimensionWeightChange(firstDimId, -20);
      });

      expect(result.current.dimensions[0].weight).toBe(0);
    });

    it('clamps weight to maximum of 100', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;

      act(() => {
        result.current.handleDimensionWeightChange(firstDimId, 150);
      });

      expect(result.current.dimensions[0].weight).toBe(100);
    });
  });

  describe('handleDimensionFilterModeChange', () => {
    it('updates dimension filter mode', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;

      act(() => {
        result.current.handleDimensionFilterModeChange(firstDimId, 'preserve_all');
      });

      expect(result.current.dimensions[0].filterMode).toBe('preserve_all');
    });
  });

  describe('handleDimensionTransformModeChange', () => {
    it('updates dimension transform mode', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;

      act(() => {
        result.current.handleDimensionTransformModeChange(firstDimId, 'blend');
      });

      expect(result.current.dimensions[0].transformMode).toBe('blend');
    });
  });

  describe('handleDimensionRemove', () => {
    it('removes the specified dimension', () => {
      const { result } = renderHook(() => useDimensions());
      const initialCount = result.current.dimensions.length;
      const firstDimId = result.current.dimensions[0].id;

      act(() => {
        result.current.handleDimensionRemove(firstDimId);
      });

      expect(result.current.dimensions.length).toBe(initialCount - 1);
      expect(result.current.dimensions.find((d) => d.id === firstDimId)).toBeUndefined();
    });
  });

  describe('handleDimensionAdd', () => {
    it('adds a new dimension from preset', () => {
      const { result } = renderHook(() => useDimensions());
      const initialCount = result.current.dimensions.length;
      const preset: DimensionPreset = {
        type: 'creatures',
        label: 'Creatures',
        icon: 'Bug',
        placeholder: 'Enter creatures...',
      };

      act(() => {
        result.current.handleDimensionAdd(preset);
      });

      expect(result.current.dimensions.length).toBe(initialCount + 1);
      const newDim = result.current.dimensions[result.current.dimensions.length - 1];
      expect(newDim.type).toBe('creatures');
      expect(newDim.label).toBe('Creatures');
    });

    it('new dimension has empty reference', () => {
      const { result } = renderHook(() => useDimensions());
      const preset: DimensionPreset = {
        type: 'creatures',
        label: 'Creatures',
        icon: 'Bug',
        placeholder: 'Enter creatures...',
      };

      act(() => {
        result.current.handleDimensionAdd(preset);
      });

      const newDim = result.current.dimensions[result.current.dimensions.length - 1];
      expect(newDim.reference).toBe('');
    });
  });

  describe('handleDimensionReorder', () => {
    it('reorders dimensions', () => {
      const { result } = renderHook(() => useDimensions());
      const original = [...result.current.dimensions];
      const reordered = [original[1], original[0], ...original.slice(2)];

      act(() => {
        result.current.handleDimensionReorder(reordered);
      });

      expect(result.current.dimensions[0].id).toBe(original[1].id);
      expect(result.current.dimensions[1].id).toBe(original[0].id);
    });
  });

  describe('handleDropElementOnDimension', () => {
    it('applies element text to dimension', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;
      const element = createMockElement({ text: 'Dropped element text' });

      act(() => {
        result.current.handleDropElementOnDimension(element, firstDimId);
      });

      expect(result.current.dimensions[0].reference).toContain('Dropped element text');
    });

    it('sets pendingDimensionChange for undo', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;
      const element = createMockElement({ text: 'Element' });

      act(() => {
        result.current.handleDropElementOnDimension(element, firstDimId);
      });

      expect(result.current.pendingDimensionChange).not.toBeNull();
      expect(result.current.pendingDimensionChange?.element).toBe(element);
    });
  });

  describe('handleUndoDimensionChange', () => {
    it('reverts to previous dimensions', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;
      const originalReference = result.current.dimensions[0].reference;
      const element = createMockElement({ text: 'New value' });

      act(() => {
        result.current.handleDropElementOnDimension(element, firstDimId);
      });

      expect(result.current.dimensions[0].reference).not.toBe(originalReference);

      act(() => {
        result.current.handleUndoDimensionChange();
      });

      expect(result.current.dimensions[0].reference).toBe(originalReference);
    });

    it('clears pendingDimensionChange after undo', () => {
      const { result } = renderHook(() => useDimensions());
      const firstDimId = result.current.dimensions[0].id;
      const element = createMockElement({ text: 'Element' });

      act(() => {
        result.current.handleDropElementOnDimension(element, firstDimId);
      });

      act(() => {
        result.current.handleUndoDimensionChange();
      });

      expect(result.current.pendingDimensionChange).toBeNull();
    });

    it('does nothing when no pending change', () => {
      const { result } = renderHook(() => useDimensions());
      const before = [...result.current.dimensions];

      act(() => {
        result.current.handleUndoDimensionChange();
      });

      expect(result.current.dimensions).toEqual(before);
    });
  });

  describe('setDimensions', () => {
    it('directly sets dimensions', () => {
      const { result } = renderHook(() => useDimensions());
      const newDimensions = [
        createMockDimension({ type: 'environment', reference: 'Custom env' }),
        createMockDimension({ type: 'characters', reference: 'Custom chars' }),
      ];

      act(() => {
        result.current.setDimensions(newDimensions);
      });

      expect(result.current.dimensions).toEqual(newDimensions);
    });
  });

  describe('resetDimensions', () => {
    it('resets to default dimensions', () => {
      const { result } = renderHook(() => useDimensions());
      const initialCount = result.current.dimensions.length;

      // Modify dimensions
      act(() => {
        result.current.handleDimensionChange(result.current.dimensions[0].id, 'Modified');
        result.current.handleDimensionRemove(result.current.dimensions[1].id);
      });

      expect(result.current.dimensions.length).not.toBe(initialCount);

      act(() => {
        result.current.resetDimensions();
      });

      expect(result.current.dimensions.length).toBe(initialCount);
      result.current.dimensions.forEach((d) => {
        expect(d.reference).toBe('');
      });
    });

    it('clears pendingDimensionChange', () => {
      const { result } = renderHook(() => useDimensions());
      const element = createMockElement();

      act(() => {
        result.current.handleDropElementOnDimension(element, result.current.dimensions[0].id);
      });

      expect(result.current.pendingDimensionChange).not.toBeNull();

      act(() => {
        result.current.resetDimensions();
      });

      expect(result.current.pendingDimensionChange).toBeNull();
    });
  });

  describe('handleConvertElementsToDimensions', () => {
    it('merges new dimensions into existing by type', () => {
      const { result } = renderHook(() => useDimensions());
      const envDim = result.current.dimensions.find((d) => d.type === 'environment');

      act(() => {
        result.current.handleConvertElementsToDimensions([
          createMockDimension({ type: 'environment', reference: 'New environment' }),
        ]);
      });

      const updatedEnv = result.current.dimensions.find((d) => d.type === 'environment');
      expect(updatedEnv?.reference).toBe('New environment');
      // ID should remain the same (merged, not replaced)
      expect(updatedEnv?.id).toBe(envDim?.id);
    });

    it('adds new dimension types', () => {
      const { result } = renderHook(() => useDimensions());
      const hasCreatures = result.current.dimensions.some((d) => d.type === 'creatures');

      if (!hasCreatures) {
        act(() => {
          result.current.handleConvertElementsToDimensions([
            createMockDimension({ type: 'creatures', reference: 'Dragons' }),
          ]);
        });

        const creaturesDim = result.current.dimensions.find((d) => d.type === 'creatures');
        expect(creaturesDim).toBeDefined();
        expect(creaturesDim?.reference).toBe('Dragons');
      }
    });
  });

  describe('loadExampleDimensions', () => {
    it('loads example dimensions', () => {
      const { result } = renderHook(() => useDimensions());

      act(() => {
        result.current.loadExampleDimensions(0);
      });

      // At least one dimension should have a reference from the example
      const hasReference = result.current.dimensions.some((d) => d.reference !== '');
      expect(hasReference).toBe(true);
    });

    it('does nothing for invalid index', () => {
      const { result } = renderHook(() => useDimensions());
      const before = [...result.current.dimensions];

      act(() => {
        result.current.loadExampleDimensions(999);
      });

      // Dimensions should remain unchanged (same references)
      expect(result.current.dimensions.map((d) => d.reference)).toEqual(before.map((d) => d.reference));
    });
  });
});
