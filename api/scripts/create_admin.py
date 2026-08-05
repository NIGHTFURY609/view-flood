"""Create or update an admin user.

Run from the api/ directory:
    python scripts/create_admin.py <email> <password>

Example:
    python scripts/create_admin.py admin@local.com admin123
    .venv/Scripts/python.exe scripts/create_admin.py admin@12.com admin12#
Requires SUPABASE_DB_URL in api/.env (or set as env var).
"""

from __future__ import annotations

import asyncio
import os
import sys

import bcrypt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def usage() -> None:
    print("Usage: python scripts/create_admin.py <email> <password>")
    sys.exit(1)


async def main(email: str, password: str) -> None:
    from app.core.config import get_settings
    from app.db.session import Database

    settings = get_settings()
    db = Database(settings)
    await db.start()

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    await db.fetch(
        """
        INSERT INTO users (email, hashed_password, display_name, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE
          SET hashed_password = EXCLUDED.hashed_password
        """,
        email,
        hashed,
        email.split("@")[0],
        "superuser",
    )

    print(f"[ok] Admin user ready: {email}")
    await db.close()


if len(sys.argv) != 3:
    usage()

asyncio.run(main(sys.argv[1], sys.argv[2]))
