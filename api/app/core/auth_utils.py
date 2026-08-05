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
    # Web (Vercel) and API (Render) live on different domains in production, so
    # every request is cross-site. SameSite=Lax cookies are never sent on
    # cross-site XHR/fetch (only same-site or top-level navigation), which would
    # silently drop auth on every request after login. SameSite=None is required
    # for that — and browsers only honor None when Secure is also set, which is
    # already true in production. Local dev stays same-origin via the Vite proxy,
    # where Lax is fine and Secure would break cookies over plain http.
    samesite = "none" if secure else "lax"
    response.set_cookie(
        "access_token",
        access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
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
        samesite=samesite,
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
        samesite=samesite,
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/api/v1")
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh")
    response.delete_cookie("logged_in", path="/")


def access_token_from_request(request: Request) -> str | None:
    """The access JWT, from either auth path.

    Bearer header wins (the localStorage flow), otherwise the httpOnly access
    cookie. Both flows are accepted at once so switching the frontend between
    them needs no backend change — flip the client and it keeps working.
    """
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() == "bearer" and token:
        return token
    return request.cookies.get("access_token")


async def require_admin_cookie(request: Request) -> AdminUser:
    """FastAPI dependency for admin routes — accepts a Bearer header or cookie JWT."""
    settings: Settings = request.app.state.settings
    database = request.app.state.db

    if not database.configured:
        raise ServiceUnavailableError(
            "The admin portal needs database credentials that are not configured yet.",
            code="db_not_configured",
        )

    token = access_token_from_request(request)
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
