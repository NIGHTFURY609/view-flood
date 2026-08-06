"""Public write surface: OTP, reports, check-ins, pledges, image flags.

Every handler runs inside a transaction. All of them return 503 with a clear
message until SUPABASE_DB_URL is configured, rather than failing obscurely.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.core.errors import NotFoundError, OtpError, RateLimitedError
from app.core.ip import client_ip, hash_ip
from app.deps import (
    CheckInServiceDep,
    DatabaseDep,
    ImageServiceDep,
    NeedsServiceDep,
    OtpServiceDep,
    ReportServiceDep,
    RequirementServiceDep,
)
from app.schemas.checkins import (
    CheckInIn,
    CheckInMaskedOut,
    CheckInResultOut,
    PledgeIn,
    PledgeResultOut,
)
from app.schemas.reports import (
    ImageFlagIn,
    OtpChallengeOut,
    OtpRequest,
    ReportIn,
    ReportResult,
)
from app.schemas.requirements import RequirementIn, RequirementResult

router = APIRouter(tags=["writes"])


@router.post("/otp/challenges", response_model=OtpChallengeOut)
async def request_otp(
    payload: OtpRequest,
    request: Request,
    db: DatabaseDep,
    otp: OtpServiceDep,
) -> OtpChallengeOut:
    ip_hash = hash_ip(client_ip(request))
    async with db.transaction() as connection:
        result = await otp.create_challenge(connection, phone=payload.phone, ip_hash=ip_hash)

    if not result.ok:
        raise RateLimitedError(
            "Too many verification codes requested. Try again in an hour.",
            code="rate_limited",
        )
    return OtpChallengeOut(
        challenge_id=result.challenge_id or "", delivered=result.delivered
    )


@router.post("/reports", response_model=ReportResult)
async def submit_report(
    payload: ReportIn,
    request: Request,
    db: DatabaseDep,
    reports: ReportServiceDep,
) -> ReportResult:
    ip_hash = hash_ip(client_ip(request))

    # One transaction for the whole pipeline — see report_service.
    async with db.transaction() as connection:
        result = await reports.persist(connection, payload=payload, ip_hash=ip_hash)

    if not result.ok:
        raise OtpError(
            "That verification code is not correct or has expired",
            code=result.reason or "otp_failed",
        )

    return ReportResult(
        ok=True,
        reference=result.reference,
        camp_id=result.camp_id,
        held_as_duplicate=result.held_as_duplicate,
        phone_unverified=result.phone_unverified,
    )


@router.post("/camps/{camp_id}/checkins", response_model=CheckInResultOut)
async def create_checkin(
    camp_id: str,
    payload: CheckInIn,
    request: Request,
    db: DatabaseDep,
    checkins: CheckInServiceDep,
) -> CheckInResultOut:
    # Trust the path, not the body.
    payload = payload.model_copy(update={"camp_id": camp_id})
    ip_hash = hash_ip(client_ip(request))

    async with db.transaction() as connection:
        result = await checkins.record(connection, payload=payload, ip_hash=ip_hash)

    return CheckInResultOut(
        ok=result.ok, reason=result.reason, checkin_count=result.checkin_count
    )


@router.get("/camps/{camp_id}/checkins", response_model=list[CheckInMaskedOut])
async def list_checkins(
    camp_id: str,
    db: DatabaseDep,
    checkins: CheckInServiceDep,
) -> list[CheckInMaskedOut]:
    async with db.acquire() as connection:
        rows = await checkins.recent(connection, camp_id)
    return [CheckInMaskedOut.model_validate(row) for row in rows]


@router.post("/needs/{need_id}/pledges", response_model=PledgeResultOut)
async def create_pledge(
    need_id: str,
    payload: PledgeIn,
    request: Request,
    db: DatabaseDep,
    needs: NeedsServiceDep,
) -> PledgeResultOut:
    ip_hash = hash_ip(client_ip(request))

    async with db.transaction() as connection:
        result = await needs.pledge(
            connection, need_id=need_id, payload=payload, ip_hash=ip_hash
        )

    if not result.ok and result.reason == "not_found":
        raise NotFoundError("That requirement no longer exists")
    if not result.ok:
        raise OtpError(
            "That verification code is not correct or has expired",
            code=result.reason or "otp_failed",
        )

    return PledgeResultOut(
        ok=True,
        verified=result.verified,
        pledged_qty=result.pledged_qty,
        needed_qty=result.needed_qty,
    )


@router.post("/camps/{camp_id}/requirements", response_model=RequirementResult)
async def submit_requirement(
    camp_id: str,
    payload: RequirementIn,
    request: Request,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
) -> RequirementResult:
    """Ask for supplies on behalf of a camp.

    Inert until an admin approves it — nothing here reaches a public camp page
    on its own. Unlike every other public write there is no OTP step, so the
    service's IP/phone windows are the only abuse control.
    """
    ip_hash = hash_ip(client_ip(request))

    async with db.transaction() as connection:
        result = await requirements.submit(
            connection, camp_id=camp_id, payload=payload, ip_hash=ip_hash
        )

    return RequirementResult(
        ok=True, requirement_id=result.requirement_id, item_count=result.item_count
    )


@router.get("/camps/{camp_id}/images")
async def camp_images(
    camp_id: str,
    db: DatabaseDep,
    images: ImageServiceDep,
) -> list[dict[str, object]]:
    async with db.acquire() as connection:
        return await images.signed_camp_images(connection, camp_id)


@router.post("/camps/{camp_id}/images/{image_id}/flag")
async def flag_image(
    camp_id: str,
    image_id: str,
    payload: ImageFlagIn,
    request: Request,
    db: DatabaseDep,
) -> dict[str, bool]:
    """Registers a concern for review. Unlike the prototype, this is not inert —
    it lands in image_flags and appears in the admin moderation queue."""
    ip_hash = hash_ip(client_ip(request))

    async with db.transaction() as connection:
        exists = await connection.fetchval(
            "SELECT 1 FROM report_images WHERE id = $1 AND camp_id = $2", image_id, camp_id
        )
        if not exists:
            raise NotFoundError("That photo does not exist")

        # Duplicate flags from one network on one day are ignored, not an error:
        # the reporter's intent is already recorded.
        await connection.execute(
            """
            INSERT INTO image_flags (image_id, reason, ip_hash)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            """,
            image_id,
            payload.reason,
            ip_hash,
        )

    return {"ok": True}
