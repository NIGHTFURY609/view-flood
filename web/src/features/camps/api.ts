import { queryOptions } from "@tanstack/react-query";

import { api, type CampsQueryParams } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/queryClient";

/**
 * Query option factories. Components never construct keys by hand, so cache
 * invalidation and persistence allowlisting stay consistent.
 */

export function campsQuery(params: CampsQueryParams) {
  return queryOptions({
    queryKey: queryKeys.campsList(params),
    queryFn: ({ signal }) => api.camps.list(params, signal),
    staleTime: 60_000,
    // Camp status genuinely changes during an event; a stale "open" is harmful.
    refetchInterval: 5 * 60_000,
  });
}

export function campQuery(id: string) {
  return queryOptions({
    queryKey: queryKeys.campDetail(id),
    queryFn: ({ signal }) => api.camps.get(id, signal),
    staleTime: 30_000,
  });
}

export function campImagesQuery(id: string) {
  return queryOptions({
    queryKey: queryKeys.campImages(id),
    queryFn: ({ signal }) => api.camps.images(id, signal),
    // Signed URLs expire after an hour, so never serve a stale one.
    staleTime: 30 * 60_000,
    gcTime: 45 * 60_000,
  });
}

export function campNeedsQuery(id: string) {
  return queryOptions({
    queryKey: queryKeys.campNeeds(id),
    queryFn: ({ signal }) => api.needs.forCamp(id, signal),
    staleTime: 30_000,
  });
}

export function districtsQuery() {
  return queryOptions({
    queryKey: queryKeys.districts,
    queryFn: ({ signal }) => api.geo.districts(signal),
    staleTime: Infinity,
  });
}

export function taluksQuery(districtCode?: string) {
  return queryOptions({
    queryKey: queryKeys.taluks(districtCode),
    queryFn: ({ signal }) => api.geo.taluks(districtCode, signal),
    staleTime: Infinity,
  });
}

export function lsgQuery(districtCode?: string) {
  return queryOptions({
    queryKey: queryKeys.lsgBodies(districtCode),
    queryFn: ({ signal }) => api.geo.lsgBodies(districtCode, signal),
    staleTime: Infinity,
  });
}

export function emergencyContactsQuery(districtCode?: string) {
  return queryOptions({
    queryKey: queryKeys.emergency(districtCode),
    queryFn: ({ signal }) => api.emergency.list(districtCode, signal),
    staleTime: Infinity,
  });
}
