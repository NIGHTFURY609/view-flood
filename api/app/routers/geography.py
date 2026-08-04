from __future__ import annotations

from fastapi import APIRouter, Response

from app.deps import RestDep
from app.schemas.camps import District, EmergencyContact, LsgBody, Taluk

router = APIRouter(tags=["geography"])

# Districts, taluks and LSG bodies change essentially never.
CACHE_HEADER = "public, max-age=3600"


@router.get("/geography/districts", response_model=list[District])
async def districts(response: Response, rest: RestDep) -> list[District]:
    response.headers["Cache-Control"] = CACHE_HEADER
    rows, _ = await rest.select(
        "districts",
        params={
            "select": "code,name,name_ml,latitude,longitude,sort_order",
            "order": "sort_order",
        },
        limit=50,
    )
    return [District.model_validate(row) for row in rows]


@router.get("/geography/taluks", response_model=list[Taluk])
async def taluks(
    response: Response,
    rest: RestDep,
    district_code: str | None = None,
) -> list[Taluk]:
    response.headers["Cache-Control"] = CACHE_HEADER
    params: dict[str, str] = {"select": "id,district_code,name,name_ml", "order": "name"}
    if district_code:
        params["district_code"] = f"eq.{district_code}"
    rows, _ = await rest.select("taluks", params=params, limit=200)
    return [Taluk.model_validate(row) for row in rows]


@router.get("/geography/lsg-bodies", response_model=list[LsgBody])
async def lsg_bodies(
    response: Response,
    rest: RestDep,
    district_code: str | None = None,
    taluk: str | None = None,
) -> list[LsgBody]:
    response.headers["Cache-Control"] = CACHE_HEADER
    params: dict[str, str] = {
        "select": "id,district_code,taluk_name,lsg_type,name,name_ml",
        "order": "name",
    }
    if district_code:
        params["district_code"] = f"eq.{district_code}"
    if taluk:
        params["taluk_name"] = f"eq.{taluk}"
    rows, _ = await rest.select("lsg_bodies", params=params, limit=1000)
    return [LsgBody.model_validate(row) for row in rows]


@router.get("/emergency-contacts", response_model=list[EmergencyContact])
async def emergency_contacts(
    rest: RestDep,
    district_code: str | None = None,
) -> list[EmergencyContact]:
    params: dict[str, str] = {
        "select": "id,scope,district_code,label,label_ml,phone,sort_order",
        "active": "is.true",
        "order": "sort_order",
    }
    if district_code:
        # State numbers always come back; district ones are additive.
        params["or"] = f"(scope.eq.state,district_code.eq.{district_code})"
    else:
        params["scope"] = "eq.state"

    rows, _ = await rest.select("emergency_contacts", params=params, limit=100)
    return [EmergencyContact.model_validate(row) for row in rows]
