"""Supabase Storage.

Storage has no protocol other than HTTP, so this stays an httpx wrapper even on
the direct-Postgres path. The bucket is private; reads go out as signed URLs
with a 1 hour TTL, which is why those URLs must never be cached by the service
worker or persisted into the offline query cache.
"""

from __future__ import annotations

import httpx
import structlog

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError

log = structlog.get_logger()

SIGNED_URL_TTL_SECONDS = 3600


class SupabaseStorage:
    def __init__(self, settings: Settings) -> None:
        self._base = f"{settings.supabase_url.rstrip('/')}/storage/v1"
        self._bucket = settings.storage_bucket
        self._key = settings.supabase_service_role_key
        self._client: httpx.AsyncClient | None = None

    @property
    def configured(self) -> bool:
        return bool(self._key)

    async def start(self) -> None:
        if not self._key:
            log.warning("storage_not_configured", detail="Image upload will return 503.")
            return
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=15.0),
            headers={
                "Authorization": f"Bearer {self._key}",
                "apikey": self._key,
            },
        )

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _require(self) -> httpx.AsyncClient:
        if self._client is None:
            raise ServiceUnavailableError(
                "Image storage needs SUPABASE_SERVICE_ROLE_KEY, which is not configured yet.",
                code="storage_not_configured",
            )
        return self._client

    async def upload(self, path: str, data: bytes, content_type: str = "image/jpeg") -> str:
        client = self._require()
        response = await client.post(
            f"{self._base}/object/{self._bucket}/{path}",
            content=data,
            headers={"Content-Type": content_type, "x-upsert": "true"},
        )
        if response.status_code >= 400:
            log.error("storage_upload_failed", path=path, status=response.status_code)
            raise ServiceUnavailableError("Could not store the photo", code="storage_error")
        return path

    async def signed_url(self, path: str, ttl: int = SIGNED_URL_TTL_SECONDS) -> str | None:
        client = self._require()
        response = await client.post(
            f"{self._base}/object/sign/{self._bucket}/{path}",
            json={"expiresIn": ttl},
        )
        if response.status_code >= 400:
            log.warning("storage_sign_failed", path=path, status=response.status_code)
            return None
        signed = response.json().get("signedURL")
        return f"{self._base}{signed}" if signed else None
