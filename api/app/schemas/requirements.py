"""Requirement request models — the public "this camp needs X" intake.

camp_needs.item_key has always been a plain text column, validated nowhere: only
seed migrations and admins ever wrote it. Now the public picks items, so the
catalogue below is the server-side gate. A typo'd key would otherwise create a
need with no icon and no dictionary entry on the camp page.

The catalogue mirrors NEED_ITEMS in web/src/shared/lib/needs.ts. If you add an
item there, add it here too.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.reports import PHONE_PATTERN

NeedCategory = Literal[
    "food_water",
    "bedding",
    "clothing",
    "hygiene",
    "medical",
    "household",
    "logistics",
]

#: category -> {item_key: unit}. Units match the seeded camp_needs rows.
NEED_CATALOGUE: dict[str, dict[str, str]] = {
    "food_water": {
        "rice": "kg",
        "cooked_food": "meals",
        "drinking_water": "cans",
        "baby_food": "packs",
    },
    "bedding": {"blankets": "pcs", "mats": "pcs"},
    "clothing": {"clothes": "sets", "footwear": "pairs"},
    "hygiene": {"sanitary_pads": "packs", "toiletries": "kits"},
    "medical": {"medicines": "kits"},
    "household": {"utensils": "sets"},
    "logistics": {"power_backup": "units", "transport": "trips"},
}

#: Every category also accepts this, with a free-text label.
OTHER_ITEM_KEY = "other"

MAX_ITEMS_PER_SUBMISSION = 20


def catalogue_unit(category: str, item_key: str) -> str:
    """Unit for a catalogue item; 'units' for anything free-text."""
    return NEED_CATALOGUE.get(category, {}).get(item_key, "units")


def slug_item_key(label: str) -> str:
    """Stable item_key for a free-text item.

    camp_needs has UNIQUE (camp_id, item_key), so every free-text item cannot
    collapse into a single 'other' row — "wheelchairs" and "dog food" are not
    the same need. Slugging the label keeps them distinct while staying stable
    across submissions, so two people asking for wheelchairs still merge.
    """
    slug = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    return f"other_{slug[:40]}" if slug else "other"


class RequirementItemIn(BaseModel):
    category: NeedCategory
    item_key: str = Field(min_length=1, max_length=60)
    label: str | None = Field(default=None, max_length=120)
    quantity: int = Field(gt=0, le=1_000_000)

    @model_validator(mode="after")
    def item_belongs_to_category(self) -> RequirementItemIn:
        if self.item_key == OTHER_ITEM_KEY:
            if len((self.label or "").strip()) < 2:
                raise ValueError("Name the item you need")
            return self
        if self.item_key not in NEED_CATALOGUE[self.category]:
            raise ValueError(f"'{self.item_key}' is not an item in {self.category}")
        return self


class RequirementIn(BaseModel):
    submitter_name: str = Field(min_length=2, max_length=120)
    submitter_phone: str = Field(pattern=PHONE_PATTERN)
    note: str | None = Field(default=None, max_length=500)
    items: list[RequirementItemIn] = Field(min_length=1, max_length=MAX_ITEMS_PER_SUBMISSION)


class RequirementResult(BaseModel):
    """Public response. Deliberately echoes nothing the submitter sent back."""

    ok: bool
    requirement_id: str
    item_count: int


class RequirementItemOut(BaseModel):
    id: str
    category: str
    item_key: str
    label: str | None = None
    unit: str
    quantity: int


class RequirementOut(BaseModel):
    """Admin-only. Carries the submitter's phone — never return this publicly."""

    id: str
    camp_id: str
    camp_name: str | None = None
    submitter_name: str
    submitter_phone: str
    note: str | None = None
    status: str
    reviewed_at: datetime | None = None
    review_note: str | None = None
    created_at: datetime
    items: list[RequirementItemOut] = []


class AdminNeedOut(BaseModel):
    """An approved need (a camp_needs row) with its donation tally. Admin-only."""

    id: str
    camp_id: str
    camp_name: str | None = None
    district_code: str | None = None
    item_key: str
    label: str | None = None
    unit: str
    needed_qty: int
    pledged_qty: int
    pledge_count: int = 0
    updated_at: datetime


class AdminPledgeOut(BaseModel):
    """A single donation, including the donor's details. Admin-only (PII)."""

    id: str
    donor_name: str
    donor_phone: str
    quantity: int
    phone_verified: bool
    created_at: datetime


class AdminPledgeRow(BaseModel):
    """A donation with its need/camp context — the Donations approval list.

    Admin-only (donor PII). ``admin_verified`` is the count-controlling flag:
    only verified pledges are summed into camp_needs.pledged_qty.
    """

    id: str
    need_id: str
    camp_id: str
    camp_name: str | None = None
    district_code: str | None = None
    item_key: str
    label: str | None = None
    unit: str
    needed_qty: int
    quantity: int
    donor_name: str
    donor_phone: str
    phone_verified: bool
    # None = pending (awaiting review), True = verified (counts), False = unverified.
    admin_verified: bool | None = None
    created_at: datetime


class RequirementCounts(BaseModel):
    total: int
    by_camp: dict[str, int]


class RequirementRejectIn(BaseModel):
    note: str | None = Field(default=None, max_length=500)
