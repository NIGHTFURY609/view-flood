import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { adminClient } from "@/features/admin/api/adminClient";
import type {
  AdminNeed,
  AdminNeedsParams,
  AdminPledge,
  AdminPledgeRow,
  AdminPledgesParams,
  AdminRequirement,
  AdminRequirementsParams,
  RequirementCounts,
} from "@/features/admin/types";
import type { Page } from "@/shared/types/api";

export function adminRequirementsQuery(params: AdminRequirementsParams) {
  return queryOptions({
    queryKey: ["admin", "requirements", params],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<Page<AdminRequirement>>("/admin/requirements", {
        params,
        signal,
      });
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Pending counts for the sidebar badge and the per-camp bubbles. Kept as its
 * own query so the camps listing does not pay for a per-row count.
 */
export function adminRequirementCountsQuery() {
  return queryOptions({
    queryKey: ["admin", "requirements", "counts"],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<RequirementCounts>("/admin/requirements/counts", {
        signal,
      });
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function adminRequirementQuery(id: string) {
  return queryOptions({
    queryKey: ["admin", "requirement", id],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<AdminRequirement>(`/admin/requirements/${id}`, { signal });
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function adminCampRequirementsQuery(campId: string) {
  return queryOptions({
    queryKey: ["admin", "camp", campId, "requirements"],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<AdminRequirement[]>(
        `/admin/camps/${campId}/requirements`,
        { signal },
      );
      return res.data;
    },
    staleTime: 30_000,
  });
}

/** Approved needs and their donation tallies — the "Donations" view. */
export function adminNeedsQuery(params: AdminNeedsParams) {
  return queryOptions({
    queryKey: ["admin", "needs", params],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<Page<AdminNeed>>("/admin/needs", { params, signal });
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/** Every donation, newest first — the Donations approval list. */
export function adminPledgesQuery(params: AdminPledgesParams) {
  return queryOptions({
    queryKey: ["admin", "pledges", params],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<Page<AdminPledgeRow>>("/admin/pledges", {
        params,
        signal,
      });
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function adminPledgeQuery(id: string) {
  return queryOptions({
    queryKey: ["admin", "pledge", id],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<AdminPledgeRow>(`/admin/pledges/${id}`, { signal });
      return res.data;
    },
    staleTime: 30_000,
  });
}

export async function verifyPledge(id: string): Promise<void> {
  await adminClient.post(`/admin/pledges/${id}/verify`);
}

export async function unverifyPledge(id: string): Promise<void> {
  await adminClient.post(`/admin/pledges/${id}/unverify`);
}

/** Individual donations for one need, with donor details (PII). */
export function adminNeedPledgesQuery(needId: string, enabled = true) {
  return queryOptions({
    queryKey: ["admin", "need", needId, "pledges"],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<AdminPledge[]>(`/admin/needs/${needId}/pledges`, {
        signal,
      });
      return res.data;
    },
    staleTime: 30_000,
    enabled,
  });
}

export async function approveRequirement(id: string): Promise<void> {
  await adminClient.post(`/admin/requirements/${id}/approve`);
}

export async function rejectRequirement(id: string, note?: string): Promise<void> {
  await adminClient.post(`/admin/requirements/${id}/reject`, { note: note ?? null });
}
