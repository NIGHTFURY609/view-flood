export type RequirementStatus = "pending" | "approved" | "rejected";

export interface AdminRequirementItem {
  id: string;
  category: string;
  /** A catalogue key, or other_<slug> for a free-text item. */
  item_key: string;
  label: string | null;
  unit: string;
  quantity: number;
}

export interface AdminRequirement {
  id: string;
  camp_id: string;
  camp_name: string | null;
  submitter_name: string;
  submitter_phone: string;
  note: string | null;
  status: RequirementStatus;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  items: AdminRequirementItem[];
}

export interface AdminRequirementsParams {
  status?: RequirementStatus | "all";
  camp_id?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

/** Pending counts, keyed by camp id, for the sidebar and per-camp bubbles. */
export interface RequirementCounts {
  total: number;
  by_camp: Record<string, number>;
}

/** An approved need (camp_needs row) with its donation tally. Admin-only. */
export interface AdminNeed {
  id: string;
  camp_id: string;
  camp_name: string | null;
  district_code: string | null;
  item_key: string;
  label: string | null;
  unit: string;
  needed_qty: number;
  pledged_qty: number;
  pledge_count: number;
  updated_at: string;
}

/** A single donation, including the donor's details. Admin-only (PII). */
export interface AdminPledge {
  id: string;
  donor_name: string;
  donor_phone: string;
  quantity: number;
  phone_verified: boolean;
  created_at: string;
}

export interface AdminNeedsParams {
  district_code?: string;
  item_key?: string;
  camp_id?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}
