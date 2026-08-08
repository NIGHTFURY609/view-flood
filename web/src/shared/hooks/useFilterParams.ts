import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { z } from "zod";

/**
 * One URL-driven filter pattern for every list route.
 *
 * The prototype drove `/` from search params but kept `/needs` in useState, so
 * requirement filters vanished on refresh and could not be shared as a link.
 * Both routes now go through this hook, so a filtered view is always a URL.
 */
export function useFilterParams<S extends z.ZodObject<z.ZodRawShape>>(schema: S) {
  type Values = z.infer<S>;

  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo<Values>(() => {
    const raw: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) raw[key] = value;
    // Unparseable params fall back to defaults rather than throwing — a
    // hand-edited or truncated URL must never break the page.
    const parsed = schema.safeParse(raw);
    return (parsed.success ? parsed.data : schema.parse({})) as Values;
  }, [searchParams, schema]);

  const setValues = useCallback(
    (patch: Partial<Values>, options?: { resetPage?: boolean }) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);

          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === null || value === "" || value === false) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }

          // Changing a filter while on page 4 of the old result set is never
          // what the user meant.
          if (options?.resetPage !== false && !("page" in patch)) next.delete("page");

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const reset = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return { values, setValues, reset };
}

/** Shared field vocabulary so `/` and `/needs` cannot drift apart. */
export const campListFilterSchema = z.object({
  district: z.string().trim().max(4).catch("").default(""),
  taluk: z.string().trim().max(80).catch("").default(""),
  lsg: z.string().trim().max(120).catch("").default(""),
  // Every camp now comes from community reporting, so "open now" is the
  // useful default. The pre-designated government sheet is no longer the
  // data source, and that filter would match nothing.
  status: z.enum(["active", "inactive", "predesignated", "all"]).catch("active"),
  verified: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .catch(false),
  q: z.string().trim().max(80).catch("").default(""),
  view: z.enum(["card", "list"]).catch("card"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});

export const needsFilterSchema = z.object({
  district: z.string().trim().max(4).catch("").default(""),
  item: z.string().trim().max(40).catch("").default(""),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});

export type CampListFilters = z.infer<typeof campListFilterSchema>;
export type NeedsFilters = z.infer<typeof needsFilterSchema>;
