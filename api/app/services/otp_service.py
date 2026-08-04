"""Phone verification.

Ported from camp-trust-link/src/lib/reports.server.ts. Thresholds are product
behaviour and must not drift:

  6-digit code · 10 minute TTL · 5 verify attempts
  20 challenges per IP per hour · 4 challenges per phone per hour

One deliberate change from the prototype: the stored hash is peppered with a
server secret. The prototype stored sha256(phone + ":" + code), which is
brute-forceable offline over a 1M code space against a often-guessable phone
number if otp_challenges ever leaked.
"""

from __future__ import annotations

from dataclasses import dataclass
from secrets import randbelow

import asyncpg

from app.core.ip import sha256_hex
from app.sms.base import SmsProvider

OTP_TTL_MINUTES = 10
MAX_VERIFY_ATTEMPTS = 5
MAX_CHALLENGES_PER_IP_PER_HOUR = 20
MAX_CHALLENGES_PER_PHONE_PER_HOUR = 4


@dataclass(frozen=True)
class ChallengeResult:
    ok: bool
    challenge_id: str | None = None
    delivered: bool = False
    reason: str | None = None


@dataclass(frozen=True)
class VerifyResult:
    ok: bool
    reason: str | None = None


def hash_code(pepper: str, phone: str, code: str) -> str:
    return sha256_hex(f"{pepper}:{phone}:{code}")


def generate_code() -> str:
    """Cryptographically random, not `random`."""
    return f"{randbelow(1_000_000):06d}"


class OtpService:
    def __init__(self, sms: SmsProvider, pepper: str) -> None:
        self._sms = sms
        self._pepper = pepper

    async def create_challenge(
        self,
        connection: asyncpg.Connection,
        *,
        phone: str,
        ip_hash: str,
    ) -> ChallengeResult:
        # Soft abuse limits. This is a COUNT-then-INSERT with no lock, so two
        # concurrent requests can exceed the cap by one. Acceptable for a soft
        # limit; hardening would need an advisory lock or a bucketed index.
        ip_count = await connection.fetchval(
            """
            SELECT count(*) FROM otp_challenges
            WHERE ip_hash = $1 AND created_at >= now() - interval '1 hour'
            """,
            ip_hash,
        )
        if (ip_count or 0) >= MAX_CHALLENGES_PER_IP_PER_HOUR:
            return ChallengeResult(ok=False, reason="rate_limited")

        phone_count = await connection.fetchval(
            """
            SELECT count(*) FROM otp_challenges
            WHERE phone = $1 AND created_at >= now() - interval '1 hour'
            """,
            phone,
        )
        if (phone_count or 0) >= MAX_CHALLENGES_PER_PHONE_PER_HOUR:
            return ChallengeResult(ok=False, reason="rate_limited")

        code = generate_code()
        delivered = await self._sms.send(
            phone, f"Kerala Camp Check verification code: {code}. Valid for 10 minutes."
        )

        challenge_id = await connection.fetchval(
            """
            INSERT INTO otp_challenges (phone, code_hash, ip_hash, delivery_failed, expires_at)
            VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)
            RETURNING id
            """,
            phone,
            hash_code(self._pepper, phone, code),
            ip_hash,
            not delivered,
            str(OTP_TTL_MINUTES),
        )

        return ChallengeResult(ok=True, challenge_id=str(challenge_id), delivered=delivered)

    async def verify(
        self,
        connection: asyncpg.Connection,
        *,
        challenge_id: str,
        phone: str,
        code: str,
    ) -> VerifyResult:
        row = await connection.fetchrow(
            """
            SELECT id, phone, code_hash, attempts, consumed_at,
                   (expires_at < now()) AS expired
            FROM otp_challenges
            WHERE id = $1
            """,
            challenge_id,
        )

        if row is None:
            return VerifyResult(ok=False, reason="not_found")
        if row["phone"] != phone:
            return VerifyResult(ok=False, reason="mismatch")
        if row["consumed_at"] is not None:
            return VerifyResult(ok=False, reason="used")
        if row["expired"]:
            return VerifyResult(ok=False, reason="expired")
        if row["attempts"] >= MAX_VERIFY_ATTEMPTS:
            return VerifyResult(ok=False, reason="too_many_attempts")

        if row["code_hash"] != hash_code(self._pepper, phone, code):
            await connection.execute(
                "UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1",
                challenge_id,
            )
            return VerifyResult(ok=False, reason="wrong")

        await connection.execute(
            "UPDATE otp_challenges SET consumed_at = now() WHERE id = $1", challenge_id
        )
        return VerifyResult(ok=True)
