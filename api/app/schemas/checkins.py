from __future__ import annotations

from pydantic import BaseModel, Field

PHONE_PATTERN = r"^\+91[6-9]\d{9}$"


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
