import Cookies from "js-cookie";
import { Navigate, Outlet } from "react-router";

/**
 * Cheap client-side gate: the presence of the non-httpOnly `logged_in` cookie.
 * This is a UX guard, not a security boundary — the real check is server-side on
 * every /admin request via the httpOnly access cookie. It just avoids flashing a
 * protected screen before that request can fail.
 */
export function ProtectedRoute() {
  if (!Cookies.get("logged_in")) {
    return <Navigate to="/admin/login" replace />;
  }
  return <Outlet />;
}
