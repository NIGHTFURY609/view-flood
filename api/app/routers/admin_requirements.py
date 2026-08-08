"""Admin review queue for public requirement requests.

Cookie-authed, like admin_camps. Approving is the only way a requirement becomes
a public camp_needs row, so every mutation here is audit-logged in the service.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.errors import NotFoundError
from app.deps import CurrentAdminDep, DatabaseDep, RequirementServiceDep
from app.schemas.common import Page
from app.schemas.requirements import (
    AdminNeedOut,
    AdminPledgeOut,
    AdminPledgeRow,
    RequirementCounts,
    RequirementOut,
    RequirementRejectIn,
)

router = APIRouter(tags=["admin-requirements"], prefix="/admin")


def _offset(cursor: str) -> int:
    return int(cursor) if cursor.isdigit() else 0


# Declared before /requirements/{requirement_id}-shaped routes so "counts" is
# never swallowed as an id.
@router.get("/requirements/counts", response_model=RequirementCounts)
async def admin_requirement_counts(
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
) -> RequirementCounts:
    """Powers the sidebar and per-camp bubbles.

    Kept separate from the camps listing on purpose: folding a per-camp count
    into admin_list_camps would put a correlated subquery on every admin camps
    page load, including the three limit=1 stat-card queries.
    """
    async with db.acquire() as connection:
        total, by_camp = await requirements.pending_counts(connection)
    return RequirementCounts(total=total, by_camp=by_camp)


@router.get("/requirements", response_model=Page[RequirementOut])
async def admin_list_requirements(
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
    status: str = "pending",
    camp_id: str | None = None,
    q: str | None = None,
    cursor: str = "",
    limit: int = Query(default=25, ge=1, le=100),
) -> Page[RequirementOut]:
    offset = _offset(cursor)
    async with db.acquire() as connection:
        rows, total = await requirements.list_for_admin(
            connection, status=status, camp_id=camp_id, q=q, offset=offset, limit=limit
        )
    next_offset = offset + limit
    return Page[RequirementOut](
        items=[RequirementOut.model_validate(row) for row in rows],
        total=total,
        next_cursor=str(next_offset) if next_offset < total else None,
    )


@router.get("/requirements/{requirement_id}", response_model=RequirementOut)
async def admin_get_requirement(
    requirement_id: str,
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
) -> RequirementOut:
    async with db.acquire() as connection:
        row = await requirements.get_one(connection, requirement_id)
    if row is None:
        raise NotFoundError("That request no longer exists")
    return RequirementOut.model_validate(row)


@router.get("/needs", response_model=Page[AdminNeedOut])
async def admin_list_needs(
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
    district_code: str | None = None,
    item_key: str | None = None,
    camp_id: str | None = None,
    q: str | None = None,
    cursor: str = "",
    limit: int = Query(default=25, ge=1, le=100),
) -> Page[AdminNeedOut]:
    """Approved needs and their donation tallies — the 'Donations' view."""
    offset = _offset(cursor)
    async with db.acquire() as connection:
        rows, total = await requirements.list_needs_for_admin(
            connection,
            district_code=district_code,
            item_key=item_key,
            camp_id=camp_id,
            q=q,
            offset=offset,
            limit=limit,
        )
    next_offset = offset + limit
    return Page[AdminNeedOut](
        items=[AdminNeedOut.model_validate(row) for row in rows],
        total=total,
        next_cursor=str(next_offset) if next_offset < total else None,
    )


@router.get("/needs/{need_id}/pledges", response_model=list[AdminPledgeOut])
async def admin_need_pledges(
    need_id: str,
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
) -> list[AdminPledgeOut]:
    """Individual donations for a need, including donor name and phone (PII)."""
    async with db.acquire() as connection:
        rows = await requirements.pledges_for_need(connection, need_id)
    return [AdminPledgeOut.model_validate(row) for row in rows]


@router.get("/pledges", response_model=Page[AdminPledgeRow])
async def admin_list_pledges(
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
    district_code: str | None = None,
    item_key: str | None = None,
    verified: str | None = None,
    q: str | None = None,
    cursor: str = "",
    limit: int = Query(default=25, ge=1, le=100),
) -> Page[AdminPledgeRow]:
    """Every donation, newest first — the Donations approval list."""
    offset = _offset(cursor)
    async with db.acquire() as connection:
        rows, total = await requirements.list_pledges_for_admin(
            connection,
            district_code=district_code,
            item_key=item_key,
            verified=verified,
            q=q,
            offset=offset,
            limit=limit,
        )
    next_offset = offset + limit
    return Page[AdminPledgeRow](
        items=[AdminPledgeRow.model_validate(r) for r in rows],
        total=total,
        next_cursor=str(next_offset) if next_offset < total else None,
    )


@router.get("/pledges/{pledge_id}", response_model=AdminPledgeRow)
async def admin_get_pledge(
    pledge_id: str,
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
) -> AdminPledgeRow:
    async with db.acquire() as connection:
        row = await requirements.get_pledge(connection, pledge_id)
    if row is None:
        raise NotFoundError("That donation no longer exists")
    return AdminPledgeRow.model_validate(row)


@router.post("/pledges/{pledge_id}/verify", response_model=AdminPledgeRow)
async def admin_verify_pledge(
    pledge_id: str,
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
) -> AdminPledgeRow:
    """Confirm a donation — its quantity counts toward the camp's needs."""
    async with db.transaction() as connection:
        row = await requirements.set_pledge_verified(
            connection, pledge_id=pledge_id, admin_id=admin.id, verified=True
        )
    return AdminPledgeRow.model_validate(row)


@router.post("/pledges/{pledge_id}/unverify", response_model=AdminPledgeRow)
async def admin_unverify_pledge(
    pledge_id: str,
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
) -> AdminPledgeRow:
    """Undo a donation — its quantity returns to the camp's still-needed total."""
    async with db.transaction() as connection:
        row = await requirements.set_pledge_verified(
            connection, pledge_id=pledge_id, admin_id=admin.id, verified=False
        )
    return AdminPledgeRow.model_validate(row)


@router.get("/camps/{camp_id}/requirements", response_model=list[RequirementOut])
async def admin_camp_requirements(
    camp_id: str,
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
) -> list[RequirementOut]:
    async with db.acquire() as connection:
        rows = await requirements.for_camp(connection, camp_id)
    return [RequirementOut.model_validate(row) for row in rows]


@router.post("/requirements/{requirement_id}/approve", status_code=204)
async def admin_approve_requirement(
    requirement_id: str,
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
) -> None:
    """Publish the request — every line item is upserted into camp_needs."""
    async with db.transaction() as connection:
        await requirements.approve(
            connection, requirement_id=requirement_id, admin_id=admin.id
        )


@router.post("/requirements/{requirement_id}/reject", status_code=204)
async def admin_reject_requirement(
    requirement_id: str,
    body: RequirementRejectIn,
    admin: CurrentAdminDep,
    db: DatabaseDep,
    requirements: RequirementServiceDep,
) -> None:
    """Close the request without touching camp_needs."""
    async with db.transaction() as connection:
        await requirements.reject(
            connection,
            requirement_id=requirement_id,
            admin_id=admin.id,
            note=body.note,
        )
