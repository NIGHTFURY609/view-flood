"""Requirement requests — moderated intake for camp needs.

A submission is inert until an admin approves it. Approval is the only path from
camp_requirements into camp_needs, so nothing a stranger types is ever published
directly on a camp page.

This form has no OTP (product decision), so it is the one public write with no
phone verification behind it. The count windows below are the only thing between
the admin queue and a flood; they mirror OtpService's soft-limit pattern.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import asyncpg

from app.core.errors import ConflictError, NotFoundError, RateLimitedError
from app.schemas.requirements import (
    OTHER_ITEM_KEY,
    RequirementIn,
    catalogue_unit,
    slug_item_key,
)
from app.services.audit_service import write_audit

MAX_SUBMISSIONS_PER_IP_PER_HOUR = 5
MAX_SUBMISSIONS_PER_PHONE_PER_DAY = 10

_ITEM_COLUMNS = "id, category, item_key, label, unit, quantity"


@dataclass(frozen=True)
class SubmitResult:
    requirement_id: str
    item_count: int


class RequirementService:
    async def submit(
        self,
        connection: asyncpg.Connection,
        *,
        camp_id: str,
        payload: RequirementIn,
        ip_hash: str,
    ) -> SubmitResult:
        camp = await connection.fetchrow(
            "SELECT id FROM camps WHERE id = $1::uuid", camp_id
        )
        if camp is None:
            raise NotFoundError("That camp is not listed")

        await self._check_limits(connection, ip_hash=ip_hash, phone=payload.submitter_phone)

        requirement_id = await connection.fetchval(
            """
            INSERT INTO camp_requirements (
                camp_id, submitter_name, submitter_phone, note, ip_hash
            )
            VALUES ($1::uuid, $2, $3, $4, $5)
            RETURNING id
            """,
            camp_id,
            payload.submitter_name.strip(),
            payload.submitter_phone,
            payload.note.strip() if payload.note else None,
            ip_hash,
        )

        for item in payload.items:
            free_text = item.item_key == OTHER_ITEM_KEY
            label = (item.label or "").strip() or None
            await connection.execute(
                """
                INSERT INTO camp_requirement_items (
                    requirement_id, category, item_key, label, unit, quantity
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                requirement_id,
                item.category,
                slug_item_key(label or "") if free_text else item.item_key,
                label,
                catalogue_unit(item.category, item.item_key),
                item.quantity,
            )

        await write_audit(
            connection,
            actor_type="public",
            action="requirement.submitted",
            entity_type="camp_requirement",
            entity_id=str(requirement_id),
            after={"camp_id": camp_id, "item_count": len(payload.items)},
        )

        return SubmitResult(requirement_id=str(requirement_id), item_count=len(payload.items))

    async def _check_limits(
        self, connection: asyncpg.Connection, *, ip_hash: str, phone: str
    ) -> None:
        """Soft caps. COUNT-then-INSERT with no lock, exactly as OtpService does:
        concurrent requests can exceed a cap by one, which is acceptable here."""
        ip_count = await connection.fetchval(
            """
            SELECT count(*) FROM camp_requirements
            WHERE ip_hash = $1 AND created_at >= now() - interval '1 hour'
            """,
            ip_hash,
        )
        if (ip_count or 0) >= MAX_SUBMISSIONS_PER_IP_PER_HOUR:
            raise RateLimitedError("Too many requests sent from here. Try again in an hour.")

        phone_count = await connection.fetchval(
            """
            SELECT count(*) FROM camp_requirements
            WHERE submitter_phone = $1 AND created_at >= now() - interval '24 hours'
            """,
            phone,
        )
        if (phone_count or 0) >= MAX_SUBMISSIONS_PER_PHONE_PER_DAY:
            raise RateLimitedError("Too many requests sent from this number today.")

    # --- admin reads ---------------------------------------------------------

    async def list_for_admin(
        self,
        connection: asyncpg.Connection,
        *,
        status: str = "pending",
        camp_id: str | None = None,
        q: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[dict[str, Any]], int]:
        where: list[str] = ["TRUE"]
        args: list[Any] = []

        def add(clause: str, value: Any) -> None:
            args.append(value)
            where.append(clause.format(n=len(args)))

        if status != "all":
            add("r.status = ${n}", status)
        if camp_id:
            add("r.camp_id = ${n}::uuid", camp_id)
        if q:
            add(
                "(r.submitter_name ILIKE '%' || ${n} || '%' "
                "OR r.submitter_phone ILIKE '%' || ${n} || '%' "
                "OR c.name ILIKE '%' || ${n} || '%')",
                q,
            )

        clause = " AND ".join(where)

        total = await connection.fetchval(
            f"""
            SELECT count(*) FROM camp_requirements r
            JOIN camps c ON c.id = r.camp_id
            WHERE {clause}
            """,
            *args,
        )

        rows = await connection.fetch(
            f"""
            SELECT r.id, r.camp_id, c.name AS camp_name, r.submitter_name,
                   r.submitter_phone, r.note, r.status, r.reviewed_at,
                   r.review_note, r.created_at
            FROM camp_requirements r
            JOIN camps c ON c.id = r.camp_id
            WHERE {clause}
            ORDER BY r.created_at DESC
            LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}
            """,
            *args,
            limit,
            offset,
        )

        return await self._attach_items(connection, rows), (total or 0)

    async def for_camp(
        self, connection: asyncpg.Connection, camp_id: str
    ) -> list[dict[str, Any]]:
        rows = await connection.fetch(
            """
            SELECT r.id, r.camp_id, c.name AS camp_name, r.submitter_name,
                   r.submitter_phone, r.note, r.status, r.reviewed_at,
                   r.review_note, r.created_at
            FROM camp_requirements r
            JOIN camps c ON c.id = r.camp_id
            WHERE r.camp_id = $1::uuid
            ORDER BY r.created_at DESC
            """,
            camp_id,
        )
        return await self._attach_items(connection, rows)

    async def get_one(
        self, connection: asyncpg.Connection, requirement_id: str
    ) -> dict[str, Any] | None:
        """A single request with its line items — backs the admin detail page."""
        row = await connection.fetchrow(
            """
            SELECT r.id, r.camp_id, c.name AS camp_name, r.submitter_name,
                   r.submitter_phone, r.note, r.status, r.reviewed_at,
                   r.review_note, r.created_at
            FROM camp_requirements r
            JOIN camps c ON c.id = r.camp_id
            WHERE r.id = $1::uuid
            """,
            requirement_id,
        )
        if row is None:
            return None
        rows = await self._attach_items(connection, [row])
        return rows[0]

    async def _attach_items(
        self, connection: asyncpg.Connection, rows: list[asyncpg.Record]
    ) -> list[dict[str, Any]]:
        """One extra query for the whole page, not one per requirement."""
        out = [dict(row) for row in rows]
        for record in out:
            record["id"] = str(record["id"])
            record["camp_id"] = str(record["camp_id"])
            record["items"] = []
        if not out:
            return out

        by_id = {record["id"]: record for record in out}
        items = await connection.fetch(
            f"SELECT requirement_id, {_ITEM_COLUMNS} FROM camp_requirement_items "
            "WHERE requirement_id = ANY($1::uuid[]) ORDER BY id",
            list(by_id),
        )
        for item in items:
            parent = by_id.get(str(item["requirement_id"]))
            if parent is not None:
                parent["items"].append({**dict(item), "id": str(item["id"])})
        return out

    async def list_needs_for_admin(
        self,
        connection: asyncpg.Connection,
        *,
        district_code: str | None = None,
        item_key: str | None = None,
        camp_id: str | None = None,
        q: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[dict[str, Any]], int]:
        """Approved needs (camp_needs) across camps, with a live donation tally."""
        where: list[str] = ["TRUE"]
        args: list[Any] = []

        def add(clause: str, value: Any) -> None:
            args.append(value)
            where.append(clause.format(n=len(args)))

        if district_code:
            add("c.district_code = ${n}", district_code)
        if item_key:
            add("n.item_key = ${n}", item_key)
        if camp_id:
            add("n.camp_id = ${n}::uuid", camp_id)
        if q:
            add("(c.name ILIKE '%' || ${n} || '%' OR n.label ILIKE '%' || ${n} || '%')", q)

        clause = " AND ".join(where)

        total = await connection.fetchval(
            f"""
            SELECT count(*) FROM camp_needs n
            JOIN camps c ON c.id = n.camp_id
            WHERE {clause}
            """,
            *args,
        )

        rows = await connection.fetch(
            f"""
            SELECT n.id, n.camp_id, c.name AS camp_name, c.district_code,
                   n.item_key, n.label, n.unit, n.needed_qty, n.pledged_qty,
                   n.updated_at,
                   (SELECT count(*) FROM need_pledges p WHERE p.need_id = n.id) AS pledge_count
            FROM camp_needs n
            JOIN camps c ON c.id = n.camp_id
            WHERE {clause}
            ORDER BY n.updated_at DESC, n.id DESC
            LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}
            """,
            *args,
            limit,
            offset,
        )

        out = []
        for row in rows:
            record = dict(row)
            record["id"] = str(record["id"])
            record["camp_id"] = str(record["camp_id"])
            record["pledge_count"] = int(record["pledge_count"] or 0)
            out.append(record)
        return out, (total or 0)

    _PLEDGE_ROW = """
        SELECT p.id, p.need_id, n.camp_id, c.name AS camp_name, c.district_code,
               n.item_key, n.label, n.unit, n.needed_qty, p.quantity,
               p.donor_name, p.donor_phone, p.phone_verified, p.admin_verified,
               p.created_at
        FROM need_pledges p
        JOIN camp_needs n ON n.id = p.need_id
        JOIN camps c ON c.id = n.camp_id
    """

    @staticmethod
    def _pledge_dict(row: asyncpg.Record) -> dict[str, Any]:
        record = dict(row)
        record["id"] = str(record["id"])
        record["need_id"] = str(record["need_id"])
        record["camp_id"] = str(record["camp_id"])
        return record

    async def list_pledges_for_admin(
        self,
        connection: asyncpg.Connection,
        *,
        district_code: str | None = None,
        item_key: str | None = None,
        verified: str | None = None,
        q: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[dict[str, Any]], int]:
        """Individual donations across camps — the Donations approval list."""
        where: list[str] = ["TRUE"]
        args: list[Any] = []

        def add(clause: str, value: Any) -> None:
            args.append(value)
            where.append(clause.format(n=len(args)))

        if district_code:
            add("c.district_code = ${n}", district_code)
        if item_key:
            add("n.item_key = ${n}", item_key)
        if verified == "verified":
            where.append("p.admin_verified IS TRUE")
        elif verified == "unverified":
            where.append("p.admin_verified IS FALSE")
        elif verified == "pending":
            where.append("p.admin_verified IS NULL")
        if q:
            add(
                "(c.name ILIKE '%' || ${n} || '%' OR p.donor_name ILIKE '%' || ${n} || '%' "
                "OR p.donor_phone ILIKE '%' || ${n} || '%')",
                q,
            )

        clause = " AND ".join(where)

        total = await connection.fetchval(
            f"""
            SELECT count(*) FROM need_pledges p
            JOIN camp_needs n ON n.id = p.need_id
            JOIN camps c ON c.id = n.camp_id
            WHERE {clause}
            """,
            *args,
        )

        rows = await connection.fetch(
            f"""
            {self._PLEDGE_ROW}
            WHERE {clause}
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}
            """,
            *args,
            limit,
            offset,
        )
        return [self._pledge_dict(r) for r in rows], (total or 0)

    async def get_pledge(
        self, connection: asyncpg.Connection, pledge_id: str
    ) -> dict[str, Any] | None:
        """A single donation with its need/camp context — the detail page."""
        row = await connection.fetchrow(
            f"{self._PLEDGE_ROW} WHERE p.id = $1::uuid", pledge_id
        )
        return self._pledge_dict(row) if row is not None else None

    async def set_pledge_verified(
        self,
        connection: asyncpg.Connection,
        *,
        pledge_id: str,
        admin_id: str,
        verified: bool,
    ) -> dict[str, Any]:
        """Flip a pledge's admin verification; a DB trigger recomputes the need's
        pledged total. Verifying can never take a camp past what it needs."""
        pledge = await connection.fetchrow(
            "SELECT id, need_id, quantity, admin_verified FROM need_pledges "
            "WHERE id = $1::uuid FOR UPDATE",
            pledge_id,
        )
        if pledge is None:
            raise NotFoundError("That donation no longer exists")

        # Cap only bites when a pledge is *becoming* verified (from pending or
        # unverified); re-affirming an already-verified pledge is a no-op.
        if verified and pledge["admin_verified"] is not True:
            need = await connection.fetchrow(
                "SELECT needed_qty, pledged_qty FROM camp_needs WHERE id = $1 FOR UPDATE",
                pledge["need_id"],
            )
            remaining = need["needed_qty"] - need["pledged_qty"]
            if pledge["quantity"] > remaining:
                raise ConflictError(
                    f"Only {max(0, remaining)} still needed — cannot verify {pledge['quantity']}.",
                    code="exceeds_remaining",
                )

        await connection.execute(
            """
            UPDATE need_pledges
               SET admin_verified = $2,
                   verified_at = CASE WHEN $2 THEN now() ELSE NULL END,
                   verified_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END
             WHERE id = $1::uuid
            """,
            pledge_id,
            verified,
            admin_id,
        )
        await write_audit(
            connection,
            actor_type="admin",
            actor_id=admin_id,
            action="pledge_verified" if verified else "pledge_unverified",
            entity_type="need_pledge",
            entity_id=pledge_id,
            before={"admin_verified": pledge["admin_verified"]},
            after={"admin_verified": verified},
        )

        row = await connection.fetchrow(
            f"{self._PLEDGE_ROW} WHERE p.id = $1::uuid", pledge_id
        )
        return self._pledge_dict(row)

    async def pledges_for_need(
        self, connection: asyncpg.Connection, need_id: str
    ) -> list[dict[str, Any]]:
        """Individual donations for a need, newest first. Carries donor PII."""
        rows = await connection.fetch(
            """
            SELECT id, donor_name, donor_phone, quantity, phone_verified, created_at
            FROM need_pledges
            WHERE need_id = $1::uuid
            ORDER BY created_at DESC
            """,
            need_id,
        )
        return [{**dict(row), "id": str(row["id"])} for row in rows]

    async def pending_counts(self, connection: asyncpg.Connection) -> tuple[int, dict[str, int]]:
        rows = await connection.fetch(
            """
            SELECT camp_id, count(*) AS n FROM camp_requirements
            WHERE status = 'pending'
            GROUP BY camp_id
            """
        )
        by_camp = {str(row["camp_id"]): int(row["n"]) for row in rows}
        return sum(by_camp.values()), by_camp

    # --- admin mutations -----------------------------------------------------

    async def approve(
        self, connection: asyncpg.Connection, *, requirement_id: str, admin_id: str
    ) -> None:
        """Publish a requirement: upsert every line item into camp_needs.

        Quantities ADD rather than replace — a camp asking for 100 more blankets
        on top of an outstanding 50 needs 150, not 100.
        """
        requirement = await self._claim(connection, requirement_id)

        items = await connection.fetch(
            f"SELECT {_ITEM_COLUMNS} FROM camp_requirement_items WHERE requirement_id = $1",
            requirement_id,
        )

        for item in items:
            await connection.execute(
                """
                INSERT INTO camp_needs (camp_id, item_key, label, unit, needed_qty)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (camp_id, item_key) DO UPDATE
                   SET needed_qty = camp_needs.needed_qty + EXCLUDED.needed_qty,
                       label      = COALESCE(camp_needs.label, EXCLUDED.label),
                       updated_at = now()
                """,
                requirement["camp_id"],
                item["item_key"],
                item["label"],
                item["unit"],
                item["quantity"],
            )

        await connection.execute(
            """
            UPDATE camp_requirements
               SET status = 'approved', reviewed_at = now(), reviewed_by = $2::uuid
             WHERE id = $1
            """,
            requirement_id,
            admin_id,
        )

        await write_audit(
            connection,
            actor_type="admin",
            actor_id=admin_id,
            action="requirement.approved",
            entity_type="camp_requirement",
            entity_id=requirement_id,
            before={"status": "pending"},
            after={
                "status": "approved",
                "camp_id": str(requirement["camp_id"]),
                "items": [
                    {"item_key": i["item_key"], "quantity": i["quantity"]} for i in items
                ],
            },
        )

    async def reject(
        self,
        connection: asyncpg.Connection,
        *,
        requirement_id: str,
        admin_id: str,
        note: str | None,
    ) -> None:
        await self._claim(connection, requirement_id)

        await connection.execute(
            """
            UPDATE camp_requirements
               SET status = 'rejected', reviewed_at = now(), reviewed_by = $2::uuid,
                   review_note = $3
             WHERE id = $1
            """,
            requirement_id,
            admin_id,
            note,
        )

        await write_audit(
            connection,
            actor_type="admin",
            actor_id=admin_id,
            action="requirement.rejected",
            entity_type="camp_requirement",
            entity_id=requirement_id,
            before={"status": "pending"},
            after={"status": "rejected"},
            note=note,
        )

    async def _claim(
        self, connection: asyncpg.Connection, requirement_id: str
    ) -> asyncpg.Record:
        """Lock the row and refuse anything already reviewed.

        Without this, a double-clicked Approve would add every quantity to
        camp_needs twice.
        """
        row = await connection.fetchrow(
            "SELECT id, camp_id, status FROM camp_requirements WHERE id = $1::uuid FOR UPDATE",
            requirement_id,
        )
        if row is None:
            raise NotFoundError("That request no longer exists")
        if row["status"] != "pending":
            raise ConflictError(f"That request was already {row['status']}")
        return row
