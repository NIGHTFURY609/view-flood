"""Client IP extraction and hashing.

The raw IP is never stored. Rate limiting and per-day check-in uniqueness use
sha256("kcc:" + ip), matching the prototype so existing rows stay comparable.
"""

from __future__ import annotations

import hashlib

from fastapi import Request

IP_HASH_PREFIX = "kcc:"


def client_ip(request: Request) -> str:
    """Trusts the edge proxy headers in the same order the prototype did."""
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first

    return request.client.host if request.client else "0.0.0.0"


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_ip(ip: str) -> str:
    return sha256_hex(f"{IP_HASH_PREFIX}{ip}")
