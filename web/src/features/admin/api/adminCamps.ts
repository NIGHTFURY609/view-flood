import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { adminClient } from "@/features/admin/api/adminClient";
import type {
  AdminCampImage,
  AdminCampsParams,
  AdminReport,
  CampUpdatePayload,
} from "@/features/admin/types";
import type { CampDetail, CampListItem, Page } from "@/shared/types/api";

export function adminCampsQuery(params: AdminCampsParams) {
  return queryOptions({
    queryKey: ["admin", "camps", params],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<Page<CampListItem>>("/admin/camps", { params, signal });
      return res.data;
    },
    staleTime: 30_000,
    // Keep the current page visible while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function adminCampQuery(id: string) {
  return queryOptions({
    queryKey: ["admin", "camp", id],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<CampDetail>(`/admin/camps/${id}`, { signal });
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function adminCampImagesQuery(id: string) {
  return queryOptions({
    queryKey: ["admin", "camp", id, "images"],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<AdminCampImage[]>(`/admin/camps/${id}/images`, { signal });
      return res.data;
    },
    // Signed URLs live ~1h; refetch well within that.
    staleTime: 5 * 60_000,
  });
}

export function adminCampReportsQuery(id: string) {
  return queryOptions({
    queryKey: ["admin", "camp", id, "reports"],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<AdminReport[]>(`/admin/camps/${id}/reports`, { signal });
      return res.data;
    },
    staleTime: 30_000,
  });
}

export async function updateAdminCamp(id: string, payload: CampUpdatePayload): Promise<CampDetail> {
  const res = await adminClient.patch<CampDetail>(`/admin/camps/${id}`, payload);
  return res.data;
}

export async function approveAdminCamp(id: string): Promise<CampDetail> {
  const res = await adminClient.post<CampDetail>(`/admin/camps/${id}/approve`);
  return res.data;
}

export async function rejectAdminCamp(id: string, note?: string): Promise<CampDetail> {
  // "/decline", not "/reject": the legacy admin router owns /reject (Supabase auth).
  const res = await adminClient.post<CampDetail>(`/admin/camps/${id}/decline`, { note });
  return res.data;
}

export async function denyAdminCamp(id: string): Promise<void> {
  await adminClient.delete(`/admin/camps/${id}`);
}
