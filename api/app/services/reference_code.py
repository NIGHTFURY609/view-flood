"""Human-quotable report references, e.g. KCC-7M4KPX.

The alphabet excludes I, O, 0 and 1 because these codes get read aloud over a
phone line by someone standing in a flood.
"""

from __future__ import annotations

from secrets import choice

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
LENGTH = 6


def reference_code() -> str:
    return "KCC-" + "".join(choice(ALPHABET) for _ in range(LENGTH))
