import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

import { shouldPersistQuery } from "./queryClient";

/**
 * "Last-seen camps" — the offline cache.
 *
 * This is the parsed-data layer; the service worker caches the HTTP responses.
 * They complement each other: the SW makes the request succeed when the network
 * is flaky, this makes the list paint instantly from local storage even before
 * any request resolves.
 *
 * Strictly allowlisted. Signed image URLs, OTP state and every mutation are
 * excluded — see shouldPersistQuery.
 */
const CACHE_VERSION = "v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const persister: Persister = createSyncStoragePersister({
  storage: typeof window === "undefined" ? undefined : window.localStorage,
  key: `kcc.query-cache.${CACHE_VERSION}`,
  throttleTime: 2000,
  serialize: (client: PersistedClient) => {
    const filtered: PersistedClient = {
      ...client,
      clientState: {
        ...client.clientState,
        queries: client.clientState.queries.filter((query) =>
          shouldPersistQuery(query.queryKey as readonly unknown[]),
        ),
        // Never persist mutations. Restoring one could re-fire a report.
        mutations: [],
      },
    };
    return JSON.stringify(filtered);
  },
  deserialize: (cached: string) => JSON.parse(cached) as PersistedClient,
});

export const persistOptions = {
  persister,
  maxAge: MAX_AGE_MS,
  buster: CACHE_VERSION,
} as const;
