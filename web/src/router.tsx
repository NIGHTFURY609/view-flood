import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter } from "react-router";

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
const AdminRoute = lazy(() =>
  import("@/features/admin/routes/AdminRoute").then((m) => ({ default: m.AdminRoute })),
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
      { path: "admin", element: withSuspense(AdminRoute) },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
