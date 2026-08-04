import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { adminClient } from "@/features/admin/api/adminClient";
import type { CampDetail, CampListItem, Page } from "@/shared/types/api";

export type Verification = "all" | "verified" | "unverified";

export interface AdminCampsParams {
  q?: string;
  phone?: string;
  district_code?: string;
  taluk?: string;
  lsg_name?: string;
  verification?: Verification;
  reviewed?: "all" | "unreviewed" | "reviewed";
  cursor?: string;
  limit?: number;
}

export interface AdminCampImage {
  id: string;
  url: string | null;
  width: number | null;
  height: number | null;
  quality_status: string | null;
  hidden: boolean;
  created_at: string;
}

export interface AdminReport {
  reference_code: string;
  reporter_name: string | null;
  reporter_phone_primary: string | null;
  reporter_phone_secondary: string | null;
  reporter_relationship: string | null;
  reported_status: string | null;
  reported_urgency: string | null;
  reported_urgency_reason: string | null;
  auto_flags: string[];
  phone_unverified: boolean;
  submitted_at: string;
}

/** Admin camps listing — richer search/filter than the public endpoint. */
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

/** Fields the admin edit form may write. Mirrors the backend whitelist. */
export interface CampUpdatePayload {
  name?: string;
  name_ml?: string | null;
  district_code?: string;
  taluk?: string | null;
  lsg_name?: string | null;
  village_or_locality?: string | null;
  landmark?: string | null;
  camp_incharge_name?: string | null;
  camp_phone_primary?: string | null;
  camp_phone_secondary?: string | null;
  status?: "active" | "inactive";
}

export async function updateAdminCamp(id: string, payload: CampUpdatePayload): Promise<CampDetail> {
  const res = await adminClient.patch<CampDetail>(`/admin/camps/${id}`, payload);
  return res.data;
}

/** Approve a reported camp — becomes verified and shows in the public app. */
export async function approveAdminCamp(id: string): Promise<CampDetail> {
  const res = await adminClient.post<CampDetail>(`/admin/camps/${id}/approve`);
  return res.data;
}

/** Reject a reported camp — stays unverified, marked reviewed (leaves the queue). */
export async function rejectAdminCamp(id: string, note?: string): Promise<CampDetail> {
  const res = await adminClient.post<CampDetail>(`/admin/camps/${id}/reject`, { note });
  return res.data;
}

/** Deny a reported camp — hard delete. */
export async function denyAdminCamp(id: string): Promise<void> {
  await adminClient.delete(`/admin/camps/${id}`);
}
