import { NavLink } from "react-router";

import { cn } from "@/shared/lib/cn";

/**
 * Camps / Requirements switch.
 *
 * Deliberately NOT Radix Tabs. These segments navigate to different routes;
 * they do not reveal panels on the same page. Using Tabs here emitted
 * aria-controls pointing at tabpanels that never existed, and told screen
 * readers to expect in-page content that would instead be a full navigation.
 * A nav with links is both semantically correct and keyboard-native.
 */
export interface Segment {
  readonly to: string;
  readonly label: string;
  readonly end?: boolean;
}

export function SegmentedNav({
  segments,
  ariaLabel,
}: {
  segments: readonly Segment[];
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel}>
      <ul className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary p-1">
        {segments.map((segment) => (
          <li key={segment.to}>
            <NavLink
              to={segment.to}
              end={segment.end ?? false}
              className={({ isActive }) =>
                cn(
                  "inline-flex min-h-11 items-center justify-center rounded-md px-3",
                  "text-sm font-semibold transition-colors duration-(--duration-fast)",
                  isActive
                    ? "bg-surface text-foreground shadow-panel"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {segment.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
