"""Open-Meteo proxy.

Proxied rather than called from the browser so the 24-hour rain aggregation is
one tested implementation, and so many phones in the same district collapse onto
one upstream call.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter(tags=["weather"])

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 15 * 60

class Weather(BaseModel):
    temperature_c: float | None = None
    weather_code: int | None = None
    rain_last_24h_mm: float = 0.0
    rain_next_24h_mm: float = 0.0
    observed_at: str | None = None


# Keyed on coordinates rounded to ~1 km so nearby users share an entry.
_cache: dict[tuple[float, float], tuple[float, Weather]] = {}


def _sum_window(
    times: list[str],
    values: list[float | None],
    start: datetime,
    end: datetime,
) -> float:
    total = 0.0
    for stamp, value in zip(times, values, strict=False):
        if value is None:
            continue
        try:
            moment = datetime.fromisoformat(stamp).replace(tzinfo=UTC)
        except ValueError:
            continue
        if start <= moment <= end:
            total += value
    return round(total, 1)


@router.get("/weather", response_model=Weather)
async def weather(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> Weather:
    key = (round(lat, 2), round(lng, 2))
    cached = _cache.get(key)
    now_monotonic = time.monotonic()
    if cached and now_monotonic - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    params = {
        "latitude": lat,
        "longitude": lng,
        "current": "temperature_2m,weather_code",
        "hourly": "precipitation",
        "past_days": 1,
        "forecast_days": 2,
        "timezone": "UTC",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(OPEN_METEO, params=params)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        # The panel hides itself on empty data rather than showing a broken
        # reading — misleading weather is worse than none in a flood.
        return Weather()

    current = payload.get("current") or {}
    hourly = payload.get("hourly") or {}
    times: list[str] = hourly.get("time") or []
    precipitation: list[float | None] = hourly.get("precipitation") or []

    now = datetime.now(UTC)
    result = Weather(
        temperature_c=current.get("temperature_2m"),
        weather_code=current.get("weather_code"),
        rain_last_24h_mm=_sum_window(times, precipitation, now - timedelta(hours=24), now),
        rain_next_24h_mm=_sum_window(times, precipitation, now, now + timedelta(hours=24)),
        observed_at=current.get("time"),
    )

    _cache[key] = (now_monotonic, result)
    return result
