import { z } from "zod";

/**
 * Client-side validation for the report wizard.
 *
 * These bounds mirror apps/api/app/schemas/reports.py field for field. If the
 * two drift, a reporter fills in six steps and loses the lot at submit — so
 * treat any change here as a change to both.
 */

const phone = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "error.phone");

export const stepLocationSchema = z.object({
  districtCode: z.string().min(2, "error.required"),
  taluk: z.string().min(2, "error.required"),
  lsgType: z.enum(["panchayat", "municipality", "corporation"]),
  lsgName: z.string().trim().min(2, "error.required").max(120),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  locationAccuracyM: z.number().int().min(0).nullable(),
  deviceLocationGranted: z.boolean(),
});

export const stepCampSchema = z.object({
  name: z.string().trim().min(2, "error.required").max(160),
  nameMl: z.string().trim().max(160).optional(),
  buildingType: z
    .enum([
      "school",
      "college",
      "community_hall",
      "place_of_worship",
      "government_building",
      "other",
    ])
    .nullable(),
  villageOrLocality: z.string().trim().max(120).optional(),
  landmark: z.string().trim().max(200).optional(),
  campInchargeName: z.string().trim().max(120).optional(),
  campPhonePrimary: z.union([phone, z.literal("")]),
  campPhoneSecondary: z.union([phone, z.literal("")]),
});

export const stepReporterSchema = z.object({
  reporterName: z.string().trim().min(2, "error.required").max(120),
  reporterPhonePrimary: phone,
  reporterPhoneSecondary: z.union([phone, z.literal("")]),
  reporterGender: z.enum(["male", "female", "other", "prefer_not_to_say"]).nullable(),
  reporterRelationship: z
    .enum(["resident", "volunteer", "camp_staff", "official", "other"])
    .nullable(),
});

export const reportDraftSchema = stepLocationSchema
  .merge(stepCampSchema)
  .merge(stepReporterSchema)
  .merge(
    z.object({
      campId: z.string().nullable(),
      isCorrection: z.boolean(),
      correctionNote: z.string().trim().max(1000).optional(),
    }),
  );

export type ReportDraft = z.infer<typeof reportDraftSchema>;

export const EMPTY_DRAFT: ReportDraft = {
  districtCode: "",
  taluk: "",
  lsgType: "panchayat",
  lsgName: "",
  latitude: null,
  longitude: null,
  locationAccuracyM: null,
  deviceLocationGranted: false,
  name: "",
  nameMl: "",
  buildingType: null,
  villageOrLocality: "",
  landmark: "",
  campInchargeName: "",
  campPhonePrimary: "",
  campPhoneSecondary: "",
  reporterName: "",
  reporterPhonePrimary: "",
  reporterPhoneSecondary: "",
  reporterGender: null,
  reporterRelationship: null,
  campId: null,
  isCorrection: false,
  correctionNote: "",
};

export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 4;
export const TOTAL_STEPS = 5;
