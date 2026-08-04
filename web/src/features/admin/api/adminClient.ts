import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

const BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api/v1";

/**
 * Admin transport. Auth rides entirely in httpOnly cookies (access + refresh),
 * so nothing here reads or writes a token — `withCredentials` sends them for us.
 * The one non-httpOnly cookie, `logged_in`, is only ever read by the app to
 * decide whether a session is worth probing; it is never a credential.
 */
export const adminClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// --- silent refresh on 401 ---------------------------------------------------
// The access cookie is short-lived. When it expires, exactly one request should
// hit /auth/refresh; every other in-flight 401 waits in this queue and retries
// once the refresh resolves, rather than each firing its own refresh.
let isRefreshing = false;
let waiters: Array<() => void> = [];

function flushWaiters() {
  waiters.forEach((resume) => resume());
  waiters = [];
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
      await adminClient.post("/auth/refresh");
      flushWaiters();
      return adminClient(original);
    } catch (refreshError) {
      waiters = [];
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
