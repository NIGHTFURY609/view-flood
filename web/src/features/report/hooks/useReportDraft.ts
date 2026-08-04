import { useCallback, useEffect, useState } from "react";

import { EMPTY_DRAFT, type ReportDraft } from "@/features/report/schema";

const STORAGE_KEY = "kcc.report.draft";
const TTL_MS = 24 * 60 * 60 * 1000;

interface StoredDraft {
  readonly savedAt: number;
  readonly draft: ReportDraft;
}

/**
 * Persists the wizard between sessions for 24 hours.
 *
 * Kept from the prototype because it is genuinely the right call here: someone
 * filling this in is standing outside a flooded building on a phone that may
 * lose signal or die mid-form. Photos are deliberately NOT persisted — a few MB
 * of base64 would blow the localStorage quota and take the whole draft with it.
 */
export function useReportDraft(initial?: Partial<ReportDraft>) {
  const [draft, setDraft] = useState<ReportDraft>(() => {
    const base = { ...EMPTY_DRAFT, ...initial };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;

      const parsed = JSON.parse(raw) as StoredDraft;
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return base;
      }
      return { ...base, ...parsed.draft, ...initial };
    } catch {
      return base;
    }
  });

  const [restored] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const payload: StoredDraft = { savedAt: Date.now(), draft };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota or private mode — the form still works, it just will not survive.
    }
  }, [draft]);

  const update = useCallback((patch: Partial<ReportDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
    setDraft({ ...EMPTY_DRAFT, ...initial });
  }, [initial]);

  return { draft, update, clear, restored };
}
