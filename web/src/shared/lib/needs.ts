import {
  Baby,
  Bath,
  Bed,
  Bike,
  Droplets,
  Footprints,
  HeartPulse,
  Package,
  Shirt,
  Soup,
  SprayCan,
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NeedItem {
  readonly key: string;
  readonly icon: LucideIcon;
  readonly unit: string;
}

/** Catalogue of relief items a camp can ask for. Keys match camp_needs.item_key. */
export const NEED_ITEMS: readonly NeedItem[] = [
  { key: "rice", icon: Package, unit: "kg" },
  { key: "cooked_food", icon: Soup, unit: "meals" },
  { key: "drinking_water", icon: Droplets, unit: "cans" },
  { key: "blankets", icon: Bed, unit: "pcs" },
  { key: "mats", icon: Bed, unit: "pcs" },
  { key: "clothes", icon: Shirt, unit: "sets" },
  { key: "sanitary_pads", icon: Bath, unit: "packs" },
  { key: "baby_food", icon: Baby, unit: "packs" },
  { key: "medicines", icon: HeartPulse, unit: "kits" },
  { key: "toiletries", icon: SprayCan, unit: "kits" },
  { key: "utensils", icon: Utensils, unit: "sets" },
  { key: "footwear", icon: Footprints, unit: "pairs" },
  { key: "power_backup", icon: Zap, unit: "units" },
  { key: "transport", icon: Bike, unit: "trips" },
] as const;

export const NEED_KEYS: readonly string[] = NEED_ITEMS.map((item) => item.key);

export function needIcon(key: string): LucideIcon {
  return NEED_ITEMS.find((item) => item.key === key)?.icon ?? Package;
}

export function needUnit(key: string): string {
  return NEED_ITEMS.find((item) => item.key === key)?.unit ?? "units";
}
