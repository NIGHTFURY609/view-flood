import { useEffect, useState } from "react";

import { Field } from "@/features/report/components/steps/StepLocation";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useI18n } from "@/shared/i18n";

const RESEND_SECONDS = 30;

export function StepOtp({
  phone,
  code,
  onCodeChange,
  onResend,
  sending,
  delivered,
  error,
}: {
  phone: string;
  code: string;
  onCodeChange: (next: string) => void;
  onResend: () => void;
  sending: boolean;
  delivered: boolean;
  error?: string | undefined;
}) {
  const { t } = useI18n();
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  if (!delivered) {
    // No SMS gateway is provisioned yet. Blocking the submission here would
    // lose a flood report over infrastructure we do not have — the server
    // accepts it flagged for manual phone confirmation instead.
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-lg bg-unverified-soft px-3 py-2 text-sm text-unverified text-pretty">
          {t("report.doneBody")}
        </p>
        <p className="text-sm text-muted-foreground">{t("detail.callBefore")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("report.otpSent", { phone: `+91 ${phone}` })}
      </p>

      <Field id="report-otp" label={t("report.otpLabel")} error={error}>
        <Input
          id="report-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, ""))}
          aria-invalid={Boolean(error)}
          className="text-center text-lg tracking-[0.4em]"
        />
      </Field>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={cooldown > 0 || sending}
        onClick={() => {
          setCooldown(RESEND_SECONDS);
          onResend();
        }}
        className="self-start"
      >
        {cooldown > 0 ? t("report.resendIn", { s: cooldown }) : t("report.resend")}
      </Button>
    </div>
  );
}
