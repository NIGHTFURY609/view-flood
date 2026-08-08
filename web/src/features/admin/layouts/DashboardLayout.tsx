import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Flag,
  HandHeart,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPinned,
  Menu,
  PackagePlus,
  ScrollText,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useMatches, useNavigate } from "react-router";

import { adminRequirementCountsQuery } from "@/features/admin/api/adminRequirements";
import { useAuth } from "@/features/admin/auth/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/lib/cn";

interface RouteHandle {
  title?: string;
  subtitle?: string;
}

function linkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
    "transition-colors duration-(--duration-fast)",
    isActive
      ? "bg-secondary text-foreground"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
  );
}

/** Same circular badge the filter button uses. Hidden at zero. */
function CountBubble({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto grid size-5 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const [campsOpen, setCampsOpen] = useState(() => location.pathname.startsWith("/admin/camps"));
  const [reqOpen, setReqOpen] = useState(() =>
    location.pathname.startsWith("/admin/requirements"),
  );
  const counts = useQuery(adminRequirementCountsQuery());

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <LayoutDashboard className="size-4" aria-hidden="true" />
        </span>
        <span className="truncate text-sm font-bold text-foreground">Camp Check Admin</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <NavLink to="/admin/dashboard" className={linkClass} onClick={onNavigate}>
          <LayoutDashboard className="size-4" aria-hidden="true" />
          Dashboard
        </NavLink>

        <div>
          <button
            type="button"
            onClick={() => setCampsOpen((v) => !v)}
            aria-expanded={campsOpen}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2",
              "text-sm font-semibold text-foreground",
              "transition-colors duration-(--duration-fast) hover:bg-secondary",
            )}
          >
            <span className="flex items-center gap-2">
              <MapPinned className="size-4" aria-hidden="true" />
              Camps
            </span>
            {campsOpen ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
          </button>

          {campsOpen && (
            <div className="mt-1 space-y-1 pl-3">
              <NavLink to="/admin/camps/management" className={linkClass} onClick={onNavigate}>
                <ListChecks className="size-4" aria-hidden="true" />
                Camps Management
              </NavLink>
              <NavLink to="/admin/camps/reported" className={linkClass} onClick={onNavigate}>
                <Flag className="size-4" aria-hidden="true" />
                Reported Camps
              </NavLink>
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setReqOpen((v) => !v)}
            aria-expanded={reqOpen}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2",
              "text-sm font-semibold text-foreground",
              "transition-colors duration-(--duration-fast) hover:bg-secondary",
            )}
          >
            <span className="flex items-center gap-2">
              <PackagePlus className="size-4" aria-hidden="true" />
              Requirements
              {!reqOpen ? <CountBubble count={counts.data?.total ?? 0} /> : null}
            </span>
            {reqOpen ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
          </button>

          {reqOpen && (
            <div className="mt-1 space-y-1 pl-3">
              <NavLink to="/admin/requirements" end className={linkClass} onClick={onNavigate}>
                <Inbox className="size-4" aria-hidden="true" />
                Requests
                <CountBubble count={counts.data?.total ?? 0} />
              </NavLink>
              <NavLink
                to="/admin/requirements/donations"
                className={linkClass}
                onClick={onNavigate}
              >
                <HandHeart className="size-4" aria-hidden="true" />
                Donations
              </NavLink>
            </div>
          )}
        </div>

        <NavLink to="/admin/logs" className={linkClass} onClick={onNavigate}>
          <ScrollText className="size-4" aria-hidden="true" />
          Logs
        </NavLink>
      </nav>
    </div>
  );
}

export function DashboardLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const matches = useMatches();
  const [navOpen, setNavOpen] = useState(false);

  const handle = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.title)
    ?.handle as RouteHandle | undefined;

  async function handleLogout() {
    await logout();
    void navigate("/admin/login", { replace: true });
  }

  return (
    <div className="flex h-full bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0" aria-describedby={undefined}>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarNav onNavigate={() => setNavOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-foreground">
              {handle?.title ?? "Admin"}
            </h1>
            {handle?.subtitle && (
              <p className="truncate text-xs text-muted-foreground">{handle.subtitle}</p>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {user && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            )}
            <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
