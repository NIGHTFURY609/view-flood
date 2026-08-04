"""Camp response models.

These ARE the data-exposure boundary. Connecting with a privileged role (the
target asyncpg path) bypasses RLS entirely, so the response model — not a
GRANT — is what keeps reporter PII out of a public payload. Never widen these
with a passthrough dict.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

VerificationState = Literal["unverified", "verified", "duplicate_held", "rejected", "removed"]
CampStatus = Literal["active", "inactive"]
UrgencyLevel = Literal["normal", "high", "critical"]
LsgType = Literal["panchayat", "municipality", "corporation"]
BuildingType = Literal[
    "school", "college", "community_hall", "place_of_worship", "government_building", "other"
]

# Rows in any other state are held for admin review and must never be public.
PUBLIC_VERIFICATION_STATES: tuple[str, ...] = ("unverified", "verified")


class CampNeedSummary(BaseModel):
    item_key: str
    urgency: UrgencyLevel


class CampListItem(BaseModel):
    id: str
    name: str
    name_ml: str | None = None
    district_code: str
    taluk: str | None = None
    lsg_name: str | None = None
    village_or_locality: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: CampStatus
    verification_state: VerificationState
    urgency: UrgencyLevel
    reported_urgency: UrgencyLevel | None = None
    camp_phone_primary: str | None = None
    amenities: list[str] = []
    reported_people_count: int | None = None
    reported_family_count: int | None = None
    reported_children_count: int | None = None
    checkin_count: int = 0
    report_count: int = 0
    status_last_confirmed_at: datetime | None = None
    updated_at: datetime
    distance_km: float | None = None
    top_needs: list[CampNeedSummary] = []


class CampSource(BaseModel):
    id: str
    type: str
    label: str
    url_or_reference: str | None = None
    created_at: datetime


class CampDetail(CampListItem):
    building_type: BuildingType | None = None
    lsg_type: LsgType | None = None
    landmark: str | None = None
    camp_incharge_name: str | None = None
    camp_phone_secondary: str | None = None
    verified_at: datetime | None = None
    verification_method: str | None = None
    verification_note: str | None = None
    occupancy_updated_at: datetime | None = None
    source_published_at: date | None = None
    sources: list[CampSource] = []


class CampBatchRequest(BaseModel):
    ids: list[str]


# --- geography ---------------------------------------------------------------


class District(BaseModel):
    code: str
    name: str
    name_ml: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    sort_order: int = 0


class Taluk(BaseModel):
    id: str
    district_code: str
    name: str
    name_ml: str | None = None


class LsgBody(BaseModel):
    id: str
    district_code: str
    # Null for ~98% of seeded rows, so the LSG dropdown cannot be cascaded off
    # the selected taluk — the client falls back to listing all LSGs in the
    # district when this is absent.
    taluk_name: str | None = None
    lsg_type: LsgType
    name: str
    name_ml: str | None = None


class EmergencyContact(BaseModel):
    id: str
    scope: Literal["state", "district"]
    district_code: str | None = None
    label: str
    label_ml: str | None = None
    phone: str
    sort_order: int = 0


class CampNeed(BaseModel):
    id: str
    camp_id: str
    item_key: str
    # Nullable in the seeded data. The client renders from item_key via the
    # EN/ML dictionary anyway, so this is a fallback, not the display source.
    label: str | None = None
    unit: str
    needed_qty: int
    pledged_qty: int
    urgency: UrgencyLevel
    note: str | None = None
    updated_at: datetime
