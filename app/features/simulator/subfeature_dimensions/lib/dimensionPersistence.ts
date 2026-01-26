/**
 * Dimension Persistence - localStorage utilities for dimension state
 *
 * Provides auto-save and restore functionality for dimension configurations:
 * - Per-project storage keys
 * - Debounced saves to avoid excessive writes
 * - Graceful handling of invalid/missing data
 * - SSR-safe (checks for window before accessing localStorage)
 *
 * Storage format: `simulator-dims-{projectId}`
 */

import { Dimension } from '../../types';

/** Storage key prefix for dimension persistence */
const STORAGE_KEY_PREFIX = 'simulator-dims';

/** Default project ID when none specified */
const DEFAULT_PROJECT_ID = 'default';

/**
 * Generate storage key for a project
 */
export function getStorageKey(projectId?: string): string {
  return `${STORAGE_KEY_PREFIX}-${projectId || DEFAULT_PROJECT_ID}`;
}

/**
 * Check if localStorage is available (SSR-safe)
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serializable dimension data (excludes non-serializable fields like icon functions)
 */
export interface PersistedDimension {
  id: string;
  type: string;
  label: string;
  icon: string;
  placeholder: string;
  reference: string;
  referenceImage?: string;
  filterMode: string;
  transformMode: string;
  weight: number;
}

/**
 * Persisted dimensions wrapper with metadata
 */
export interface PersistedDimensionsData {
  version: number;
  timestamp: number;
  projectId: string;
  dimensions: PersistedDimension[];
}

/** Current persistence format version */
const PERSISTENCE_VERSION = 1;

/**
 * Convert Dimension to serializable format
 */
function dimensionToPersistedFormat(dimension: Dimension): PersistedDimension {
  return {
    id: dimension.id,
    type: dimension.type,
    label: dimension.label,
    icon: typeof dimension.icon === 'string' ? dimension.icon : dimension.icon?.toString() || '',
    placeholder: dimension.placeholder,
    reference: dimension.reference,
    referenceImage: dimension.referenceImage,
    filterMode: dimension.filterMode,
    transformMode: dimension.transformMode,
    weight: dimension.weight,
  };
}

/**
 * Convert persisted format back to Dimension
 * Note: Icon will be a string; the actual icon component needs to be resolved by the caller
 */
function persistedToDimension(persisted: PersistedDimension): Dimension {
  return {
    id: persisted.id,
    type: persisted.type as Dimension['type'],
    label: persisted.label,
    icon: persisted.icon,
    placeholder: persisted.placeholder,
    reference: persisted.reference,
    referenceImage: persisted.referenceImage,
    filterMode: (persisted.filterMode || 'preserve_structure') as Dimension['filterMode'],
    transformMode: (persisted.transformMode || 'blend') as Dimension['transformMode'],
    weight: persisted.weight ?? 75,
  };
}

/**
 * Validate persisted data structure
 */
function isValidPersistedData(data: unknown): data is PersistedDimensionsData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.version !== 'number') return false;
  if (typeof d.timestamp !== 'number') return false;
  if (typeof d.projectId !== 'string') return false;
  if (!Array.isArray(d.dimensions)) return false;
  return d.dimensions.every((dim: unknown) => {
    if (!dim || typeof dim !== 'object') return false;
    const dimObj = dim as Record<string, unknown>;
    return typeof dimObj.id === 'string' && typeof dimObj.type === 'string';
  });
}

/**
 * Save dimensions to localStorage
 */
export function persistDimensions(dimensions: Dimension[], projectId?: string): boolean {
  if (!isLocalStorageAvailable()) return false;

  try {
    const data: PersistedDimensionsData = {
      version: PERSISTENCE_VERSION,
      timestamp: Date.now(),
      projectId: projectId || DEFAULT_PROJECT_ID,
      dimensions: dimensions.map(dimensionToPersistedFormat),
    };

    const key = getStorageKey(projectId);
    window.localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn('Failed to persist dimensions:', error);
    return false;
  }
}

/**
 * Load dimensions from localStorage
 */
export function loadPersistedDimensions(projectId?: string): Dimension[] | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const key = getStorageKey(projectId);
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;

    const data = JSON.parse(stored);
    if (!isValidPersistedData(data)) {
      console.warn('Invalid persisted dimensions data, ignoring');
      return null;
    }

    // Check if data is for the correct project (safety check)
    if (projectId && data.projectId !== projectId) {
      return null;
    }

    return data.dimensions.map(persistedToDimension);
  } catch (error) {
    console.warn('Failed to load persisted dimensions:', error);
    return null;
  }
}

/**
 * Clear persisted dimensions for a project
 */
export function clearPersistedDimensions(projectId?: string): boolean {
  if (!isLocalStorageAvailable()) return false;

  try {
    const key = getStorageKey(projectId);
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn('Failed to clear persisted dimensions:', error);
    return false;
  }
}

/**
 * Get timestamp of last persistence
 */
export function getLastPersistedTimestamp(projectId?: string): number | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const key = getStorageKey(projectId);
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;

    const data = JSON.parse(stored);
    if (!isValidPersistedData(data)) return null;

    return data.timestamp;
  } catch {
    return null;
  }
}

/**
 * Create a debounced persist function
 * Delays writes to avoid excessive localStorage operations
 */
export function createDebouncedPersist(
  delay: number = 500
): {
  persist: (dimensions: Dimension[], projectId?: string) => void;
  cancel: () => void;
  flush: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingDimensions: Dimension[] | null = null;
  let pendingProjectId: string | undefined;

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (pendingDimensions) {
      persistDimensions(pendingDimensions, pendingProjectId);
      pendingDimensions = null;
      pendingProjectId = undefined;
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingDimensions = null;
    pendingProjectId = undefined;
  };

  const persist = (dimensions: Dimension[], projectId?: string) => {
    pendingDimensions = dimensions;
    pendingProjectId = projectId;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(flush, delay);
  };

  return { persist, cancel, flush };
}

/**
 * Hook-friendly wrapper for dimension persistence
 * Returns functions that can be used in useEffect
 */
export interface DimensionPersistenceManager {
  /** Load dimensions on mount */
  load: (projectId?: string) => Dimension[] | null;
  /** Save dimensions (debounced) */
  save: (dimensions: Dimension[], projectId?: string) => void;
  /** Clear persisted data */
  clear: (projectId?: string) => void;
  /** Flush any pending saves */
  flush: () => void;
  /** Cancel pending saves (for cleanup) */
  cancel: () => void;
}

/**
 * Create a persistence manager instance
 */
export function createPersistenceManager(debounceDelay: number = 500): DimensionPersistenceManager {
  const debounced = createDebouncedPersist(debounceDelay);

  return {
    load: loadPersistedDimensions,
    save: debounced.persist,
    clear: clearPersistedDimensions,
    flush: debounced.flush,
    cancel: debounced.cancel,
  };
}
