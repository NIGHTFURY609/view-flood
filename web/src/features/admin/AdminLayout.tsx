import { useEffect } from "react";
import { Outlet } from "react-router";

import { AuthProvider } from "@/features/admin/auth/AuthContext";

// Applied to <body> while the admin panel is mounted. Radix Dialog/Select
// portal to <body>, OUTSIDE the wrapper div below — so scoping the theme only
// to that div left modals rendering with the public theme (white scrim, wrong
// accent). Theming the body makes portaled content inherit the Kashti tokens,
// and the classes are removed again the moment the admin panel unmounts.
const ADMIN_BODY_CLASSES = ["admin-theme", "dark", "font-inter"];

/**
 * The admin shell. Deliberately renders NONE of the public RootLayout chrome
 * (header, nav, footer, PWA prompt) — the admin panel is a separate surface.
 *
 * There is NO <Toaster> here on purpose: the app already mounts one in
 * app/providers.tsx. A second Toaster made every toast render twice. The global
 * one picks up the admin (Kashti) theme automatically because we theme <body>.
 */
export function AdminLayout() {
  useEffect(() => {
    document.body.classList.add(...ADMIN_BODY_CLASSES);
    return () => document.body.classList.remove(...ADMIN_BODY_CLASSES);
  }, []);

  return (
    <AuthProvider>
      <div className="admin-theme dark font-inter h-dvh overflow-hidden bg-background text-foreground">
        <Outlet />
      </div>
    </AuthProvider>
  );
}
