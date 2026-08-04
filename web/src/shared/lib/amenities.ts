import {
  Accessibility,
  BedDouble,
  Blocks,
  Droplets,
  HeartPulse,
  PawPrint,
  Plug,
  Shirt,
  ShowerHead,
  Signal,
  Soup,
  Toilet,
  type LucideIcon,
} from "lucide-react";

/** Matches the `amenities text[]` values accepted by the check-in endpoint. */
export type AmenityKey =
  | "food"
  | "drinking_water"
  | "toilets"
  | "bathing"
  | "medical"
  | "power"
  | "mobile_network"
  | "bedding"
  | "clothes"
  | "children_space"
  | "accessible"
  | "pets_allowed";

export interface Amenity {
  readonly key: AmenityKey;
  readonly icon: LucideIcon;
}

export const AMENITIES: readonly Amenity[] = [
  { key: "food", icon: Soup },
  { key: "drinking_water", icon: Droplets },
  { key: "toilets", icon: Toilet },
  { key: "bathing", icon: ShowerHead },
  { key: "medical", icon: HeartPulse },
  { key: "power", icon: Plug },
  { key: "mobile_network", icon: Signal },
  { key: "bedding", icon: BedDouble },
  { key: "clothes", icon: Shirt },
  { key: "children_space", icon: Blocks },
  { key: "accessible", icon: Accessibility },
  { key: "pets_allowed", icon: PawPrint },
] as const;

export const AMENITY_KEYS: readonly AmenityKey[] = AMENITIES.map((a) => a.key);

export function amenityIcon(key: string): LucideIcon | null {
  return AMENITIES.find((a) => a.key === key)?.icon ?? null;
}

export function isAmenityKey(value: string): value is AmenityKey {
  return AMENITY_KEYS.includes(value as AmenityKey);
}
