"""Admin camps — listing, detail, edit, approve/reject/delete, images, reports.

Cookie-authed (the from-scratch admin session), and backed by the direct-Postgres
service only: it needs to see inactive camps and the unverified queue, which the
PostgREST fallback path does not model. Every mutation is audit-logged.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.errors import NotFoundError, ServiceUnavailableError
from app.deps import CampsServiceDep, CurrentAdminDep, DatabaseDep, ImageServiceDep
from app.schemas.camps import CampDetail, CampListItem
from app.schemas.common import Page
from app.services.camps_sql_service import CampsSqlService

router = APIRouter(tags=["admin-camps"], prefix="/admin")


def _offset(cursor: str) -> int:
    return int(cursor) if cursor.isdigit() else 0


def _require_sql(service: CampsServiceDep) -> CampsSqlService:
    if not isinstance(service, CampsSqlService):
        raise ServiceUnavailableError(
            "The admin camps view needs database credentials that are not configured yet.",
            code="db_not_configured",
        )
    return service


class CampUpdate(BaseModel):
    name: str | None = None
    name_ml: str | None = None
    district_code: str | None = None
    taluk: str | None = None
    lsg_name: str | None = None
    village_or_locality: str | None = None
    landmark: str | None = None
    camp_incharge_name: str | None = None
    camp_phone_primary: str | None = None
    camp_phone_secondary: str | None = None
    status: Literal["active", "inactive"] | None = None


class RejectIn(BaseModel):
    note: str | None = None


class AdminCampImage(BaseModel):
    id: str
    url: str | None = None
    width: int | None = None
    height: int | None = None
    quality_status: str | None = None
    hidden: bool = False
    created_at: datetime


class AdminReport(BaseModel):
    reference_code: str
    reporter_name: str | None = None
    reporter_phone_primary: str | None = None
    reporter_phone_secondary: str | None = None
    reporter_relationship: str | None = None
    reported_status: str | None = None
    reported_urgency: str | None = None
    reported_urgency_reason: str | None = None
    auto_flags: list[str] = []
    phone_unverified: bool = False
    submitted_at: datetime


@router.get("/camps", response_model=Page[CampListItem])
async def admin_list_camps(
    admin: CurrentAdminDep,
    service: CampsServiceDep,
    q: str | None = None,
    phone: str | None = None,
    district_code: str | None = None,
    taluk: str | None = None,
    lsg_name: str | None = None,
    verification: str = "all",
    reviewed: str = "all",
    cursor: str = "",
    limit: int = Query(default=25, ge=1, le=100),
) -> Page[CampListItem]:
    sql = _require_sql(service)
    offset = _offset(cursor)
    items, total = await sql.admin_list_camps(
        q=q,
        phone=phone,
        district_code=district_code,
        taluk=taluk,
        lsg_name=lsg_name,
        verification=verification,
        reviewed=reviewed,
        offset=offset,
        limit=limit,
    )
    next_offset = offset + limit
    has_more = next_offset < total
    return Page[CampListItem](
        items=items, total=total, next_cursor=str(next_offset) if has_more else None
    )


@router.get("/camps/{camp_id}", response_model=CampDetail)
async def admin_get_camp(
    camp_id: str, admin: CurrentAdminDep, service: CampsServiceDep
) -> CampDetail:
    camp = await _require_sql(service).admin_get_camp(camp_id)
    if camp is None:
        raise NotFoundError("That camp is not listed")
    return camp


@router.get("/camps/{camp_id}/images", response_model=list[AdminCampImage])
async def admin_camp_images(
    camp_id: str, admin: CurrentAdminDep, db: DatabaseDep, images: ImageServiceDep
) -> list[AdminCampImage]:
    rows = await db.fetch(
        """
        SELECT id, storage_path, width, height, quality_status, hidden, created_at
        FROM report_images
        WHERE camp_id = $1::uuid
        ORDER BY created_at
        """,
        camp_id,
    )
    out: list[AdminCampImage] = []
    for r in rows:
        url = await images.signed_url_for(str(r["storage_path"]))
        out.append(
            AdminCampImage(
                id=str(r["id"]),
                url=url,
                width=r["width"],
                height=r["height"],
                quality_status=r["quality_status"],
                hidden=r["hidden"],
                created_at=r["created_at"],
            )
        )
    return out


@router.get("/camps/{camp_id}/reports", response_model=list[AdminReport])
async def admin_camp_reports(
    camp_id: str, admin: CurrentAdminDep, service: CampsServiceDep
) -> list[AdminReport]:
    rows = await _require_sql(service).admin_camp_reports(camp_id)
    return [AdminReport.model_validate(r) for r in rows]


@router.patch("/camps/{camp_id}", response_model=CampDetail)
async def admin_update_camp(
    camp_id: str, body: CampUpdate, admin: CurrentAdminDep, service: CampsServiceDep
) -> CampDetail:
    camp = await _require_sql(service).admin_update_camp(
        camp_id, body.model_dump(exclude_unset=True), admin.id
    )
    if camp is None:
        raise NotFoundError("That camp is not listed")
    return camp


@router.post("/camps/{camp_id}/approve", response_model=CampDetail)
async def admin_approve_camp(
    camp_id: str, admin: CurrentAdminDep, service: CampsServiceDep
) -> CampDetail:
    """Approve a reported camp — verified + reviewed; shows in the public app."""
    camp = await _require_sql(service).admin_approve(camp_id, admin.id)
    if camp is None:
        raise NotFoundError("That camp is not listed")
    return camp


# Path is "/decline", not "/reject": the legacy admin.py router (Supabase bearer
# auth) already owns POST /admin/camps/{id}/reject and is mounted first, so it
# would shadow this cookie/JWT-authed handler and 401 our tokens.
@router.post("/camps/{camp_id}/decline", response_model=CampDetail)
async def admin_reject_camp(
    camp_id: str, body: RejectIn, admin: CurrentAdminDep, service: CampsServiceDep
) -> CampDetail:
    """Reject a reported camp — stays unverified, marked reviewed (leaves the queue)."""
    camp = await _require_sql(service).admin_reject(camp_id, admin.id, body.note)
    if camp is None:
        raise NotFoundError("That camp is not listed")
    return camp


@router.delete("/camps/{camp_id}", status_code=204)
async def admin_delete_camp(
    camp_id: str, admin: CurrentAdminDep, service: CampsServiceDep
) -> None:
    """Hard delete a camp (dependents cascade / null out)."""
    deleted = await _require_sql(service).admin_delete_camp(camp_id, admin.id)
    if not deleted:
        raise NotFoundError("That camp is not listed")
