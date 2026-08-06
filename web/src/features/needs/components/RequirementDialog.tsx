import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api, type RequirementItemInput } from "@/shared/api/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useI18n, type DictKey } from "@/shared/i18n";
import { normalisePhone } from "@/shared/lib/format";
import {
  itemsForCategory,
  NEED_CATEGORIES,
  OTHER_ITEM_KEY,
  type NeedCategory,
} from "@/shared/lib/needs";

/** Matches MAX_ITEMS_PER_SUBMISSION in api/app/schemas/requirements.py. */
const MAX_ITEMS = 20;

type Step = "items" | "contact" | "done";

interface DraftItem {
  readonly id: number;
  readonly category: NeedCategory;
  readonly itemKey: string;
  readonly customLabel: string;
  readonly quantity: string;
}

let nextId = 0;

function blankItem(): DraftItem {
  const category = NEED_CATEGORIES[0] as NeedCategory;
  return {
    id: nextId++,
    category,
    itemKey: itemsForCategory(category)[0]?.key ?? OTHER_ITEM_KEY,
    customLabel: "",
    quantity: "",
  };
}

function isComplete(item: DraftItem): boolean {
  if (Number(item.quantity) < 1) return false;
  return item.itemKey !== OTHER_ITEM_KEY || item.customLabel.trim().length >= 2;
}

/**
 * Asks for supplies on behalf of a camp — the counterpart to DonateDialog,
 * which offers them. Submissions are inert until an admin approves them, so
 * there is no OTP step here.
 */
export function RequirementDialog({
  campId,
  open,
  onOpenChange,
}: {
  campId: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("items");
  const [items, setItems] = useState<DraftItem[]>(() => [blankItem()]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("items");
    setItems([blankItem()]);
    setNote("");
    setError(null);
  }

  function patch(id: number, changes: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  const submit = useMutation({
    mutationFn: async () => {
      const e164 = normalisePhone(phone);
      if (!e164) throw new Error("invalid_phone");

      const payload: RequirementItemInput[] = items.filter(isComplete).map((item) => ({
        category: item.category,
        item_key: item.itemKey,
        label: item.itemKey === OTHER_ITEM_KEY ? item.customLabel.trim() : null,
        quantity: Number(item.quantity),
      }));

      return api.requirements.submit(campId, {
        submitter_name: name.trim(),
        submitter_phone: e164,
        note: note.trim() || null,
        items: payload,
      });
    },
    onSuccess: () => {
      setStep("done");
      toast.success(t("requirement.doneTitle"));
      // The request is pending review, so nothing is public yet — but refresh
      // anyway so an admin approving in another tab shows up on return.
      void queryClient.invalidateQueries({ queryKey: queryKeys.campNeeds(campId) });
    },
    onError: (cause) => {
      if (cause instanceof Error && cause.message === "invalid_phone") {
        setError(t("error.phone"));
        return;
      }
      if (isApiError(cause) && cause.code === "rate_limited") {
        setError(t("requirement.rateLimited"));
        return;
      }
      setError(t("requirement.error"));
    },
  });

  const validItems = items.filter(isComplete);

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
          <DialogTitle>{t("requirement.title")}</DialogTitle>
          <DialogDescription>{t("requirement.disclaimer")}</DialogDescription>
        </DialogHeader>

        {step === "items" ? (
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {items.map((item) => {
              const options = itemsForCategory(item.category);
              return (
                <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-secondary/50 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Label className="mb-1.5 block">{t("requirement.category")}</Label>
                      <Select
                        value={item.category}
                        onValueChange={(value) => {
                          const category = value as NeedCategory;
                          patch(item.id, {
                            category,
                            itemKey: itemsForCategory(category)[0]?.key ?? OTHER_ITEM_KEY,
                            customLabel: "",
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NEED_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {t(`needCategory.${category}` as DictKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {items.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-6 shrink-0"
                        aria-label={t("requirement.remove")}
                        onClick={() =>
                          setItems((current) => current.filter((row) => row.id !== item.id))
                        }
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>

                  <div>
                    <Label className="mb-1.5 block">{t("requirement.item")}</Label>
                    <Select
                      value={item.itemKey}
                      onValueChange={(value) => patch(item.id, { itemKey: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {t(`need.${option.key}` as DictKey)}
                          </SelectItem>
                        ))}
                        <SelectItem value={OTHER_ITEM_KEY}>{t("requirement.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {item.itemKey === OTHER_ITEM_KEY ? (
                    <div>
                      <Label htmlFor={`req-label-${item.id}`} className="mb-1.5 block">
                        {t("requirement.itemName")}
                      </Label>
                      <Input
                        id={`req-label-${item.id}`}
                        value={item.customLabel}
                        maxLength={120}
                        onChange={(event) =>
                          patch(item.id, { customLabel: event.target.value })
                        }
                      />
                    </div>
                  ) : null}

                  <div>
                    <Label htmlFor={`req-qty-${item.id}`} className="mb-1.5 block">
                      {t("requirement.quantity")}
                    </Label>
                    <Input
                      id={`req-qty-${item.id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={1000000}
                      value={item.quantity}
                      onChange={(event) => patch(item.id, { quantity: event.target.value })}
                    />
                  </div>
                </div>
              );
            })}

            {items.length < MAX_ITEMS ? (
              <Button
                variant="outline"
                size="md"
                className="self-start"
                onClick={() => setItems((current) => [...current, blankItem()])}
              >
                <Plus className="size-4" aria-hidden="true" />
                {t("requirement.addItem")}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("requirement.itemMax", { count: MAX_ITEMS })}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="primary"
                size="lg"
                disabled={validItems.length === 0}
                onClick={() => setStep("contact")}
              >
                {t("action.continue")}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "contact" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground text-pretty">
              {t("requirement.contactIntro")}
            </p>

            <div>
              <Label htmlFor="req-name" className="mb-1.5 block">
                {t("report.yourName")}
              </Label>
              <Input
                id="req-name"
                value={name}
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="req-phone" className="mb-1.5 block">
                {t("report.yourPhone")}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">+91</span>
                <Input
                  id="req-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={error !== null}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="req-note" className="mb-1.5 block">
                {t("requirement.note")}
              </Label>
              <Input
                id="req-note"
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            {error ? (
              <p role="alert" className="text-xs text-critical">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button variant="ghost" size="md" onClick={() => setStep("items")}>
                {t("action.back")}
              </Button>
              <Button
                variant="primary"
                size="lg"
                disabled={submit.isPending || name.trim().length < 2}
                onClick={() => {
                  setError(null);
                  submit.mutate();
                }}
              >
                {submit.isPending ? t("list.loading") : t("requirement.submit")}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-verified-soft text-verified">
              <CheckCircle2 className="size-6" aria-hidden="true" />
            </span>
            <p className="text-base font-semibold text-foreground">
              {t("requirement.doneTitle")}
            </p>
            <p className="text-sm text-muted-foreground text-pretty">
              {t("requirement.doneBody")}
            </p>
            <Button variant="outline" size="md" onClick={() => onOpenChange(false)}>
              {t("action.close")}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
