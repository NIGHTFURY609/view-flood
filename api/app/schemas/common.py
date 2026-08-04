"""Shared response envelopes. These mirror apps/web/src/shared/types/api.ts."""

from __future__ import annotations

from pydantic import BaseModel


class Page[T](BaseModel):
    items: list[T]
    next_cursor: str | None = None
    total: int | None = None
