import React, { useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from '../../lib/queryClient';
import {
  createIndexedDbPersister,
  PERSISTENCE_MAX_AGE_MS,
  shouldPersistQuery,
} from '../../lib/queryPersistence';
import { useCacheSettings } from '../cache/CacheProvider';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { cacheEnabled } = useCacheSettings();

  const persister = useMemo(() => createIndexedDbPersister(), []);

  if (!cacheEnabled) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSISTENCE_MAX_AGE_MS,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
