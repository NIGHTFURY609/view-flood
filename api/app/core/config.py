"""Runtime configuration.

Fails fast at import time if a required secret is missing, so a
misconfigured deployment never starts and silently serves errors.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Supabase -----------------------------------------------------------
    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_publishable_key: str = Field(..., alias="SUPABASE_PUBLISHABLE_KEY")

    # Absent until the operator pulls it from the Lovable dashboard. Every
    # privileged path checks for it and returns 503 rather than crashing, so
    # the public read surface stays up in the meantime.
    supabase_service_role_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_ROLE_KEY")

    # Direct Postgres. When present the API switches from the REST adapter to
    # asyncpg, which is required for transactions, PostGIS distance ranking and
    # the admin surface.
    supabase_db_url: str | None = Field(default=None, alias="SUPABASE_DB_URL")

    storage_bucket: str = Field(default="camp-images", alias="SUPABASE_STORAGE_BUCKET")

    # --- security -----------------------------------------------------------
    # Without this the OTP hash is sha256(phone:code) — offline-brute-forceable
    # over a 1M code space if otp_challenges ever leaks.
    otp_pepper: str = Field(default="dev-only-pepper-change-me", alias="OTP_PEPPER")

    # Swap for a real Indian DLT gateway once sender-ID registration completes.
    sms_provider: str = Field(default="stub", alias="SMS_PROVIDER")

    # --- service ------------------------------------------------------------
    environment: Literal["development", "production"] = Field(
        default="development", alias="ENVIRONMENT"
    )
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173", alias="CORS_ORIGINS"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def has_privileged_access(self) -> bool:
        """True once writes and admin operations are possible."""
        return bool(self.supabase_service_role_key or self.supabase_db_url)

    @property
    def uses_direct_postgres(self) -> bool:
        return bool(self.supabase_db_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
