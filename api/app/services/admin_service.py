"""Admin verification portal — PRD §9 item 11.

Nothing here exists in the prototype; duplicates simply accumulated with no way
to resolve them, and the photo "flag" button wrote an audit row and did nothing
else.

Every mutating call writes an audit_log row with the acting admin's id, so
"who published this" is always answerable.
"""

from __future__ import annotations

from typing import Any, Literal

import asyncpg

from app.core.errors import ConflictError, NotFoundError
from app.services.audit_service import write_audit

VerificationMethod = Literal[
    "phone_call", "official_document", "site_visit", "known_contact", "cross_reference"
]

CAMP_SNAPSHOT_COLUMNS = (
    "id, name, district_code, taluk, lsg_name, status, verification_state, "
    "duplicate_of, report_count, verified_at, verified_by, verification_note"
)


def _snapshot(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {k: (str(v) if hasattr(v, "hex") else v) for k, v in dict(row).items()}


class AdminService:
    async def pending_reports(
        self,
        connection: asyncpg.Connection,
        *,
        district_code: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[dict[str, Any]], int]:
        where = ["c.verification_state = 'unverified'"]
        args: list[Any] = []
        if district_code:
            args.append(district_code)
            where.append(f"c.district_code = ${len(args)}")

        clause = " AND ".join(where)

        total = await connection.fetchval(
            f"SELECT count(*) FROM reports r JOIN camps c ON c.id = r.camp_id WHERE {clause}",
            *args,
        )

        rows = await connection.fetch(
            f"""
            SELECT r.id, r.reference_code, r.camp_id, r.is_correction, r.reporter_name,
                   r.reporter_phone_primary, r.reported_status,
                   r.auto_flags, r.submitted_at,
                   c.name AS camp_name, c.district_code, c.taluk, c.lsg_name,
                   c.verification_state
            FROM reports r
            JOIN camps c ON c.id = r.camp_id
            WHERE {clause}
            ORDER BY r.submitted_at DESC
            OFFSET ${len(args) + 1} LIMIT ${len(args) + 2}
            """,
            *args,
            offset,
            limit,
        )

        return [
            {
                "id": str(row["id"]),
                "reference_code": row["reference_code"],
                "camp_id": str(row["camp_id"]) if row["camp_id"] else None,
                "camp_name": row["camp_name"],
                "district_code": row["district_code"],
                "taluk": row["taluk"],
                "lsg_name": row["lsg_name"],
                "is_correction": row["is_correction"],
                # Reporter PII is visible ONLY on admin routes. Never public.
                "reporter_name": row["reporter_name"],
                "reporter_phone": row["reporter_phone_primary"],
                "reported_status": row["reported_status"],
                "auto_flags": row["auto_flags"] or [],
                "submitted_at": row["submitted_at"],
                "verification_state": row["verification_state"],
            }
            for row in rows
        ], (total or 0)

    async def set_verification(
        self,
        connection: asyncpg.Connection,
        *,
        camp_id: str,
        admin_id: str,
        state: Literal["verified", "rejected", "removed", "unverified"],
        method: VerificationMethod | None = None,
        note: str | None = None,
    ) -> dict[str, Any]:
        before = await connection.fetchrow(
            f"SELECT {CAMP_SNAPSHOT_COLUMNS} FROM camps WHERE id = $1::uuid", camp_id
        )
        if before is None:
            raise NotFoundError("That camp does not exist")

        # $2 is bound once but used two ways — as the enum being assigned and as
        # a value compared to a text literal. Without explicit casts Postgres
        # cannot deduce a single type for it and rejects the statement.
        after = await connection.fetchrow(
            f"""
            UPDATE camps
            SET verification_state = $2::verification_state,
                verified_at = CASE WHEN $2::text = 'verified' THEN now() ELSE NULL END,
                verified_by = CASE WHEN $2::text = 'verified' THEN $3::uuid ELSE NULL END,
                verification_method = $4::verification_method,
                verification_note = $5
            WHERE id = $1::uuid
            RETURNING {CAMP_SNAPSHOT_COLUMNS}
            """,
            camp_id,
            state,
            admin_id,
            method,
            note,
        )

        await write_audit(
            connection,
            actor_type="admin",
            actor_id=admin_id,
            action=f"camp_{state}",
            entity_type="camp",
            entity_id=camp_id,
            before=_snapshot(before),
            after=_snapshot(after),
            note=note,
        )
        return _snapshot(after) or {}

    async def merge_camps(
        self,
        connection: asyncpg.Connection,
        *,
        duplicate_id: str,
        canonical_id: str,
        admin_id: str,
        note: str | None = None,
    ) -> dict[str, Any]:
        """Fold a duplicate into the canonical record.

        The duplicate is marked duplicate_held and pointed at the canonical row
        rather than deleted — the PRD requires provenance to survive, and a hard
        delete would orphan the reports that justified the merge.
        """
        if duplicate_id == canonical_id:
            raise ConflictError("A camp cannot be merged into itself")

        duplicate = await connection.fetchrow(
            f"SELECT {CAMP_SNAPSHOT_COLUMNS} FROM camps WHERE id = $1::uuid", duplicate_id
        )
        canonical = await connection.fetchrow(
            "SELECT id FROM camps WHERE id = $1::uuid", canonical_id
        )
        if duplicate is None or canonical is None:
            raise NotFoundError("One of those camps does not exist")

        # Move corroborating evidence onto the surviving record.
        await connection.execute(
            "UPDATE reports SET camp_id = $2::uuid WHERE camp_id = $1::uuid",
            duplicate_id,
            canonical_id,
        )
        await connection.execute(
            "UPDATE report_images SET camp_id = $2::uuid WHERE camp_id = $1::uuid",
            duplicate_id,
            canonical_id,
        )
        await connection.execute(
            """
            UPDATE camps
            SET report_count = report_count + COALESCE(
                    (SELECT report_count FROM camps WHERE id = $2::uuid), 0)
            WHERE id = $1::uuid
            """,
            canonical_id,
            duplicate_id,
        )

        after = await connection.fetchrow(
            f"""
            UPDATE camps
            SET verification_state = 'duplicate_held', duplicate_of = $2::uuid,
                verification_note = $3
            WHERE id = $1::uuid
            RETURNING {CAMP_SNAPSHOT_COLUMNS}
            """,
            duplicate_id,
            canonical_id,
            note,
        )

        await write_audit(
            connection,
            actor_type="admin",
            actor_id=admin_id,
            action="camp_merged",
            entity_type="camp",
            entity_id=duplicate_id,
            before=_snapshot(duplicate),
            after=_snapshot(after),
            note=f"Merged into {canonical_id}. {note or ''}".strip(),
        )
        return _snapshot(after) or {}

    async def hide_image(
        self,
        connection: asyncpg.Connection,
        *,
        image_id: str,
        admin_id: str,
        reason: str,
    ) -> None:
        """The fix for the prototype's inert flag button: this actually hides."""
        updated = await connection.fetchval(
            "UPDATE report_images SET hidden = true WHERE id = $1::uuid RETURNING id", image_id
        )
        if updated is None:
            raise NotFoundError("That photo does not exist")

        await connection.execute(
            "UPDATE image_flags SET resolved_at = now(), resolved_by = $2::uuid "
            "WHERE image_id = $1::uuid AND resolved_at IS NULL",
            image_id,
            admin_id,
        )
        await write_audit(
            connection,
            actor_type="admin",
            actor_id=admin_id,
            action="image_hidden",
            entity_type="report_image",
            entity_id=image_id,
            note=reason,
        )

    async def flagged_images(
        self, connection: asyncpg.Connection, *, offset: int = 0, limit: int = 30
    ) -> tuple[list[dict[str, Any]], int]:
        total = await connection.fetchval(
            "SELECT count(*) FROM image_flags WHERE resolved_at IS NULL"
        )
        rows = await connection.fetch(
            """
            SELECT f.id AS flag_id, f.reason, f.created_at, f.image_id,
                   i.storage_path, i.camp_id, i.hidden, i.quality_status, i.quality_reasons,
                   c.name AS camp_name,
                   count(*) OVER (PARTITION BY f.image_id) AS flag_count
            FROM image_flags f
            JOIN report_images i ON i.id = f.image_id
            LEFT JOIN camps c ON c.id = i.camp_id
            WHERE f.resolved_at IS NULL
            ORDER BY f.created_at DESC
            OFFSET $1 LIMIT $2
            """,
            offset,
            limit,
        )
        return [
            {
                "flag_id": str(row["flag_id"]),
                "image_id": str(row["image_id"]),
                "camp_id": str(row["camp_id"]) if row["camp_id"] else None,
                "camp_name": row["camp_name"],
                "storage_path": row["storage_path"],
                "reason": row["reason"],
                "hidden": row["hidden"],
                "quality_status": row["quality_status"],
                "quality_reasons": row["quality_reasons"] or [],
                "flag_count": row["flag_count"],
                "created_at": row["created_at"],
            }
            for row in rows
        ], (total or 0)

    async def audit_log(
        self,
        connection: asyncpg.Connection,
        *,
        entity_type: str | None = None,
        entity_id: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[dict[str, Any]], int]:
        where: list[str] = []
        args: list[Any] = []
        if entity_type:
            args.append(entity_type)
            where.append(f"entity_type = ${len(args)}")
        if entity_id:
            args.append(entity_id)
            where.append(f"entity_id = ${len(args)}::uuid")
        clause = f"WHERE {' AND '.join(where)}" if where else ""

        total = await connection.fetchval(f"SELECT count(*) FROM audit_log {clause}", *args)
        rows = await connection.fetch(
            f"""
            SELECT id, created_at, actor_type, actor_id, entity_type, entity_id,
                   action, before, after, note
            FROM audit_log {clause}
            ORDER BY created_at DESC
            OFFSET ${len(args) + 1} LIMIT ${len(args) + 2}
            """,
            *args,
            offset,
            limit,
        )
        return [
            {
                "id": str(row["id"]),
                "created_at": row["created_at"],
                "actor_type": row["actor_type"],
                "actor_id": str(row["actor_id"]) if row["actor_id"] else None,
                "entity_type": row["entity_type"],
                "entity_id": str(row["entity_id"]) if row["entity_id"] else None,
                "action": row["action"],
                "before": row["before"],
                "after": row["after"],
                "note": row["note"],
            }
            for row in rows
        ], (total or 0)
