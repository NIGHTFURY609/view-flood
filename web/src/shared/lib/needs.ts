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

/**
 * Categories group the catalogue for the requirement form, which asks for a
 * category before an item. Mirrored by NEED_CATALOGUE in
 * api/app/schemas/requirements.py — that copy is what actually validates
 * submissions, so add items to both.
 */
export type NeedCategory =
  | "food_water"
  | "bedding"
  | "clothing"
  | "hygiene"
  | "medical"
  | "household"
  | "logistics";

export const NEED_CATEGORIES: readonly NeedCategory[] = [
  "food_water",
  "bedding",
  "clothing",
  "hygiene",
  "medical",
  "household",
  "logistics",
] as const;

/** Every category also accepts this, with a free-text label. */
export const OTHER_ITEM_KEY = "other";

export interface NeedItem {
  readonly key: string;
  readonly icon: LucideIcon;
  readonly unit: string;
  readonly category: NeedCategory;
}

/** Catalogue of relief items a camp can ask for. Keys match camp_needs.item_key. */
export const NEED_ITEMS: readonly NeedItem[] = [
  { key: "rice", icon: Package, unit: "kg", category: "food_water" },
  { key: "cooked_food", icon: Soup, unit: "meals", category: "food_water" },
  { key: "drinking_water", icon: Droplets, unit: "cans", category: "food_water" },
  { key: "blankets", icon: Bed, unit: "pcs", category: "bedding" },
  { key: "mats", icon: Bed, unit: "pcs", category: "bedding" },
  { key: "clothes", icon: Shirt, unit: "sets", category: "clothing" },
  { key: "sanitary_pads", icon: Bath, unit: "packs", category: "hygiene" },
  { key: "baby_food", icon: Baby, unit: "packs", category: "food_water" },
  { key: "medicines", icon: HeartPulse, unit: "kits", category: "medical" },
  { key: "toiletries", icon: SprayCan, unit: "kits", category: "hygiene" },
  { key: "utensils", icon: Utensils, unit: "sets", category: "household" },
  { key: "footwear", icon: Footprints, unit: "pairs", category: "clothing" },
  { key: "power_backup", icon: Zap, unit: "units", category: "logistics" },
  { key: "transport", icon: Bike, unit: "trips", category: "logistics" },
] as const;

export const NEED_KEYS: readonly string[] = NEED_ITEMS.map((item) => item.key);

export function needIcon(key: string): LucideIcon {
  return NEED_ITEMS.find((item) => item.key === key)?.icon ?? Package;
}

export function needUnit(key: string): string {
  return NEED_ITEMS.find((item) => item.key === key)?.unit ?? "units";
}

export function itemsForCategory(category: NeedCategory): readonly NeedItem[] {
  return NEED_ITEMS.filter((item) => item.category === category);
}

/**
 * True for keys the dictionary can translate. Approved free-text requirements
 * land in camp_needs as `other_<slug>`, which has no dictionary entry — those
 * render from camp_needs.label instead.
 */
export function isCatalogueKey(key: string): boolean {
  return NEED_KEYS.includes(key);
}
