import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { adminClient } from "@/features/admin/api/adminClient";
import type { Page } from "@/shared/types/api";

export interface AuditLogEntry {
  id: string;
  created_at: string;
  actor_type: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  note: string | null;
}

export interface AdminLogsParams {
  entity_type?: string;
  action?: string;
  cursor?: string;
  limit?: number;
}

export function adminLogsQuery(params: AdminLogsParams) {
  return queryOptions({
    queryKey: ["admin", "logs", params],
    queryFn: async ({ signal }) => {
      const res = await adminClient.get<Page<AuditLogEntry>>("/admin/logs", { params, signal });
      return res.data;
    },
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}
