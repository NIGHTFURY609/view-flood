import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // A 404 or a validation error will not become true by asking again.
        if (error instanceof ApiError && error.isClientError) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      // Never retry a write. Double-firing an OTP request, a report submission,
      // a check-in or a pledge is worse than showing the user an error.
      retry: 0,
    },
  },
});

export const queryKeys = {
  districts: ["geo", "districts"] as const,
  taluks: (districtCode?: string) => ["geo", "taluks", districtCode ?? "all"] as const,
  lsgBodies: (districtCode?: string) => ["geo", "lsg", districtCode ?? "all"] as const,

  campsList: (params: object) => ["camps", "list", params] as const,
  campDetail: (id: string) => ["camps", "detail", id] as const,
  campImages: (id: string) => ["camps", "images", id] as const,
  campNeeds: (id: string) => ["needs", "camp", id] as const,
  checkins: (id: string) => ["checkins", id] as const,

  needsList: (params: object) => ["needs", "list", params] as const,
  emergency: (districtCode?: string) => ["emergency", districtCode ?? "state"] as const,
  weather: (lat: number, lng: number) => ["weather", lat, lng] as const,
} as const;

/**
 * Only these query families survive into IndexedDB for offline use. Anything
 * carrying a signed URL, a phone number or mutation state must not persist.
 */
export const PERSISTED_QUERY_PREFIXES: readonly string[] = ["camps", "geo", "emergency", "needs"];

export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0];
  if (typeof head !== "string") return false;
  if (head === "camps" && queryKey[1] === "images") return false; // signed URLs expire in 1h
  return PERSISTED_QUERY_PREFIXES.includes(head);
}
