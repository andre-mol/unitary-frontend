import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { clearQueryCache } from '../../lib/queryClient';
import { removePersistedCache } from '../../lib/queryPersistence';

const CACHE_SETTING_KEY = 'patrio_cache_on_device';

interface CacheContextValue {
  cacheEnabled: boolean;
  setCacheEnabled: (enabled: boolean) => void;
  clearLocalCache: () => Promise<void>;
}

const CacheContext = createContext<CacheContextValue | undefined>(undefined);

function readCacheSetting(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(CACHE_SETTING_KEY) === 'true';
}

function writeCacheSetting(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(CACHE_SETTING_KEY, enabled ? 'true' : 'false');
}

export function CacheProvider({ children }: { children: React.ReactNode }) {
  const [cacheEnabled, setCacheEnabledState] = useState<boolean>(() => readCacheSetting());

  const clearLocalCache = useCallback(async () => {
    clearQueryCache();
    await removePersistedCache();
  }, []);

  const setCacheEnabled = useCallback(
    (enabled: boolean) => {
      setCacheEnabledState(enabled);
      writeCacheSetting(enabled);
      if (!enabled) {
        void clearLocalCache();
      }
    },
    [clearLocalCache]
  );

  const value = useMemo<CacheContextValue>(
    () => ({
      cacheEnabled,
      setCacheEnabled,
      clearLocalCache,
    }),
    [cacheEnabled, setCacheEnabled, clearLocalCache]
  );

  return <CacheContext.Provider value={value}>{children}</CacheContext.Provider>;
}

export function useCacheSettings(): CacheContextValue {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCacheSettings must be used within CacheProvider');
  }
  return context;
}
