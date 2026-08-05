import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router";

import { NotFound } from "@/app/NotFound";
import { RootErrorBoundary } from "@/app/RootErrorBoundary";
import { RootLayout } from "@/app/RootLayout";
import { RouteFallback } from "@/shared/components/Skeletons";

/**
 * Data mode + per-route lazy(). Leaflet, the report wizard's image pipeline and
 * the whole admin subtree are separate chunks, so a seeker looking for a camp
 * never downloads them.
 */
function withSuspense(Component: ComponentType): ReactNode {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );
}

const CampsListRoute = lazy(() =>
  import("@/features/camps/routes/CampsListRoute").then((m) => ({ default: m.CampsListRoute })),
);
const CampDetailRoute = lazy(() =>
  import("@/features/camps/routes/CampDetailRoute").then((m) => ({ default: m.CampDetailRoute })),
);
const AdminLogsRoute = lazy(() =>
  import("@/features/admin/routes/LogsRoute").then((m) => ({ default: m.LogsRoute })),
);
const NeedsRoute = lazy(() =>
  import("@/features/needs/routes/NeedsRoute").then((m) => ({ default: m.NeedsRoute })),
);
const HelplinesRoute = lazy(() =>
  import("@/features/helplines/routes/HelplinesRoute").then((m) => ({
    default: m.HelplinesRoute,
  })),
);
// The wizard pulls in the image pipeline; the admin subtree pulls in staff-only
// UI and copy. Neither belongs in a seeker's first download.
const ReportRoute = lazy(() =>
  import("@/features/report/routes/ReportRoute").then((m) => ({ default: m.ReportRoute })),
);
// Admin panel — its own chunk and its own layout. AdminLayout provides the
// AuthProvider + toasts; ProtectedRoute gates everything past login.
const AdminLayout = lazy(() =>
  import("@/features/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const ProtectedRoute = lazy(() =>
  import("@/features/admin/auth/ProtectedRoute").then((m) => ({ default: m.ProtectedRoute })),
);
const DashboardLayout = lazy(() =>
  import("@/features/admin/layouts/DashboardLayout").then((m) => ({ default: m.DashboardLayout })),
);
const AdminLoginRoute = lazy(() =>
  import("@/features/admin/routes/AdminLoginRoute").then((m) => ({ default: m.AdminLoginRoute })),
);
const AdminDashboardRoute = lazy(() =>
  import("@/features/admin/routes/AdminDashboardRoute").then((m) => ({
    default: m.AdminDashboardRoute,
  })),
);
const CampsManagementRoute = lazy(() =>
  import("@/features/admin/routes/CampsManagementRoute").then((m) => ({
    default: m.CampsManagementRoute,
  })),
);
const ReportedCampsRoute = lazy(() =>
  import("@/features/admin/routes/ReportedCampsRoute").then((m) => ({
    default: m.ReportedCampsRoute,
  })),
);
const AdminCampDetailRoute = lazy(() =>
  import("@/features/admin/routes/CampDetailRoute").then((m) => ({
    default: m.CampDetailRoute,
  })),
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      { index: true, element: withSuspense(CampsListRoute) },
      { path: "camps/:campId", element: withSuspense(CampDetailRoute) },
      { path: "needs", element: withSuspense(NeedsRoute) },
      { path: "helplines", element: withSuspense(HelplinesRoute) },
      { path: "report", element: withSuspense(ReportRoute) },
      { path: "*", element: <NotFound /> },
    ],
  },
  // Admin panel — outside RootLayout, so no public header/nav/footer.
  {
    path: "/admin",
    element: withSuspense(AdminLayout),
    errorElement: <RootErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "login", element: withSuspense(AdminLoginRoute) },
      {
        element: withSuspense(ProtectedRoute),
        children: [
          {
            element: withSuspense(DashboardLayout),
            children: [
              {
                path: "dashboard",
                element: withSuspense(AdminDashboardRoute),
                handle: { title: "Dashboard", subtitle: "Admin overview" },
              },
              {
                path: "camps/management",
                element: withSuspense(CampsManagementRoute),
                handle: {
                  title: "Camps Management",
                  subtitle: "Overview and management of all relief camps",
                },
              },
              {
                path: "camps/reported",
                element: withSuspense(ReportedCampsRoute),
                handle: {
                  title: "Reported Camps",
                  subtitle: "Unverified camps awaiting review",
                },
              },
              {
                path: "camps/:campId",
                element: withSuspense(AdminCampDetailRoute),
                handle: { title: "Camp Details", subtitle: "View and edit camp information" },
              },
              {
                path: "logs",
                element: withSuspense(AdminLogsRoute),
                handle: { title: "Activity Logs", subtitle: "Every admin action, most recent first" },
              },
            ],
          },
        ],
      },
    ],
  },
]);
