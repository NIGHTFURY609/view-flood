"""The client mirrors these bounds field for field. If they drift, a reporter
fills in six steps and loses the lot at submit."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.reports import ReportIn


def _image(index: int = 0) -> dict[str, object]:
    return {
        "data_url": f"data:image/jpeg;base64,AAAA{index}",
        "width": 1200,
        "height": 900,
        "quality_reasons": [],
    }


def _report(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "name": "GHSS Ranni",
        "district_code": "PTA",
        "taluk": "Ranni",
        "lsg_type": "panchayat",
        "lsg_name": "Ranni",
        "reported_status": "active",
        "reporter_name": "A Volunteer",
        "reporter_phone_primary": "+919876543210",
        "images": [_image(0), _image(1)],
    }
    base.update(overrides)
    return base


class TestReportIn:
    def test_a_minimal_valid_report_parses(self) -> None:
        assert ReportIn(**_report()).name == "GHSS Ranni"

    @pytest.mark.parametrize("phone", ["9876543210", "+91987654321", "+915876543210", "abc"])
    def test_rejects_non_indian_mobile_numbers(self, phone: str) -> None:
        with pytest.raises(ValidationError):
            ReportIn(**_report(reporter_phone_primary=phone))

    def test_requires_at_least_two_photos(self) -> None:
        with pytest.raises(ValidationError):
            ReportIn(**_report(images=[_image(0)]))

    def test_rejects_more_than_four_photos(self) -> None:
        with pytest.raises(ValidationError):
            ReportIn(**_report(images=[_image(i) for i in range(5)]))

    def test_raising_urgency_requires_an_explanation(self) -> None:
        """Ported from a check that sat OUTSIDE the prototype's zod schema, so
        client and server could disagree about it."""
        with pytest.raises(ValidationError):
            ReportIn(**_report(reported_urgency="critical"))

        with pytest.raises(ValidationError):
            ReportIn(**_report(reported_urgency="high", reported_urgency_reason="too short"))

    def test_urgency_with_a_real_reason_is_accepted(self) -> None:
        report = ReportIn(
            **_report(
                reported_urgency="critical",
                reported_urgency_reason="Water rising, 200 people need evacuation now",
            )
        )
        assert report.reported_urgency == "critical"

    def test_normal_urgency_needs_no_reason(self) -> None:
        assert ReportIn(**_report(reported_urgency="normal")).reported_urgency_reason is None

    def test_otp_code_must_be_six_digits(self) -> None:
        with pytest.raises(ValidationError):
            ReportIn(**_report(otp_code="12345"))

    def test_coordinates_are_range_checked(self) -> None:
        with pytest.raises(ValidationError):
            ReportIn(**_report(latitude=95.0))
