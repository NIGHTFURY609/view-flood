import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { Verification } from "@/features/admin/api/adminCamps";
import { districtsQuery, lsgQuery, taluksQuery } from "@/features/camps/api";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/cn";

export interface CampFilters {
  verification: Verification;
  district_code: string;
  taluk: string;
  lsg_name: string;
}

export const EMPTY_FILTERS: CampFilters = {
  verification: "all",
  district_code: "",
  taluk: "",
  lsg_name: "",
};

const ANY = "__ANY__";
const VERIFICATION: { value: Verification; label: string }[] = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Unverified" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: CampFilters;
  onApply: (filters: CampFilters) => void;
  /** Hide the verification control (e.g. Reported Camps is locked to unverified). */
  hideVerification?: boolean;
}

export function CampsFilterDialog({
  open,
  onOpenChange,
  value,
  onApply,
  hideVerification = false,
}: Props) {
  const [draft, setDraft] = useState<CampFilters>(value);

  // Re-seed the draft each time the dialog opens.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const districts = useQuery(districtsQuery());
  const taluks = useQuery({
    ...taluksQuery(draft.district_code || undefined),
    enabled: Boolean(draft.district_code),
  });
  const lsgBodies = useQuery({
    ...lsgQuery(draft.district_code || undefined),
    enabled: Boolean(draft.district_code),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter camps</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {!hideVerification && (
            <div className="flex flex-col gap-2">
              <Label>Verification</Label>
              <div className="flex gap-2">
                {VERIFICATION.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, verification: v.value }))}
                    className={cn(
                      "min-h-10 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors",
                      draft.verification === v.value
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-input text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>District</Label>
            <Select
              value={draft.district_code || ANY}
              onValueChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  district_code: v === ANY ? "" : v,
                  taluk: "",
                  lsg_name: "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any district" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any district</SelectItem>
                {(districts.data ?? []).map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Taluk</Label>
            <Select
              value={draft.taluk || ANY}
              onValueChange={(v) => setDraft((d) => ({ ...d, taluk: v === ANY ? "" : v }))}
              disabled={!draft.district_code}
            >
              <SelectTrigger>
                <SelectValue placeholder={draft.district_code ? "Any taluk" : "Select a district first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any taluk</SelectItem>
                {(taluks.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Local Body</Label>
            <Select
              value={draft.lsg_name || ANY}
              onValueChange={(v) => setDraft((d) => ({ ...d, lsg_name: v === ANY ? "" : v }))}
              disabled={!draft.district_code}
            >
              <SelectTrigger>
                <SelectValue placeholder={draft.district_code ? "Any local body" : "Select a district first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any local body</SelectItem>
                {(lsgBodies.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.name}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setDraft(EMPTY_FILTERS)}>
            Clear all
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
