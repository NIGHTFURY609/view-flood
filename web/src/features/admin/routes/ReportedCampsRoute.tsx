import { CampsTable } from "@/features/admin/components/CampsTable";

/**
 * Reported Camps — the unverified queue. These are camps reported from the app
 * that a reviewer still needs to verify. Same table + detail/edit flow as Camps
 * Management, locked to the unverified verification state.
 */
export function ReportedCampsRoute() {
  return (
    <div className="flex h-full flex-col">
      <CampsTable lockedVerification="unverified" reviewed="unreviewed" actions="review" />
    </div>
  );
}
