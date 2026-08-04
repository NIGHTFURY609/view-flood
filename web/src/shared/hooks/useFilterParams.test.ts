import { describe, expect, it } from "vitest";

import {
  campListFilterSchema,
  needsFilterSchema,
  parseAmenities,
  toggleAmenity,
} from "./useFilterParams";

describe("campListFilterSchema", () => {
  it("applies defaults for an empty URL", () => {
    const parsed = campListFilterSchema.parse({});
    expect(parsed).toMatchObject({
      district: "",
      // Every camp is community-reported now, so "open now" is the useful
      // default; the government pre-designated sheet is no longer a source.
      status: "active",
      verified: false,
      view: "card",
      page: 1,
    });
  });

  it("coerces the verified flag from its string form", () => {
    expect(campListFilterSchema.parse({ verified: "true" }).verified).toBe(true);
    expect(campListFilterSchema.parse({ verified: "false" }).verified).toBe(false);
  });

  it("falls back to defaults on hostile input instead of throwing", () => {
    const parsed = campListFilterSchema.parse({
      status: "'; drop table camps--",
      view: "carousel",
      page: "-9",
      verified: "maybe",
    });
    expect(parsed.status).toBe("active");
    expect(parsed.view).toBe("card");
    expect(parsed.page).toBe(1);
    expect(parsed.verified).toBe(false);
  });

  it("clamps an overlong query rather than accepting it", () => {
    const parsed = campListFilterSchema.safeParse({ q: "x".repeat(500) });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.q).toBe("");
  });
});

describe("needsFilterSchema", () => {
  it("shares the district and page vocabulary with the camps list", () => {
    const parsed = needsFilterSchema.parse({ district: "PTA", page: "3" });
    expect(parsed).toEqual({ district: "PTA", item: "", page: 3 });
  });
});

describe("amenities csv helpers", () => {
  it("parses and trims", () => {
    expect(parseAmenities("food, toilets ,,medical")).toEqual(["food", "toilets", "medical"]);
  });

  it("toggles a key on and off", () => {
    expect(toggleAmenity("food,toilets", "medical")).toBe("food,toilets,medical");
    expect(toggleAmenity("food,toilets", "food")).toBe("toilets");
  });

  it("round-trips an empty string", () => {
    expect(parseAmenities("")).toEqual([]);
    expect(toggleAmenity("", "food")).toBe("food");
  });
});
