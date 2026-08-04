"""Direct Postgres access for everything that writes.

Reads can go through PostgREST (see supabase_rest.py), but writes cannot: the
report pipeline has to insert a report, bump a camp counter and append an audit
row atomically, and the duplicate shortlist wants a real spatial query. Chaining
HTTP calls would reintroduce exactly the read-then-write races this port exists
to remove.

The pool is created lazily so the service still boots — and still serves reads —
when no connection string has been supplied yet.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
import structlog

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError

log = structlog.get_logger()

MISSING_DB_MESSAGE = (
    "This action needs database credentials that are not configured yet. "
    "Set SUPABASE_DB_URL in apps/api/.env."
)


async def _register_codecs(connection: asyncpg.Connection) -> None:
    """Decode json/jsonb into Python objects.

    Without this asyncpg hands back the raw JSON *string*, so `auto_flags`
    arrives as '["a","b"]' rather than a list — and the admin queue, which maps
    over it to render flag chips, would iterate the characters of that string
    instead. Audit before/after snapshots have the same problem.
    """
    for type_name in ("json", "jsonb"):
        await connection.set_type_codec(
            type_name,
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )


class Database:
    def __init__(self, settings: Settings) -> None:
        self._dsn = settings.supabase_db_url
        self._pool: asyncpg.Pool | None = None

    @property
    def configured(self) -> bool:
        return bool(self._dsn)

    async def start(self) -> None:
        if not self._dsn:
            log.warning("db_not_configured", detail="Write endpoints will return 503.")
            return

        # statement_cache_size=0 is REQUIRED against Supabase's transaction
        # pooler (port 6543): pgbouncer does not keep prepared statements across
        # pooled connections, and asyncpg's cache silently breaks if it assumes
        # they persist.
        try:
            self._pool = await asyncpg.create_pool(
                self._dsn,
                min_size=1,
                max_size=10,
                statement_cache_size=0,
                command_timeout=20,
                init=_register_codecs,
            )
            log.info("db_pool_started")
        except Exception as exc:
            log.warning("db_pool_failed", error=str(exc), detail="Falling back to PostgREST for reads. Writes will return 503.")
            self._dsn = None

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    def require(self) -> asyncpg.Pool:
        if self._pool is None:
            raise ServiceUnavailableError(MISSING_DB_MESSAGE, code="db_not_configured")
        return self._pool

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[asyncpg.Connection]:
        pool = self.require()
        async with pool.acquire() as connection:
            yield connection

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[asyncpg.Connection]:
        """All-or-nothing. The report pipeline depends on this."""
        pool = self.require()
        async with pool.acquire() as connection, connection.transaction():
            yield connection

    async def fetch(self, query: str, *args: Any) -> list[asyncpg.Record]:
        async with self.acquire() as connection:
            return await connection.fetch(query, *args)

    async def fetchrow(self, query: str, *args: Any) -> asyncpg.Record | None:
        async with self.acquire() as connection:
            return await connection.fetchrow(query, *args)

    async def fetchval(self, query: str, *args: Any) -> Any:
        async with self.acquire() as connection:
            return await connection.fetchval(query, *args)

    async def execute(self, query: str, *args: Any) -> str:
        async with self.acquire() as connection:
            return await connection.execute(query, *args)
