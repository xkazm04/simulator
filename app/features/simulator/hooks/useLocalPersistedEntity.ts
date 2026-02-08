/**
 * useLocalPersistedEntity<T> - Hook for locally persisted entity management (IndexedDB)
 *
 * Similar to usePersistedEntity but for local storage:
 * - Persists to IndexedDB instead of API
 * - Auto-loads on mount
 * - Auto-saves on state change
 * - Handles large data (images, blobs)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { saveToIndexedDB, loadFromIndexedDB } from '@/app/lib/indexedDB';

/**
 * Options for the useLocalPersistedEntity hook
 */
export interface UseLocalPersistedEntityOptions<T> {
  /** Storage key for IndexedDB */
  storageKey: string;

  /** Initial/default value if nothing is stored */
  initialValue: T;

  /** Called after successful load from storage */
  onLoaded?: (data: T) => void;

  /** Called after successful save to storage */
  onSaved?: (data: T) => void;

  /** Called on any error */
  onError?: (error: string) => void;

  /** Debounce time for save in milliseconds (defaults to 0 - immediate) */
  saveDebounce?: number;
}

/**
 * Return type for useLocalPersistedEntity hook
 */
export interface UseLocalPersistedEntityReturn<T> {
  /** Current data */
  data: T;

  /** True if still loading from storage */
  isLoading: boolean;

  /** True if initialized (loaded at least once) */
  isInitialized: boolean;

  /** Error message (null if no error) */
  error: string | null;

  /** Update data (triggers save) */
  setData: (data: T | ((prev: T) => T)) => void;

  /**
   * Set data that survives storage key changes.
   * Sets React state immediately and stores the data so that the next
   * loadFromStorage call (triggered by storageKey change) uses it instead
   * of reading from IndexedDB, then saves it to the new key.
   */
  overrideNextLoad: (data: T) => void;

  /** Force save immediately */
  saveNow: () => Promise<boolean>;

  /** Force reload from storage */
  reload: () => Promise<T>;

  /** Clear stored data */
  clear: () => Promise<boolean>;
}

/**
 * Hook for managing locally persisted entities using IndexedDB.
 * Auto-loads on mount and auto-saves on changes.
 */
export function useLocalPersistedEntity<T>(
  options: UseLocalPersistedEntityOptions<T>
): UseLocalPersistedEntityReturn<T> {
  const {
    storageKey,
    initialValue,
    onLoaded,
    onSaved,
    onError,
    saveDebounce = 0,
  } = options;

  // State
  const [data, setDataInternal] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for debounced save
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDataRef = useRef<T | null>(null);

  // Override data: when set, loadFromStorage uses this instead of reading IndexedDB
  const overrideRef = useRef<T | null>(null);

  // Refs for callbacks to avoid infinite loops (these don't need to trigger re-renders)
  const initialValueRef = useRef<T>(initialValue);
  const onLoadedRef = useRef(onLoaded);
  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);

  // Keep refs updated
  useEffect(() => {
    initialValueRef.current = initialValue;
    onLoadedRef.current = onLoaded;
    onSavedRef.current = onSaved;
    onErrorRef.current = onError;
  });

  /**
   * Handle errors
   */
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    onErrorRef.current?.(errorMessage);
  }, []);

  /**
   * Perform save to IndexedDB
   */
  const performSave = useCallback(async (saveData: T): Promise<boolean> => {
    try {
      await saveToIndexedDB(storageKey, saveData);
      onSavedRef.current?.(saveData);
      return true;
    } catch (err) {
      console.error('Failed to save to IndexedDB:', err);
      handleError('Failed to save data');
      return false;
    }
  }, [storageKey, handleError]);

  /**
   * Load data from IndexedDB
   */
  const loadFromStorage = useCallback(async (): Promise<T> => {
    // Check for override data (e.g. from hydratePanelImages before a key change)
    if (overrideRef.current !== null) {
      const overrideData = overrideRef.current;
      overrideRef.current = null;

      // Save the override data to the current (new) key
      try {
        await saveToIndexedDB(storageKey, overrideData);
        onSavedRef.current?.(overrideData);
      } catch (err) {
        console.error('Failed to save override data to IndexedDB:', err);
      }

      setDataInternal(overrideData);
      onLoadedRef.current?.(overrideData);
      setIsLoading(false);
      setIsInitialized(true);
      return overrideData;
    }

    setIsLoading(true);
    setError(null);

    try {
      const storedData = await loadFromIndexedDB<T>(storageKey);
      const result = storedData ?? initialValueRef.current;
      setDataInternal(result);
      onLoadedRef.current?.(result);
      return result;
    } catch (err) {
      console.error('Failed to load from IndexedDB:', err);
      handleError('Failed to load data');
      return initialValueRef.current;
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [storageKey, handleError]);

  /**
   * Set data and trigger save
   */
  const setData = useCallback((newData: T | ((prev: T) => T)) => {
    setDataInternal((prev) => {
      const resolved = typeof newData === 'function'
        ? (newData as (prev: T) => T)(prev)
        : newData;

      // Only save if initialized (avoid saving initial value before load)
      if (isInitialized) {
        if (saveDebounce > 0) {
          // Debounced save
          pendingDataRef.current = resolved;
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
          }
          saveTimerRef.current = setTimeout(() => {
            const dataToSave = pendingDataRef.current;
            pendingDataRef.current = null;
            if (dataToSave !== null) {
              performSave(dataToSave);
            }
          }, saveDebounce);
        } else {
          // Immediate save
          performSave(resolved);
        }
      }

      return resolved;
    });
  }, [isInitialized, saveDebounce, performSave]);

  /**
   * Set data that survives storage key changes.
   * Sets React state immediately. When loadFromStorage fires
   * (e.g. after storageKey changes), uses this data instead of IndexedDB
   * and saves it to the new key.
   */
  const overrideNextLoad = useCallback((newData: T) => {
    overrideRef.current = newData;
    setDataInternal(newData);
  }, []);

  /**
   * Force save immediately
   */
  const saveNow = useCallback(async (): Promise<boolean> => {
    // Clear any pending timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const dataToSave = pendingDataRef.current ?? data;
    pendingDataRef.current = null;

    return performSave(dataToSave);
  }, [data, performSave]);

  /**
   * Force reload from storage
   */
  const reload = useCallback(async (): Promise<T> => {
    return loadFromStorage();
  }, [loadFromStorage]);

  /**
   * Clear stored data
   */
  const clear = useCallback(async (): Promise<boolean> => {
    try {
      await saveToIndexedDB(storageKey, initialValueRef.current);
      setDataInternal(initialValueRef.current);
      return true;
    } catch (err) {
      console.error('Failed to clear IndexedDB:', err);
      handleError('Failed to clear data');
      return false;
    }
  }, [storageKey, handleError]);

  // Load from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    data,
    isLoading,
    isInitialized,
    error,
    setData,
    overrideNextLoad,
    saveNow,
    reload,
    clear,
  };
}
