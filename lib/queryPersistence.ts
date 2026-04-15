import type { Persister, PersistedClient } from '@tanstack/query-persist-client-core';
import type { Query } from '@tanstack/react-query';

const DB_NAME = 'patrio_query_cache';
const STORE_NAME = 'query_client';
const STORE_KEY = 'client';

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const PERSISTENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const PERSISTED_QUERY_PREFIXES: string[] = [];

// AIDEV-NOTE: Persist only whitelisted queries to avoid storing sensitive tables on-device.
export function shouldPersistQuery(query: Query): boolean {
  const [prefix] = query.queryKey as [string];
  return PERSISTED_QUERY_PREFIXES.includes(prefix);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = handler(store);
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  }).finally(() => {
    db.close();
  });
}

function getByteSize(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

export function createIndexedDbPersister(maxSizeBytes = DEFAULT_MAX_SIZE_BYTES): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      const serialized = JSON.stringify(client);
      if (getByteSize(serialized) > maxSizeBytes) {
        await removePersistedCache();
        return;
      }
      await withStore('readwrite', (store) => store.put(serialized, STORE_KEY));
    },
    restoreClient: async () => {
      const stored = await withStore<string | undefined>('readonly', (store) =>
        store.get(STORE_KEY)
      );
      if (!stored) return undefined;
      return JSON.parse(stored) as PersistedClient;
    },
    removeClient: async () => {
      await removePersistedCache();
    },
  };
}

export async function removePersistedCache(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(STORE_KEY));
}
