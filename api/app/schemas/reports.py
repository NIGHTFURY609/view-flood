"""Report submission models.

Every bound here mirrors the zod schema in the prototype's reports.functions.ts,
and the client's schema mirrors this file. If the two drift, a reporter fills in
a six-step form and loses it at the last step.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

PHONE_PATTERN = r"^\+91[6-9]\d{9}$"

BuildingType = Literal[
    "school", "college", "community_hall", "place_of_worship", "government_building", "other"
]
LsgType = Literal["panchayat", "municipality", "corporation"]
ReporterRelationship = Literal["resident", "volunteer", "camp_staff", "official", "other"]
ReporterGender = Literal["male", "female", "other", "prefer_not_to_say"]


class ReportImageIn(BaseModel):
    data_url: str = Field(max_length=2_200_000)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    blur_score: float | None = None
    brightness_score: float | None = None
    exif_lat: float | None = Field(default=None, ge=-90, le=90)
    exif_lng: float | None = Field(default=None, ge=-180, le=180)
    exif_captured_at: str | None = None
    quality_reasons: list[str] = Field(default_factory=list, max_length=6)


class ReportIn(BaseModel):
    camp_id: str | None = None
    is_correction: bool = False
    correction_note: str | None = Field(default=None, max_length=1000)

    # Camp identity
    name: str = Field(min_length=2, max_length=160)
    name_ml: str | None = Field(default=None, max_length=160)
    building_type: BuildingType | None = None
    district_code: str = Field(min_length=2, max_length=4)
    taluk: str = Field(min_length=2, max_length=80)
    lsg_type: LsgType
    lsg_name: str = Field(min_length=2, max_length=120)
    village_or_locality: str | None = Field(default=None, max_length=120)
    landmark: str | None = Field(default=None, max_length=200)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_accuracy_m: int | None = Field(default=None, ge=0)
    camp_incharge_name: str | None = Field(default=None, max_length=120)
    camp_phone_primary: str | None = Field(default=None, pattern=PHONE_PATTERN)
    camp_phone_secondary: str | None = Field(default=None, pattern=PHONE_PATTERN)

    # What the reporter observed
    reported_status: Literal["active", "inactive"]
    reported_urgency: Literal["normal", "high", "critical"] = "normal"
    reported_urgency_reason: str | None = Field(default=None, max_length=500)

    # Who is reporting. Never published.
    reporter_name: str = Field(min_length=2, max_length=120)
    reporter_phone_primary: str = Field(pattern=PHONE_PATTERN)
    reporter_phone_secondary: str | None = Field(default=None, pattern=PHONE_PATTERN)
    reporter_gender: ReporterGender | None = None
    reporter_relationship: ReporterRelationship | None = None
    device_location_granted: bool = False

    challenge_id: str | None = None
    otp_code: str | None = Field(default=None, pattern=r"^\d{6}$")

    images: list[ReportImageIn] = Field(min_length=2, max_length=4)

    @model_validator(mode="after")
    def urgency_needs_a_reason(self) -> ReportIn:
        """Raising an alarm requires saying why.

        This lived outside the prototype's zod schema as a hand-rolled check in
        the handler, which meant the client and server could disagree about it.
        """
        if self.reported_urgency != "normal":
            reason = (self.reported_urgency_reason or "").strip()
            if len(reason) < 10:
                raise ValueError("Give at least 10 characters explaining the urgency")
        return self


class ReportResult(BaseModel):
    ok: bool
    reference: str
    camp_id: str
    held_as_duplicate: bool
    phone_unverified: bool


class OtpRequest(BaseModel):
    phone: str = Field(pattern=PHONE_PATTERN)
    purpose: Literal["report", "pledge", "checkin"] = "report"


class OtpChallengeOut(BaseModel):
    challenge_id: str
    delivered: bool


class ImageFlagIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
