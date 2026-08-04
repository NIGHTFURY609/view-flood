"""Crowd confirmation that a camp is open.

Uniqueness (one per phone and one per IP, per camp, per IST day) is enforced by
DB unique indexes, not by a pre-check — a pre-check would race. We catch the
23505 and read the CONSTRAINT NAME to tell the two cases apart, because "you
already checked in" and "someone on your network already did" need different
copy.

The bump_camp_checkin() trigger propagates occupancy into camps; never update
those counters by hand.
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from app.schemas.checkins import CheckInIn

PHONE_CONSTRAINT = "camp_checkins_phone_uniq"
IP_CONSTRAINT = "camp_checkins_ip_uniq"


@dataclass(frozen=True)
class CheckInResult:
    ok: bool
    checkin_count: int = 0
    reason: str | None = None


def mask_phone(phone: str) -> str:
    return f"••••• {phone[-4:]}"


class CheckInService:
    async def record(
        self,
        connection: asyncpg.Connection,
        *,
        payload: CheckInIn,
        ip_hash: str,
    ) -> CheckInResult:
        try:
            await connection.execute(
                """
                INSERT INTO camp_checkins (
                    camp_id, phone, ip_hash, is_open, note, latitude, longitude,
                    people_count, family_count, children_count, amenities
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                """,
                payload.camp_id,
                payload.phone,
                ip_hash,
                payload.is_open,
                payload.note,
                payload.latitude,
                payload.longitude,
                payload.people_count,
                payload.family_count,
                payload.children_count,
                list(payload.amenities),
            )
        except asyncpg.UniqueViolationError as exc:
            constraint = (exc.constraint_name or "").lower()
            if IP_CONSTRAINT in constraint:
                return CheckInResult(ok=False, reason="already_ip")
            if PHONE_CONSTRAINT in constraint:
                return CheckInResult(ok=False, reason="already_phone")
            # Unexpected unique index — surface it rather than guess.
            raise

        count = await connection.fetchval(
            "SELECT checkin_count FROM camps WHERE id = $1", payload.camp_id
        )
        return CheckInResult(ok=True, checkin_count=count or 0)

    async def recent(
        self, connection: asyncpg.Connection, camp_id: str, limit: int = 8
    ) -> list[dict[str, object]]:
        rows = await connection.fetch(
            """
            SELECT id, phone, is_open, note, people_count, created_at
            FROM camp_checkins
            WHERE camp_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            camp_id,
            limit,
        )
        # Phone numbers are masked here, never returned raw. PRD §11.
        return [
            {
                "id": str(row["id"]),
                "phone_masked": mask_phone(row["phone"]),
                "is_open": row["is_open"],
                "note": row["note"],
                "people_count": row["people_count"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]
