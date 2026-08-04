"""Admin verification portal — PRD §9 item 11.

Every route here is guarded by require_admin, which checks a valid Supabase JWT
AND membership in admin_users. Reporter PII appears only on these routes.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.security import AdminUser, require_admin
from app.deps import AdminAuthDep, AdminServiceDep, DatabaseDep, ImageServiceDep
from app.schemas.common import Page

router = APIRouter(prefix="/admin", tags=["admin"])

CurrentAdmin = Annotated[AdminUser, Depends(require_admin)]


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=200)


class VerifyIn(BaseModel):
    method: (
        Literal["phone_call", "official_document", "site_visit", "known_contact", "cross_reference"]
        | None
    ) = None
    note: str | None = Field(default=None, max_length=500)


class RejectIn(BaseModel):
    # A rejection without a stated reason is unreviewable later.
    note: str = Field(min_length=3, max_length=500)


class MergeIn(BaseModel):
    canonical_camp_id: str
    note: str | None = Field(default=None, max_length=500)


class HideImageIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


@router.post("/login")
async def login(payload: LoginIn, auth: AdminAuthDep) -> dict[str, Any]:
    """Credential exchange happens server-side so no Supabase key ever reaches
    the browser."""
    session = await auth.sign_in(payload.email, payload.password)
    return {
        "access_token": session.get("access_token"),
        "refresh_token": session.get("refresh_token"),
        "expires_in": session.get("expires_in"),
    }


@router.get("/me")
async def me(admin: CurrentAdmin) -> dict[str, Any]:
    return {
        "id": admin.id,
        "email": admin.email,
        "display_name": admin.display_name,
        "role": admin.role,
    }


@router.get("/reports")
async def pending_reports(
    admin: CurrentAdmin,
    db: DatabaseDep,
    service: AdminServiceDep,
    district_code: str | None = None,
    cursor: str = "",
    limit: int = Query(default=25, ge=1, le=100),
) -> Page[dict[str, Any]]:
    offset = int(cursor) if cursor.isdigit() else 0
    async with db.acquire() as connection:
        items, total = await service.pending_reports(
            connection, district_code=district_code, offset=offset, limit=limit
        )
    nxt = offset + limit
    return Page(items=items, total=total, next_cursor=str(nxt) if nxt < total else None)


@router.post("/camps/{camp_id}/verify")
async def verify_camp(
    camp_id: str,
    payload: VerifyIn,
    admin: CurrentAdmin,
    db: DatabaseDep,
    service: AdminServiceDep,
) -> dict[str, Any]:
    async with db.transaction() as connection:
        return await service.set_verification(
            connection,
            camp_id=camp_id,
            admin_id=admin.id,
            state="verified",
            method=payload.method,
            note=payload.note,
        )


@router.post("/camps/{camp_id}/reject")
async def reject_camp(
    camp_id: str,
    payload: RejectIn,
    admin: CurrentAdmin,
    db: DatabaseDep,
    service: AdminServiceDep,
) -> dict[str, Any]:
    async with db.transaction() as connection:
        return await service.set_verification(
            connection,
            camp_id=camp_id,
            admin_id=admin.id,
            state="rejected",
            note=payload.note,
        )


@router.post("/camps/{camp_id}/remove")
async def remove_camp(
    camp_id: str,
    payload: RejectIn,
    admin: CurrentAdmin,
    db: DatabaseDep,
    service: AdminServiceDep,
) -> dict[str, Any]:
    """Soft-delete for spam or hoax. The row survives so the audit trail does."""
    async with db.transaction() as connection:
        return await service.set_verification(
            connection,
            camp_id=camp_id,
            admin_id=admin.id,
            state="removed",
            note=payload.note,
        )


@router.post("/camps/{camp_id}/merge")
async def merge_camp(
    camp_id: str,
    payload: MergeIn,
    admin: CurrentAdmin,
    db: DatabaseDep,
    service: AdminServiceDep,
) -> dict[str, Any]:
    async with db.transaction() as connection:
        return await service.merge_camps(
            connection,
            duplicate_id=camp_id,
            canonical_id=payload.canonical_camp_id,
            admin_id=admin.id,
            note=payload.note,
        )


@router.get("/report-images/flagged")
async def flagged_images(
    admin: CurrentAdmin,
    db: DatabaseDep,
    service: AdminServiceDep,
    images: ImageServiceDep,
    cursor: str = "",
    limit: int = Query(default=30, ge=1, le=100),
) -> Page[dict[str, Any]]:
    offset = int(cursor) if cursor.isdigit() else 0
    async with db.acquire() as connection:
        items, total = await service.flagged_images(connection, offset=offset, limit=limit)

    # Sign each path so a reviewer can actually see what was reported.
    for item in items:
        item["url"] = await images.signed_url_for(str(item["storage_path"]))

    nxt = offset + limit
    return Page(items=items, total=total, next_cursor=str(nxt) if nxt < total else None)


@router.post("/report-images/{image_id}/hide")
async def hide_image(
    image_id: str,
    payload: HideImageIn,
    admin: CurrentAdmin,
    db: DatabaseDep,
    service: AdminServiceDep,
) -> dict[str, bool]:
    async with db.transaction() as connection:
        await service.hide_image(
            connection, image_id=image_id, admin_id=admin.id, reason=payload.reason
        )
    return {"ok": True}


@router.get("/audit-log")
async def audit_log(
    admin: CurrentAdmin,
    db: DatabaseDep,
    service: AdminServiceDep,
    entity_type: str | None = None,
    entity_id: str | None = None,
    cursor: str = "",
    limit: int = Query(default=50, ge=1, le=200),
) -> Page[dict[str, Any]]:
    offset = int(cursor) if cursor.isdigit() else 0
    async with db.acquire() as connection:
        items, total = await service.audit_log(
            connection,
            entity_type=entity_type,
            entity_id=entity_id,
            offset=offset,
            limit=limit,
        )
    nxt = offset + limit
    return Page(items=items, total=total, next_cursor=str(nxt) if nxt < total else None)
