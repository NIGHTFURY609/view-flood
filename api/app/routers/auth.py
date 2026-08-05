from __future__ import annotations

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.auth_utils import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    set_auth_cookies,
    verify_password,
)
from app.core.errors import UnauthorizedError
from app.deps import DatabaseDep

router = APIRouter(tags=["auth"], prefix="/auth")


class LoginIn(BaseModel):
    email: str
    password: str


class MeOut(BaseModel):
    id: str
    email: str
    display_name: str | None
    role: str


@router.post("/login")
async def login(body: LoginIn, response: Response, db: DatabaseDep) -> dict[str, bool]:
    row = await db.fetchrow(
        "SELECT id, email, display_name, role, hashed_password FROM users WHERE lower(email) = lower($1)",
        body.email,
    )
    # Constant-time path: always call verify even on missing row to avoid timing oracle.
    dummy = "$2b$12$placeholder.hash.to.keep.timing.constant.xxxxxxxxxxxxxxxxx"
    stored = row["hashed_password"] if row else dummy
    valid = verify_password(body.password, stored)

    if not row or not valid:
        raise UnauthorizedError("Email or password is incorrect", code="invalid_credentials")

    settings = get_settings()
    user_id = str(row["id"])
    set_auth_cookies(
        response,
        create_access_token(user_id, settings),
        create_refresh_token(user_id, settings),
        settings,
    )
    return {"ok": True}


@router.post("/refresh")
async def refresh(request: Request, response: Response) -> dict[str, bool]:
    settings = get_settings()
    token = request.cookies.get("refresh_token")
    if not token:
        raise UnauthorizedError("No refresh token", code="missing_token")

    claims = decode_token(token, settings)
    if claims.get("type") != "refresh":
        raise UnauthorizedError("Invalid token type", code="invalid_token")

    new_access = create_access_token(str(claims["sub"]), settings)
    secure = settings.environment == "production"
    # Must match set_auth_cookies: SameSite=None in production, since web (Vercel)
    # and API (Render) are cross-site there.
    response.set_cookie(
        "access_token",
        new_access,
        httponly=True,
        secure=secure,
        samesite="none" if secure else "lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/api/v1",
    )
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response) -> dict[str, bool]:
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=MeOut)
async def me(request: Request, db: DatabaseDep) -> MeOut:
    settings = get_settings()
    token = request.cookies.get("access_token")
    if not token:
        raise UnauthorizedError("Sign in to continue", code="missing_token")

    claims = decode_token(token, settings)
    if claims.get("type") != "access":
        raise UnauthorizedError("Invalid token type", code="invalid_token")

    row = await db.fetchrow(
        "SELECT id, email, display_name, role FROM users WHERE id = $1::uuid",
        str(claims["sub"]),
    )
    if row is None:
        raise UnauthorizedError("Account not found", code="not_found")

    return MeOut(
        id=str(row["id"]),
        email=row["email"],
        display_name=row["display_name"],
        role=row["role"],
    )
