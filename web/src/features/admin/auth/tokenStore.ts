import Cookies from "js-cookie";

/**
 * Admin auth mode.
 *
 * - "bearer": tokens live in localStorage and ride in the Authorization header.
 * - "cookie": rely on the httpOnly access/refresh cookies (nothing stored in JS).
 *
 * The backend accepts BOTH at once, so switching back to httpOnly later is a
 * one-line change here — flip this to "cookie" and rebuild.
 */
export const AUTH_MODE: "bearer" | "cookie" = "bearer";

const ACCESS_KEY = "kcc.admin.access_token";
const REFRESH_KEY = "kcc.admin.refresh_token";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const tokenStore = {
  getAccess: () => read(ACCESS_KEY),
  getRefresh: () => read(REFRESH_KEY),
  set(access: string, refresh?: string | null) {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      // localStorage unavailable — the cookie flow still covers auth.
    }
  },
  setAccess(access: string) {
    try {
      localStorage.setItem(ACCESS_KEY, access);
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // ignore
    }
  },
};

/**
 * Is there plausibly a session? Cheap client-side check used to decide whether
 * to probe /me and to gate ProtectedRoute — the real check is server-side.
 * bearer → a stored access token; cookie → the JS-readable `logged_in` flag.
 */
export function hasSession(): boolean {
  if (AUTH_MODE === "bearer") return Boolean(tokenStore.getAccess());
  try {
    return Boolean(Cookies.get("logged_in"));
  } catch {
    return false;
  }
}
