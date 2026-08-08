from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.errors import NotFoundError
from app.deps import CampsServiceDep
from app.schemas.camps import CampBatchRequest, CampDetail, CampListItem, CampNeed
from app.schemas.common import Page

router = APIRouter(tags=["camps"])


def _offset(cursor: str) -> int:
    return int(cursor) if cursor.isdigit() else 0


def _page[T](items: list[T], total: int | None, offset: int, limit: int) -> Page[T]:
    next_offset = offset + limit
    has_more = total is not None and next_offset < total
    return Page[T](
        items=items, total=total, next_cursor=str(next_offset) if has_more else None
    )


@router.get("/camps", response_model=Page[CampListItem])
async def list_camps(
    service: CampsServiceDep,
    district_code: str | None = None,
    taluk: str | None = None,
    lsg_name: str | None = None,
    status: str = "active",
    verified_only: bool = False,
    q: str | None = None,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    sort: str = "recent",
    cursor: str = "",
    limit: int = Query(default=24, ge=1, le=100),
) -> Page[CampListItem]:
    offset = _offset(cursor)
    items, total = await service.list_camps(
        district_code=district_code,
        taluk=taluk,
        lsg_name=lsg_name,
        status=status,
        verified_only=verified_only,
        q=q,
        lat=lat,
        lng=lng,
        sort=sort,
        offset=offset,
        limit=limit,
    )
    return _page(items, total, offset, limit)


@router.post("/camps/batch", response_model=list[CampListItem])
async def camps_batch(
    payload: CampBatchRequest,
    service: CampsServiceDep,
) -> list[CampListItem]:
    return await service.camps_by_ids(payload.ids[:500])


@router.get("/camps/{camp_id}", response_model=CampDetail)
async def get_camp(camp_id: str, service: CampsServiceDep) -> CampDetail:
    camp = await service.get_camp(camp_id)
    if camp is None:
        raise NotFoundError("That camp is not listed")
    return camp


@router.get("/camps/{camp_id}/needs", response_model=list[CampNeed])
async def camp_needs(camp_id: str, service: CampsServiceDep) -> list[CampNeed]:
    return await service.camp_needs(camp_id)


@router.get("/needs", response_model=Page[CampNeed])
async def list_needs(
    service: CampsServiceDep,
    district_code: str | None = None,
    item_key: str | None = None,
    cursor: str = "",
    limit: int = Query(default=30, ge=1, le=100),
) -> Page[CampNeed]:
    offset = _offset(cursor)
    items, total = await service.list_needs(
        district_code=district_code, item_key=item_key, offset=offset, limit=limit
    )
    return _page(items, total, offset, limit)
