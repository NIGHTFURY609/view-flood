import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/shared/api/client";
import { isApiError } from "@/shared/api/errors";
import { queryKeys } from "@/shared/api/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useI18n, type DictKey } from "@/shared/i18n";
import { normalisePhone } from "@/shared/lib/format";
import { isCatalogueKey } from "@/shared/lib/needs";
import type { CampNeed } from "@/shared/types/api";

type Step = "quantity" | "contact" | "otp" | "done";

/**
 * Built on Radix Dialog. The prototype hand-rolled this modal and so had no
 * role="dialog", no focus trap, no Escape-to-close and no return-focus — all of
 * which come free here.
 */
export function DonateDialog({
  need,
  open,
  onOpenChange,
}: {
  need: CampNeed;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const remaining = Math.max(0, need.needed_qty - need.pledged_qty);

  const [step, setStep] = useState<Step>("quantity");
  const [quantity, setQuantity] = useState(String(Math.min(remaining || 1, 10)));
  const qtyNum = Number(quantity);
  const overRemaining = qtyNum > remaining;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("quantity");
    setCode("");
    setChallengeId(null);
    setError(null);
  }

  const requestOtp = useMutation({
    mutationFn: async () => {
      const e164 = normalisePhone(phone);
      if (!e164) throw new Error("invalid_phone");
      return api.otp.request(e164, "pledge");
    },
    onSuccess: (challenge) => {
      setChallengeId(challenge.challenge_id);
      if (challenge.delivered) {
        setStep("otp");
      } else {
        // No SMS gateway provisioned. Recording an unverified pledge is better
        // than losing a donor to infrastructure we do not have yet.
        pledge.mutate({ challengeId: null, code: null });
      }
    },
    onError: (cause) => {
      setError(
        cause instanceof Error && cause.message === "invalid_phone"
          ? t("error.phone")
          : t("error.generic"),
      );
    },
  });

  const pledge = useMutation({
    mutationFn: async (args: { challengeId: string | null; code: string | null }) => {
      const e164 = normalisePhone(phone);
      if (!e164) throw new Error("invalid_phone");
      return api.needs.pledge(need.id, {
        quantity: Number(quantity),
        donor_name: name.trim(),
        donor_phone: e164,
        challenge_id: args.challengeId,
        otp_code: args.code,
      });
    },
    onSuccess: () => {
      setStep("done");
      toast.success(t("donate.confirm"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.campNeeds(need.camp_id) });
      void queryClient.invalidateQueries({ queryKey: ["needs", "list"] });
    },
    onError: (cause) => {
      // The server is the backstop for over-pledging: another donor may have
      // taken the last units between this dialog opening and submitting.
      if (isApiError(cause) && cause.code === "exceeds_remaining") {
        setStep("quantity");
        setError(t("error.pledgeExceeds"));
        return;
      }
      setError(t("error.otpWrong"));
    },
  });

  const busy = requestOtp.isPending || pledge.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCatalogueKey(need.item_key)
              ? t(`need.${need.item_key}` as DictKey)
              : (need.label ?? need.item_key)}
          </DialogTitle>
          <DialogDescription>{t("donate.disclaimer")}</DialogDescription>
        </DialogHeader>

        {step === "quantity" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {t("need.remaining", { count: remaining, unit: need.unit })}
            </p>
            <div>
              <Label htmlFor="donate-qty" className="mb-1.5 block">
                {need.unit}
              </Label>
              <Input
                id="donate-qty"
                type="number"
                inputMode="numeric"
                min={1}
                max={remaining}
                value={quantity}
                onChange={(event) => {
                  setError(null);
                  setQuantity(event.target.value);
                }}
                aria-invalid={overRemaining}
              />
            </div>
            {overRemaining ? (
              <p role="alert" className="text-xs text-critical">
                {t("need.onlyNeeded", { count: remaining })}
              </p>
            ) : error ? (
              <p role="alert" className="text-xs text-critical">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                variant="primary"
                size="lg"
                disabled={qtyNum < 1 || qtyNum > remaining}
                onClick={() => {
                  setError(null);
                  setStep("contact");
                }}
              >
                {t("action.continue")}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "contact" ? (
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="donate-name" className="mb-1.5 block">
                {t("report.yourName")}
              </Label>
              <Input
                id="donate-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="donate-phone" className="mb-1.5 block">
                {t("report.yourPhone")}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">+91</span>
                <Input
                  id="donate-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={error !== null}
                />
              </div>
            </div>
            {error ? (
              <p role="alert" className="text-xs text-critical">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" size="md" onClick={() => setStep("quantity")}>
                {t("action.back")}
              </Button>
              <Button
                variant="primary"
                size="lg"
                disabled={busy || name.trim().length < 2}
                onClick={() => {
                  setError(null);
                  requestOtp.mutate();
                }}
              >
                {busy ? t("list.loading") : t("report.sendOtp")}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "otp" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {t("report.otpSent", { phone: `+91 ${phone}` })}
            </p>
            <div>
              <Label htmlFor="donate-otp" className="mb-1.5 block">
                {t("report.otpLabel")}
              </Label>
              <Input
                id="donate-otp"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                aria-invalid={error !== null}
              />
            </div>
            {error ? (
              <p role="alert" className="text-xs text-critical">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                variant="primary"
                size="lg"
                disabled={busy || code.length !== 6}
                onClick={() => {
                  setError(null);
                  pledge.mutate({ challengeId, code });
                }}
              >
                {busy ? t("list.loading") : t("donate.confirm")}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-verified-soft text-verified">
              <CheckCircle2 className="size-6" aria-hidden="true" />
            </span>
            <p className="text-base font-semibold text-foreground">{t("donate.confirm")}</p>
            <p className="text-sm text-muted-foreground text-pretty">{t("donate.disclaimer")}</p>
            <Button variant="outline" size="md" onClick={() => onOpenChange(false)}>
              {t("action.close")}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
