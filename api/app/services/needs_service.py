"""Donation pledges.

A pledge records intent only — no money moves through this platform (PRD §11).
The bump_need_pledge() trigger updates camp_needs.pledged_qty; never write that
column directly.
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from app.schemas.checkins import PledgeIn
from app.services.otp_service import OtpService


@dataclass(frozen=True)
class PledgeResult:
    ok: bool
    verified: bool = False
    pledged_qty: int = 0
    needed_qty: int = 0
    reason: str | None = None


class NeedsService:
    def __init__(self, otp: OtpService) -> None:
        self._otp = otp

    async def pledge(
        self,
        connection: asyncpg.Connection,
        *,
        need_id: str,
        payload: PledgeIn,
        ip_hash: str,
    ) -> PledgeResult:
        need = await connection.fetchrow(
            "SELECT id, camp_id, needed_qty, pledged_qty FROM camp_needs WHERE id = $1",
            need_id,
        )
        if need is None:
            return PledgeResult(ok=False, reason="not_found")

        verified = False
        if payload.challenge_id and payload.otp_code:
            result = await self._otp.verify(
                connection,
                challenge_id=payload.challenge_id,
                phone=payload.donor_phone,
                code=payload.otp_code,
            )
            if not result.ok:
                return PledgeResult(ok=False, reason=result.reason or "otp_failed")
            verified = True

        await connection.execute(
            """
            INSERT INTO need_pledges (
                need_id, camp_id, quantity, donor_name, donor_phone, phone_verified, ip_hash
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            """,
            need_id,
            need["camp_id"],
            payload.quantity,
            payload.donor_name,
            payload.donor_phone,
            verified,
            ip_hash,
        )

        # Re-read rather than compute: the trigger is the source of truth, and
        # another pledge may have landed in between.
        pledged = await connection.fetchval(
            "SELECT pledged_qty FROM camp_needs WHERE id = $1", need_id
        )

        return PledgeResult(
            ok=True,
            verified=verified,
            pledged_qty=pledged or 0,
            needed_qty=need["needed_qty"],
        )
