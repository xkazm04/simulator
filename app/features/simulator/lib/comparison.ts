/**
 * Comparison Utilities - Functions for comparing generated prompts
 *
 * These utilities support the side-by-side comparison view by detecting
 * differences between prompts, elements, and highlighting changes.
 */

import { GeneratedPrompt, PromptElement, ElementDiff, Dimension } from '../types';

/**
 * Compare elements between two prompts
 * Identifies elements unique to each prompt and common elements
 */
export function compareElements(promptA: GeneratedPrompt, promptB: GeneratedPrompt): ElementDiff {
  const textSetA = new Set(promptA.elements.map(e => e.text.toLowerCase().trim()));
  const textSetB = new Set(promptB.elements.map(e => e.text.toLowerCase().trim()));

  return {
    onlyInFirst: promptA.elements.filter(e => !textSetB.has(e.text.toLowerCase().trim())),
    onlyInSecond: promptB.elements.filter(e => !textSetA.has(e.text.toLowerCase().trim())),
    common: promptA.elements.filter(e => textSetB.has(e.text.toLowerCase().trim())),
  };
}

/**
 * Get element classification for styling purposes
 * Returns 'unique-first' | 'unique-second' | 'common' | 'neutral'
 */
export function getElementClassification(
  element: PromptElement,
  diff: ElementDiff
): 'unique-first' | 'unique-second' | 'common' | 'neutral' {
  const normalizedText = element.text.toLowerCase().trim();

  if (diff.onlyInFirst.some(e => e.text.toLowerCase().trim() === normalizedText)) {
    return 'unique-first';
  }
  if (diff.onlyInSecond.some(e => e.text.toLowerCase().trim() === normalizedText)) {
    return 'unique-second';
  }
  if (diff.common.some(e => e.text.toLowerCase().trim() === normalizedText)) {
    return 'common';
  }
  return 'neutral';
}

/**
 * Calculate similarity score between two prompts (0-100)
 * Based on common elements ratio
 */
export function calculateSimilarity(promptA: GeneratedPrompt, promptB: GeneratedPrompt): number {
  const diff = compareElements(promptA, promptB);
  const totalUniqueElements = new Set([
    ...promptA.elements.map(e => e.text.toLowerCase().trim()),
    ...promptB.elements.map(e => e.text.toLowerCase().trim())
  ]).size;

  if (totalUniqueElements === 0) return 100;

  return Math.round((diff.common.length / totalUniqueElements) * 100);
}

/**
 * Highlight differences in prompt text
 * Returns tokens with classification for styling
 */
export interface TextToken {
  text: string;
  type: 'common' | 'added' | 'removed' | 'neutral';
}

export function tokenizePromptText(text: string): string[] {
  // Split by sentence-like boundaries while preserving delimiters
  return text.split(/([,.])\s*/).filter(t => t.trim().length > 0);
}

export function highlightPromptDifferences(
  promptA: string,
  promptB: string
): { tokensA: TextToken[]; tokensB: TextToken[] } {
  const tokensA = tokenizePromptText(promptA);
  const tokensB = tokenizePromptText(promptB);

  const normalizedB = new Set(tokensB.map(t => t.toLowerCase().trim()));
  const normalizedA = new Set(tokensA.map(t => t.toLowerCase().trim()));

  return {
    tokensA: tokensA.map(token => ({
      text: token,
      type: normalizedB.has(token.toLowerCase().trim()) ? 'common' : 'removed'
    })),
    tokensB: tokensB.map(token => ({
      text: token,
      type: normalizedA.has(token.toLowerCase().trim()) ? 'common' : 'added'
    }))
  };
}

/**
 * Get comparison statistics between multiple prompts
 */
export interface ComparisonStats {
  totalElements: number;
  uniqueElements: number;
  commonElements: number;
  similarityPercent: number;
}

export function getComparisonStats(prompts: GeneratedPrompt[]): ComparisonStats {
  if (prompts.length < 2) {
    return {
      totalElements: prompts[0]?.elements.length ?? 0,
      uniqueElements: prompts[0]?.elements.length ?? 0,
      commonElements: 0,
      similarityPercent: 100,
    };
  }

  // For multiple prompts, find elements common to ALL prompts
  const allElementTexts = prompts.map(p =>
    new Set(p.elements.map(e => e.text.toLowerCase().trim()))
  );

  // Common elements are those present in all prompts
  const firstPromptElements = prompts[0].elements;
  const commonElements = firstPromptElements.filter(e =>
    allElementTexts.every(set => set.has(e.text.toLowerCase().trim()))
  );

  // Unique elements are union of all elements
  const allUniqueTexts = new Set<string>();
  prompts.forEach(p => p.elements.forEach(e =>
    allUniqueTexts.add(e.text.toLowerCase().trim())
  ));

  const totalElements = prompts.reduce((sum, p) => sum + p.elements.length, 0);
  const similarityPercent = allUniqueTexts.size > 0
    ? Math.round((commonElements.length / allUniqueTexts.size) * 100)
    : 100;

  return {
    totalElements,
    uniqueElements: allUniqueTexts.size,
    commonElements: commonElements.length,
    similarityPercent,
  };
}

/**
 * Get scene type differences between prompts
 */
export function getSceneTypeDifferences(prompts: GeneratedPrompt[]): {
  sceneTypes: string[];
  areAllSame: boolean;
} {
  const sceneTypes = prompts.map(p => p.sceneType);
  const uniqueTypes = new Set(sceneTypes);

  return {
    sceneTypes,
    areAllSame: uniqueTypes.size === 1,
  };
}

/**
 * Format dimension for display in comparison
 */
export function formatDimensionForComparison(dimension: Dimension): string {
  const parts = [dimension.reference];
  if (dimension.weight !== 100) {
    parts.push(`(${dimension.weight}%)`);
  }
  return parts.join(' ');
}
