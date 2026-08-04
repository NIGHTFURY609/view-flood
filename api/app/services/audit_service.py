"""Provenance trail.

Every published value has to be explainable: who changed it, when, from what to
what. Admin actions and public submissions both land here, and the admin portal
reads it back as a before/after diff.
"""

from __future__ import annotations

import json
from typing import Any, Literal

import asyncpg

ActorType = Literal["admin", "public", "system"]


async def write_audit(
    connection: asyncpg.Connection,
    *,
    actor_type: ActorType,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    actor_id: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    note: str | None = None,
) -> None:
    await connection.execute(
        """
        INSERT INTO audit_log (
            actor_type, actor_id, entity_type, entity_id, action, before, after, note
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
        """,
        actor_type,
        actor_id,
        entity_type,
        entity_id,
        action,
        json.dumps(before) if before is not None else None,
        json.dumps(after) if after is not None else None,
        note[:500] if note else None,
    )
