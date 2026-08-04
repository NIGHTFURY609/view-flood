"""One-time data copy: Lovable Cloud project -> the new Supabase project.

The 9 inherited migrations only carry their own small seed. The real dataset —
6,383 camps from the KSDMA / Revenue monsoon sheet, 1,183 LSG bodies, the needs
rows — was bulk-loaded outside migrations, so it exists only in the source
project. Every table copied here is publicly readable there under RLS, which is
why the publishable key is enough.

Reporter-generated tables (reports, report_images, camp_checkins, need_pledges,
otp_challenges, audit_log) are deliberately NOT copied: they are prototype test
data containing phone numbers, and starting clean is both safer and more honest.

Idempotent — ON CONFLICT DO NOTHING. Safe to re-run.

    uv run --project api python scripts/migrate-data.py
"""

from __future__ import annotations

import asyncio
import json
import os
import pathlib
import re
import sys
import urllib.request

import asyncpg

SOURCE_URL = "https://cbcgauafordsqywkbxri.supabase.co/rest/v1"
SOURCE_KEY = "sb_publishable_CjM-caMFCkvjKJiYxe0kng_k1kHXxnq"
PAGE = 1000

# Order matters: camps must exist before camp_needs references them.
TABLES: list[tuple[str, list[str]]] = [
    (
        "lsg_bodies",
        ["id", "district_code", "taluk_name", "lsg_type", "name", "name_ml", "verified_source"],
    ),
    (
        "camps",
        [
            "id", "name", "name_ml", "building_type", "district_code", "taluk", "lsg_type",
            "lsg_name", "village_or_locality", "landmark", "latitude", "longitude",
            "location_accuracy_m", "camp_incharge_name", "camp_phone_primary",
            "camp_phone_secondary", "verification_state", "status", "urgency",
            "reported_urgency", "reported_urgency_reason", "status_last_confirmed_at",
            "verified_at", "verification_method", "verification_note", "duplicate_of",
            "report_count", "source_published_at", "created_at", "updated_at",
            "checkin_count", "last_checkin_at", "reported_people_count",
            "reported_family_count", "reported_children_count", "amenities",
            "occupancy_updated_at",
        ],
    ),
    (
        "camp_needs",
        [
            "id", "camp_id", "item_key", "label", "unit", "needed_qty", "pledged_qty",
            "urgency", "note", "created_at", "updated_at",
        ],
    ),
]


def fetch_all(table: str, columns: list[str]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    offset = 0
    select = ",".join(columns)

    while True:
        request = urllib.request.Request(
            f"{SOURCE_URL}/{table}?select={select}&order=id",
            headers={
                "apikey": SOURCE_KEY,
                "Range-Unit": "items",
                "Range": f"{offset}-{offset + PAGE - 1}",
            },
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            page = json.load(response)

        rows.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE
        print(f"    {table}: {len(rows)} fetched…", flush=True)

    return rows


def to_text(value: object) -> str | None:
    """Render a JSON value as the text Postgres will parse.

    Everything is bound as text and cast on the SQL side, so a single code path
    handles enums, uuids, timestamps, numerics, booleans and arrays without
    asyncpg trying to infer a Python type per column.
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        # Postgres array literal. Quote each element and escape embedded quotes.
        parts = [str(item).replace("\\", "\\\\").replace('"', '\\"') for item in value]
        return "{" + ",".join(f'"{p}"' for p in parts) + "}"
    return str(value)


def read_db_url() -> str:
    env = pathlib.Path(__file__).resolve().parent.parent / "api" / ".env"
    match = re.search(
        r"^SUPABASE_DB_URL_DIRECT=(.+)$", env.read_text(encoding="utf-8"), re.M
    )
    if not match:
        sys.exit("SUPABASE_DB_URL_DIRECT is not set in api/.env")
    return match.group(1).strip()


async def column_types(connection: asyncpg.Connection, table: str) -> dict[str, str]:
    """Ask the database what each column actually is, rather than guessing."""
    rows = await connection.fetch(
        """
        SELECT a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS pg_type
        FROM pg_attribute a
        WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
        """,
        table,
    )
    return {row["column_name"]: row["pg_type"] for row in rows}


async def main() -> None:
    dsn = os.environ.get("SUPABASE_DB_URL_DIRECT") or read_db_url()
    connection = await asyncpg.connect(dsn, statement_cache_size=0)

    try:
        for table, columns in TABLES:
            print(f"\n{table}")
            types = await column_types(connection, table)

            rows = fetch_all(table, columns)
            print(f"  {len(rows)} rows in source")
            if not rows:
                continue

            # $n::text::<real type> — bind as text, let Postgres do the parsing.
            values = ", ".join(
                f"${i + 1}::text::{types[column]}" for i, column in enumerate(columns)
            )
            # Unqualified DO NOTHING, not ON CONFLICT (id): the seeded rows were
            # inserted with fresh UUIDs, so they collide on natural keys such as
            # lsg_bodies (district_code, lsg_type, name) rather than on the PK.
            statement = (
                f"INSERT INTO {table} ({', '.join(columns)}) "
                f"VALUES ({values}) ON CONFLICT DO NOTHING"
            )

            payload = [tuple(to_text(row.get(column)) for column in columns) for row in rows]

            async with connection.transaction():
                await connection.executemany(statement, payload)

            final = await connection.fetchval(f"SELECT count(*) FROM {table}")
            print(f"  -> {final} rows now in target")

        print("\nfinal counts")
        for table, _ in TABLES:
            count = await connection.fetchval(f"SELECT count(*) FROM {table}")
            print(f"  {table:14s} {count}")
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
