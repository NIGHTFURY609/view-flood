import { Field } from "@/features/report/components/steps/StepLocation";
import type { ReportDraft } from "@/features/report/schema";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useI18n } from "@/shared/i18n";

const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
const RELATIONSHIPS = ["resident", "volunteer", "camp_staff", "official", "other"] as const;

const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

const RELATIONSHIP_LABELS: Record<(typeof RELATIONSHIPS)[number], string> = {
  resident: "Staying at the camp",
  volunteer: "Volunteer",
  camp_staff: "Camp staff",
  official: "Official",
  other: "Other",
};

export function StepReporter({
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
      {/* Reporter identity is shown to the verification team only, never
          published. PRD §11. */}
      <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground text-pretty">
        {t("report.intro")}
      </p>

      <Field id="report-reporter-name" label={t("report.yourName")} error={errors["reporterName"]}>
        <Input
          id="report-reporter-name"
          value={draft.reporterName}
          autoComplete="name"
          onChange={(event) => update({ reporterName: event.target.value })}
          aria-invalid={Boolean(errors["reporterName"])}
        />
      </Field>

      <Field
        id="report-reporter-phone"
        label={t("report.yourPhone")}
        error={errors["reporterPhonePrimary"]}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">+91</span>
          <Input
            id="report-reporter-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={draft.reporterPhonePrimary}
            onChange={(event) => update({ reporterPhonePrimary: event.target.value })}
            aria-invalid={Boolean(errors["reporterPhonePrimary"])}
          />
        </div>
      </Field>

      <Field
        id="report-reporter-alt"
        label={t("report.altPhone")}
        error={errors["reporterPhoneSecondary"]}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">+91</span>
          <Input
            id="report-reporter-alt"
            type="tel"
            inputMode="numeric"
            value={draft.reporterPhoneSecondary}
            onChange={(event) => update({ reporterPhoneSecondary: event.target.value })}
          />
        </div>
      </Field>

      <Field id="report-gender" label={t("report.gender")}>
        <Select
          value={draft.reporterGender ?? ""}
          onValueChange={(next) =>
            update({ reporterGender: next as ReportDraft["reporterGender"] })
          }
        >
          <SelectTrigger id="report-gender">
            <SelectValue placeholder={t("common.optional")} />
          </SelectTrigger>
          <SelectContent>
            {GENDERS.map((value) => (
              <SelectItem key={value} value={value}>
                {GENDER_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field id="report-relationship" label={t("report.relationship")}>
        <Select
          value={draft.reporterRelationship ?? ""}
          onValueChange={(next) =>
            update({ reporterRelationship: next as ReportDraft["reporterRelationship"] })
          }
        >
          <SelectTrigger id="report-relationship">
            <SelectValue placeholder={t("common.optional")} />
          </SelectTrigger>
          <SelectContent>
            {RELATIONSHIPS.map((value) => (
              <SelectItem key={value} value={value}>
                {RELATIONSHIP_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
