"""Admin auth utilities — scratch-built JWT + bcrypt, no Supabase dependency.

Keeps the new cookie-based admin auth completely separate from the existing
Supabase-backed auth in security.py so neither path interferes with the other.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import bcrypt
import structlog
from fastapi import Request, Response
from jose import JWTError
from jose import jwt as jose_jwt

from app.core.config import Settings, get_settings
from app.core.errors import ForbiddenError, ServiceUnavailableError, UnauthorizedError
from app.core.security import AdminUser

log = structlog.get_logger()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(subject: str, settings: Settings) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    return jose_jwt.encode(
        {"sub": subject, "exp": expire, "type": "access"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(subject: str, settings: Settings) -> str:
    expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    return jose_jwt.encode(
        {"sub": subject, "exp": expire, "type": "refresh"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str, settings: Settings | None = None) -> dict[str, object]:
    cfg = settings or get_settings()
    try:
        return jose_jwt.decode(token, cfg.jwt_secret_key, algorithms=[cfg.jwt_algorithm])
    except JWTError as exc:
        raise UnauthorizedError("Session expired. Sign in again.", code="invalid_token") from exc


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    settings: Settings,
) -> None:
    secure = settings.environment == "production"
    response.set_cookie(
        "access_token",
        access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/api/v1",
    )
    # Refresh token path is scoped to the refresh endpoint only —
    # narrower path means the cookie is never sent to other routes.
    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        path="/api/v1/auth/refresh",
    )
    # Non-httpOnly flag the browser JS can read to know a session exists, so the
    # SPA can decide whether to call /me. Deliberately NOT a credential — it holds
    # no token, only "true". Its lifetime tracks the refresh token, so it survives
    # exactly as long as the session can be silently renewed.
    response.set_cookie(
        "logged_in",
        "true",
        httponly=False,
        secure=secure,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/api/v1")
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh")
    response.delete_cookie("logged_in", path="/")


async def require_admin_cookie(request: Request) -> AdminUser:
    """FastAPI dependency for admin routes — reads JWT from httpOnly cookie."""
    settings: Settings = request.app.state.settings
    database = request.app.state.db

    if not database.configured:
        raise ServiceUnavailableError(
            "The admin portal needs database credentials that are not configured yet.",
            code="db_not_configured",
        )

    token = request.cookies.get("access_token")
    if not token:
        raise UnauthorizedError("Sign in to continue", code="missing_token")

    claims = decode_token(token, settings)
    if claims.get("type") != "access":
        raise UnauthorizedError("Invalid token type", code="invalid_token")

    user_id = str(claims.get("sub") or "")
    row = await database.fetchrow(
        "SELECT id, email, display_name, role FROM users WHERE id = $1::uuid",
        user_id,
    )
    if row is None:
        log.warning("admin_cookie_access_denied", user_id=user_id)
        raise ForbiddenError("This account does not have admin access", code="not_admin")

    return AdminUser(
        id=str(row["id"]),
        email=row["email"],
        display_name=row["display_name"],
        role=row["role"],
    )
