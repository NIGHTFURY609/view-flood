import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

export interface MapPoint {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly tone: "active" | "inactive" | "predesignated";
}

/** Matches the open / closed / government-list token hues. */
const TONE_COLOR: Record<MapPoint["tone"], string> = {
  active: "#00753c",
  inactive: "#8a1a12",
  predesignated: "#8a5200",
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}

/**
 * Leaflet is imported dynamically so it never lands in the initial bundle —
 * most seekers never open the map.
 */
export function CampMap({
  points,
  className,
  zoom = 9,
}: {
  points: readonly MapPoint[];
  className?: string;
  zoom?: number;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const listId = useId();

  useEffect(() => {
    const element = containerRef.current;
    if (!element || points.length === 0) return;

    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    void (async () => {
      try {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        if (cancelled || !containerRef.current) return;

        map = L.map(containerRef.current, {
          scrollWheelZoom: false, // never hijack a page scroll
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);

        const bounds: [number, number][] = [];
        for (const point of points) {
          const marker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({
              className: "",
              html:
                `<span style="display:block;width:14px;height:14px;border-radius:9999px;` +
                `background:${TONE_COLOR[point.tone]};border:2px solid #fff;` +
                `box-shadow:0 1px 4px rgba(0,0,0,.5)"></span>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            }),
            keyboard: false, // the adjacent list is the keyboard path
          });

          marker.bindPopup(
            `<strong>${escapeHtml(point.name)}</strong>`,
          );
          marker.on("click", () => navigate(`/camps/${point.id}`));
          marker.addTo(map);
          bounds.push([point.lat, point.lng]);
        }

        if (bounds.length === 1 && bounds[0]) map.setView(bounds[0], 14);
        else map.fitBounds(bounds, { padding: [24, 24] });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, zoom, navigate]);

  if (points.length === 0 || failed) {
    return (
      <p className="panel px-4 py-6 text-center text-sm text-muted-foreground">
        {t("map.noPoints")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        role="application"
        aria-label={t("map.pointsList")}
        className={cn(
          "h-[50dvh] max-h-[420px] min-h-64 w-full overflow-hidden rounded-xl border border-border",
          className,
        )}
      />

      <MapLegend />

      {/*
        Leaflet markers are not reachable by keyboard, and no amount of ARIA on
        a canvas-like surface fixes that. The same points are published as a
        real list so the map is never the only way to get the information.
      */}
      <details className="panel px-4 py-2">
        <summary className="min-h-11 cursor-pointer list-none py-2 text-sm font-semibold text-foreground">
          {t("map.pointsList")} ({points.length})
        </summary>
        <ul id={listId} className="flex flex-col gap-1 pb-2">
          {points.map((point) => (
            <li key={point.id}>
              <a
                href={`/camps/${point.id}`}
                className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-foreground hover:bg-secondary"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: TONE_COLOR[point.tone] }}
                />
                {point.name}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Marker colour is meaningless without this. The prototype had no legend. */
export function MapLegend() {
  const { t } = useI18n();

  const entries = [
    { tone: "active" as const, label: t("map.legendActive") },
    { tone: "inactive" as const, label: t("map.legendInactive") },
    { tone: "predesignated" as const, label: t("map.legendPredesignated") },
  ];

  return (
    <ul
      aria-label={t("map.legend")}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground"
    >
      {entries.map((entry) => (
        <li key={entry.tone} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full border border-surface"
            style={{ background: TONE_COLOR[entry.tone] }}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
