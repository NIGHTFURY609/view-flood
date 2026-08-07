"""Camp reads over direct Postgres.

This is the real read path. `camps_service.CampsService` (PostgREST) remains as
a fallback for running without database credentials, but once SUPABASE_DB_URL is
set this takes over — otherwise reads and writes would target different
databases and a freshly submitted report would be invisible in the list.

Everything the prototype did in the browser over a 3,000-row download happens
here in SQL: filtering, search, pagination and distance ranking.
"""

from __future__ import annotations

from typing import Any

import asyncpg

from app.db.session import Database
from app.schemas.camps import CampDetail, CampListItem, CampNeed, CampNeedSummary
from app.services.audit_service import write_audit

# Compact snapshot recorded in audit_log before/after admin mutations.
AUDIT_SNAPSHOT_COLUMNS = (
    "id, name, district_code, taluk, lsg_name, status, verification_state, "
    "reviewed_at, verified_at, camp_incharge_name, camp_phone_primary, camp_phone_secondary"
)

# Explicit column lists. Never SELECT * — the response model is the
# data-exposure boundary and it should be obvious what crosses it.
LIST_COLUMNS = """
    id, name, name_ml, district_code, taluk, lsg_name, village_or_locality,
    latitude, longitude, status, verification_state, urgency, reported_urgency,
    camp_phone_primary, report_count,
    status_last_confirmed_at, updated_at
"""

DETAIL_COLUMNS = (
    LIST_COLUMNS
    + """,
    building_type, lsg_type, landmark, camp_incharge_name, camp_phone_secondary,
    verified_at, verification_method, verification_note,
    source_published_at
"""
)

NEED_COLUMNS = """
    id, camp_id, item_key, label, unit, needed_qty, pledged_qty, urgency, note, updated_at
"""

PUBLIC_STATES = ("unverified", "verified")


def _row_to_list_item(row: asyncpg.Record, distance_km: float | None = None) -> CampListItem:
    data: dict[str, Any] = dict(row)
    data["id"] = str(data["id"])
    data["latitude"] = float(data["latitude"]) if data.get("latitude") is not None else None
    data["longitude"] = float(data["longitude"]) if data.get("longitude") is not None else None
    data["distance_km"] = distance_km
    data.pop("distance_m", None)
    data["top_needs"] = []
    return CampListItem.model_validate(data)


def _row_to_detail(row: asyncpg.Record) -> CampDetail:
    data: dict[str, Any] = dict(row)
    data["id"] = str(data["id"])
    data["latitude"] = float(data["latitude"]) if data.get("latitude") is not None else None
    data["longitude"] = float(data["longitude"]) if data.get("longitude") is not None else None
    data["distance_km"] = None
    data["top_needs"] = []
    data["sources"] = []
    return CampDetail.model_validate(data)


# Columns the admin edit form is allowed to write. Fixed whitelist — the SET
# clause is built from these names, never from caller-supplied keys.
ADMIN_EDITABLE_COLUMNS = (
    "name",
    "name_ml",
    "district_code",
    "taluk",
    "lsg_name",
    "village_or_locality",
    "landmark",
    "camp_incharge_name",
    "camp_phone_primary",
    "camp_phone_secondary",
    "status",
)


class CampsSqlService:
    def __init__(self, db: Database) -> None:
        self._db = db

    async def list_camps(
        self,
        *,
        district_code: str | None = None,
        taluk: str | None = None,
        lsg_name: str | None = None,
        status: str = "active",
        verified_only: bool = False,
        q: str | None = None,
        lat: float | None = None,
        lng: float | None = None,
        sort: str = "urgency",
        offset: int = 0,
        limit: int = 24,
    ) -> tuple[list[CampListItem], int | None]:
        # $1 is always the allowed-state list, so it is always referenced —
        # rewriting the predicate instead would leave $1 unbound.
        states = ["verified"] if verified_only else list(PUBLIC_STATES)
        where: list[str] = ["verification_state = ANY($1::verification_state[])"]
        args: list[Any] = [states]

        def add(clause: str, value: Any) -> None:
            args.append(value)
            where.append(clause.format(n=len(args)))

        if status == "active":
            where.append("status = 'active'")
        elif status == "inactive":
            where.append("status = 'inactive'")
        elif status == "predesignated":
            where.append("report_count = 0 AND status <> 'active'")

        if district_code:
            add("district_code = ${n}", district_code)
        if taluk:
            add("taluk = ${n}", taluk)
        if lsg_name:
            add("lsg_name = ${n}", lsg_name)
        if q:
            # Trigram-backed; matches substrings the way people actually search.
            add(
                "(name ILIKE '%' || ${n} || '%' OR name_ml ILIKE '%' || ${n} || '%' "
                "OR village_or_locality ILIKE '%' || ${n} || '%' "
                "OR landmark ILIKE '%' || ${n} || '%')",
                q,
            )

        clause = " AND ".join(where)
        geo = sort == "distance" and lat is not None and lng is not None

        async with self._db.acquire() as connection:
            total = await connection.fetchval(
                f"SELECT count(*) FROM camps WHERE {clause}", *args
            )

            if geo:
                # Indexed radius shortlist, then exact ordering by true distance.
                args.extend([lat, lng, limit, offset])
                lat_i, lng_i = len(args) - 3, len(args) - 2
                limit_i, offset_i = len(args) - 1, len(args)
                rows = await connection.fetch(
                    f"""
                    SELECT {LIST_COLUMNS},
                           earth_distance(
                               ll_to_earth(${lat_i}, ${lng_i}),
                               ll_to_earth(latitude::float8, longitude::float8)
                           ) AS distance_m
                    FROM camps
                    WHERE {clause}
                      AND latitude IS NOT NULL AND longitude IS NOT NULL
                    ORDER BY distance_m ASC
                    LIMIT ${limit_i} OFFSET ${offset_i}
                    """,
                    *args,
                )
                items = [
                    _row_to_list_item(row, round(float(row["distance_m"]) / 1000, 2))
                    for row in rows
                ]
            else:
                order = (
                    "urgency DESC, status_last_confirmed_at DESC NULLS LAST"
                    if sort == "urgency"
                    else "updated_at DESC"
                )
                args.extend([limit, offset])
                rows = await connection.fetch(
                    f"""
                    SELECT {LIST_COLUMNS}
                    FROM camps
                    WHERE {clause}
                    ORDER BY {order}, id DESC
                    LIMIT ${len(args) - 1} OFFSET ${len(args)}
                    """,
                    *args,
                )
                items = [_row_to_list_item(row) for row in rows]

            await self._attach_top_needs(connection, items)

        return items, total

    async def admin_list_camps(
        self,
        *,
        q: str | None = None,
        phone: str | None = None,
        district_code: str | None = None,
        taluk: str | None = None,
        lsg_name: str | None = None,
        verification: str = "all",
        reviewed: str = "all",
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[CampListItem], int]:
        """Admin listing: every status, all verification states, phone search.

        Unlike the public path this exposes both active and inactive camps and
        can isolate the unverified queue — filters the public endpoint has no
        reason to offer. `reviewed` narrows to the Reported queue (unreviewed).
        """
        if verification == "verified":
            states = ["verified"]
        elif verification == "unverified":
            states = ["unverified"]
        else:
            states = list(PUBLIC_STATES)

        where: list[str] = ["verification_state = ANY($1::verification_state[])"]
        args: list[Any] = [states]

        if reviewed == "unreviewed":
            where.append("reviewed_at IS NULL")
        elif reviewed == "reviewed":
            where.append("reviewed_at IS NOT NULL")

        def add(clause: str, value: Any) -> None:
            args.append(value)
            where.append(clause.format(n=len(args)))

        if district_code:
            add("district_code = ${n}", district_code)
        if taluk:
            add("taluk = ${n}", taluk)
        if lsg_name:
            add("lsg_name = ${n}", lsg_name)
        if q:
            add(
                "(name ILIKE '%' || ${n} || '%' OR name_ml ILIKE '%' || ${n} || '%' "
                "OR village_or_locality ILIKE '%' || ${n} || '%')",
                q,
            )
        if phone:
            add(
                "(camp_phone_primary ILIKE '%' || ${n} || '%' "
                "OR camp_phone_secondary ILIKE '%' || ${n} || '%')",
                phone,
            )

        clause = " AND ".join(where)

        async with self._db.acquire() as connection:
            total = await connection.fetchval(
                f"SELECT count(*) FROM camps WHERE {clause}", *args
            )
            args.extend([limit, offset])
            rows = await connection.fetch(
                f"""
                SELECT {LIST_COLUMNS}
                FROM camps
                WHERE {clause}
                ORDER BY updated_at DESC, id DESC
                LIMIT ${len(args) - 1} OFFSET ${len(args)}
                """,
                *args,
            )
            items = [_row_to_list_item(row) for row in rows]
            await self._attach_top_needs(connection, items)

        return items, int(total or 0)

    async def _attach_top_needs(
        self, connection: asyncpg.Connection, items: list[CampListItem]
    ) -> None:
        """One query for the page, not one per card."""
        if not items:
            return

        rows = await connection.fetch(
            """
            SELECT camp_id, item_key, urgency, label
            FROM (
                SELECT camp_id, item_key, urgency, label,
                       row_number() OVER (PARTITION BY camp_id ORDER BY urgency DESC) AS rn
                FROM camp_needs
                WHERE camp_id = ANY($1::uuid[])
            ) ranked
            WHERE rn <= 5
            """,
            [item.id for item in items],
        )

        by_camp: dict[str, list[CampNeedSummary]] = {}
        for row in rows:
            by_camp.setdefault(str(row["camp_id"]), []).append(
                CampNeedSummary(
                    item_key=row["item_key"], urgency=row["urgency"], label=row["label"]
                )
            )

        for item in items:
            item.top_needs = by_camp.get(item.id, [])

    async def get_camp(self, camp_id: str) -> CampDetail | None:
        row = await self._db.fetchrow(
            f"""
            SELECT {DETAIL_COLUMNS}
            FROM camps
            WHERE id = $1::uuid AND verification_state = ANY($2::verification_state[])
            """,
            camp_id,
            list(PUBLIC_STATES),
        )
        if row is None:
            return None

        data: dict[str, Any] = dict(row)
        data["id"] = str(data["id"])
        data["latitude"] = float(data["latitude"]) if data.get("latitude") is not None else None
        data["longitude"] = float(data["longitude"]) if data.get("longitude") is not None else None
        data["distance_km"] = None
        data["top_needs"] = []
        data["sources"] = []
        return CampDetail.model_validate(data)

    async def admin_get_camp(self, camp_id: str) -> CampDetail | None:
        """Detail for the admin — any verification state, unlike the public path."""
        row = await self._db.fetchrow(
            f"SELECT {DETAIL_COLUMNS} FROM camps WHERE id = $1::uuid", camp_id
        )
        return _row_to_detail(row) if row is not None else None

    @staticmethod
    async def _snapshot(conn: asyncpg.Connection, camp_id: str) -> dict[str, Any] | None:
        row = await conn.fetchrow(
            f"SELECT {AUDIT_SNAPSHOT_COLUMNS} FROM camps WHERE id = $1::uuid", camp_id
        )
        return dict(row) if row is not None else None

    async def admin_update_camp(
        self, camp_id: str, fields: dict[str, Any], admin_id: str
    ) -> CampDetail | None:
        """Update whitelisted columns, audit the before/after, return fresh detail."""
        updates = {k: v for k, v in fields.items() if k in ADMIN_EDITABLE_COLUMNS}
        async with self._db.transaction() as conn:
            before = await self._snapshot(conn, camp_id)
            if before is None:
                return None
            if updates:
                cols = list(updates.keys())
                set_clause = ", ".join(f"{col} = ${i + 1}" for i, col in enumerate(cols))
                args: list[Any] = [updates[col] for col in cols]
                args.append(camp_id)
                await conn.execute(
                    f"UPDATE camps SET {set_clause}, updated_at = now() "
                    f"WHERE id = ${len(args)}::uuid",
                    *args,
                )
                after = await self._snapshot(conn, camp_id)
                await write_audit(
                    conn, actor_type="admin", actor_id=admin_id, action="camp_updated",
                    entity_type="camp", entity_id=camp_id, before=before, after=after,
                )
        return await self.admin_get_camp(camp_id)

    async def admin_approve(self, camp_id: str, admin_id: str) -> CampDetail | None:
        """Approve a reported camp — verified, reviewed, shown in the public app."""
        async with self._db.transaction() as conn:
            before = await self._snapshot(conn, camp_id)
            if before is None:
                return None
            await conn.execute(
                """
                UPDATE camps
                SET verification_state = 'verified', verified_at = now(),
                    reviewed_at = now(), updated_at = now()
                WHERE id = $1::uuid
                """,
                camp_id,
            )
            after = await self._snapshot(conn, camp_id)
            await write_audit(
                conn, actor_type="admin", actor_id=admin_id, action="camp_approved",
                entity_type="camp", entity_id=camp_id, before=before, after=after,
            )
        return await self.admin_get_camp(camp_id)

    async def admin_reject(
        self, camp_id: str, admin_id: str, note: str | None = None
    ) -> CampDetail | None:
        """Reject a reported camp — stays unverified, marked reviewed (leaves queue)."""
        async with self._db.transaction() as conn:
            before = await self._snapshot(conn, camp_id)
            if before is None:
                return None
            await conn.execute(
                "UPDATE camps SET reviewed_at = now(), updated_at = now() WHERE id = $1::uuid",
                camp_id,
            )
            after = await self._snapshot(conn, camp_id)
            await write_audit(
                conn, actor_type="admin", actor_id=admin_id, action="camp_rejected",
                entity_type="camp", entity_id=camp_id, before=before, after=after, note=note,
            )
        return await self.admin_get_camp(camp_id)

    async def admin_delete_camp(self, camp_id: str, admin_id: str) -> bool:
        """Hard delete. Dependents cascade / null out via FK rules. Audited first."""
        async with self._db.transaction() as conn:
            before = await self._snapshot(conn, camp_id)
            if before is None:
                return False
            await conn.execute("DELETE FROM camps WHERE id = $1::uuid", camp_id)
            await write_audit(
                conn, actor_type="admin", actor_id=admin_id, action="camp_deleted",
                entity_type="camp", entity_id=camp_id, before=before, after=None,
            )
        return True

    async def admin_camp_reports(self, camp_id: str) -> list[dict[str, Any]]:
        """Reporter submissions for a camp — admin review context (PII, staff only)."""
        rows = await self._db.fetch(
            """
            SELECT reference_code, reporter_name, reporter_phone_primary,
                   reporter_phone_secondary, reporter_relationship, reported_status,
                   reported_urgency, reported_urgency_reason, auto_flags,
                   phone_unverified, submitted_at
            FROM reports
            WHERE camp_id = $1::uuid
            ORDER BY submitted_at DESC
            """,
            camp_id,
        )
        return [dict(r) for r in rows]

    async def admin_audit_log(
        self,
        *,
        entity_type: str | None = None,
        action: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[dict[str, Any]], int]:
        where: list[str] = []
        args: list[Any] = []

        def add(clause: str, value: Any) -> None:
            args.append(value)
            where.append(clause.format(n=len(args)))

        if entity_type:
            add("entity_type = ${n}", entity_type)
        if action:
            add("action = ${n}", action)
        clause = (" WHERE " + " AND ".join(where)) if where else ""

        async with self._db.acquire() as conn:
            total = await conn.fetchval(f"SELECT count(*) FROM audit_log{clause}", *args)
            args.extend([limit, offset])
            rows = await conn.fetch(
                f"""
                SELECT id, created_at, actor_type, actor_id, entity_type,
                       entity_id, action, note
                FROM audit_log{clause}
                ORDER BY created_at DESC
                LIMIT ${len(args) - 1} OFFSET ${len(args)}
                """,
                *args,
            )
        return [dict(r) for r in rows], int(total or 0)

    async def camps_by_ids(self, ids: list[str]) -> list[CampListItem]:
        if not ids:
            return []
        rows = await self._db.fetch(
            f"""
            SELECT {LIST_COLUMNS}
            FROM camps
            WHERE id = ANY($1::uuid[]) AND verification_state = ANY($2::verification_state[])
            """,
            ids[:500],
            list(PUBLIC_STATES),
        )
        return [_row_to_list_item(row) for row in rows]

    async def camp_needs(self, camp_id: str) -> list[CampNeed]:
        rows = await self._db.fetch(
            f"""
            SELECT {NEED_COLUMNS}
            FROM camp_needs
            WHERE camp_id = $1::uuid
            ORDER BY urgency DESC, item_key ASC
            """,
            camp_id,
        )
        return [
            CampNeed.model_validate({**dict(r), "id": str(r["id"]), "camp_id": str(r["camp_id"])})
            for r in rows
        ]

    async def list_needs(
        self,
        *,
        district_code: str | None = None,
        item_key: str | None = None,
        offset: int = 0,
        limit: int = 30,
    ) -> tuple[list[CampNeed], int | None]:
        where: list[str] = ["TRUE"]
        args: list[Any] = []

        if district_code:
            args.append(district_code)
            where.append(
                f"camp_id IN (SELECT id FROM camps WHERE district_code = ${len(args)})"
            )
        if item_key:
            args.append(item_key)
            where.append(f"item_key = ${len(args)}")

        clause = " AND ".join(where)

        async with self._db.acquire() as connection:
            total = await connection.fetchval(
                f"SELECT count(*) FROM camp_needs WHERE {clause}", *args
            )
            args.extend([limit, offset])
            rows = await connection.fetch(
                f"""
                SELECT {NEED_COLUMNS}
                FROM camp_needs
                WHERE {clause}
                ORDER BY urgency DESC, updated_at DESC
                LIMIT ${len(args) - 1} OFFSET ${len(args)}
                """,
                *args,
            )

        items = [
            CampNeed.model_validate({**dict(r), "id": str(r["id"]), "camp_id": str(r["camp_id"])})
            for r in rows
        ]
        return items, total
