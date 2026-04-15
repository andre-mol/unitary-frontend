/**
 * Storage Utilities
 * Provides safe JSON parsing and storage versioning
 */

// Storage version - increment when breaking changes occur
export const STORAGE_VERSION = 1;
const STORAGE_VERSION_KEY = 'patrio_storage_version';

/**
 * Safely parses a JSON string, returning a fallback value on error
 */
export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (value === null) {
    return fallback;
  }
  
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('[Storage] Failed to parse JSON, using fallback:', error);
    return fallback;
  }
}

/**
 * Checks storage version and performs reset if version mismatch
 * Should be called once on app initialization
 */
export function initializeStorageVersion(): void {
  const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
  const currentVersion = storedVersion ? parseInt(storedVersion, 10) : 0;
  
  if (currentVersion !== STORAGE_VERSION) {
    console.info(`[Storage] Version mismatch: stored=${currentVersion}, current=${STORAGE_VERSION}`);
    
    // For now, just update the version without clearing data
    // In future versions, you can add migration logic here
    // Example: if (currentVersion < 2) { migrateToV2(); }
    
    if (currentVersion === 0) {
      // First time or corrupted version - just set the version
      console.info('[Storage] Initializing storage version');
    }
    
    localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION.toString());
  }
}

/**
 * Performs a safe reset of all Patrio storage data
 * Preserves storage version
 */
export function resetStorageData(): void {
  const keys = Object.keys(localStorage);
  const patrioKeys = keys.filter(key => key.startsWith('patrio_'));
  
  patrioKeys.forEach(key => {
    if (key !== STORAGE_VERSION_KEY) {
      localStorage.removeItem(key);
    }
  });
  
  console.info(`[Storage] Reset complete. Removed ${patrioKeys.length - 1} keys.`);
}

