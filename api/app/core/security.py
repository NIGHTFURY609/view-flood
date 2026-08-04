"""Admin authentication.

Two separate questions, deliberately kept apart:

  Authentication — is this a valid Supabase Auth token? (JWT verified via JWKS)
  Authorization  — is this person an admin?          (row in admin_users)

A valid JWT alone proves only the first. If the project ever grows a public
sign-up surface for anything else, an authenticated non-admin must still be
rejected — hence 401 and 403 are different answers here.

The browser never holds a Supabase key: /admin/login proxies the credential
exchange server-side and hands back only the session token.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx
import jwt
import structlog
from fastapi import Request
from jwt import PyJWKClient

from app.core.config import Settings
from app.core.errors import ForbiddenError, ServiceUnavailableError, UnauthorizedError

log = structlog.get_logger()


@dataclass(frozen=True)
class AdminUser:
    id: str
    email: str
    display_name: str | None
    role: str


class AdminAuth:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        self._auth_url = f"{settings.supabase_url.rstrip('/')}/auth/v1"
        self._jwk_client: PyJWKClient | None = None

    def _jwks(self) -> PyJWKClient:
        if self._jwk_client is None:
            # Caches keys in-process; refetches on unknown kid.
            self._jwk_client = PyJWKClient(self._jwks_url, cache_keys=True)
        return self._jwk_client

    async def sign_in(self, email: str, password: str) -> dict[str, object]:
        """Server-side credential exchange, so no Supabase key reaches the client."""
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{self._auth_url}/token",
                params={"grant_type": "password"},
                json={"email": email, "password": password},
                headers={
                    "apikey": self._settings.supabase_publishable_key,
                    "Content-Type": "application/json",
                },
            )

        if response.status_code >= 400:
            # Never echo the provider's message — it distinguishes "no such user"
            # from "wrong password", which is a user-enumeration oracle.
            raise UnauthorizedError("Email or password is incorrect", code="invalid_credentials")

        return response.json()

    def decode(self, token: str) -> dict[str, object]:
        try:
            signing_key = self._jwks().get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience="authenticated",
                options={"require": ["exp", "sub"]},
            )
        except jwt.PyJWTError as exc:
            raise UnauthorizedError(
                "Session expired. Sign in again.", code="invalid_token"
            ) from exc


def bearer_token(request: Request) -> str:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("Sign in to continue", code="missing_token")
    return token


async def require_admin(request: Request) -> AdminUser:
    """FastAPI dependency guarding every /admin route."""
    auth: AdminAuth = request.app.state.admin_auth
    database = request.app.state.db

    if not database.configured:
        raise ServiceUnavailableError(
            "The admin portal needs database credentials that are not configured yet.",
            code="db_not_configured",
        )

    claims = auth.decode(bearer_token(request))
    user_id = str(claims.get("sub") or "")
    if not user_id:
        raise UnauthorizedError("Sign in to continue", code="invalid_token")

    row = await database.fetchrow(
        "SELECT id, email, display_name, role FROM admin_users WHERE id = $1", user_id
    )
    if row is None:
        # Authenticated, but not staff.
        log.warning("admin_access_denied", user_id=user_id)
        raise ForbiddenError("This account does not have admin access", code="not_admin")

    return AdminUser(
        id=str(row["id"]),
        email=row["email"],
        display_name=row["display_name"],
        role=row["role"],
    )
