"""The report pipeline.

Port of `persistReport`. The whole thing runs in ONE transaction: a report that
half-lands — camp created, counter bumped, audit row missing — is worse than a
report that fails cleanly and can be retried.

Flow:
  verify OTP (or flag the SMS fallback)
  flag high-volume reporters
  resolve the camp: explicit id, else duplicate detection, else create
  auto-detected duplicate  -> hold it, do NOT attach images to the camp
  insert the report, store images, write audit rows
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import asyncpg

from app.schemas.reports import ReportIn
from app.services.audit_service import write_audit
from app.services.duplicate_detection import find_duplicate
from app.services.image_service import ImageService, IncomingImage
from app.services.otp_service import OtpService
from app.services.reference_code import reference_code

HIGH_VOLUME_REPORTS_PER_DAY = 5


@dataclass(frozen=True)
class PersistResult:
    ok: bool
    reference: str = ""
    camp_id: str = ""
    held_as_duplicate: bool = False
    phone_unverified: bool = False
    reason: str | None = None


class ReportService:
    def __init__(self, otp: OtpService, images: ImageService) -> None:
        self._otp = otp
        self._images = images

    async def persist(
        self,
        connection: asyncpg.Connection,
        *,
        payload: ReportIn,
        ip_hash: str,
    ) -> PersistResult:
        auto_flags: list[str] = []
        phone_unverified = False

        # 1. Phone verification.
        if payload.challenge_id and payload.otp_code:
            result = await self._otp.verify(
                connection,
                challenge_id=payload.challenge_id,
                phone=payload.reporter_phone_primary,
                code=payload.otp_code,
            )
            if not result.ok:
                return PersistResult(ok=False, reason=result.reason or "otp_failed")
        else:
            # No gateway provisioned. Accept, flag, let an admin call back —
            # losing a flood report to a missing SMS is the worse failure.
            auto_flags.append("phone_unverified_sms_fallback")
            phone_unverified = True

        # 2. Volume signal. Flags for review; never blocks.
        recent = await connection.fetchval(
            """
            SELECT count(*) FROM reports
            WHERE reporter_phone_primary = $1 AND submitted_at >= now() - interval '24 hours'
            """,
            payload.reporter_phone_primary,
        )
        if (recent or 0) >= HIGH_VOLUME_REPORTS_PER_DAY:
            auto_flags.append("high_volume_reporter")

        # 3. Resolve which camp this is about.
        existing = None
        held_as_duplicate = False

        if payload.camp_id:
            existing = await connection.fetchrow(
                """
                SELECT id, status FROM camps
                WHERE id = $1 AND verification_state IN ('unverified', 'verified')
                """,
                payload.camp_id,
            )
        else:
            match = await find_duplicate(
                connection,
                district_code=payload.district_code,
                name=payload.name,
                lsg_name=payload.lsg_name,
                latitude=payload.latitude,
                longitude=payload.longitude,
            )
            if match is not None:
                existing = await connection.fetchrow(
                    "SELECT id, status FROM camps WHERE id = $1", match.camp_id
                )
                # An auto-detected duplicate is corroboration, not a new camp.
                # It is held for an admin rather than published.
                held_as_duplicate = True
                auto_flags.append("duplicate_held")

        if existing is not None:
            camp_id = str(existing["id"])

            if existing["status"] != payload.reported_status:
                auto_flags.append("status_contradiction")

            # Atomic. The prototype read then wrote, losing concurrent updates.
            await connection.execute(
                """
                UPDATE camps
                SET report_count = report_count + 1,
                    status_last_confirmed_at = CASE
                        WHEN $2 = 'active' THEN now()
                        ELSE status_last_confirmed_at
                    END
                WHERE id = $1
                """,
                camp_id,
                payload.reported_status,
            )
        else:
            camp_id = str(
                await connection.fetchval(
                    """
                    INSERT INTO camps (
                        name, name_ml, building_type, district_code, taluk, lsg_type, lsg_name,
                        village_or_locality, landmark, latitude, longitude, location_accuracy_m,
                        camp_incharge_name, camp_phone_primary, camp_phone_secondary,
                        verification_state, status,
                        status_last_confirmed_at, report_count
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                            'unverified', $16, now(), 1)
                    RETURNING id
                    """,
                    payload.name,
                    payload.name_ml,
                    payload.building_type,
                    payload.district_code,
                    payload.taluk,
                    payload.lsg_type,
                    payload.lsg_name,
                    payload.village_or_locality,
                    payload.landmark,
                    payload.latitude,
                    payload.longitude,
                    payload.location_accuracy_m,
                    payload.camp_incharge_name,
                    payload.camp_phone_primary,
                    payload.camp_phone_secondary,
                    payload.reported_status,
                )
            )

            # Provenance: every camp links to where it came from.
            source_id = await connection.fetchval(
                """
                INSERT INTO sources (type, label)
                VALUES ('public_submission', 'Public submission')
                RETURNING id
                """
            )
            await connection.execute(
                "INSERT INTO camp_sources (camp_id, source_id) VALUES ($1, $2) "
                "ON CONFLICT DO NOTHING",
                camp_id,
                source_id,
            )

        # 4. The report row itself.
        reference = reference_code()
        report_id = str(
            await connection.fetchval(
                """
                INSERT INTO reports (
                    reference_code, camp_id, is_correction, correction_note,
                    reporter_name, reporter_phone_primary, reporter_phone_secondary,
                    reporter_gender, reporter_relationship, phone_verified_at, phone_unverified,
                    submitted_lat, submitted_lng, device_location_granted,
                    reported_status,
                    payload, auto_flags, ip_hash
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
                        CASE WHEN $10 THEN NULL ELSE now() END, $10,
                        $11,$12,$13,$14,$15::jsonb,$16::jsonb,$17)
                RETURNING id
                """,
                reference,
                camp_id,
                payload.is_correction,
                payload.correction_note,
                payload.reporter_name,
                payload.reporter_phone_primary,
                payload.reporter_phone_secondary,
                payload.reporter_gender,
                payload.reporter_relationship,
                phone_unverified,
                payload.latitude,
                payload.longitude,
                payload.device_location_granted,
                payload.reported_status,
                json.dumps(
                    {"landmark": payload.landmark, "village": payload.village_or_locality}
                ),
                json.dumps(auto_flags),
                ip_hash,
            )
        )

        # 5. Photos. Held duplicates keep their images off the public camp.
        await self._images.store(
            connection,
            report_id=report_id,
            camp_id=None if held_as_duplicate else camp_id,
            images=[
                IncomingImage(
                    data_url=image.data_url,
                    width=image.width,
                    height=image.height,
                    blur_score=image.blur_score,
                    brightness_score=image.brightness_score,
                    exif_lat=image.exif_lat,
                    exif_lng=image.exif_lng,
                    exif_captured_at=image.exif_captured_at,
                    quality_reasons=image.quality_reasons,
                )
                for image in payload.images
            ],
        )

        # 6. Trail.
        if held_as_duplicate:
            await write_audit(
                connection,
                actor_type="system",
                action="corroborating_report_held",
                entity_type="report",
                entity_id=report_id,
                note=f"Matched existing camp {camp_id}",
            )

        await write_audit(
            connection,
            actor_type="public",
            action="correction_submitted" if payload.is_correction else "report_submitted",
            entity_type="camp",
            entity_id=camp_id,
            after={"reference": reference, "flags": auto_flags},
        )

        return PersistResult(
            ok=True,
            reference=reference,
            camp_id=camp_id,
            held_as_duplicate=held_as_duplicate,
            phone_unverified=phone_unverified,
        )
