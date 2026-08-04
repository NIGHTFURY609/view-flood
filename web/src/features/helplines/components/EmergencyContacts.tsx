import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";

import { emergencyContactsQuery } from "@/features/camps/api";
import { CampRowSkeleton } from "@/shared/components/Skeletons";
import { ErrorState } from "@/shared/components/states";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { displayPhone } from "@/shared/lib/format";
import type { EmergencyContact } from "@/shared/types/api";

export function EmergencyContacts({ districtCode }: { districtCode?: string }) {
  const { t, locale } = useI18n();
  const contacts = useQuery(emergencyContactsQuery(districtCode));

  if (contacts.isPending) {
    return (
      <div aria-busy="true" className="space-y-2">
        <CampRowSkeleton />
        <CampRowSkeleton />
      </div>
    );
  }

  if (contacts.isError) {
    return <ErrorState error={contacts.error} onRetry={() => void contacts.refetch()} />;
  }

  const rows = contacts.data ?? [];
  const state = rows.filter((c) => c.scope === "state");
  const district = rows.filter((c) => c.scope === "district");

  return (
    <div className="flex flex-col gap-5">
      {district.length > 0 ? (
        <ContactGroup
          title={t("help.district", { district: districtCode ?? "" })}
          contacts={district}
          locale={locale}
        />
      ) : null}
      <ContactGroup title={t("help.state")} contacts={state} locale={locale} />
    </div>
  );
}

function ContactGroup({
  title,
  contacts,
  locale,
}: {
  title: string;
  contacts: readonly EmergencyContact[];
  locale: string;
}) {
  if (contacts.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-foreground">{title}</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <a
              href={`tel:${contact.phone}`}
              className={cn(
                "panel flex min-h-14 items-center gap-3 px-4 py-2",
                "transition-colors duration-(--duration-fast)",
                "hover:border-critical hover:bg-critical-soft",
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-critical-soft text-critical">
                <Phone className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {locale === "ml" && contact.label_ml ? contact.label_ml : contact.label}
                </span>
                <span className="block text-sm font-bold text-critical">
                  {displayPhone(contact.phone)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
