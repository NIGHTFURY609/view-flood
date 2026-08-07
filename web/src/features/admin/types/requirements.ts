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
