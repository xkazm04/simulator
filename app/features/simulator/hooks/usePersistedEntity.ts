/**
 * usePersistedEntity<T> - Generic hook for persisted entity lifecycle management
 *
 * Provides a unified pattern for:
 * - Create, Read, Update, Delete operations
 * - Autosave with debouncing
 * - Optimistic UI updates
 * - Loading and error states
 * - Cleanup on unmount
 *
 * This hook is composed by domain-specific hooks:
 * - useProject
 * - usePoster
 * - useImageGeneration (for panel slots)
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// Default debounce time for autosave (500ms)
const DEFAULT_AUTOSAVE_DEBOUNCE = 500;

/**
 * Configuration for API endpoints
 */
export interface EntityApiConfig<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  /** Base endpoint for the entity (e.g., '/api/projects') */
  baseEndpoint: string;

  /** Transform API response to entity type */
  parseResponse?: (data: unknown) => T;

  /** Transform entity to API request body */
  serializeForCreate?: (data: TCreate) => unknown;
  serializeForUpdate?: (data: TUpdate) => unknown;

  /** Custom fetch function (defaults to global fetch) */
  fetchFn?: typeof fetch;
}

/**
 * Options for the usePersistedEntity hook
 */
export interface UsePersistedEntityOptions<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  /** API configuration */
  api: EntityApiConfig<T, TCreate, TUpdate>;

  /** Debounce time for autosave in milliseconds */
  autosaveDebounce?: number;

  /** Enable autosave (defaults to true) */
  enableAutosave?: boolean;

  /** Called when entity is successfully created */
  onCreated?: (entity: T) => void;

  /** Called when entity is successfully updated */
  onUpdated?: (entity: T) => void;

  /** Called when entity is successfully deleted */
  onDeleted?: (id: string) => void;

  /** Called on any error */
  onError?: (error: string) => void;
}

/**
 * Return type for usePersistedEntity hook
 */
export interface UsePersistedEntityReturn<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  /** Current entity data (null if not loaded) */
  entity: T | null;

  /** List of all entities (for list views) */
  entities: T[];

  /** Loading state */
  isLoading: boolean;

  /** Error message (null if no error) */
  error: string | null;

  /** True if there are pending unsaved changes */
  isDirty: boolean;

  /** Load all entities */
  loadAll: () => Promise<T[]>;

  /** Load a single entity by ID */
  load: (id: string) => Promise<T | null>;

  /** Create a new entity */
  create: (data: TCreate) => Promise<T | null>;

  /** Update the current entity (debounced if autosave enabled) */
  update: (data: TUpdate) => void;

  /** Force immediate save (bypasses debounce) */
  saveNow: () => Promise<boolean>;

  /** Delete an entity by ID */
  remove: (id: string) => Promise<boolean>;

  /** Set the current entity directly (for optimistic updates) */
  setEntity: (entity: T | null) => void;

  /** Set entities list directly */
  setEntities: (entities: T[]) => void;

  /** Clear error state */
  clearError: () => void;
}

/**
 * Generic hook for managing persisted entities with CRUD operations,
 * autosave, and optimistic updates.
 */
export function usePersistedEntity<T extends { id: string }, TCreate = Partial<T>, TUpdate = Partial<T>>(
  options: UsePersistedEntityOptions<T, TCreate, TUpdate>
): UsePersistedEntityReturn<T, TCreate, TUpdate> {
  const {
    api,
    autosaveDebounce = DEFAULT_AUTOSAVE_DEBOUNCE,
    enableAutosave = true,
    onCreated,
    onUpdated,
    onDeleted,
    onError,
  } = options;

  const fetchFn = api.fetchFn || fetch;

  // State
  const [entity, setEntity] = useState<T | null>(null);
  const [entities, setEntities] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Refs for autosave
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdateRef = useRef<TUpdate | null>(null);
  const currentEntityIdRef = useRef<string | null>(null);

  // Refs for callbacks to avoid infinite loops (these don't need to trigger re-renders)
  const onCreatedRef = useRef(onCreated);
  const onUpdatedRef = useRef(onUpdated);
  const onDeletedRef = useRef(onDeleted);
  const onErrorRef = useRef(onError);
  const parseResponseRef = useRef(api.parseResponse);
  const serializeForCreateRef = useRef(api.serializeForCreate);
  const serializeForUpdateRef = useRef(api.serializeForUpdate);

  // Keep refs updated
  useEffect(() => {
    onCreatedRef.current = onCreated;
    onUpdatedRef.current = onUpdated;
    onDeletedRef.current = onDeleted;
    onErrorRef.current = onError;
    parseResponseRef.current = api.parseResponse;
    serializeForCreateRef.current = api.serializeForCreate;
    serializeForUpdateRef.current = api.serializeForUpdate;
  });

  // Keep entity ID ref in sync
  useEffect(() => {
    currentEntityIdRef.current = entity?.id || null;
  }, [entity?.id]);

  /**
   * Handle API errors
   */
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    onErrorRef.current?.(errorMessage);
  }, []);

  /**
   * Load all entities
   */
  const loadAll = useCallback(async (): Promise<T[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchFn(api.baseEndpoint);
      const data = await response.json();

      if (data.success) {
        const parseResponse = parseResponseRef.current;
        const parsedEntities = parseResponse
          ? (data.items || data.entities || data.projects || []).map(parseResponse)
          : data.items || data.entities || data.projects || [];
        setEntities(parsedEntities);
        return parsedEntities;
      } else {
        handleError(data.error || 'Failed to load entities');
        return [];
      }
    } catch (err) {
      handleError('Network error loading entities');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [api.baseEndpoint, fetchFn, handleError]);

  /**
   * Load a single entity by ID
   */
  const load = useCallback(async (id: string): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchFn(`${api.baseEndpoint}/${id}`);
      const data = await response.json();

      if (data.success) {
        const parseResponse = parseResponseRef.current;
        const parsed = parseResponse
          ? parseResponse(data.entity || data.project || data.item || data)
          : data.entity || data.project || data.item;
        setEntity(parsed);
        setIsDirty(false);
        return parsed;
      } else {
        handleError(data.error || 'Failed to load entity');
        return null;
      }
    } catch (err) {
      handleError('Network error loading entity');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [api.baseEndpoint, fetchFn, handleError]);

  /**
   * Create a new entity
   */
  const create = useCallback(async (data: TCreate): Promise<T | null> => {
    setError(null);

    try {
      const serializeForCreate = serializeForCreateRef.current;
      const body = serializeForCreate ? serializeForCreate(data) : data;
      const response = await fetchFn(api.baseEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        const parseResponse = parseResponseRef.current;
        const created = parseResponse
          ? parseResponse(result.entity || result.project || result.item || result)
          : result.entity || result.project || result.item;

        // Optimistic update - add to list
        setEntities((prev) => [created, ...prev]);
        setEntity(created);
        setIsDirty(false);
        onCreatedRef.current?.(created);
        return created;
      } else {
        handleError(result.error || 'Failed to create entity');
        return null;
      }
    } catch (err) {
      handleError('Network error creating entity');
      return null;
    }
  }, [api.baseEndpoint, fetchFn, handleError]);

  /**
   * Internal save function
   */
  const performSave = useCallback(async (id: string, updateData: TUpdate): Promise<boolean> => {
    try {
      const serializeForUpdate = serializeForUpdateRef.current;
      const body = serializeForUpdate ? serializeForUpdate(updateData) : updateData;
      const response = await fetchFn(`${api.baseEndpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        const parseResponse = parseResponseRef.current;
        const updated = parseResponse && result.entity
          ? parseResponse(result.entity || result.project || result.item || result)
          : entity;
        if (updated) {
          onUpdatedRef.current?.(updated);
        }
        setIsDirty(false);
        return true;
      } else {
        console.error('Save failed:', result.error);
        return false;
      }
    } catch (err) {
      console.error('Autosave error:', err);
      return false;
    }
  }, [api.baseEndpoint, fetchFn, entity]);

  /**
   * Update entity (debounced if autosave enabled)
   */
  const update = useCallback((data: TUpdate) => {
    const entityId = currentEntityIdRef.current;
    if (!entityId) return;

    // Merge with pending updates
    pendingUpdateRef.current = { ...pendingUpdateRef.current, ...data } as TUpdate;
    setIsDirty(true);

    if (!enableAutosave) return;

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Set new timer
    autosaveTimerRef.current = setTimeout(async () => {
      const pendingData = pendingUpdateRef.current;
      pendingUpdateRef.current = null;

      if (pendingData && entityId) {
        await performSave(entityId, pendingData);
      }
    }, autosaveDebounce);
  }, [enableAutosave, autosaveDebounce, performSave]);

  /**
   * Force immediate save
   */
  const saveNow = useCallback(async (): Promise<boolean> => {
    const entityId = currentEntityIdRef.current;
    if (!entityId) return false;

    // Clear any pending timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const pendingData = pendingUpdateRef.current;
    pendingUpdateRef.current = null;

    if (pendingData) {
      return performSave(entityId, pendingData);
    }

    return true;
  }, [performSave]);

  /**
   * Delete an entity
   */
  const remove = useCallback(async (id: string): Promise<boolean> => {
    setError(null);

    try {
      const response = await fetchFn(`${api.baseEndpoint}/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // Optimistic update - remove from list
        setEntities((prev) => prev.filter((e) => e.id !== id));
        if (entity?.id === id) {
          setEntity(null);
        }
        onDeletedRef.current?.(id);
        return true;
      } else {
        handleError(result.error || 'Failed to delete entity');
        return false;
      }
    } catch (err) {
      handleError('Network error deleting entity');
      return false;
    }
  }, [api.baseEndpoint, fetchFn, entity?.id, handleError]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  return {
    entity,
    entities,
    isLoading,
    error,
    isDirty,
    loadAll,
    load,
    create,
    update,
    saveNow,
    remove,
    setEntity,
    setEntities,
    clearError,
  };
}

/**
 * Utility type for extracting entity type from a hook return
 */
export type EntityOf<T> = T extends UsePersistedEntityReturn<infer E, unknown, unknown> ? E : never;
