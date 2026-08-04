"""Duplicate camp detection.

A 1:1 port of `findDuplicate` / `normaliseName` / `tokenSetRatio` from
camp-trust-link/src/lib/reports.server.ts. The normalisation is tuned for Kerala
school names ("Govt. G.H.S.S. Ranni" vs "GHSS Ranni") and Malayalam
transliteration variance — do not "simplify" it.

Thresholds come from app_settings so an admin can tune them without a deploy:
  duplicate_radius_m          default 150
  name_similarity_threshold   default 0.85
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import asyncpg

DEFAULT_RADIUS_M = 150.0
DEFAULT_NAME_THRESHOLD = 0.85

_STOPWORDS = re.compile(
    r"\b(govt|government|ghss|gvhss|hss|hs|lps|ups|st|saint|school|higher|secondary)\b"
)
_DIGRAPHS = re.compile(r"zh|dh|th|kh|gh|ch|sh|bh|ph")
_NON_ALNUM = re.compile(r"[^a-z0-9 ]")
_REPEATS = re.compile(r"([a-z])\1+")
_SPACES = re.compile(r"\s+")

# Runs of two or more single letters, i.e. what "G.H.S.S." becomes once the
# periods are gone.
_INITIALISMS = re.compile(r"\b(?:[a-z] )+[a-z]\b")


def normalise_name(value: str) -> str:
    """Reduce a camp name to a comparable core.

    NOTE — deviation from the prototype, deliberate. The prototype stripped
    punctuation to spaces BEFORE removing stopwords, so "Govt. G.H.S.S. Ranni"
    became "govt g h s s ranni" and the \\bghss\\b stopword never matched. That
    meant it failed to recognise it as the same place as "GHSS Ranni" — two
    records for one camp, the exact failure duplicate detection exists to
    prevent. Kerala school names are written with periods constantly, so this is
    a common case, not an edge one.

    The fix is to rejoin initialisms before applying stopwords.
    """
    text = value.lower()
    text = _NON_ALNUM.sub(" ", text)
    text = _SPACES.sub(" ", text).strip()
    text = _INITIALISMS.sub(lambda m: m.group(0).replace(" ", ""), text)
    text = _STOPWORDS.sub(" ", text)
    text = _DIGRAPHS.sub(lambda m: m.group(0)[0], text)
    text = _REPEATS.sub(r"\1", text)
    return _SPACES.sub(" ", text).strip()


def token_set_ratio(a: str, b: str) -> float:
    """Dice coefficient over token sets: 2|A∩B| / (|A|+|B|)."""
    tokens_a = {t for t in normalise_name(a).split(" ") if t}
    tokens_b = {t for t in normalise_name(b).split(" ") if t}
    if not tokens_a or not tokens_b:
        return 0.0
    overlap = len(tokens_a & tokens_b)
    return (2 * overlap) / (len(tokens_a) + len(tokens_b))


@dataclass(frozen=True)
class DuplicateMatch:
    camp_id: str
    name: str
    distance_m: float | None
    name_similarity: float
    reason: str  # "geo" | "name"


async def _setting(connection: asyncpg.Connection, key: str, fallback: float) -> float:
    raw = await connection.fetchval("SELECT value FROM app_settings WHERE key = $1", key)
    if raw is None:
        return fallback
    try:
        # app_settings.value is jsonb; a bare number arrives as "150".
        return float(str(raw).strip('"'))
    except (TypeError, ValueError):
        return fallback


async def find_duplicate(
    connection: asyncpg.Connection,
    *,
    district_code: str,
    name: str,
    lsg_name: str | None,
    latitude: float | None,
    longitude: float | None,
) -> DuplicateMatch | None:
    radius_m = await _setting(connection, "duplicate_radius_m", DEFAULT_RADIUS_M)
    threshold = await _setting(connection, "name_similarity_threshold", DEFAULT_NAME_THRESHOLD)

    # Geo match wins outright when both sides have coordinates.
    # earth_distance over the lat/lng columns; the migration adds the GiST index
    # so this stays a bounded lookup rather than a district-wide scan.
    if latitude is not None and longitude is not None:
        row = await connection.fetchrow(
            """
            SELECT id, name,
                   earth_distance(
                       ll_to_earth($2, $3),
                       ll_to_earth(latitude::float8, longitude::float8)
                   ) AS distance_m
            FROM camps
            WHERE district_code = $1
              AND verification_state IN ('unverified', 'verified')
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND earth_box(ll_to_earth($2, $3), $4) @> ll_to_earth(
                      latitude::float8, longitude::float8)
              AND earth_distance(
                      ll_to_earth($2, $3),
                      ll_to_earth(latitude::float8, longitude::float8)
                  ) <= $4
            ORDER BY distance_m ASC
            LIMIT 1
            """,
            district_code,
            latitude,
            longitude,
            radius_m,
        )
        if row is not None:
            return DuplicateMatch(
                camp_id=str(row["id"]),
                name=row["name"],
                distance_m=float(row["distance_m"]),
                name_similarity=token_set_ratio(name, row["name"]),
                reason="geo",
            )

    # Otherwise fall back to same-LSG name similarity. Shortlist in SQL, compare
    # in Python — the prototype pulled every same-district camp into memory.
    if not lsg_name:
        return None

    candidates = await connection.fetch(
        """
        SELECT id, name
        FROM camps
        WHERE district_code = $1
          AND verification_state IN ('unverified', 'verified')
          AND lower(lsg_name) = lower($2)
        LIMIT 500
        """,
        district_code,
        lsg_name,
    )

    best: DuplicateMatch | None = None
    for candidate in candidates:
        score = token_set_ratio(name, candidate["name"])
        if score >= threshold and (best is None or score > best.name_similarity):
            best = DuplicateMatch(
                camp_id=str(candidate["id"]),
                name=candidate["name"],
                distance_m=None,
                name_similarity=score,
                reason="name",
            )

    return best
