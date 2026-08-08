/**
 * The contract with the FastAPI service (apps/api).
 *
 * These names mirror the Postgres enums and the Pydantic response models
 * exactly, snake_case included, so a field rename on either side is a
 * compile error here rather than an undefined at runtime.
 */

export type VerificationState =
  | "unverified"
  | "verified"
  | "duplicate_held"
  | "rejected"
  | "removed";

export type CampStatus = "active" | "inactive";
export type UrgencyLevel = "normal" | "high" | "critical";
export type LsgType = "panchayat" | "municipality" | "corporation";

export type BuildingType =
  | "school"
  | "college"
  | "community_hall"
  | "place_of_worship"
  | "government_building"
  | "other";

export type ReporterRelationship = "resident" | "volunteer" | "camp_staff" | "official" | "other";
export type ReporterGender = "male" | "female" | "other" | "prefer_not_to_say";

// --- geography ---------------------------------------------------------------

export interface District {
  readonly code: string;
  readonly name: string;
  readonly name_ml: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly sort_order: number;
}

export interface Taluk {
  readonly id: string;
  readonly district_code: string;
  readonly name: string;
  readonly name_ml: string | null;
}

export interface LsgBody {
  readonly id: string;
  readonly district_code: string;
  /** Null for almost all seeded rows — do not cascade the LSG list off it. */
  readonly taluk_name: string | null;
  readonly lsg_type: LsgType;
  readonly name: string;
  readonly name_ml: string | null;
}

// --- camps -------------------------------------------------------------------

/** Slim shape for list views. The detail route fetches more. */
export interface CampListItem {
  readonly id: string;
  readonly name: string;
  readonly name_ml: string | null;
  readonly district_code: string;
  readonly taluk: string | null;
  readonly lsg_name: string | null;
  readonly village_or_locality: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly status: CampStatus;
  readonly verification_state: VerificationState;
  readonly urgency: UrgencyLevel;
  readonly reported_urgency: UrgencyLevel | null;
  readonly camp_phone_primary: string | null;
  readonly report_count: number;
  readonly status_last_confirmed_at: string | null;
  readonly updated_at: string;
  /** Present only when the request supplied lat/lng. */
  readonly distance_km: number | null;
  readonly top_needs: readonly CampNeedSummary[];
}

export interface CampDetail extends CampListItem {
  readonly building_type: BuildingType | null;
  readonly lsg_type: LsgType | null;
  readonly landmark: string | null;
  readonly camp_incharge_name: string | null;
  readonly camp_phone_secondary: string | null;
  readonly verified_at: string | null;
  readonly verification_method: string | null;
  readonly verification_note: string | null;
  readonly source_published_at: string | null;
  readonly sources: readonly CampSource[];
}

export interface CampSource {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly url_or_reference: string | null;
  readonly created_at: string;
}

export interface SignedImage {
  readonly id: string;
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly created_at: string;
}

// --- needs -------------------------------------------------------------------

export interface CampNeedSummary {
  readonly item_key: string;
  readonly urgency: UrgencyLevel;
  /** Set only for approved free-text requirements, whose key has no dictionary entry. */
  readonly label: string | null;
}

export interface CampNeed {
  readonly id: string;
  readonly camp_id: string;
  readonly item_key: string;
  /** Nullable in the seeded data; the UI renders from item_key + dictionary. */
  readonly label: string | null;
  readonly unit: string;
  readonly needed_qty: number;
  readonly pledged_qty: number;
  readonly urgency: UrgencyLevel;
  readonly note: string | null;
  readonly updated_at: string;
}

export interface PledgeResult {
  readonly ok: boolean;
  readonly verified: boolean;
  readonly pledged_qty: number;
  readonly needed_qty: number;
}

// --- OTP / reports -----------------------------------------------------------

export type OtpPurpose = "report" | "pledge";

export interface OtpChallenge {
  readonly challenge_id: string;
  /** False when no SMS gateway is provisioned — the flow continues, flagged. */
  readonly delivered: boolean;
}

export interface ReportResult {
  readonly ok: boolean;
  readonly reference: string;
  readonly camp_id: string;
  readonly held_as_duplicate: boolean;
  readonly phone_unverified: boolean;
}

export interface ReportImageSubmission {
  readonly data_url: string;
  readonly width: number;
  readonly height: number;
  readonly blur_score: number | null;
  readonly brightness_score: number | null;
  readonly exif_lat: number | null;
  readonly exif_lng: number | null;
  readonly exif_captured_at: string | null;
  readonly quality_reasons: readonly string[];
}

/** Mirrors apps/api/app/schemas/reports.py::ReportIn exactly. */
export interface ReportSubmission {
  readonly camp_id: string | null;
  readonly is_correction: boolean;
  readonly correction_note: string | null;
  readonly name: string;
  readonly name_ml: string | null;
  readonly building_type: BuildingType | null;
  readonly district_code: string;
  readonly taluk: string;
  readonly lsg_type: LsgType;
  readonly lsg_name: string;
  readonly village_or_locality: string | null;
  readonly landmark: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly location_accuracy_m: number | null;
  readonly camp_incharge_name: string | null;
  readonly camp_phone_primary: string | null;
  readonly camp_phone_secondary: string | null;
  readonly reported_status: CampStatus;
  readonly reported_urgency: UrgencyLevel;
  readonly reported_urgency_reason: string | null;
  readonly reporter_name: string;
  readonly reporter_phone_primary: string;
  readonly reporter_phone_secondary: string | null;
  readonly reporter_gender: ReporterGender | null;
  readonly reporter_relationship: ReporterRelationship | null;
  readonly device_location_granted: boolean;
  readonly challenge_id: string | null;
  readonly otp_code: string | null;
  readonly images: readonly ReportImageSubmission[];
}

// --- admin -------------------------------------------------------------------

export interface AdminSession {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
}

export interface AdminProfile {
  readonly id: string;
  readonly email: string;
  readonly display_name: string | null;
  readonly role: string;
}

/** Reporter PII appears ONLY here, never in a public response. */
export interface AdminQueueItem {
  readonly id: string;
  readonly reference_code: string;
  readonly camp_id: string | null;
  readonly camp_name: string;
  readonly district_code: string;
  readonly taluk: string | null;
  readonly lsg_name: string | null;
  readonly is_correction: boolean;
  readonly reporter_name: string;
  readonly reporter_phone: string;
  readonly reported_status: CampStatus;
  readonly reported_urgency: UrgencyLevel;
  readonly auto_flags: readonly string[];
  readonly submitted_at: string;
  readonly verification_state: VerificationState;
}

export interface FlaggedImage {
  readonly flag_id: string;
  readonly image_id: string;
  readonly camp_id: string | null;
  readonly camp_name: string | null;
  readonly storage_path: string;
  readonly url: string | null;
  readonly reason: string;
  readonly hidden: boolean;
  readonly quality_status: string;
  readonly quality_reasons: readonly string[];
  readonly flag_count: number;
  readonly created_at: string;
}

export interface AuditEntry {
  readonly id: string;
  readonly created_at: string;
  readonly actor_type: "admin" | "public" | "system";
  readonly actor_id: string | null;
  readonly entity_type: string;
  readonly entity_id: string | null;
  readonly action: string;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly note: string | null;
}

// --- misc --------------------------------------------------------------------

export interface EmergencyContact {
  readonly id: string;
  readonly scope: "state" | "district";
  readonly district_code: string | null;
  readonly label: string;
  readonly label_ml: string | null;
  readonly phone: string;
  readonly sort_order: number;
}

export interface Weather {
  readonly temperature_c: number | null;
  readonly weather_code: number | null;
  readonly rain_last_24h_mm: number;
  readonly rain_next_24h_mm: number;
  readonly observed_at: string | null;
}

// --- envelopes ---------------------------------------------------------------

export interface Page<T> {
  readonly items: readonly T[];
  readonly next_cursor: string | null;
  readonly total: number | null;
}

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly fields?: Readonly<Record<string, string>> | null;
  };
}
