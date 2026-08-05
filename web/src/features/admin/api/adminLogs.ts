import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { adminClient } from "@/features/admin/api/adminClient";
import type { AdminLogsParams, AuditLogEntry } from "@/features/admin/types";
import type { Page } from "@/shared/types/api";

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
