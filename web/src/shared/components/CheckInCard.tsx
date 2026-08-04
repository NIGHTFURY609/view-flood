import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, DoorClosed, DoorOpen, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { checkInsQuery } from "@/features/camps/api";
import { api } from "@/shared/api/client";
import { isApiError } from "@/shared/api/errors";
import { queryKeys } from "@/shared/api/queryClient";
import { Button } from "@/shared/components/ui/button";
import { Input, Textarea } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useI18n, type DictKey } from "@/shared/i18n";
import { AMENITIES, type AmenityKey } from "@/shared/lib/amenities";
import { cn } from "@/shared/lib/cn";
import { normalisePhone } from "@/shared/lib/format";

/**
 * Crowd confirmation. One check-in per phone and per network per day, enforced
 * server-side — the two rejections get different copy because they mean
 * different things to the person standing there.
 */
export function CheckInCard({ campId, count }: { campId: string; count: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(true);
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  const [families, setFamilies] = useState("");
  const [children, setChildren] = useState("");
  const [amenities, setAmenities] = useState<AmenityKey[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const recent = useQuery(checkInsQuery(campId));

  const submit = useMutation({
    mutationFn: async () => {
      const e164 = normalisePhone(phone);
      if (!e164) throw new Error("invalid_phone");

      return api.checkins.create({
        camp_id: campId,
        phone: e164,
        is_open: isOpen,
        note: note.trim() || null,
        people_count: people === "" ? null : Number(people),
        // The prototype hardcoded family_count: 1 with no field in the UI, so
        // every check-in claimed exactly one family regardless of reality.
        family_count: families === "" ? null : Number(families),
        children_count: children === "" ? null : Number(children),
        amenities,
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(
          result.reason === "already_ip" ? t("checkin.alreadyIp") : t("checkin.alreadyPhone"),
        );
        return;
      }
      setDone(true);
      toast.success(t("checkin.success"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.checkins(campId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.campDetail(campId) });
    },
    onError: (cause) => {
      if (cause instanceof Error && cause.message === "invalid_phone") {
        setError(t("checkin.invalidPhone"));
        return;
      }
      toast.error(isApiError(cause) ? t("checkin.error") : t("error.generic"));
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!normalisePhone(phone)) {
      setError(t("checkin.invalidPhone"));
      return;
    }
    submit.mutate();
  }

  if (done) {
    return (
      <section className="panel flex flex-col items-center gap-2 p-6 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-verified-soft text-verified">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </span>
        <p className="text-base font-semibold text-foreground">{t("checkin.success")}</p>
      </section>
    );
  }

  return (
    <section className="panel flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-base font-bold text-foreground">{t("checkin.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{t("checkin.subtitle")}</p>
        {count > 0 ? (
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {t("checkin.count", { count })}
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-foreground">
            {t("checkin.title")}
          </legend>
          <div className="flex gap-2">
            <StateButton active={isOpen} onClick={() => setIsOpen(true)} tone="open">
              <DoorOpen className="size-4" aria-hidden="true" />
              {t("checkin.open")}
            </StateButton>
            <StateButton active={!isOpen} onClick={() => setIsOpen(false)} tone="closed">
              <DoorClosed className="size-4" aria-hidden="true" />
              {t("checkin.closed")}
            </StateButton>
          </div>
        </fieldset>

        <div>
          <Label htmlFor="checkin-phone" className="mb-1.5 block">
            {t("checkin.phone")}
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">+91</span>
            <Input
              id="checkin-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              aria-invalid={error !== null}
              {...(error ? { "aria-describedby": "checkin-phone-error" } : {})}
              required
            />
          </div>
          {error ? (
            <p id="checkin-phone-error" role="alert" className="mt-1 text-xs text-critical">
              {error}
            </p>
          ) : null}
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            {t("checkin.occupancy")}
          </legend>
          <p className="mb-2 mt-0.5 text-xs text-muted-foreground">{t("checkin.occupancyHint")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CountField
              id="checkin-people"
              label={t("checkin.people")}
              value={people}
              onChange={setPeople}
            />
            <CountField
              id="checkin-families"
              label={t("checkin.families")}
              value={families}
              onChange={setFamilies}
            />
            <CountField
              id="checkin-children"
              label={t("checkin.children")}
              value={children}
              onChange={setChildren}
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            {t("checkin.amenities")}
          </legend>
          <p className="mb-2 mt-0.5 text-xs text-muted-foreground">{t("checkin.amenitiesHint")}</p>
          <div className="flex flex-wrap gap-1.5">
            {AMENITIES.map(({ key, icon: Icon }) => {
              const active = amenities.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setAmenities((current) =>
                      current.includes(key)
                        ? current.filter((a) => a !== key)
                        : [...current, key],
                    )
                  }
                  className={cn(
                    "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5",
                    "text-xs font-medium transition-colors duration-(--duration-fast)",
                    active
                      ? "border-verified bg-verified-soft text-verified"
                      : "border-input bg-surface text-foreground hover:bg-secondary",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {t(`amenity.${key}` as DictKey)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="checkin-note" className="mb-1.5 block">
            {t("checkin.note")}
          </Label>
          <Textarea
            id="checkin-note"
            value={note}
            maxLength={280}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={submit.isPending}>
          {submit.isPending ? t("list.loading") : t("checkin.submit")}
        </Button>
      </form>

      {(recent.data?.length ?? 0) > 0 ? (
        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t("checkin.title")}</h3>
          <ul className="flex flex-col gap-2">
            {(recent.data ?? []).map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 text-xs">
                <Users className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">
                  {/* Phones are masked server-side and never sent in full. */}
                  <span className="font-semibold text-foreground">{entry.phone_masked}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {entry.is_open ? t("status.active") : t("status.inactive")}
                  </span>
                  {entry.note ? (
                    <span className="block text-muted-foreground">{entry.note}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function StateButton({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: "open" | "closed";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3",
        "text-sm font-semibold transition-colors duration-(--duration-fast)",
        active && tone === "open" && "border-open bg-open-soft text-open",
        active && tone === "closed" && "border-closed bg-closed-soft text-closed",
        !active && "border-input bg-surface text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function CountField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
