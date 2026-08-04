from __future__ import annotations

from fastapi import APIRouter, Response

from app.deps import DatabaseDep, RestDep
from app.schemas.camps import District, EmergencyContact, LsgBody, Taluk

router = APIRouter(tags=["geography"])

# Districts, taluks and LSG bodies change essentially never.
CACHE_HEADER = "public, max-age=3600"


@router.get("/geography/districts", response_model=list[District])
async def districts(response: Response, db: DatabaseDep, rest: RestDep) -> list[District]:
    response.headers["Cache-Control"] = CACHE_HEADER

    if db.configured:
        rows = await db.fetch(
            """
            SELECT code, name, name_ml, latitude, longitude, sort_order
            FROM districts ORDER BY sort_order
            """
        )
        return [District.model_validate(dict(row)) for row in rows]

    rows_rest, _ = await rest.select(
        "districts",
        params={
            "select": "code,name,name_ml,latitude,longitude,sort_order",
            "order": "sort_order",
        },
        limit=50,
    )
    return [District.model_validate(row) for row in rows_rest]


@router.get("/geography/taluks", response_model=list[Taluk])
async def taluks(
    response: Response,
    db: DatabaseDep,
    rest: RestDep,
    district_code: str | None = None,
) -> list[Taluk]:
    response.headers["Cache-Control"] = CACHE_HEADER

    if db.configured:
        rows = await db.fetch(
            """
            SELECT id, district_code, name, name_ml
            FROM taluks
            WHERE ($1::text IS NULL OR district_code = $1)
            ORDER BY name
            """,
            district_code,
        )
        return [Taluk.model_validate({**dict(r), "id": str(r["id"])}) for r in rows]

    params: dict[str, str] = {"select": "id,district_code,name,name_ml", "order": "name"}
    if district_code:
        params["district_code"] = f"eq.{district_code}"
    rows_rest, _ = await rest.select("taluks", params=params, limit=200)
    return [Taluk.model_validate(row) for row in rows_rest]


@router.get("/geography/lsg-bodies", response_model=list[LsgBody])
async def lsg_bodies(
    response: Response,
    db: DatabaseDep,
    rest: RestDep,
    district_code: str | None = None,
    taluk: str | None = None,
) -> list[LsgBody]:
    response.headers["Cache-Control"] = CACHE_HEADER

    if db.configured:
        rows = await db.fetch(
            """
            SELECT id, district_code, taluk_name, lsg_type, name, name_ml
            FROM lsg_bodies
            WHERE ($1::text IS NULL OR district_code = $1)
              AND ($2::text IS NULL OR taluk_name = $2)
            ORDER BY name
            """,
            district_code,
            taluk,
        )
        return [LsgBody.model_validate({**dict(r), "id": str(r["id"])}) for r in rows]

    params: dict[str, str] = {
        "select": "id,district_code,taluk_name,lsg_type,name,name_ml",
        "order": "name",
    }
    if district_code:
        params["district_code"] = f"eq.{district_code}"
    if taluk:
        params["taluk_name"] = f"eq.{taluk}"
    rows_rest, _ = await rest.select("lsg_bodies", params=params, limit=1000)
    return [LsgBody.model_validate(row) for row in rows_rest]


@router.get("/emergency-contacts", response_model=list[EmergencyContact])
async def emergency_contacts(
    db: DatabaseDep,
    rest: RestDep,
    district_code: str | None = None,
) -> list[EmergencyContact]:
    if db.configured:
        # State numbers always come back; district ones are additive.
        rows = await db.fetch(
            """
            SELECT id, scope, district_code, label, label_ml, phone, sort_order
            FROM emergency_contacts
            WHERE active = true
              AND (scope = 'state' OR ($1::text IS NOT NULL AND district_code = $1))
            ORDER BY sort_order
            """,
            district_code,
        )
        return [
            EmergencyContact.model_validate({**dict(r), "id": str(r["id"])}) for r in rows
        ]

    params: dict[str, str] = {
        "select": "id,scope,district_code,label,label_ml,phone,sort_order",
        "active": "is.true",
        "order": "sort_order",
    }
    if district_code:
        params["or"] = f"(scope.eq.state,district_code.eq.{district_code})"
    else:
        params["scope"] = "eq.state"

    rows_rest, _ = await rest.select("emergency_contacts", params=params, limit=100)
    return [EmergencyContact.model_validate(row) for row in rows_rest]
