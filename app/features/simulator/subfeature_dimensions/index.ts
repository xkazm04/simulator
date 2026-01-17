/**
 * Dimensions Subfeature - Manages dimension state and components
 *
 * Dimensions are the "lenses" that transform the base image.
 * Each dimension has a filter (what to preserve), transform (how to apply),
 * and weight (intensity 0-100).
 */

// Context
export { DimensionsProvider, useDimensionsContext } from './DimensionsContext';

// Hooks
export { useDimensions } from './hooks/useDimensions';

// Lib
export { DEFAULT_DIMENSIONS, EXTRA_DIMENSIONS, getDimensionPreset, getAllDimensionPresets, EXAMPLE_SIMULATIONS } from './lib/defaultDimensions';
export { applyConceptToDimensions, applyElementToDimensionById, createDimensionFromElement } from './lib/concept';

// Components
export { DimensionColumn } from './components/DimensionColumn';
export { DimensionCard } from './components/DimensionCard';
export { DimensionGrid } from './components/DimensionGrid';
