export type Verification = "all" | "verified" | "unverified";

export interface AdminCampsParams {
  q?: string;
  phone?: string;
  district_code?: string;
  taluk?: string;
  lsg_name?: string;
  verification?: Verification;
  reviewed?: "all" | "unreviewed" | "reviewed";
  cursor?: string;
  limit?: number;
}

export interface AdminCampImage {
  id: string;
  url: string | null;
  width: number | null;
  height: number | null;
  quality_status: string | null;
  hidden: boolean;
  created_at: string;
}

export interface AdminReport {
  reference_code: string;
  reporter_name: string | null;
  reporter_phone_primary: string | null;
  reporter_phone_secondary: string | null;
  reporter_relationship: string | null;
  reported_status: string | null;
  reported_urgency: string | null;
  reported_urgency_reason: string | null;
  auto_flags: string[];
  phone_unverified: boolean;
  submitted_at: string;
}

/** Fields the admin edit form may write. Mirrors the backend whitelist. */
export interface CampUpdatePayload {
  name?: string;
  name_ml?: string | null;
  district_code?: string;
  taluk?: string | null;
  lsg_name?: string | null;
  village_or_locality?: string | null;
  landmark?: string | null;
  camp_incharge_name?: string | null;
  camp_phone_primary?: string | null;
  camp_phone_secondary?: string | null;
  status?: "active" | "inactive";
}

export interface CampFilters {
  verification: Verification;
  district_code: string;
  taluk: string;
  lsg_name: string;
}
