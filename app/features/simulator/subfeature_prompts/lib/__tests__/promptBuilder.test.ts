/**
 * Unit Tests for Prompt Builder
 *
 * Tests the core prompt generation logic including:
 * - buildNegativePrompt
 * - generateSmartNegatives
 * - getDefaultNegativePrompts
 * - buildMockPromptWithElements
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildNegativePrompt,
  generateSmartNegatives,
  getDefaultNegativePrompts,
  buildMockPromptWithElements,
} from '../promptBuilder';
import { createMockDimension, createMockNegativePrompt, resetIdCounter } from '@/test/test-utils';
import { NegativePromptItem, Dimension } from '../../../types';

describe('promptBuilder', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('getDefaultNegativePrompts', () => {
    it('returns an array of default negative prompts', () => {
      const defaults = getDefaultNegativePrompts();

      expect(Array.isArray(defaults)).toBe(true);
      expect(defaults.length).toBeGreaterThan(0);
      expect(defaults).toContain('blurry');
      expect(defaults).toContain('low quality');
      expect(defaults).toContain('watermark');
    });
  });

  describe('buildNegativePrompt', () => {
    it('returns empty string when no negative prompts provided', () => {
      const result = buildNegativePrompt([]);
      expect(result).toBe('');
    });

    it('combines global negative prompts', () => {
      const negatives: NegativePromptItem[] = [
        createMockNegativePrompt({ text: 'blurry', scope: 'global' }),
        createMockNegativePrompt({ text: 'watermark', scope: 'global' }),
      ];

      const result = buildNegativePrompt(negatives);

      expect(result).toContain('blurry');
      expect(result).toContain('watermark');
    });

    it('includes prompt-specific negatives when promptId matches', () => {
      const negatives: NegativePromptItem[] = [
        createMockNegativePrompt({ text: 'blurry', scope: 'global' }),
        createMockNegativePrompt({ text: 'specific', scope: 'prompt', promptId: 'prompt-1' }),
      ];

      const result = buildNegativePrompt(negatives, 'prompt-1');

      expect(result).toContain('blurry');
      expect(result).toContain('specific');
    });

    it('excludes prompt-specific negatives when promptId does not match', () => {
      const negatives: NegativePromptItem[] = [
        createMockNegativePrompt({ text: 'blurry', scope: 'global' }),
        createMockNegativePrompt({ text: 'specific', scope: 'prompt', promptId: 'prompt-1' }),
      ];

      const result = buildNegativePrompt(negatives, 'prompt-2');

      expect(result).toContain('blurry');
      expect(result).not.toContain('specific');
    });

    it('deduplicates negative prompts', () => {
      const negatives: NegativePromptItem[] = [
        createMockNegativePrompt({ text: 'blurry', scope: 'global' }),
        createMockNegativePrompt({ text: 'blurry', scope: 'global' }),
      ];

      const result = buildNegativePrompt(negatives);
      const occurrences = result.split('blurry').length - 1;

      expect(occurrences).toBe(1);
    });

    it('truncates when exceeding maxLength', () => {
      const negatives: NegativePromptItem[] = Array(100).fill(null).map((_, i) =>
        createMockNegativePrompt({ text: `negative-prompt-${i}`, scope: 'global' })
      );

      const result = buildNegativePrompt(negatives, undefined, 100);

      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  describe('generateSmartNegatives', () => {
    it('includes default negatives for any scene', () => {
      const dimensions: Dimension[] = [];
      const result = generateSmartNegatives(dimensions, 'Cinematic Wide Shot');

      expect(result).toContain('blurry');
      expect(result).toContain('low quality');
      expect(result).toContain('watermark');
    });

    it('adds anatomy negatives for character scenes', () => {
      const dimensions: Dimension[] = [
        createMockDimension({ type: 'characters', reference: 'Jedi warriors' }),
      ];

      const result = generateSmartNegatives(dimensions, 'Hero Portrait');

      expect(result).toContain('extra limbs');
      expect(result).toContain('mutated hands');
      expect(result).toContain('disfigured face');
    });

    it('adds composition negatives for environment scenes', () => {
      const dimensions: Dimension[] = [];
      const result = generateSmartNegatives(dimensions, 'Environmental Storytelling');

      expect(result).toContain('cropped');
      expect(result).toContain('out of frame');
      expect(result).toContain('poor composition');
    });

    it('adds conflicting style negatives for anime style', () => {
      const dimensions: Dimension[] = [
        createMockDimension({ type: 'artStyle', reference: 'Anime cel-shaded style' }),
      ];

      const result = generateSmartNegatives(dimensions, 'Cinematic Wide Shot');

      expect(result).toContain('photorealistic');
      expect(result).toContain('3D render');
    });

    it('adds conflicting style negatives for realistic style', () => {
      const dimensions: Dimension[] = [
        createMockDimension({ type: 'artStyle', reference: 'Photorealistic rendering' }),
      ];

      const result = generateSmartNegatives(dimensions, 'Cinematic Wide Shot');

      expect(result).toContain('cartoon');
      expect(result).toContain('anime');
    });

    it('adds UI negatives when no gameUI dimension', () => {
      const dimensions: Dimension[] = [];
      const result = generateSmartNegatives(dimensions, 'Cinematic Wide Shot');

      expect(result).toContain('game UI');
      expect(result).toContain('HUD elements');
    });

    it('does not add UI negatives when gameUI dimension is set', () => {
      const dimensions: Dimension[] = [
        createMockDimension({ type: 'gameUI', reference: 'RPG interface' }),
      ];

      const result = generateSmartNegatives(dimensions, 'Cinematic Wide Shot');

      expect(result).not.toContain('game UI');
    });

    it('adds mood-conflicting negatives for dark mood', () => {
      const dimensions: Dimension[] = [
        createMockDimension({ type: 'mood', reference: 'Dark and gritty atmosphere' }),
      ];

      const result = generateSmartNegatives(dimensions, 'Cinematic Wide Shot');

      expect(result).toContain('bright');
      expect(result).toContain('cheerful');
    });

    it('adds mood-conflicting negatives for bright mood', () => {
      const dimensions: Dimension[] = [
        createMockDimension({ type: 'mood', reference: 'Bright and cheerful scene' }),
      ];

      const result = generateSmartNegatives(dimensions, 'Cinematic Wide Shot');

      expect(result).toContain('dark');
      expect(result).toContain('gloomy');
    });

    it('returns deduplicated array', () => {
      const dimensions: Dimension[] = [];
      const result = generateSmartNegatives(dimensions, 'Cinematic Wide Shot');

      const uniqueItems = new Set(result);
      expect(result.length).toBe(uniqueItems.size);
    });
  });

  describe('buildMockPromptWithElements', () => {
    it('returns prompt, negativePrompt, and elements', () => {
      const dimensions: Dimension[] = [
        createMockDimension({ type: 'environment', reference: 'Star Wars cantina' }),
      ];

      const result = buildMockPromptWithElements(
        'Isometric RPG screenshot',
        dimensions,
        'Cinematic Wide Shot',
        0,
        [],
        'concept',
        [],
        'prompt-1'
      );

      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('negativePrompt');
      expect(result).toHaveProperty('elements');
      expect(typeof result.prompt).toBe('string');
      expect(typeof result.negativePrompt).toBe('string');
      expect(Array.isArray(result.elements)).toBe(true);
    });

    it('includes base image description in prompt', () => {
      const result = buildMockPromptWithElements(
        'Isometric RPG screenshot with party formation',
        [],
        'Cinematic Wide Shot',
        0,
        [],
        'concept'
      );

      expect(result.prompt).toContain('Isometric RPG screenshot');
    });

    it('includes dimension references in prompt', () => {
      const dimensions: Dimension[] = [
        createMockDimension({ type: 'environment', reference: 'Star Wars cantina' }),
        createMockDimension({ type: 'characters', reference: 'Jedi knights' }),
      ];

      const result = buildMockPromptWithElements(
        'Base image',
        dimensions,
        'Hero Portrait',
        0,
        [],
        'concept'
      );

      expect(result.prompt).toContain('Star Wars cantina');
      expect(result.prompt).toContain('Jedi knights');
    });

    it('generates elements for each dimension', () => {
      const dimensions: Dimension[] = [
        createMockDimension({ type: 'environment', reference: 'Fantasy castle' }),
        createMockDimension({ type: 'characters', reference: 'Knight hero' }),
      ];

      const result = buildMockPromptWithElements(
        'Base image',
        dimensions,
        'Hero Portrait',
        0,
        [],
        'concept'
      );

      expect(result.elements.length).toBeGreaterThan(0);
      expect(result.elements.some(e => e.text.includes('Fantasy castle') || e.text.includes('Knight'))).toBe(true);
    });

    it('respects output mode - concept', () => {
      const result = buildMockPromptWithElements(
        'Base image',
        [],
        'Cinematic Wide Shot',
        0,
        [],
        'concept'
      );

      expect(result.prompt).toContain('concept art');
    });

    it('respects output mode - gameplay', () => {
      const result = buildMockPromptWithElements(
        'Base image',
        [],
        'Cinematic Wide Shot',
        0,
        [],
        'gameplay'
      );

      expect(result.prompt).toContain('game UI');
    });

    it('truncates prompt to max length', () => {
      const longDescription = 'Very long description '.repeat(100);

      const result = buildMockPromptWithElements(
        longDescription,
        [],
        'Cinematic Wide Shot',
        0,
        [],
        'concept'
      );

      expect(result.prompt.length).toBeLessThanOrEqual(1500);
    });

    it('includes negative prompts from input', () => {
      const negatives: NegativePromptItem[] = [
        createMockNegativePrompt({ text: 'custom-negative', scope: 'global' }),
      ];

      const result = buildMockPromptWithElements(
        'Base image',
        [],
        'Cinematic Wide Shot',
        0,
        [],
        'concept',
        negatives,
        'prompt-1'
      );

      expect(result.negativePrompt).toContain('custom-negative');
    });
  });
});
