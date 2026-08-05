import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

import { StepCampDetails } from "@/features/report/components/steps/StepCampDetails";
import { StepLocation } from "@/features/report/components/steps/StepLocation";
import { StepOtp } from "@/features/report/components/steps/StepOtp";
import { StepPhotos } from "@/features/report/components/steps/StepPhotos";
import { StepReporter } from "@/features/report/components/steps/StepReporter";
import { StepStatus } from "@/features/report/components/steps/StepStatus";
import { useReportDraft } from "@/features/report/hooks/useReportDraft";
import {
  MIN_PHOTOS,
  TOTAL_STEPS,
  stepCampSchema,
  stepLocationSchema,
  stepReporterSchema,
  stepStatusSchema,
  type ReportDraft,
} from "@/features/report/schema";
import { api } from "@/shared/api/client";
import { isApiError } from "@/shared/api/errors";
import { Breadcrumbs } from "@/shared/components/Breadcrumbs";
import { Button } from "@/shared/components/ui/button";
import { useI18n, type DictKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { normalisePhone } from "@/shared/lib/format";
import type { ProcessedImage } from "@/shared/lib/imageProcessing";

const STEP_TITLES: readonly DictKey[] = [
  "report.step1",
  "report.step2",
  "report.step3",
  "report.step4",
  "report.step5",
  "report.step6",
];

/** Empty strings mean "not provided"; the API wants null. */
function orNull(value: string | undefined | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export function ReportRoute() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const campId = searchParams.get("campId");

  const initial = useMemo<Partial<ReportDraft>>(
    () => (campId ? { campId, isCorrection: true } : {}),
    [campId],
  );
  const { draft, update, clear, restored } = useReportDraft(initial);

  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<ProcessedImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otpCode, setOtpCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [submittedCampId, setSubmittedCampId] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${t("report.title")} — ${t("app.name")}`;
  }, [t]);

  const requestOtp = useMutation({
    mutationFn: () => {
      const e164 = normalisePhone(draft.reporterPhonePrimary);
      if (!e164) throw new Error("invalid_phone");
      return api.otp.request(e164, "report");
    },
    onSuccess: (challenge) => {
      setChallengeId(challenge.challenge_id);
      setDelivered(challenge.delivered);
    },
    onError: (cause) => {
      // A rate limit or an unconfigured backend must not trap the reporter on
      // step 5 — they continue and the submission is flagged for callback.
      setDelivered(false);
      if (isApiError(cause) && cause.code === "rate_limited") {
        toast.error(t("error.otp"));
      }
    },
  });

  const submit = useMutation({
    mutationFn: () => {
      const e164 = normalisePhone(draft.reporterPhonePrimary);
      if (!e164) throw new Error("invalid_phone");

      return api.reports.submit({
        camp_id: draft.campId,
        is_correction: draft.isCorrection,
        correction_note: orNull(draft.correctionNote),
        name: draft.name.trim(),
        name_ml: orNull(draft.nameMl),
        building_type: draft.buildingType,
        district_code: draft.districtCode,
        taluk: draft.taluk,
        lsg_type: draft.lsgType,
        lsg_name: draft.lsgName.trim(),
        village_or_locality: orNull(draft.villageOrLocality),
        landmark: orNull(draft.landmark),
        latitude: draft.latitude,
        longitude: draft.longitude,
        location_accuracy_m: draft.locationAccuracyM,
        camp_incharge_name: orNull(draft.campInchargeName),
        camp_phone_primary: normalisePhone(draft.campPhonePrimary),
        camp_phone_secondary: normalisePhone(draft.campPhoneSecondary),
        reported_status: draft.reportedStatus,
        reported_urgency: draft.reportedUrgency,
        reported_urgency_reason: orNull(draft.reportedUrgencyReason),
        reporter_name: draft.reporterName.trim(),
        reporter_phone_primary: e164,
        reporter_phone_secondary: normalisePhone(draft.reporterPhoneSecondary),
        reporter_gender: draft.reporterGender,
        reporter_relationship: draft.reporterRelationship,
        device_location_granted: draft.deviceLocationGranted,
        challenge_id: challengeId,
        otp_code: otpCode || null,
        images: photos.map((photo) => ({
          data_url: photo.dataUrl,
          width: photo.width,
          height: photo.height,
          blur_score: photo.blurScore,
          brightness_score: photo.brightnessScore,
          exif_lat: photo.exifLat,
          exif_lng: photo.exifLng,
          exif_captured_at: photo.exifCapturedAt,
          quality_reasons: photo.qualityReasons,
        })),
      });
    },
    onSuccess: (result) => {
      setReference(result.reference);
      setSubmittedCampId(result.camp_id);
      clear();
      setPhotos([]);
    },
    onError: (cause) => {
      if (isApiError(cause) && cause.fields) {
        setErrors(cause.fields);
        toast.error(t("error.generic"));
        return;
      }
      if (isApiError(cause) && cause.code.startsWith("otp")) {
        setErrors({ otp: "error.otpWrong" });
        return;
      }
      toast.error(t("error.generic"));
    },
  });

  function validateStep(current: number): boolean {
    const collect = (result: { success: boolean; error?: { issues: unknown[] } }) => {
      if (result.success) {
        setErrors({});
        return true;
      }
      const next: Record<string, string> = {};
      for (const issue of (result.error?.issues ?? []) as {
        path: (string | number)[];
        message: string;
      }[]) {
        const key = String(issue.path[0] ?? "form");
        next[key] = issue.message;
      }
      setErrors(next);
      return false;
    };

    if (current === 1) return collect(stepLocationSchema.safeParse(draft));
    if (current === 2) return collect(stepCampSchema.safeParse(draft));
    if (current === 3) return collect(stepStatusSchema.safeParse(draft));
    if (current === 4) {
      if (photos.length < MIN_PHOTOS) {
        setErrors({ photos: "error.minPhotos" });
        return false;
      }
      setErrors({});
      return true;
    }
    if (current === 5) return collect(stepReporterSchema.safeParse(draft));
    return true;
  }

  function next() {
    if (!validateStep(step)) return;

    // Completing step 5 triggers the code, so step 6 opens ready to verify.
    if (step === 5) requestOtp.mutate();
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  if (reference) {
    return (
      <div className="flex max-w-2xl flex-col items-center gap-4 py-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-verified-soft text-verified">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-foreground">{t("report.doneTitle")}</h1>
        <p className="max-w-md text-sm text-muted-foreground text-pretty">
          {t("report.doneBody")}
        </p>
        <p className="max-w-full break-all rounded-lg bg-secondary px-4 py-2 font-mono text-lg font-bold text-foreground">
          {reference}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {submittedCampId ? (
            <Button asChild variant="primary" size="md">
              <Link to={`/camps/${submittedCampId}`}>{t("report.viewCamp")}</Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setReference(null);
              setSubmittedCampId(null);
              setStep(1);
              setOtpCode("");
              setChallengeId(null);
            }}
          >
            {t("report.doneAnother")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Breadcrumbs
        items={[{ label: t("report.title"), to: "/report" }, { label: t(STEP_TITLES[step - 1]!) }]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("report.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{t("report.intro")}</p>
      </div>

      {/* Progress is a real progressbar, not a decorative row of divs. */}
      <div
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={t("report.step", { n: step })}
        className="flex gap-1"
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-(--duration-base)",
              i < step ? "bg-accent" : "bg-muted",
            )}
          />
        ))}
      </div>

      <p className="text-sm font-semibold text-foreground">
        {t("report.step", { n: step })} · {t(STEP_TITLES[step - 1]!)}
      </p>

      {restored && step === 1 ? (
        <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
          {t("report.saved")}
        </p>
      ) : null}

      <div className="panel p-4">
        {step === 1 ? <StepLocation draft={draft} update={update} errors={errors} /> : null}
        {step === 2 ? <StepCampDetails draft={draft} update={update} errors={errors} /> : null}
        {step === 3 ? <StepStatus draft={draft} update={update} errors={errors} /> : null}
        {step === 4 ? (
          <StepPhotos photos={photos} onChange={setPhotos} error={errors["photos"]} />
        ) : null}
        {step === 5 ? <StepReporter draft={draft} update={update} errors={errors} /> : null}
        {step === 6 ? (
          <StepOtp
            phone={draft.reporterPhonePrimary}
            code={otpCode}
            onCodeChange={setOtpCode}
            onResend={() => requestOtp.mutate()}
            sending={requestOtp.isPending}
            delivered={delivered}
            error={errors["otp"]}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="md"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t("action.back")}
        </Button>

        {step < TOTAL_STEPS ? (
          <Button variant="primary" size="md" onClick={next}>
            {t("action.next")}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            disabled={submit.isPending || (delivered && otpCode.length !== 6)}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? t("list.loading") : t("action.submit")}
          </Button>
        )}
      </div>
    </div>
  );
}
