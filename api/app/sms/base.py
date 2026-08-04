"""Pluggable SMS delivery.

No gateway is provisioned yet — Indian DLT sender-ID registration is pending —
so the stub always fails and the caller falls back to accepting the submission
with a `phone_unverified_sms_fallback` flag for admin follow-up. That fallback
is deliberate product behaviour during a flood: refusing a report because an SMS
did not arrive would lose information we cannot get back.
"""

from __future__ import annotations

from typing import Protocol

import structlog

log = structlog.get_logger()


class SmsProvider(Protocol):
    async def send(self, phone: str, message: str) -> bool:
        """Return True only on confirmed delivery."""
        ...


class StubSmsProvider:
    """Always fails, loudly enough to be visible in logs but never blocking."""

    async def send(self, phone: str, message: str) -> bool:
        # Never log the code itself, and only the last 4 digits of the number.
        log.info("sms_stub_skipped", phone_suffix=phone[-4:], length=len(message))
        return False


def get_sms_provider(name: str) -> SmsProvider:
    if name == "stub":
        return StubSmsProvider()
    raise ValueError(f"Unknown SMS provider: {name}")
