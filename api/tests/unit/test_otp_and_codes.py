from __future__ import annotations

import re

from app.core.ip import hash_ip, sha256_hex
from app.services.otp_service import generate_code, hash_code
from app.services.reference_code import ALPHABET, reference_code


class TestOtpHashing:
    def test_pepper_changes_the_hash(self) -> None:
        """The whole point of the pepper: a leaked table is not brute-forceable
        without the server secret."""
        a = hash_code("pepper-a", "+919876543210", "123456")
        b = hash_code("pepper-b", "+919876543210", "123456")
        assert a != b

    def test_hash_is_stable_for_the_same_inputs(self) -> None:
        args = ("s3cret", "+919876543210", "123456")
        assert hash_code(*args) == hash_code(*args)

    def test_phone_is_part_of_the_hash(self) -> None:
        assert hash_code("s", "+919876543210", "123456") != hash_code(
            "s", "+919876543211", "123456"
        )

    def test_hash_does_not_contain_the_plaintext_code(self) -> None:
        assert "123456" not in hash_code("s3cret", "+919876543210", "123456")


class TestGenerateCode:
    def test_is_always_six_digits_including_leading_zeros(self) -> None:
        for _ in range(500):
            code = generate_code()
            assert re.fullmatch(r"\d{6}", code), code

    def test_produces_varied_output(self) -> None:
        assert len({generate_code() for _ in range(200)}) > 100


class TestReferenceCode:
    def test_shape(self) -> None:
        code = reference_code()
        assert code.startswith("KCC-")
        assert len(code) == 10

    def test_avoids_characters_that_are_ambiguous_when_read_aloud(self) -> None:
        """These get dictated over a phone line during a flood."""
        for banned in ("I", "O", "0", "1"):
            assert banned not in ALPHABET

        joined = "".join(reference_code()[4:] for _ in range(300))
        assert set(joined) <= set(ALPHABET)


class TestIpHashing:
    def test_ip_is_never_stored_raw(self) -> None:
        assert "203.0.113.9" not in hash_ip("203.0.113.9")

    def test_prefix_is_applied(self) -> None:
        assert hash_ip("203.0.113.9") == sha256_hex("kcc:203.0.113.9")

    def test_distinct_ips_hash_differently(self) -> None:
        assert hash_ip("203.0.113.9") != hash_ip("203.0.113.10")
