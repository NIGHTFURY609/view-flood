import { ApiError, parseErrorBody } from "./errors";
import type {
  AdminProfile,
  AdminQueueItem,
  AdminSession,
  AuditEntry,
  CampDetail,
  CampListItem,
  CampNeed,
  District,
  EmergencyContact,
  FlaggedImage,
  LsgBody,
  OtpChallenge,
  OtpPurpose,
  Page,
  PledgeResult,
  ReportResult,
  ReportSubmission,
  SignedImage,
  Taluk,
  Weather,
} from "@/shared/types/api";

/**
 * The single transport boundary.
 *
 * Nothing outside this file calls `fetch`, and nothing outside this file knows
 * where the data comes from. Swapping FastAPI for anything else means editing
 * this module and `shared/types/api.ts` — no feature code changes.
 */

const BASE_URL = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api/v1";

/**
 * Requests must not hang forever.
 *
 * The API runs on Render's free tier, which spins down when idle and can take
 * the better part of a minute to wake. Without a ceiling, a seeker on a bad
 * connection sits on a spinner with no way to tell whether anything is
 * happening. A bounded failure surfaces the retry button and the cached
 * last-seen camps instead.
 *
 * Generous because a cold start is a real, recoverable condition — not a bug.
 */
const REQUEST_TIMEOUT_MS = 45_000;

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Combine the caller's cancellation with our own deadline.
 *
 * `AbortSignal.any` only landed in Chrome 116 / Safari 17.4, and a meaningful
 * share of the phones this app is built for are older than that. The manual
 * controller path is the one those devices actually take.
 */
function withDeadline(caller?: AbortSignal): { signal: AbortSignal; dispose: () => void } {
  if (typeof AbortSignal.any === "function" && typeof AbortSignal.timeout === "function") {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    return {
      signal: caller ? AbortSignal.any([caller, timeout]) : timeout,
      dispose: () => undefined,
    };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(new DOMException("Timed out", "TimeoutError")),
    REQUEST_TIMEOUT_MS,
  );
  const forward = () => controller.abort();
  caller?.addEventListener("abort", forward);

  return {
    signal: controller.signal,
    dispose: () => {
      window.clearTimeout(timer);
      caller?.removeEventListener("abort", forward);
    },
  };
}

interface RequestOptions {
  readonly method?: "GET" | "POST" | "PATCH" | "DELETE";
  readonly query?: Query;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  /** Bearer token for /admin routes. */
  readonly token?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, signal, token } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  // ngrok shows an HTML interstitial to browser requests. Skipping it keeps
  // JSON responses (and CORS headers) flowing when the API is served through
  // a tunnel; harmless against any other origin.
  headers["ngrok-skip-browser-warning"] = "true";
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const { signal: combined, dispose } = withDeadline(signal);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body:
        body === undefined ? null : body instanceof FormData ? body : JSON.stringify(body),
      signal: combined,
    });
  } catch (cause) {
    // A caller-initiated abort is not an error to report — the component went
    // away. A timeout or a dead network is, and the offline UI branches on it.
    if (signal?.aborted) throw cause;
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new ApiError(0, "network_error", "The server took too long to respond");
    }
    throw new ApiError(0, "network_error", "Could not reach the server");
  } finally {
    dispose();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? safeJson(text) : null;

  if (!response.ok) throw parseErrorBody(response.status, payload);
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// --- request parameter shapes ------------------------------------------------

export interface CampsQueryParams {
  readonly district_code?: string;
  readonly taluk?: string;
  readonly lsg_name?: string;
  readonly status?: "active" | "inactive" | "predesignated" | "all";
  readonly verified_only?: boolean;
  readonly q?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly sort?: "distance" | "recent" | "urgency";
  readonly cursor?: string;
  readonly limit?: number;
}

export interface NeedsQueryParams {
  readonly district_code?: string;
  readonly item_key?: string;
  readonly urgency?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

// --- the surface -------------------------------------------------------------

export const api = {
  geo: {
    districts: (signal?: AbortSignal) =>
      request<District[]>("/geography/districts", signal ? { signal } : {}),
    taluks: (districtCode?: string, signal?: AbortSignal) =>
      request<Taluk[]>("/geography/taluks", {
        ...(districtCode ? { query: { district_code: districtCode } } : {}),
        ...(signal ? { signal } : {}),
      }),
    lsgBodies: (districtCode?: string, signal?: AbortSignal) =>
      request<LsgBody[]>("/geography/lsg-bodies", {
        ...(districtCode ? { query: { district_code: districtCode } } : {}),
        ...(signal ? { signal } : {}),
      }),
  },

  camps: {
    list: (params: CampsQueryParams, signal?: AbortSignal) =>
      request<Page<CampListItem>>("/camps", {
        query: params as Query,
        ...(signal ? { signal } : {}),
      }),
    get: (id: string, signal?: AbortSignal) =>
      request<CampDetail>(`/camps/${id}`, signal ? { signal } : {}),
    /** POST, not GET — a few hundred UUIDs overflow a URL. */
    batch: (ids: readonly string[], signal?: AbortSignal) =>
      request<CampListItem[]>("/camps/batch", {
        method: "POST",
        body: { ids },
        ...(signal ? { signal } : {}),
      }),
    images: (id: string, signal?: AbortSignal) =>
      request<SignedImage[]>(`/camps/${id}/images`, signal ? { signal } : {}),
    flagImage: (campId: string, imageId: string, reason: string) =>
      request<{ ok: boolean }>(`/camps/${campId}/images/${imageId}/flag`, {
        method: "POST",
        body: { reason },
      }),
  },

  needs: {
    list: (params: NeedsQueryParams, signal?: AbortSignal) =>
      request<Page<CampNeed>>("/needs", {
        query: params as Query,
        ...(signal ? { signal } : {}),
      }),
    forCamp: (campId: string, signal?: AbortSignal) =>
      request<CampNeed[]>(`/camps/${campId}/needs`, signal ? { signal } : {}),
    pledge: (needId: string, input: PledgeInput) =>
      request<PledgeResult>(`/needs/${needId}/pledges`, { method: "POST", body: input }),
  },

  requirements: {
    /** Asks for supplies on behalf of a camp. Inert until an admin approves it. */
    submit: (campId: string, input: RequirementInput) =>
      request<RequirementResult>(`/camps/${campId}/requirements`, {
        method: "POST",
        body: input,
      }),
  },

  otp: {
    request: (phone: string, purpose: OtpPurpose) =>
      request<OtpChallenge>("/otp/challenges", { method: "POST", body: { phone, purpose } }),
  },

  reports: {
    submit: (input: ReportSubmission) =>
      request<ReportResult>("/reports", { method: "POST", body: input }),
  },

  admin: {
    login: (email: string, password: string) =>
      request<AdminSession>("/admin/login", { method: "POST", body: { email, password } }),
    me: (token: string) => request<AdminProfile>("/admin/me", { token }),
    queue: (params: { district_code?: string; cursor?: string; limit?: number }, token: string) =>
      request<Page<AdminQueueItem>>("/admin/reports", { query: params as Query, token }),
    verify: (
      campId: string,
      body: { method?: string | undefined; note?: string | undefined },
      token: string,
    ) =>
      request<unknown>(`/admin/camps/${campId}/verify`, { method: "POST", body, token }),
    reject: (campId: string, note: string, token: string) =>
      request<unknown>(`/admin/camps/${campId}/reject`, { method: "POST", body: { note }, token }),
    remove: (campId: string, note: string, token: string) =>
      request<unknown>(`/admin/camps/${campId}/remove`, { method: "POST", body: { note }, token }),
    merge: (campId: string, canonicalCampId: string, note: string | null, token: string) =>
      request<unknown>(`/admin/camps/${campId}/merge`, {
        method: "POST",
        body: { canonical_camp_id: canonicalCampId, note },
        token,
      }),
    flaggedImages: (params: { cursor?: string; limit?: number }, token: string) =>
      request<Page<FlaggedImage>>("/admin/report-images/flagged", {
        query: params as Query,
        token,
      }),
    hideImage: (imageId: string, reason: string, token: string) =>
      request<{ ok: boolean }>(`/admin/report-images/${imageId}/hide`, {
        method: "POST",
        body: { reason },
        token,
      }),
    auditLog: (
      params: { entity_type?: string; entity_id?: string; cursor?: string; limit?: number },
      token: string,
    ) => request<Page<AuditEntry>>("/admin/audit-log", { query: params as Query, token }),
  },

  emergency: {
    list: (districtCode?: string, signal?: AbortSignal) =>
      request<EmergencyContact[]>("/emergency-contacts", {
        ...(districtCode ? { query: { district_code: districtCode } } : {}),
        ...(signal ? { signal } : {}),
      }),
  },

  weather: {
    at: (lat: number, lng: number, signal?: AbortSignal) =>
      request<Weather>("/weather", { query: { lat, lng }, ...(signal ? { signal } : {}) }),
  },
} as const;

export interface RequirementItemInput {
  readonly category: string;
  /** A catalogue key, or "other" with a label. */
  readonly item_key: string;
  readonly label?: string | null;
  readonly quantity: number;
}

export interface RequirementInput {
  readonly submitter_name: string;
  readonly submitter_phone: string;
  readonly note?: string | null;
  readonly items: readonly RequirementItemInput[];
}

export interface RequirementResult {
  readonly ok: boolean;
  readonly requirement_id: string;
  readonly item_count: number;
}

export interface PledgeInput {
  readonly quantity: number;
  readonly donor_name: string;
  readonly donor_phone: string;
  readonly challenge_id?: string | null;
  readonly otp_code?: string | null;
}

export { ApiError };
