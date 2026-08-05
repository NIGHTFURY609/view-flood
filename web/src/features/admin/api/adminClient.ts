import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

import { AUTH_MODE, tokenStore } from "@/features/admin/auth/tokenStore";

const BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api/v1";

/**
 * Admin transport. Two interchangeable auth paths (see AUTH_MODE):
 * - "cookie": httpOnly access/refresh cookies, sent automatically via
 *   `withCredentials`. Nothing is read or written in JS.
 * - "bearer": the access token from localStorage rides in the Authorization
 *   header. `withCredentials` stays on so the same client works either way.
 * The backend accepts both, so switching modes is a client-only change.
 */
export const adminClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Attach the Bearer token in bearer mode. A no-op in cookie mode.
adminClient.interceptors.request.use((config) => {
  if (AUTH_MODE === "bearer") {
    const token = tokenStore.getAccess();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The access token is short-lived. When it expires, exactly one request should
// hit /auth/refresh; every other in-flight 401 waits in this queue and retries
// once the refresh resolves, rather than each firing its own refresh.
let isRefreshing = false;
let waiters: Array<() => void> = [];

function flushWaiters() {
  waiters.forEach((resume) => resume());
  waiters = [];
}

async function runRefresh(): Promise<void> {
  if (AUTH_MODE === "bearer") {
    const res = await adminClient.post<{ access_token?: string }>("/auth/refresh", {
      refresh_token: tokenStore.getRefresh(),
    });
    if (res.data?.access_token) tokenStore.setAccess(res.data.access_token);
  } else {
    await adminClient.post("/auth/refresh");
  }
}

adminClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";

    // Never try to refresh the auth endpoints themselves — that loops forever.
    const isAuthEndpoint = url.includes("/auth/refresh") || url.includes("/auth/login");

    if (status !== 401 || !original || original._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      await new Promise<void>((resolve) => waiters.push(resolve));
      return adminClient(original);
    }

    isRefreshing = true;
    try {
      await runRefresh();
      flushWaiters();
      return adminClient(original);
    } catch (refreshError) {
      waiters = [];
      tokenStore.clear();
      Cookies.remove("logged_in");
      if (window.location.pathname !== "/admin/login") {
        window.location.href = "/admin/login";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
