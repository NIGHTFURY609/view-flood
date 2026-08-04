import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  EyeOff,
  FileClock,
  Inbox,
  ImageOff,
  LogOut,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAdminSession } from "@/features/admin/useAdminSession";
import { api } from "@/shared/api/client";
import { isApiError } from "@/shared/api/errors";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Input, Textarea } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { NeedsRowSkeleton } from "@/shared/components/Skeletons";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { displayPhone, formatIst } from "@/shared/lib/format";

type Tab = "queue" | "images" | "audit";

/**
 * Staff-only verification portal.
 *
 * Visually distinct from the public app — navy chrome, no orange, denser rows —
 * so it is never mistaken for the public site. Same token system throughout.
 */
export function AdminRoute() {
  const { t } = useI18n();
  const session = useAdminSession();
  const [tab, setTab] = useState<Tab>("queue");

  useEffect(() => {
    document.title = `Admin — ${t("app.name")}`;
  }, [t]);

  if (session.checking) {
    return (
      <div className="space-y-2 py-8">
        <NeedsRowSkeleton />
        <NeedsRowSkeleton />
      </div>
    );
  }

  if (!session.profile || !session.token) {
    return <AdminLogin onSignIn={session.signIn} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground">
        <ShieldCheck className="size-5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">Verification portal</h1>
          <p className="truncate text-xs opacity-80">{session.profile.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={session.signOut} className="text-primary-foreground hover:bg-white/10">
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </Button>
      </header>

      <nav aria-label="Admin sections">
        <ul className="flex flex-wrap gap-1 rounded-lg border border-border bg-secondary p-1">
          {(
            [
              { key: "queue" as const, label: "Pending reports", icon: Inbox },
              { key: "images" as const, label: "Flagged photos", icon: ImageOff },
              { key: "audit" as const, label: "Audit log", icon: FileClock },
            ]
          ).map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={tab === item.key ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-semibold",
                  "transition-colors duration-(--duration-fast)",
                  tab === item.key
                    ? "bg-surface text-foreground shadow-panel"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "queue" ? <QueuePanel token={session.token} /> : null}
      {tab === "images" ? <ImagesPanel token={session.token} /> : null}
      {tab === "audit" ? <AuditPanel token={session.token} /> : null}
    </div>
  );
}

function AdminLogin({
  onSignIn,
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signIn = useMutation({
    mutationFn: () => onSignIn(email, password),
    onError: (cause) =>
      setError(
        isApiError(cause) && cause.code === "db_not_configured"
          ? "The admin portal needs database credentials. See apps/api/.env."
          : "Email or password is incorrect.",
      ),
  });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 py-10">
      <div className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-xl font-bold text-foreground">Verification portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Staff access only.</p>
      </div>

      <form
        className="panel flex flex-col gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          signIn.mutate();
        }}
      >
        <div>
          <Label htmlFor="admin-email" className="mb-1.5 block">
            Email
          </Label>
          <Input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="admin-password" className="mb-1.5 block">
            Password
          </Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? (
          <p role="alert" className="text-xs font-medium text-critical">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" disabled={signIn.isPending}>
          {signIn.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Accounts are provisioned by the platform owner. There is no self-registration.
      </p>
    </div>
  );
}

function QueuePanel({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const queue = useQuery({
    queryKey: ["admin", "queue"],
    queryFn: () => api.admin.queue({ limit: 25 }, token),
  });

  const act = useMutation({
    mutationFn: async (args: { campId: string; action: "verify" | "reject" }) => {
      if (args.action === "verify") {
        return api.admin.verify(args.campId, { method: "phone_call", note: note || undefined }, token);
      }
      return api.admin.reject(args.campId, note || "Rejected on review", token);
    },
    onSuccess: () => {
      toast.success("Saved");
      setNote("");
      setActing(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "queue"] });
      void queryClient.invalidateQueries({ queryKey: ["camps"] });
    },
    onError: () => toast.error("Could not save that"),
  });

  if (queue.isPending) {
    return (
      <div className="space-y-2">
        <NeedsRowSkeleton />
        <NeedsRowSkeleton />
      </div>
    );
  }
  if (queue.isError) return <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />;

  const items = queue.data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState title="Nothing waiting for review" hint="New community reports appear here." />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id} className="panel flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-foreground">{item.camp_name}</h2>
              <p className="text-xs text-muted-foreground">
                {[item.district_code, item.taluk, item.lsg_name].filter(Boolean).join(" › ")}
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs font-bold text-secondary-foreground">
              {item.reference_code}
            </span>
          </div>

          {/* Reporter contact is visible here and nowhere else. */}
          <dl className="grid grid-cols-2 gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Reporter</dt>
              <dd className="font-semibold text-foreground">{item.reporter_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-semibold text-foreground">
                <a href={`tel:${item.reporter_phone}`} className="text-accent hover:underline">
                  {displayPhone(item.reporter_phone)}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reported</dt>
              <dd className="font-semibold text-foreground">
                {item.reported_status === "active" ? "Open" : "Closed"} · {item.reported_urgency}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="font-semibold text-foreground">{formatIst(item.submitted_at)}</dd>
            </div>
          </dl>

          {item.auto_flags.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {item.auto_flags.map((flag) => (
                <li
                  key={flag}
                  className="rounded-full bg-unverified-soft px-2 py-0.5 text-xs font-semibold text-unverified"
                >
                  {flag.replaceAll("_", " ")}
                </li>
              ))}
            </ul>
          ) : null}

          {acting === item.id ? (
            <Textarea
              value={note}
              maxLength={500}
              placeholder="Reason / note (required to reject)"
              onChange={(event) => setNote(event.target.value)}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={act.isPending}
              onClick={() => item.camp_id && act.mutate({ campId: item.camp_id, action: "verify" })}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={act.isPending}
              onClick={() => {
                if (acting !== item.id) {
                  setActing(item.id);
                  return;
                }
                if (note.trim().length < 3) {
                  toast.error("Give a reason before rejecting");
                  return;
                }
                if (item.camp_id) act.mutate({ campId: item.camp_id, action: "reject" });
              }}
            >
              <XCircle className="size-4" aria-hidden="true" />
              Reject
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ImagesPanel({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const flagged = useQuery({
    queryKey: ["admin", "images"],
    queryFn: () => api.admin.flaggedImages({ limit: 30 }, token),
  });

  const hide = useMutation({
    mutationFn: (imageId: string) => api.admin.hideImage(imageId, "Hidden on review", token),
    onSuccess: () => {
      toast.success("Photo hidden");
      void queryClient.invalidateQueries({ queryKey: ["admin", "images"] });
    },
    onError: () => toast.error("Could not hide that photo"),
  });

  if (flagged.isPending) return <NeedsRowSkeleton />;
  if (flagged.isError) {
    return <ErrorState error={flagged.error} onRetry={() => void flagged.refetch()} />;
  }

  const items = flagged.data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState title="No flagged photos" hint="Reports from the public appear here." />;
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.flag_id} className="panel flex flex-col gap-2 p-3">
          {item.url ? (
            <img
              src={item.url}
              alt="Flagged submission"
              className="aspect-[4/3] w-full rounded-lg bg-muted object-cover"
            />
          ) : null}
          <p className="text-sm font-semibold text-foreground">{item.camp_name ?? "Unattached"}</p>
          <p className="text-xs text-muted-foreground text-pretty">{item.reason}</p>
          <p className="text-xs text-muted-foreground">
            {item.flag_count} flag(s) · {formatIst(item.created_at)}
          </p>
          <Button
            variant="critical"
            size="sm"
            disabled={item.hidden || hide.isPending}
            onClick={() => hide.mutate(item.image_id)}
          >
            <EyeOff className="size-4" aria-hidden="true" />
            {item.hidden ? "Already hidden" : "Hide photo"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function AuditPanel({ token }: { token: string }) {
  const log = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => api.admin.auditLog({ limit: 50 }, token),
  });

  if (log.isPending) return <NeedsRowSkeleton />;
  if (log.isError) return <ErrorState error={log.error} onRetry={() => void log.refetch()} />;

  const items = log.data?.items ?? [];
  if (items.length === 0) return <EmptyState title="No activity recorded yet" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">Audit log</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-semibold">When</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Actor</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Action</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Entity</th>
            <th scope="col" className="py-2 font-semibold">Note</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr key={entry.id} className="border-b border-border/60">
              <td className="py-2 pr-3 text-xs text-muted-foreground">
                {formatIst(entry.created_at)}
              </td>
              <td className="py-2 pr-3 text-xs">{entry.actor_type}</td>
              <td className="py-2 pr-3 text-xs font-semibold text-foreground">
                {entry.action.replaceAll("_", " ")}
              </td>
              <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                {entry.entity_type}
              </td>
              <td className="py-2 text-xs text-muted-foreground">{entry.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
