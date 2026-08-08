import { createBrowserRouter, Navigate } from "react-router";

import { NotFound } from "@/app/NotFound";
import { RootErrorBoundary } from "@/app/RootErrorBoundary";
import { RootLayout } from "@/app/RootLayout";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { ProtectedRoute } from "@/features/admin/auth/ProtectedRoute";
import { DashboardLayout } from "@/features/admin/layouts/DashboardLayout";
import { AdminDashboardRoute } from "@/features/admin/routes/AdminDashboardRoute";
import { AdminLoginRoute } from "@/features/admin/routes/AdminLoginRoute";
import { CampDetailRoute as AdminCampDetailRoute } from "@/features/admin/routes/CampDetailRoute";
import { CampsManagementRoute } from "@/features/admin/routes/CampsManagementRoute";
import { DonationsRoute } from "@/features/admin/routes/DonationsRoute";
import { LogsRoute } from "@/features/admin/routes/LogsRoute";
import { ReportedCampsRoute } from "@/features/admin/routes/ReportedCampsRoute";
import { RequirementsRoute } from "@/features/admin/routes/RequirementsRoute";
import { CampDetailRoute } from "@/features/camps/routes/CampDetailRoute";
import { CampsListRoute } from "@/features/camps/routes/CampsListRoute";
import { HelplinesRoute } from "@/features/helplines/routes/HelplinesRoute";
import { NeedsRoute } from "@/features/needs/routes/NeedsRoute";
import { ReportRoute } from "@/features/report/routes/ReportRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      { index: true, element: <CampsListRoute /> },
      { path: "camps/:campId", element: <CampDetailRoute /> },
      { path: "needs", element: <NeedsRoute /> },
      { path: "helplines", element: <HelplinesRoute /> },
      { path: "report", element: <ReportRoute /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  // Admin panel — outside RootLayout, so no public header/nav/footer.
  {
    path: "/admin",
    element: <AdminLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "login", element: <AdminLoginRoute /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              {
                path: "dashboard",
                element: <AdminDashboardRoute />,
                handle: { title: "Dashboard", subtitle: "Admin overview" },
              },
              {
                path: "camps/management",
                element: <CampsManagementRoute />,
                handle: {
                  title: "Camps Management",
                  subtitle: "Overview and management of all relief camps",
                },
              },
              {
                path: "camps/reported",
                element: <ReportedCampsRoute />,
                handle: {
                  title: "Reported Camps",
                  subtitle: "Unverified camps awaiting review",
                },
              },
              {
                // Promoted out of the Camps group into its own section.
                path: "camps/requirements",
                element: <Navigate to="/admin/requirements" replace />,
              },
              {
                path: "requirements",
                element: <RequirementsRoute />,
                handle: {
                  title: "Requirement Requests",
                  subtitle: "Supply requests awaiting review",
                },
              },
              {
                path: "requirements/donations",
                element: <DonationsRoute />,
                handle: {
                  title: "Donations",
                  subtitle: "Approved needs and who has pledged against them",
                },
              },
              {
                path: "camps/:campId",
                element: <AdminCampDetailRoute />,
                handle: { title: "Camp Details", subtitle: "View and edit camp information" },
              },
              {
                path: "logs",
                element: <LogsRoute />,
                handle: { title: "Activity Logs", subtitle: "Every admin action, most recent first" },
              },
            ],
          },
        ],
      },
    ],
  },
]);
