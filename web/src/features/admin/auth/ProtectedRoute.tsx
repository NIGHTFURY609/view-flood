import { Navigate, Outlet } from "react-router";

import { hasSession } from "@/features/admin/auth/tokenStore";

/**
 * Cheap client-side gate: whether a session plausibly exists (a stored token in
 * bearer mode, or the non-httpOnly `logged_in` cookie in cookie mode). This is a
 * UX guard, not a security boundary — the real check is server-side on every
 * /admin request. It just avoids flashing a protected screen before that fails.
 */
export function ProtectedRoute() {
  if (!hasSession()) {
    return <Navigate to="/admin/login" replace />;
  }
  return <Outlet />;
}
