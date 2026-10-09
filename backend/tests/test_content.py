import re
from collections.abc import Callable
from typing import Any

import pytest
from pydantic import ValidationError

from vgame.content.models import Catalog
from vgame.content.repository import load_catalog

Mutation = Callable[[dict[str, Any]], None]


def test_bundled_catalog_satisfies_invariants() -> None:
    catalog = load_catalog()

    zone_ids = [zone.id for zone in catalog.zones]
    level_ids = [level.id for zone in catalog.zones for level in zone.levels]
    assert zone_ids == ["library", "watchtower", "market"]
    assert len(set(level_ids)) == len(level_ids)
    for zone in catalog.zones:
        assert [level.order for level in zone.levels] == list(range(1, len(zone.levels) + 1))
        assert zone.levels[-1].kind == "incident"
    assert {zone.id: zone.status for zone in catalog.zones} == {
        "library": "open",
        "watchtower": "coming_soon",
        "market": "coming_soon",
    }


def test_level_briefs_call_the_assistant_tro_ly() -> None:
    """The brief is the first line a player reads under the title; the workbench says "trợ lý"."""
    for zone in load_catalog().zones:
        for level in zone.levels:
            assert not re.search(r"\bagent\b", level.brief, re.IGNORECASE), level.id


def test_level_cards_spell_khoa_like_the_ui() -> None:
    """The zone page shows the brief and concepts side by side: one spelling, "khóa"."""
    for zone in load_catalog().zones:
        for level in zone.levels:
            assert "khoá" not in " ".join([level.brief, *level.concepts]), level.id


def _level(level_id: str, order: int) -> dict[str, Any]:
    return {
        "id": level_id,
        "order": order,
        "title": "Tiêu đề",
        "brief": "Mô tả ngắn.",
        "concepts": ["Khái niệm"],
        "kind": "standard",
    }


def _valid_catalog() -> dict[str, Any]:
    return {
        "zones": [
            {
                "id": "alpha",
                "name": "Khu A",
                "summary": "Tóm tắt.",
                "concepts": ["Khái niệm"],
                "location": "library",
                "status": "open",
                "levels": [_level("alpha-one", 1), _level("alpha-two", 2)],
            },
            {
                "id": "beta",
                "name": "Khu B",
                "summary": "Tóm tắt.",
                "concepts": [],
                "location": "market",
                "status": "coming_soon",
                "levels": [_level("beta-one", 1)],
            },
        ]
    }


def test_valid_in_memory_catalog_passes() -> None:
    catalog = Catalog.model_validate(_valid_catalog())

    assert catalog.find_zone("beta") is not None
    assert catalog.find_zone("gamma") is None


def _set(path: tuple[str | int, ...], value: object) -> Mutation:
    def mutate(data: dict[str, Any]) -> None:
        target: Any = data
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value

    return mutate


@pytest.mark.parametrize(
    ("mutation", "error"),
    [
        pytest.param(_set(("zones", 1, "id"), "alpha"), "duplicate zone ids", id="dup-zone"),
        pytest.param(
            _set(("zones", 1, "levels", 0, "id"), "alpha-one"),
            "duplicate level ids",
            id="dup-level-across-zones",
        ),
        pytest.param(_set(("zones", 0, "levels", 1, "order"), 3), "level orders", id="gap"),
        pytest.param(_set(("zones", 0, "levels", 0, "order"), 0), "greater than", id="zero"),
        pytest.param(
            _set(("zones", 0, "levels"), [_level("x-two", 2), _level("x-one", 1)]),
            "level orders",
            id="out-of-order",
        ),
        pytest.param(_set(("zones", 0, "levels", 0, "order"), "1"), "integer", id="str-order"),
        pytest.param(_set(("zones", 0, "secret"), True), "Extra inputs", id="extra-field"),
        pytest.param(_set(("zones", 0, "id"), "Alpha"), "pattern", id="bad-slug"),
        pytest.param(_set(("zones", 0, "status"), "closed"), "status", id="bad-status"),
        pytest.param(_set(("zones", 0, "location"), "moon"), "location", id="bad-location"),
        pytest.param(_set(("zones", 0, "name"), "   "), "at least 1", id="blank-name"),
        pytest.param(_set(("zones", 0, "levels", 0, "kind"), "boss"), "kind", id="bad-kind"),
    ],
)
def test_malformed_catalog_is_rejected(mutation: Mutation, error: str) -> None:
    data = _valid_catalog()
    mutation(data)

    with pytest.raises(ValidationError, match=error):
        Catalog.model_validate(data)


def test_content_models_are_immutable() -> None:
    catalog = Catalog.model_validate(_valid_catalog())

    with pytest.raises(ValidationError, match="frozen"):
        catalog.zones[0].name = "Đổi tên"  # type: ignore[misc]
