from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

PHONE_PATTERN = r"^\+91[6-9]\d{9}$"

AMENITY_KEYS = (
    "food",
    "drinking_water",
    "toilets",
    "bathing",
    "medical",
    "power",
    "mobile_network",
    "bedding",
    "clothes",
    "children_space",
    "accessible",
    "pets_allowed",
)


class CheckInIn(BaseModel):
    camp_id: str
    phone: str = Field(pattern=PHONE_PATTERN)
    is_open: bool = True
    note: str | None = Field(default=None, max_length=280)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    # "People who came with me", not the whole camp — the UI says so explicitly,
    # because early reporters otherwise guess at total occupancy.
    people_count: int | None = Field(default=None, ge=0, le=20_000)
    family_count: int | None = Field(default=None, ge=0, le=5_000)
    children_count: int | None = Field(default=None, ge=0, le=10_000)

    amenities: list[str] = Field(default_factory=list, max_length=20)

    def model_post_init(self, _context: object) -> None:
        unknown = [a for a in self.amenities if a not in AMENITY_KEYS]
        if unknown:
            raise ValueError(f"Unknown amenities: {', '.join(unknown)}")


class CheckInResultOut(BaseModel):
    ok: bool
    reason: str | None = None
    checkin_count: int = 0


class CheckInMaskedOut(BaseModel):
    id: str
    phone_masked: str
    is_open: bool
    note: str | None = None
    people_count: int | None = None
    created_at: datetime


class PledgeIn(BaseModel):
    quantity: int = Field(ge=1, le=100_000)
    donor_name: str = Field(min_length=2, max_length=120)
    donor_phone: str = Field(pattern=PHONE_PATTERN)
    challenge_id: str | None = None
    otp_code: str | None = Field(default=None, pattern=r"^\d{6}$")


class PledgeResultOut(BaseModel):
    ok: bool
    verified: bool = False
    pledged_qty: int = 0
    needed_qty: int = 0
