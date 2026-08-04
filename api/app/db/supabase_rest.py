"""PostgREST adapter over Supabase.

WHY THIS EXISTS
---------------
The target design is SQLAlchemy async Core + asyncpg against Postgres directly,
because the report pipeline needs multi-table transactions, atomic counter
increments and PostGIS distance ranking — none of which compose well over HTTP.

But this project's Supabase instance is Lovable Cloud-managed: we hold only the
publishable key, and neither the service-role key nor a connection string. That
blocks the direct-Postgres path until the operator supplies them.

Rather than stall the whole build, the public READ surface runs through
PostgREST with the publishable key today (RLS-enforced, exactly the rows the
browser could already see). Every read router depends on the `Repository`
protocol, so swapping in the asyncpg implementation later touches this package
only — no router, schema or client change.

Writes and admin are NOT implemented here on purpose. They require the
service-role key and real transactions; attempting them over PostgREST would
recreate the read-then-write races the port is meant to remove.
"""

from __future__ import annotations

from typing import Any

import httpx
import structlog

from app.core.config import Settings

log = structlog.get_logger()

# PostgREST caps a single request; we page rather than ask for everything.
MAX_PAGE = 1000


class SupabaseRestError(RuntimeError):
    pass


class SupabaseRest:
    """Thin async PostgREST client. One httpx client for the process lifetime."""

    def __init__(self, settings: Settings) -> None:
        self._base = f"{settings.supabase_url.rstrip('/')}/rest/v1"
        self._key = settings.supabase_publishable_key
        self._client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        self._client = httpx.AsyncClient(
            # The first request after boot pays TLS setup; 5s was too tight and
            # produced a spurious 500 on cold start.
            timeout=httpx.Timeout(15.0, connect=15.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            headers={
                "apikey": self._key,
                "Accept": "application/json",
                "Accept-Profile": "public",
            },
        )

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            raise SupabaseRestError("SupabaseRest.start() was never awaited")
        return self._client

    async def select(
        self,
        table: str,
        *,
        params: dict[str, Any] | None = None,
        offset: int = 0,
        limit: int = 100,
        want_count: bool = False,
    ) -> tuple[list[dict[str, Any]], int | None]:
        """Return (rows, total). `total` is None unless want_count is set.

        The exact count comes from PostgREST's Content-Range header, so the
        client can paginate without a second round trip.
        """
        headers: dict[str, str] = {
            "Range-Unit": "items",
            "Range": f"{offset}-{offset + min(limit, MAX_PAGE) - 1}",
        }
        if want_count:
            headers["Prefer"] = "count=exact"

        response = await self.client.get(
            f"{self._base}/{table}",
            params=params or {},
            headers=headers,
        )

        if response.status_code not in (200, 206):
            log.error(
                "postgrest_error",
                table=table,
                status=response.status_code,
                body=response.text[:500],
            )
            raise SupabaseRestError(f"{table} query failed with {response.status_code}")

        total: int | None = None
        if want_count:
            # Header looks like "0-23/6383"; "*" means unknown.
            content_range = response.headers.get("content-range", "")
            _, _, tail = content_range.partition("/")
            if tail.isdigit():
                total = int(tail)

        return response.json(), total

    async def select_one(
        self, table: str, *, params: dict[str, Any] | None = None
    ) -> dict[str, Any] | None:
        rows, _ = await self.select(table, params=params, limit=1)
        return rows[0] if rows else None
