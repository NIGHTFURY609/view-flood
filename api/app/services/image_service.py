"""Report photo handling.

The client already downscales to a 1600px max edge and re-encodes under 1 MiB
(see apps/web/src/shared/lib/imageProcessing.ts), so this validates rather than
transcodes.

One behaviour change from the prototype: an oversized image is REJECTED with a
field error instead of being silently dropped. The prototype's `continue` meant
a reporter could lose a photo and never be told.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
from dataclasses import dataclass

import asyncpg

from app.core.errors import AppError
from app.storage.supabase_storage import SupabaseStorage

MAX_IMAGE_BYTES = 1_048_576  # 1 MiB, matches the client's encode ceiling
MIN_IMAGES = 2
MAX_IMAGES = 4


@dataclass(frozen=True)
class IncomingImage:
    data_url: str
    width: int
    height: int
    blur_score: float | None
    brightness_score: float | None
    exif_lat: float | None
    exif_lng: float | None
    exif_captured_at: str | None
    quality_reasons: list[str]


def decode_data_url(data_url: str) -> bytes:
    _, _, payload = data_url.partition(",")
    if not payload:
        raise AppError("That photo could not be read", code="image_invalid")
    try:
        return base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AppError("That photo could not be read", code="image_invalid") from exc


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class ImageService:
    def __init__(self, storage: SupabaseStorage) -> None:
        self._storage = storage

    async def store(
        self,
        connection: asyncpg.Connection,
        *,
        report_id: str,
        camp_id: str | None,
        images: list[IncomingImage],
    ) -> int:
        """Returns the number of rows written. camp_id is None for held duplicates."""
        seen: set[str] = set()
        stored = 0

        for index, image in enumerate(images):
            data = decode_data_url(image.data_url)

            if not data:
                raise AppError(
                    "That photo is empty",
                    code="image_invalid",
                    fields={f"images.{index}": "empty"},
                )
            if len(data) > MAX_IMAGE_BYTES:
                raise AppError(
                    "One photo is too large. Please retake it.",
                    code="image_too_large",
                    fields={f"images.{index}": "too_large"},
                )

            digest = sha256_bytes(data)
            if digest in seen:
                # Same photo twice in one submission — skip silently, the client
                # already warns about this before upload.
                continue
            seen.add(digest)

            reasons = list(image.quality_reasons)

            # Flag reuse across reports without blocking: a genuinely reused
            # photo is a signal for review, not proof of bad faith.
            reused = await connection.fetchval(
                "SELECT EXISTS(SELECT 1 FROM report_images WHERE sha256 = $1)", digest
            )
            if reused:
                reasons.append("reused_image")

            path = f"{report_id}/{index}-{digest[:12]}.jpg"
            await self._storage.upload(path, data)

            await connection.execute(
                """
                INSERT INTO report_images (
                    report_id, camp_id, storage_path, file_size_bytes, width, height,
                    sha256, blur_score, brightness_score, exif_lat, exif_lng,
                    exif_captured_at, quality_status, quality_reasons
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                        $12::timestamptz, $13, $14::jsonb)
                """,
                report_id,
                camp_id,
                path,
                len(data),
                image.width,
                image.height,
                digest,
                image.blur_score,
                image.brightness_score,
                image.exif_lat,
                image.exif_lng,
                image.exif_captured_at,
                "warn" if reasons else "pass",
                json.dumps(reasons),
            )
            stored += 1

        return stored

    async def signed_url_for(self, storage_path: str) -> str | None:
        """Single signed URL, used by the admin moderation grid."""
        return await self._storage.signed_url(storage_path)

    async def signed_camp_images(
        self, connection: asyncpg.Connection, camp_id: str, limit: int = 8
    ) -> list[dict[str, object]]:
        rows = await connection.fetch(
            """
            SELECT id, storage_path, width, height, created_at
            FROM report_images
            WHERE camp_id = $1 AND hidden = false
            ORDER BY created_at DESC
            LIMIT $2
            """,
            camp_id,
            limit,
        )

        out: list[dict[str, object]] = []
        for row in rows:
            url = await self._storage.signed_url(row["storage_path"])
            if url is None:
                continue
            out.append(
                {
                    "id": str(row["id"]),
                    "url": url,
                    "width": row["width"],
                    "height": row["height"],
                    "created_at": row["created_at"],
                }
            )
        return out
