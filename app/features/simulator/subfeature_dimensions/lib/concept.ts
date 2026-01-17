/**
 * Concept Utilities - Bidirectional flow between inputs and outputs
 *
 * This module implements the duality between Dimensions (input constraints)
 * and PromptElements (output elements). The core insight is that these are
 * two forms of the same underlying Concept:
 *
 * - Dimensions constrain what gets generated
 * - Elements are what gets generated
 * - Any element can become a constraint (feedback loop)
 * - Any constraint can be shown as an element
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Concept,
  ConceptRole,
  Dimension,
  DimensionType,
  PromptElement,
  elementToConcept,
  dimensionToConcept,
  categoryToDimensionType,
  createDimensionWithDefaults,
} from '../../types';
import { getDimensionPreset } from './defaultDimensions';

/**
 * Apply a concept to dimensions - the key bidirectional operation
 * Takes an output element and applies it back as an input constraint
 */
export function applyConceptToDimensions(
  concept: Concept,
  dimensions: Dimension[]
): { updatedDimensions: Dimension[]; wasApplied: boolean; targetDimensionId: string | null } {
  const targetType = categoryToDimensionType(concept.category);

  if (!targetType) {
    return { updatedDimensions: dimensions, wasApplied: false, targetDimensionId: null };
  }

  // Find existing dimension of this type
  const existingIndex = dimensions.findIndex((d) => d.type === targetType);

  if (existingIndex >= 0) {
    // Update existing dimension
    const updated = [...dimensions];
    updated[existingIndex] = {
      ...updated[existingIndex],
      reference: concept.value,
    };
    return {
      updatedDimensions: updated,
      wasApplied: true,
      targetDimensionId: updated[existingIndex].id,
    };
  }

  // Create new dimension if type doesn't exist
  const preset = getDimensionPreset(targetType);
  if (preset) {
    const newDimension = createDimensionWithDefaults({
      id: uuidv4(),
      type: targetType,
      label: preset.label,
      icon: preset.icon,
      placeholder: preset.placeholder,
      reference: concept.value,
    });
    return {
      updatedDimensions: [...dimensions, newDimension],
      wasApplied: true,
      targetDimensionId: newDimension.id,
    };
  }

  return { updatedDimensions: dimensions, wasApplied: false, targetDimensionId: null };
}

/**
 * Apply an element directly to a specific dimension by ID
 * Used for drag-and-drop operations
 */
export function applyElementToDimensionById(
  element: PromptElement,
  targetDimensionId: string,
  dimensions: Dimension[]
): Dimension[] {
  return dimensions.map((dim) =>
    dim.id === targetDimensionId ? { ...dim, reference: element.text } : dim
  );
}

/**
 * Create a new dimension from an element
 * Used when user wants to create a new constraint from generated content
 */
export function createDimensionFromElement(
  element: PromptElement,
  dimensionType?: DimensionType
): Dimension | null {
  const targetType = dimensionType || categoryToDimensionType(element.category);

  if (!targetType) {
    // Fallback to custom dimension
    return createDimensionWithDefaults({
      id: uuidv4(),
      type: 'custom',
      label: element.category,
      icon: '✨',
      placeholder: `Custom ${element.category}`,
      reference: element.text,
    });
  }

  const preset = getDimensionPreset(targetType);
  if (!preset) return null;

  return createDimensionWithDefaults({
    id: uuidv4(),
    type: targetType,
    label: preset.label,
    icon: preset.icon,
    placeholder: preset.placeholder,
    reference: element.text,
  });
}

/**
 * Extract concepts from locked elements across all prompts
 * These become the preserved constraints for the next generation
 */
export function extractLockedConcepts(
  lockedElements: PromptElement[]
): Concept[] {
  return lockedElements.map(elementToConcept);
}

/**
 * Extract concepts from filled dimensions
 * These are the current input constraints
 */
export function extractDimensionConcepts(dimensions: Dimension[]): Concept[] {
  return dimensions
    .filter((d) => d.reference.trim())
    .map(dimensionToConcept);
}

/**
 * Merge concepts from multiple sources, resolving conflicts
 * Priority: locked elements > filled dimensions > defaults
 */
export function mergeConcepts(
  lockedConcepts: Concept[],
  dimensionConcepts: Concept[]
): Concept[] {
  const merged = new Map<string, Concept>();

  // First, add dimension concepts
  dimensionConcepts.forEach((c) => {
    merged.set(c.category, c);
  });

  // Then, override with locked concepts (higher priority)
  lockedConcepts.forEach((c) => {
    merged.set(c.category, { ...c, locked: true });
  });

  return Array.from(merged.values());
}

/**
 * Check if an element is compatible with a dimension type
 */
export function isElementCompatibleWithDimension(
  element: PromptElement,
  dimension: Dimension
): boolean {
  if (dimension.type === 'custom') return true;

  const mappedType = categoryToDimensionType(element.category);
  return mappedType === dimension.type;
}

/**
 * Get suggested dimension types for an element
 * Returns list of dimension types that could accept this element
 */
export function getSuggestedDimensionTypes(element: PromptElement): DimensionType[] {
  const primary = categoryToDimensionType(element.category);
  const suggestions: DimensionType[] = primary ? [primary] : [];

  // Always suggest custom as fallback
  if (!suggestions.includes('custom')) {
    suggestions.push('custom');
  }

  return suggestions;
}

/**
 * Transform role - flip a concept between input and output roles
 * This is the mathematical dual operation
 */
export function flipConceptRole(concept: Concept): Concept {
  return {
    ...concept,
    role: concept.role === 'input' ? 'output' : 'input',
  };
}

/**
 * Create a concept from raw text input
 */
export function createConceptFromText(
  text: string,
  category: string,
  role: ConceptRole = 'input'
): Concept {
  return {
    id: uuidv4(),
    value: text,
    category,
    locked: false,
    role,
    source: { type: 'user' },
  };
}
