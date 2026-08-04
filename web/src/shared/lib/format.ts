/**
 * Domain formatting and matching helpers.
 *
 * Ported from the prototype (camp-trust-link/src/lib/format.ts). The staleness
 * thresholds and the search-key normalisation are load-bearing product
 * behaviour — do not "simplify" them without changing the PRD.
 */

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

const EARTH_RADIUS_KM = 6371;
const IST = "Asia/Kolkata";

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Kerala is one timezone; everything user-facing is rendered in IST. */
export function formatIst(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function hoursSince(value: string | number | Date | null | undefined): number | null {
  if (!value) return null;
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  return (Date.now() - then) / 3_600_000;
}

export type Staleness = "fresh" | "caution" | "warning" | "never";

/**
 * Matches app_settings.staleness_caution_hours (24) and
 * staleness_warning_hours (72). Kept as constants here deliberately: this runs
 * on every card render and must not depend on a network round-trip.
 */
export function stalenessOf(lastConfirmedAt: string | null | undefined): Staleness {
  const h = hoursSince(lastConfirmedAt);
  if (h === null) return "never";
  if (h > 72) return "warning";
  if (h > 24) return "caution";
  return "fresh";
}

/**
 * Tolerant search key. Strips punctuation and the transliteration variance that
 * makes Malayalam place names hard to match from a Latin keyboard — "Thiruvalla"
 * vs "Tiruvalla", "G.H.S.S." vs "GHSS". Keeps the Malayalam Unicode block so
 * native-script queries still work.
 */
export function searchKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9ഀ-ൿ ]/g, " ")
    .replace(/\b(govt|government)\b/g, "govt")
    .replace(/\b(ghss|gvhss|hss|hs|lps|ups|up|lp)\b/g, "")
    .replace(/(?:zh|dh|th|kh|gh|ch|sh|bh|ph)/g, (m) => m[0] as string)
    .replace(/y$/g, "i")
    .replace(/([a-z])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every term must appear, in either the normalised or the raw text. */
export function matchesQuery(
  haystacks: ReadonlyArray<string | null | undefined>,
  query: string,
): boolean {
  const q = searchKey(query);
  if (!q) return true;
  const terms = q.split(" ").filter(Boolean);
  const present = haystacks.filter((h): h is string => Boolean(h));
  const normalised = present.map(searchKey).join(" ");
  const raw = present.join(" ").toLowerCase();
  return terms.every((term) => normalised.includes(term) || raw.includes(term));
}

/** Canonical E.164 Indian mobile, or null. Mirrors the server's ^\+91[6-9]\d{9}$. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (!/^[6-9]\d{9}$/.test(ten)) return null;
  return `+91${ten}`;
}

export function displayPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : e164;
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
