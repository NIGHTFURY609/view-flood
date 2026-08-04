import { describe, expect, it } from "vitest";

import en from "@/shared/i18n/dictionaries/en.json";
import ml from "@/shared/i18n/dictionaries/ml.json";

/**
 * The prototype had 100% EN/ML parity maintained entirely by hand, with nothing
 * enforcing it. This test is what keeps it true as keys are added.
 */
describe("i18n dictionaries", () => {
  it("have identical key sets", () => {
    expect(Object.keys(ml).sort()).toEqual(Object.keys(en).sort());
  });

  it("have no empty translations", () => {
    const blank = Object.entries({ ...en, ...ml }).filter(([, v]) => v.trim() === "");
    expect(blank).toEqual([]);
  });

  it("use the same interpolation variables in both languages", () => {
    const varsOf = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const mismatched = Object.keys(en)
      .filter((key) => {
        const a = varsOf(en[key as keyof typeof en]);
        const b = varsOf(ml[key as keyof typeof ml]);
        return JSON.stringify(a) !== JSON.stringify(b);
      })
      .map((key) => ({
        key,
        en: en[key as keyof typeof en],
        ml: ml[key as keyof typeof ml],
      }));

    expect(mismatched).toEqual([]);
  });
});
