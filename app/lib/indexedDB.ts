/**
 * IndexedDB utility for storing large data like images
 * Replaces localStorage for data that exceeds quota limits
 */

const DB_NAME = 'simulator_db';
const DB_VERSION = 1;
const STORE_NAME = 'panel_images';

let dbInstance: IDBDatabase | null = null;

/**
 * Open/get the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store for panel images
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Save data to IndexedDB
 */
export async function saveToIndexedDB<T>(key: string, data: T): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.put({ key, data });

    request.onerror = () => {
      reject(new Error('Failed to save to IndexedDB'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Load data from IndexedDB
 */
export async function loadFromIndexedDB<T>(key: string): Promise<T | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(key);

    request.onerror = () => {
      reject(new Error('Failed to load from IndexedDB'));
    };

    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.data : null);
    };
  });
}

/**
 * Delete data from IndexedDB
 */
export async function deleteFromIndexedDB(key: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.delete(key);

    request.onerror = () => {
      reject(new Error('Failed to delete from IndexedDB'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Clear all data from IndexedDB store
 */
export async function clearIndexedDB(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.clear();

    request.onerror = () => {
      reject(new Error('Failed to clear IndexedDB'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}
