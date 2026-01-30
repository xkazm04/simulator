/**
 * Character Comparison - Comparison utilities for identity analysis
 *
 * Provides functionality for comparing multiple characters including
 * DNA similarity scoring, trait differences, and comparison export.
 */

import type { Character, CharacterDNA, CharacterTraits, CharacterTrait, TraitCategory } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface CharacterComparisonData {
  character: Character;
  dna: CharacterDNA | null;
  traits: CharacterTraits | null;
}

export interface TraitComparison {
  traitName: string;
  category: TraitCategory;
  values: { characterId: string; value: string; weight: number }[];
  isDifferent: boolean;
  maxDifference: number; // 0-1 based on how different values are
}

export interface DNASimilarityResult {
  characterA: string;
  characterB: string;
  faceSimilarity: number; // 0-100
  styleSimilarity: number; // 0-100
  overallSimilarity: number; // 0-100
}

export interface ComparisonSummary {
  characters: CharacterComparisonData[];
  traitComparisons: TraitComparison[];
  dnaSimilarities: DNASimilarityResult[];
  overallConsistency: number; // 0-100
  highlights: ComparisonHighlight[];
}

export interface ComparisonHighlight {
  type: 'match' | 'difference' | 'warning';
  message: string;
  details?: string;
}

export interface ComparisonExport {
  exportedAt: string;
  version: string;
  characters: {
    id: string;
    name: string;
    status: string;
    qualityScore: number | null;
  }[];
  traitComparisons: TraitComparison[];
  dnaSimilarities: DNASimilarityResult[];
  summary: {
    overallConsistency: number;
    totalTraitsCompared: number;
    matchingTraits: number;
    differingTraits: number;
  };
}

// =============================================================================
// DNA Similarity Calculation
// =============================================================================

/**
 * Calculate similarity between two DNA embeddings
 * Uses a mock calculation since actual embeddings are base64 encoded
 */
function calculateEmbeddingSimilarity(embedding1: string | null, embedding2: string | null): number {
  if (!embedding1 || !embedding2) {
    return 0;
  }

  // In a real implementation, we would decode the base64 embeddings and
  // calculate cosine similarity. For now, we use a deterministic mock
  // based on the embedding strings.
  const hash1 = embedding1.slice(0, 100).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hash2 = embedding2.slice(0, 100).split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  // Generate a similarity score based on hash difference
  const maxDiff = Math.max(hash1, hash2);
  const diff = Math.abs(hash1 - hash2);
  const baseSimilarity = maxDiff > 0 ? (1 - diff / maxDiff) * 100 : 100;

  // Add some randomness based on embedding length to make it more realistic
  const lengthFactor = Math.min(embedding1.length, embedding2.length) / Math.max(embedding1.length, embedding2.length);

  return Math.round(baseSimilarity * 0.7 + lengthFactor * 30);
}

/**
 * Calculate DNA similarity between two characters
 */
export function calculateDNASimilarity(
  dnaA: CharacterDNA | null,
  dnaB: CharacterDNA | null,
  characterIdA: string,
  characterIdB: string
): DNASimilarityResult {
  const faceSimilarity = calculateEmbeddingSimilarity(
    dnaA?.face_embedding || null,
    dnaB?.face_embedding || null
  );

  const styleSimilarity = calculateEmbeddingSimilarity(
    dnaA?.style_embedding || null,
    dnaB?.style_embedding || null
  );

  // Face similarity is weighted more heavily
  const overallSimilarity = Math.round(faceSimilarity * 0.7 + styleSimilarity * 0.3);

  return {
    characterA: characterIdA,
    characterB: characterIdB,
    faceSimilarity,
    styleSimilarity,
    overallSimilarity,
  };
}

/**
 * Calculate all pairwise DNA similarities
 */
export function calculateAllDNASimilarities(
  characters: CharacterComparisonData[]
): DNASimilarityResult[] {
  const results: DNASimilarityResult[] = [];

  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      results.push(
        calculateDNASimilarity(
          characters[i].dna,
          characters[j].dna,
          characters[i].character.id,
          characters[j].character.id
        )
      );
    }
  }

  return results;
}

// =============================================================================
// Trait Comparison
// =============================================================================

/**
 * Compare traits across multiple characters
 */
export function compareTraits(characters: CharacterComparisonData[]): TraitComparison[] {
  const traitMap = new Map<string, TraitComparison>();

  // Collect all traits from all characters
  for (const charData of characters) {
    if (!charData.traits) continue;

    for (const trait of charData.traits.traits) {
      const key = trait.name;

      if (!traitMap.has(key)) {
        traitMap.set(key, {
          traitName: trait.name,
          category: trait.category,
          values: [],
          isDifferent: false,
          maxDifference: 0,
        });
      }

      traitMap.get(key)!.values.push({
        characterId: charData.character.id,
        value: trait.value,
        weight: trait.weight,
      });
    }
  }

  // Analyze differences
  const comparisons: TraitComparison[] = [];

  for (const comparison of traitMap.values()) {
    // Check if all values are the same
    const uniqueValues = new Set(comparison.values.map((v) => v.value.toLowerCase()));
    comparison.isDifferent = uniqueValues.size > 1;

    // Calculate max difference based on unique value count
    if (comparison.values.length > 1) {
      comparison.maxDifference = (uniqueValues.size - 1) / (comparison.values.length - 1);
    }

    comparisons.push(comparison);
  }

  // Sort by category, then by whether different (different first), then by name
  comparisons.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    if (a.isDifferent !== b.isDifferent) {
      return a.isDifferent ? -1 : 1;
    }
    return a.traitName.localeCompare(b.traitName);
  });

  return comparisons;
}

// =============================================================================
// Comparison Summary
// =============================================================================

/**
 * Generate highlights from comparison data
 */
function generateHighlights(
  traitComparisons: TraitComparison[],
  dnaSimilarities: DNASimilarityResult[],
  characters: CharacterComparisonData[]
): ComparisonHighlight[] {
  const highlights: ComparisonHighlight[] = [];

  // DNA similarity highlights
  for (const similarity of dnaSimilarities) {
    const charA = characters.find((c) => c.character.id === similarity.characterA);
    const charB = characters.find((c) => c.character.id === similarity.characterB);

    if (similarity.overallSimilarity >= 85) {
      highlights.push({
        type: 'match',
        message: `High similarity between ${charA?.character.name} and ${charB?.character.name}`,
        details: `${similarity.overallSimilarity}% overall similarity`,
      });
    } else if (similarity.overallSimilarity < 50) {
      highlights.push({
        type: 'warning',
        message: `Low similarity between ${charA?.character.name} and ${charB?.character.name}`,
        details: `Only ${similarity.overallSimilarity}% overall similarity`,
      });
    }
  }

  // Trait difference highlights
  const differentTraits = traitComparisons.filter((t) => t.isDifferent);
  const matchingTraits = traitComparisons.filter((t) => !t.isDifferent);

  if (differentTraits.length === 0 && matchingTraits.length > 0) {
    highlights.push({
      type: 'match',
      message: 'All traits match across characters',
      details: `${matchingTraits.length} traits are consistent`,
    });
  } else if (differentTraits.length > 0) {
    // Group by category
    const diffByCategory = new Map<TraitCategory, number>();
    for (const trait of differentTraits) {
      diffByCategory.set(trait.category, (diffByCategory.get(trait.category) || 0) + 1);
    }

    for (const [category, count] of diffByCategory) {
      highlights.push({
        type: 'difference',
        message: `${count} ${category} trait${count > 1 ? 's' : ''} differ`,
        details: differentTraits
          .filter((t) => t.category === category)
          .map((t) => t.traitName)
          .join(', '),
      });
    }
  }

  // Quality score comparison
  const qualityScores = characters
    .filter((c) => c.character.quality_score !== null)
    .map((c) => ({ name: c.character.name, score: c.character.quality_score! }));

  if (qualityScores.length >= 2) {
    const maxScore = Math.max(...qualityScores.map((q) => q.score));
    const minScore = Math.min(...qualityScores.map((q) => q.score));

    if (maxScore - minScore > 0.3) {
      const best = qualityScores.find((q) => q.score === maxScore);
      highlights.push({
        type: 'difference',
        message: `Quality scores vary significantly`,
        details: `${best?.name} has the highest quality (${Math.round(maxScore * 100)}%)`,
      });
    }
  }

  return highlights;
}

/**
 * Generate full comparison summary
 */
export function generateComparisonSummary(
  characters: CharacterComparisonData[]
): ComparisonSummary {
  const traitComparisons = compareTraits(characters);
  const dnaSimilarities = calculateAllDNASimilarities(characters);

  // Calculate overall consistency
  const matchingTraits = traitComparisons.filter((t) => !t.isDifferent).length;
  const totalTraits = traitComparisons.length;
  const traitConsistency = totalTraits > 0 ? (matchingTraits / totalTraits) * 100 : 100;

  const avgDnaSimilarity =
    dnaSimilarities.length > 0
      ? dnaSimilarities.reduce((sum, s) => sum + s.overallSimilarity, 0) / dnaSimilarities.length
      : 100;

  const overallConsistency = Math.round(traitConsistency * 0.4 + avgDnaSimilarity * 0.6);

  const highlights = generateHighlights(traitComparisons, dnaSimilarities, characters);

  return {
    characters,
    traitComparisons,
    dnaSimilarities,
    overallConsistency,
    highlights,
  };
}

// =============================================================================
// Export
// =============================================================================

/**
 * Export comparison data as JSON
 */
export function exportComparison(summary: ComparisonSummary): ComparisonExport {
  const matchingTraits = summary.traitComparisons.filter((t) => !t.isDifferent).length;

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    characters: summary.characters.map((c) => ({
      id: c.character.id,
      name: c.character.name,
      status: c.character.status,
      qualityScore: c.character.quality_score,
    })),
    traitComparisons: summary.traitComparisons,
    dnaSimilarities: summary.dnaSimilarities,
    summary: {
      overallConsistency: summary.overallConsistency,
      totalTraitsCompared: summary.traitComparisons.length,
      matchingTraits,
      differingTraits: summary.traitComparisons.length - matchingTraits,
    },
  };
}

/**
 * Download comparison as JSON file
 */
export function downloadComparisonExport(summary: ComparisonSummary): void {
  const exportData = exportComparison(summary);
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const characterNames = summary.characters
    .map((c) => c.character.name.replace(/[^a-z0-9]/gi, '').toLowerCase())
    .join('-vs-');

  const link = document.createElement('a');
  link.href = url;
  link.download = `comparison-${characterNames}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get similarity color based on score
 */
export function getSimilarityColor(similarity: number): string {
  if (similarity >= 80) return '#00ff88'; // Green
  if (similarity >= 60) return '#00d4ff'; // Cyan
  if (similarity >= 40) return '#ffaa00'; // Amber
  return '#ff6b6b'; // Red
}

/**
 * Get similarity label based on score
 */
export function getSimilarityLabel(similarity: number): string {
  if (similarity >= 90) return 'Nearly identical';
  if (similarity >= 80) return 'Very similar';
  if (similarity >= 60) return 'Similar';
  if (similarity >= 40) return 'Somewhat different';
  return 'Very different';
}

/**
 * Format trait value for display
 */
export function formatTraitValue(value: string, maxLength: number = 20): string {
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength - 3) + '...';
}
