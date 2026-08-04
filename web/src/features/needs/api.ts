import { queryOptions } from "@tanstack/react-query";

import { api, type NeedsQueryParams } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/queryClient";

export function needsListQuery(params: NeedsQueryParams) {
  return queryOptions({
    queryKey: queryKeys.needsList(params),
    queryFn: ({ signal }) => api.needs.list(params, signal),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
