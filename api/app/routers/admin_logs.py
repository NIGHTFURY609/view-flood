"""Admin activity log — reads the shared audit_log trail (cookie-authed)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.deps import CampsServiceDep, CurrentAdminDep
from app.routers.admin_camps import _offset, _require_sql
from app.schemas.common import Page

router = APIRouter(tags=["admin-logs"], prefix="/admin")


class AuditLogEntry(BaseModel):
    id: str
    created_at: datetime
    actor_type: str
    actor_id: str | None = None
    entity_type: str
    entity_id: str | None = None
    action: str
    note: str | None = None


@router.get("/logs", response_model=Page[AuditLogEntry])
async def admin_logs(
    admin: CurrentAdminDep,
    service: CampsServiceDep,
    entity_type: str | None = None,
    action: str | None = None,
    cursor: str = "",
    limit: int = Query(default=25, ge=1, le=100),
) -> Page[AuditLogEntry]:
    offset = _offset(cursor)
    rows, total = await _require_sql(service).admin_audit_log(
        entity_type=entity_type, action=action, offset=offset, limit=limit
    )
    items = [
        AuditLogEntry(
            id=str(r["id"]),
            created_at=r["created_at"],
            actor_type=r["actor_type"],
            actor_id=str(r["actor_id"]) if r["actor_id"] is not None else None,
            entity_type=r["entity_type"],
            entity_id=str(r["entity_id"]) if r["entity_id"] is not None else None,
            action=r["action"],
            note=r["note"],
        )
        for r in rows
    ]
    next_offset = offset + limit
    has_more = next_offset < total
    return Page[AuditLogEntry](
        items=items, total=total, next_cursor=str(next_offset) if has_more else None
    )
