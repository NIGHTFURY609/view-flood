import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ImageOff,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import {
  adminCampImagesQuery,
  adminCampQuery,
  adminCampReportsQuery,
  approveAdminCamp,
  denyAdminCamp,
  rejectAdminCamp,
  updateAdminCamp,
} from "@/features/admin/api/adminCamps";
import {
  adminCampRequirementsQuery,
  adminNeedsQuery,
} from "@/features/admin/api/adminRequirements";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import { NeedDonationRow } from "@/features/admin/components/NeedDonationRow";
import { RequirementCard } from "@/features/admin/components/RequirementCard";
import { districtsQuery, lsgQuery, taluksQuery } from "@/features/camps/api";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type {
  AdminNeed,
  AdminReport,
  AdminRequirement,
  CampUpdatePayload,
} from "@/features/admin/types";
import { cn } from "@/shared/lib/cn";
import type { CampDetail, VerificationState } from "@/shared/types/api";

const NONE = "__NONE__";

interface FormState {
  name: string;
  name_ml: string;
  district_code: string;
  taluk: string;
  lsg_name: string;
  village_or_locality: string;
  landmark: string;
  camp_incharge_name: string;
  camp_phone_primary: string;
  camp_phone_secondary: string;
  status: "active" | "inactive";
}

function toForm(c: CampDetail): FormState {
  return {
    name: c.name ?? "",
    name_ml: c.name_ml ?? "",
    district_code: c.district_code ?? "",
    taluk: c.taluk ?? "",
    lsg_name: c.lsg_name ?? "",
    village_or_locality: c.village_or_locality ?? "",
    landmark: c.landmark ?? "",
    camp_incharge_name: c.camp_incharge_name ?? "",
    camp_phone_primary: c.camp_phone_primary ?? "",
    camp_phone_secondary: c.camp_phone_secondary ?? "",
    status: c.status,
  };
}

export function CampDetailRoute() {
  const { campId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const camp = useQuery(adminCampQuery(campId));
  const images = useQuery(adminCampImagesQuery(campId));
  const reports = useQuery(adminCampReportsQuery(campId));
  const requirements = useQuery(adminCampRequirementsQuery(campId));
  const campNeeds = useQuery(adminNeedsQuery({ camp_id: campId, limit: 100 }));

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (camp.data && !form) setForm(toForm(camp.data));
  }, [camp.data, form]);

  const districts = useQuery(districtsQuery());
  const taluks = useQuery({
    ...taluksQuery(form?.district_code || undefined),
    enabled: Boolean(form?.district_code) && editing,
  });
  const lsgBodies = useQuery({
    ...lsgQuery(form?.district_code || undefined),
    enabled: Boolean(form?.district_code) && editing,
  });
  const talukNames = useMemo(
    () => withCurrent((taluks.data ?? []).map((t) => t.name), form?.taluk),
    [taluks.data, form?.taluk],
  );
  const lsgNames = useMemo(
    () => withCurrent((lsgBodies.data ?? []).map((l) => l.name), form?.lsg_name),
    [lsgBodies.data, form?.lsg_name],
  );

  const save = useMutation({
    mutationFn: (payload: CampUpdatePayload) => updateAdminCamp(campId, payload),
    onSuccess: (updated) => {
      qc.setQueryData(["admin", "camp", campId], updated);
      void qc.invalidateQueries({ queryKey: ["admin", "camps"] });
      setForm(toForm(updated));
      setEditing(false);
      setSaveOpen(false);
      toast.success("Camp updated");
    },
    onError: () => toast.error("Could not save changes"),
  });

  const approve = useMutation({
    mutationFn: () => approveAdminCamp(campId),
    onSuccess: (updated) => {
      qc.setQueryData(["admin", "camp", campId], updated);
      void qc.invalidateQueries({ queryKey: ["admin", "camps"] });
      setApproveOpen(false);
      toast.success("Camp approved", { description: "It now appears in the public app." });
    },
    onError: () => toast.error("Could not approve camp"),
  });

  const reject = useMutation({
    mutationFn: () => rejectAdminCamp(campId),
    onSuccess: (updated) => {
      qc.setQueryData(["admin", "camp", campId], updated);
      void qc.invalidateQueries({ queryKey: ["admin", "camps"] });
      setRejectOpen(false);
      toast.success("Camp rejected", { description: "Left unverified, removed from the queue." });
    },
    onError: () => toast.error("Could not reject camp"),
  });

  const remove = useMutation({
    mutationFn: () => denyAdminCamp(campId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "camps"] });
      toast.success("Camp deleted", { description: "The camp and its data were removed." });
      navigate("/admin/camps/management", { replace: true });
    },
    onError: () => toast.error("Could not delete camp"),
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function submitEdit() {
    if (!form) return;
    save.mutate({
      name: form.name,
      name_ml: form.name_ml || null,
      district_code: form.district_code,
      taluk: form.taluk || null,
      lsg_name: form.lsg_name || null,
      village_or_locality: form.village_or_locality || null,
      landmark: form.landmark || null,
      camp_incharge_name: form.camp_incharge_name || null,
      camp_phone_primary: form.camp_phone_primary || null,
      camp_phone_secondary: form.camp_phone_secondary || null,
      status: form.status,
    });
  }

  const data = camp.data;
  const isReported = data?.verification_state === "unverified";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl pb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>

        {camp.isPending || !form || !data ? (
          <DetailSkeleton />
        ) : camp.isError ? (
          <p className="text-sm text-critical">Could not load this camp.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <h2 className="truncate text-lg font-semibold text-foreground">{data.name}</h2>
                <VerificationBadge state={data.verification_state} />
              </div>
              <div className="flex flex-wrap gap-2">
                {isReported && !editing && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => setApproveOpen(true)}>
                      <Check className="size-4" />
                      Approve
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)}>
                      <X className="size-4" />
                      Reject
                    </Button>
                  </>
                )}
                {!editing && (
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {editing ? (
              <EditForm
                form={form}
                set={set}
                setForm={setForm}
                districts={districts.data ?? []}
                talukNames={talukNames}
                lsgNames={lsgNames}
                saving={save.isPending}
                onCancel={() => {
                  setForm(toForm(data));
                  setEditing(false);
                }}
                onSubmit={() => setSaveOpen(true)}
              />
            ) : (
              <div className="space-y-4">
                <ViewSections
                  camp={data}
                  districtName={districts.data?.find((d) => d.code === data.district_code)?.name}
                />

                <ImagesCard
                  images={images.data ?? []}
                  loading={images.isPending}
                />

                <ReportsCard reports={reports.data ?? []} loading={reports.isPending} />

                <RequirementsCard
                  requirements={requirements.data ?? []}
                  loading={requirements.isPending}
                />

                <DonationsCard
                  needs={campNeeds.data?.items ?? []}
                  loading={campNeeds.isPending}
                />

                <div className="rounded-xl border border-[#f85149]/40 bg-[#f85149]/5 p-5">
                  <h3 className="text-sm font-semibold text-[#f85149]">Danger zone</h3>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Deleting a camp removes it and all its reports and images
                      permanently. This cannot be undone.
                    </p>
                    <Button variant="critical" size="sm" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="size-4" />
                      Delete camp
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save these changes?"
        description="This updates the live camp record immediately. Changes overwrite the previous values."
        confirmLabel="Save changes"
        loading={save.isPending}
        onConfirm={submitEdit}
      />

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve this camp?"
        description={data ? `"${data.name}" will be marked verified and shown in the public app.` : ""}
        confirmLabel="Approve"
        loading={approve.isPending}
        onConfirm={() => approve.mutate()}
      />

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this camp?"
        description={
          data
            ? `"${data.name}" will stay unverified (hidden from the public app) and leave the reported queue.`
            : ""
        }
        confirmLabel="Reject"
        loading={reject.isPending}
        onConfirm={() => reject.mutate()}
      />

      {data && (
        <DeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          campName={data.name}
          loading={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      )}
    </div>
  );
}

function ViewSections({ camp, districtName }: { camp: CampDetail; districtName: string | undefined }) {
  const location = [camp.village_or_locality, camp.lsg_name, camp.taluk, districtName ?? camp.district_code]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      <Section title="Overview">
        <Info label="Camp status" value={camp.status === "active" ? "Open" : "Closed"} />
        <Info label="Verification" value={camp.verification_state.replace("_", " ")} className="capitalize" />
        <Info label="Verified at" value={fmtDate(camp.verified_at)} />
        <Info label="Last updated" value={fmtDate(camp.updated_at)} />
      </Section>

      <Section title="Contact">
        <Info label="Camp manager" value={camp.camp_incharge_name} />
        <Info label="Primary phone" value={camp.camp_phone_primary} />
        <Info label="Secondary phone" value={camp.camp_phone_secondary} />
      </Section>

      <Section title="Location">
        <Info label="Address" value={location} className="col-span-2" />
        <Info label="Landmark" value={camp.landmark} />
        <Info label="Building type" value={camp.building_type} className="capitalize" />
        <Info label="Local body type" value={camp.lsg_type} className="capitalize" />
        <Info
          label="Coordinates"
          value={
            camp.latitude != null && camp.longitude != null
              ? `${camp.latitude.toFixed(5)}, ${camp.longitude.toFixed(5)}`
              : null
          }
        />
      </Section>

    </>
  );
}

function ImagesCard({
  images,
  loading,
}: {
  images: { id: string; url: string | null; hidden: boolean }[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Photos from reporters</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-secondary" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <ImageOff className="size-4" aria-hidden="true" />
            No photos submitted for this camp.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img) => (
              <a
                key={img.id}
                href={img.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block overflow-hidden rounded-lg border border-border"
              >
                {img.url ? (
                  <img
                    src={img.url}
                    alt="Reporter photo"
                    loading="lazy"
                    className="aspect-[4/3] w-full bg-secondary object-cover"
                  />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-secondary text-muted-foreground">
                    <ImageOff className="size-5" />
                  </div>
                )}
                {img.hidden && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-[#f85149] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    HIDDEN
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RequirementsCard({
  requirements,
  loading,
}: {
  requirements: AdminRequirement[];
  loading: boolean;
}) {
  if (!loading && requirements.length === 0) return null;

  const pending = requirements.filter((r) => r.status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Requirement requests
          {pending > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
              {pending}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="m-5 h-16 animate-pulse rounded-lg bg-secondary" />
        ) : (
          <ul className="divide-y divide-border/60">
            {requirements.map((requirement) => (
              <RequirementCard
                key={requirement.id}
                requirement={requirement}
                showCamp={false}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DonationsCard({ needs, loading }: { needs: readonly AdminNeed[]; loading: boolean }) {
  if (!loading && needs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Donations</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="m-5 h-16 animate-pulse rounded-lg bg-secondary" />
        ) : (
          <ul className="divide-y divide-border/60">
            {needs.map((need) => (
              <NeedDonationRow key={need.id} need={need} showCamp={false} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsCard({
  reports,
  loading,
}: {
  reports: AdminReport[];
  loading: boolean;
}) {
  if (!loading && reports.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reporter submissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-secondary" />
        ) : (
          reports.map((r) => (
            <div key={r.reference_code} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {r.reporter_name ?? "Anonymous"}
                  {r.reporter_relationship && (
                    <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">
                      {r.reporter_relationship}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{fmtDate(r.submitted_at)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {r.reporter_phone_primary && <span className="tabular-nums">{r.reporter_phone_primary}</span>}
                <span className="capitalize">status: {r.reported_status ?? "—"}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-mono">{r.reference_code}</span>
                {r.phone_unverified && (
                  <span className="rounded bg-[#d29922]/15 px-1.5 py-0.5 text-[#d29922]">phone unverified</span>
                )}
              </div>
              {r.auto_flags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.auto_flags.map((f) => (
                    <span key={f} className="rounded bg-[#f85149]/15 px-1.5 py-0.5 text-[10px] text-[#f85149]">
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function EditForm({
  form,
  set,
  setForm,
  districts,
  talukNames,
  lsgNames,
  saving,
  onCancel,
  onSubmit,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>;
  districts: { code: string; name: string }[];
  talukNames: string[];
  lsgNames: string[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit camp details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Camp Name">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Malayalam Name">
            <Input value={form.name_ml} onChange={(e) => set("name_ml", e.target.value)} />
          </Field>
          <Field label="Camp status (open / closed)">
            <Select value={form.status} onValueChange={(v) => set("status", v as FormState["status"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Open</SelectItem>
                <SelectItem value="inactive">Closed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="District">
            <Select
              value={form.district_code}
              onValueChange={(v) =>
                setForm((f) => (f ? { ...f, district_code: v, taluk: "", lsg_name: "" } : f))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Taluk">
            <Select
              value={form.taluk || NONE}
              onValueChange={(v) => set("taluk", v === NONE ? "" : v)}
              disabled={!form.district_code}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {talukNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Local Body">
            <Select
              value={form.lsg_name || NONE}
              onValueChange={(v) => set("lsg_name", v === NONE ? "" : v)}
              disabled={!form.district_code}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {lsgNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Village / Locality">
            <Input
              value={form.village_or_locality}
              onChange={(e) => set("village_or_locality", e.target.value)}
            />
          </Field>
          <Field label="Landmark">
            <Input value={form.landmark} onChange={(e) => set("landmark", e.target.value)} />
          </Field>
          <Field label="Camp Manager">
            <Input
              value={form.camp_incharge_name}
              onChange={(e) => set("camp_incharge_name", e.target.value)}
              placeholder="Name"
            />
          </Field>
          <Field label="Primary Phone">
            <Input
              value={form.camp_phone_primary}
              onChange={(e) => set("camp_phone_primary", e.target.value)}
              inputMode="tel"
            />
          </Field>
          <Field label="Secondary Phone">
            <Input
              value={form.camp_phone_secondary}
              onChange={(e) => set("camp_phone_secondary", e.target.value)}
              inputMode="tel"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          <Save className="size-4" aria-hidden="true" />
          Save changes
        </Button>
      </div>
    </form>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  campName,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campName: string;
  loading: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === campName.trim();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this camp?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently removes the camp and all its reports and images. To confirm,
          type the camp name below:
        </p>
        <p className="mt-2 rounded-md bg-secondary px-2.5 py-1.5 text-sm font-medium text-foreground">
          {campName}
        </p>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type the camp name to confirm"
          className="mt-3"
          autoComplete="off"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="critical" onClick={onConfirm} disabled={!matches || loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{children}</dl>
      </CardContent>
    </Card>
  );
}

function Info({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function VerificationBadge({ state }: { state: VerificationState }) {
  const map: Record<VerificationState, string> = {
    verified: "bg-[#3fb950]/15 text-[#3fb950]",
    unverified: "bg-[#d29922]/15 text-[#d29922]",
    duplicate_held: "bg-secondary text-muted-foreground",
    rejected: "bg-[#f85149]/15 text-[#f85149]",
    removed: "bg-[#f85149]/15 text-[#f85149]",
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        map[state],
      )}
    >
      {state.replace("_", " ")}
    </span>
  );
}

function withCurrent(list: string[], current: string | undefined): string[] {
  if (current && !list.includes(current)) return [current, ...list];
  return list;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-secondary" />
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <span className="h-3 w-20 animate-pulse rounded bg-secondary" />
              <span className="h-4 w-24 animate-pulse rounded bg-secondary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
