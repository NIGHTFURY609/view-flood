"""Camp read logic.

Every filter that the prototype ran in the browser over a 3,000-row download now
runs server-side. The table holds 6,383 rows; a phone should never see more than
a page of them.
"""

from __future__ import annotations

import math
from typing import Any

from app.db.supabase_rest import SupabaseRest
from app.schemas.camps import (
    PUBLIC_VERIFICATION_STATES,
    CampDetail,
    CampListItem,
    CampNeed,
    CampNeedSummary,
)

EARTH_RADIUS_KM = 6371.0

# Columns the public list view needs. Explicit, never SELECT *.
LIST_COLUMNS = (
    "id,name,name_ml,district_code,taluk,lsg_name,village_or_locality,"
    "latitude,longitude,status,verification_state,urgency,reported_urgency,"
    "camp_phone_primary,amenities,reported_people_count,reported_family_count,"
    "reported_children_count,checkin_count,report_count,status_last_confirmed_at,updated_at"
)

NEED_COLUMNS = (
    "id,camp_id,item_key,label,unit,needed_qty,pledged_qty,urgency,note,updated_at"
)

DETAIL_COLUMNS = (
    LIST_COLUMNS + ",building_type,lsg_type,landmark,camp_incharge_name,"
    "camp_phone_secondary,verified_at,verification_method,verification_note,"
    "occupancy_updated_at,source_published_at"
)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.sin(d_lng / 2) ** 2 * math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _status_filter(status: str) -> dict[str, str]:
    """Translate the UI's status vocabulary into PostgREST predicates.

    'predesignated' is the default view: government-sheet rows nobody has
    reported on yet (report_count = 0 and not active).
    """
    if status == "active":
        return {"status": "eq.active"}
    if status == "inactive":
        return {"status": "eq.inactive"}
    if status == "predesignated":
        return {"report_count": "eq.0", "status": "neq.active"}
    return {}


class CampsService:
    def __init__(self, rest: SupabaseRest) -> None:
        self._rest = rest

    async def list_camps(
        self,
        *,
        district_code: str | None = None,
        taluk: str | None = None,
        lsg_name: str | None = None,
        amenities: str | None = None,
        status: str = "active",
        verified_only: bool = False,
        q: str | None = None,
        lat: float | None = None,
        lng: float | None = None,
        sort: str = "urgency",
        offset: int = 0,
        limit: int = 24,
    ) -> tuple[list[CampListItem], int | None]:
        params: dict[str, Any] = {
            "select": LIST_COLUMNS,
            "verification_state": f"in.({','.join(PUBLIC_VERIFICATION_STATES)})",
        }
        params.update(_status_filter(status))

        if district_code:
            params["district_code"] = f"eq.{district_code}"
        if taluk:
            params["taluk"] = f"eq.{taluk}"
        if lsg_name:
            params["lsg_name"] = f"eq.{lsg_name}"
        if verified_only:
            params["verification_state"] = "eq.verified"
        if amenities:
            keys = [a.strip() for a in amenities.split(",") if a.strip()]
            if keys:
                # Array contains — "has ALL of these facilities".
                params["amenities"] = "cs.{" + ",".join(keys) + "}"
        if q:
            # Case-insensitive match across the name fields and the landmark.
            escaped = q.replace(",", " ").replace("*", "")
            params["or"] = (
                f"(name.ilike.*{escaped}*,name_ml.ilike.*{escaped}*,"
                f"village_or_locality.ilike.*{escaped}*,landmark.ilike.*{escaped}*)"
            )

        geo_sorted = sort == "distance" and lat is not None and lng is not None

        if geo_sorted:
            # Distance ordering cannot be expressed in PostgREST. Narrow with a
            # bounding box first so we rank a few hundred rows, never 6,383.
            # (The asyncpg path replaces this with a PostGIS KNN query.)
            span_deg = 1.0  # ~110 km
            params["latitude"] = f"gte.{lat - span_deg}"
            params["longitude"] = f"gte.{lng - span_deg}"
            params["and"] = f"(latitude.lte.{lat + span_deg},longitude.lte.{lng + span_deg})"
            rows, total = await self._rest.select(
                "camps", params=params, offset=0, limit=500, want_count=True
            )
        else:
            params["order"] = (
                "urgency.desc,status_last_confirmed_at.desc.nullslast"
                if sort == "urgency"
                else "updated_at.desc"
            )
            rows, total = await self._rest.select(
                "camps", params=params, offset=offset, limit=limit, want_count=True
            )

        items = [CampListItem.model_validate(row) for row in rows]

        if geo_sorted and lat is not None and lng is not None:
            for item in items:
                if item.latitude is not None and item.longitude is not None:
                    item.distance_km = round(
                        haversine_km(lat, lng, item.latitude, item.longitude), 2
                    )
            items.sort(key=lambda c: (c.distance_km is None, c.distance_km or 0.0))
            total = len(items)
            items = items[offset : offset + limit]

        await self._attach_top_needs(items)
        return items, total

    async def _attach_top_needs(self, items: list[CampListItem]) -> None:
        """One extra query for the whole page, not one per card."""
        if not items:
            return

        ids = ",".join(item.id for item in items)
        rows, _ = await self._rest.select(
            "camp_needs",
            params={
                "select": "camp_id,item_key,urgency",
                "camp_id": f"in.({ids})",
                "order": "urgency.desc",
            },
            limit=len(items) * 8,
        )

        by_camp: dict[str, list[CampNeedSummary]] = {}
        for row in rows:
            bucket = by_camp.setdefault(row["camp_id"], [])
            if len(bucket) < 5:
                bucket.append(CampNeedSummary(item_key=row["item_key"], urgency=row["urgency"]))

        for item in items:
            item.top_needs = by_camp.get(item.id, [])

    async def get_camp(self, camp_id: str) -> CampDetail | None:
        row = await self._rest.select_one(
            "camps",
            params={
                "select": DETAIL_COLUMNS,
                "id": f"eq.{camp_id}",
                "verification_state": f"in.({','.join(PUBLIC_VERIFICATION_STATES)})",
            },
        )
        if row is None:
            return None
        return CampDetail.model_validate(row)

    async def camps_by_ids(self, ids: list[str]) -> list[CampListItem]:
        if not ids:
            return []
        # Chunked because a few hundred UUIDs would blow the URL length limit.
        out: list[CampListItem] = []
        for start in range(0, len(ids), 100):
            chunk = ids[start : start + 100]
            rows, _ = await self._rest.select(
                "camps",
                params={
                    "select": LIST_COLUMNS,
                    "id": f"in.({','.join(chunk)})",
                    "verification_state": f"in.({','.join(PUBLIC_VERIFICATION_STATES)})",
                },
                limit=len(chunk),
            )
            out.extend(CampListItem.model_validate(row) for row in rows)
        return out

    async def camp_needs(self, camp_id: str) -> list[CampNeed]:
        rows, _ = await self._rest.select(
            "camp_needs",
            params={
                "select": NEED_COLUMNS,
                "camp_id": f"eq.{camp_id}",
                "order": "urgency.desc,item_key.asc",
            },
            limit=50,
        )
        return [CampNeed.model_validate(row) for row in rows]

    async def list_needs(
        self,
        *,
        district_code: str | None = None,
        item_key: str | None = None,
        offset: int = 0,
        limit: int = 30,
    ) -> tuple[list[CampNeed], int | None]:
        params: dict[str, Any] = {
            "select": NEED_COLUMNS,
            "order": "urgency.desc,updated_at.desc",
        }
        if item_key:
            params["item_key"] = f"eq.{item_key}"

        if district_code:
            # camp_needs has no district column; resolve camp ids first.
            camp_rows, _ = await self._rest.select(
                "camps",
                params={"select": "id", "district_code": f"eq.{district_code}"},
                limit=1000,
            )
            ids = [row["id"] for row in camp_rows]
            if not ids:
                return [], 0
            params["camp_id"] = f"in.({','.join(ids)})"

        rows, total = await self._rest.select(
            "camp_needs", params=params, offset=offset, limit=limit, want_count=True
        )
        return [CampNeed.model_validate(row) for row in rows], total
