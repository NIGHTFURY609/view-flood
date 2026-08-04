"""The name-matching rules decide whether a second report creates a new camp or
corroborates an existing one. Getting them wrong either fragments a camp across
duplicates or silently merges two real places.
"""

from __future__ import annotations

import pytest

from app.services.duplicate_detection import normalise_name, token_set_ratio


class TestNormaliseName:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("Govt. G.H.S.S. Ranni", "rani"),
            ("GHSS Ranni", "rani"),
            ("Government Higher Secondary School, Ranni", "rani"),
            ("St. Thomas HSS Ranni", "tomas rani"),
        ],
    )
    def test_school_boilerplate_is_stripped(self, raw: str, expected: str) -> None:
        assert normalise_name(raw) == expected

    def test_digraphs_collapse_to_their_first_letter(self) -> None:
        # "Thiruvalla" and "Tiruvalla" are the same place spelled two ways.
        assert normalise_name("Thiruvalla") == normalise_name("Tiruvalla")

    def test_repeated_letters_collapse(self) -> None:
        assert normalise_name("Mallappally") == normalise_name("Malapally")

    def test_punctuation_and_case_are_irrelevant(self) -> None:
        assert normalise_name("A.K.M. Hall") == normalise_name("akm hall")

    def test_empty_input_is_safe(self) -> None:
        assert normalise_name("") == ""
        assert normalise_name("!!!") == ""


class TestTokenSetRatio:
    def test_identical_names_score_one(self) -> None:
        assert token_set_ratio("Govt HSS Ranni", "GHSS Ranni") == pytest.approx(1.0)

    def test_transliteration_variants_clear_the_threshold(self) -> None:
        assert token_set_ratio("Thiruvalla Town Hall", "Tiruvalla Town Hall") >= 0.85

    def test_different_places_score_low(self) -> None:
        assert token_set_ratio("GHSS Ranni", "GHSS Adoor") < 0.85

    def test_empty_side_scores_zero_rather_than_dividing_by_zero(self) -> None:
        assert token_set_ratio("", "GHSS Ranni") == 0.0
        assert token_set_ratio("GHSS", "") == 0.0

    def test_partial_overlap_is_proportional(self) -> None:
        # One shared token out of three distinct: 2*1 / (1+2) = 0.667
        assert token_set_ratio("Ranni", "Ranni Perunad") == pytest.approx(2 / 3)
