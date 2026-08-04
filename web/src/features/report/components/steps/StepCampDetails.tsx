import type { ReportDraft } from "@/features/report/schema";
import { Field } from "@/features/report/components/steps/StepLocation";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useI18n } from "@/shared/i18n";

const BUILDING_TYPES = [
  "school",
  "college",
  "community_hall",
  "place_of_worship",
  "government_building",
  "other",
] as const;

const BUILDING_LABELS: Record<(typeof BUILDING_TYPES)[number], string> = {
  school: "School",
  college: "College",
  community_hall: "Community hall",
  place_of_worship: "Place of worship",
  government_building: "Government building",
  other: "Other",
};

export function StepCampDetails({
  draft,
  update,
  errors,
}: {
  draft: ReportDraft;
  update: (patch: Partial<ReportDraft>) => void;
  errors: Record<string, string>;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Field
        id="report-name"
        label={t("report.campName")}
        hint={t("report.campNameHint")}
        error={errors["name"]}
      >
        <Input
          id="report-name"
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
          aria-invalid={Boolean(errors["name"])}
        />
      </Field>

      <Field id="report-building" label={t("report.buildingType")}>
        <Select
          value={draft.buildingType ?? ""}
          onValueChange={(next) =>
            update({ buildingType: next as ReportDraft["buildingType"] })
          }
        >
          <SelectTrigger id="report-building">
            <SelectValue placeholder={t("common.select")} />
          </SelectTrigger>
          <SelectContent>
            {BUILDING_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {BUILDING_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field id="report-village" label={t("report.village")}>
        <Input
          id="report-village"
          value={draft.villageOrLocality ?? ""}
          onChange={(event) => update({ villageOrLocality: event.target.value })}
        />
      </Field>

      <Field id="report-landmark" label={t("report.landmark")}>
        <Input
          id="report-landmark"
          value={draft.landmark ?? ""}
          onChange={(event) => update({ landmark: event.target.value })}
        />
      </Field>

      <Field id="report-incharge" label={t("report.inchargeName")}>
        <Input
          id="report-incharge"
          value={draft.campInchargeName ?? ""}
          onChange={(event) => update({ campInchargeName: event.target.value })}
        />
      </Field>

      <Field
        id="report-camp-phone"
        label={t("report.campPhone")}
        error={errors["campPhonePrimary"]}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">+91</span>
          <Input
            id="report-camp-phone"
            type="tel"
            inputMode="numeric"
            value={draft.campPhonePrimary}
            onChange={(event) => update({ campPhonePrimary: event.target.value })}
            aria-invalid={Boolean(errors["campPhonePrimary"])}
          />
        </div>
      </Field>
    </div>
  );
}
