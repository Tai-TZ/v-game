"""Learning content model: zones on the campus map and the levels inside them.

Invariants are enforced here, so invalid content fails at load time, never at request time.
"""

from collections import Counter
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

SLUG_PATTERN = r"^[a-z][a-z0-9-]{1,31}$"

Slug = Annotated[str, StringConstraints(pattern=SLUG_PATTERN)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
ZoneLocation = Literal["library", "watchtower", "market"]
ZoneStatus = Literal["open", "coming_soon"]
LevelKind = Literal["standard", "incident"]


class ContentModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)


class Level(ContentModel):
    id: Slug
    order: Annotated[int, Field(ge=1)]
    title: Text
    brief: Text
    concepts: list[Text]
    kind: LevelKind


class Zone(ContentModel):
    id: Slug
    name: Text
    summary: Text
    concepts: list[Text]
    location: ZoneLocation
    status: ZoneStatus
    levels: list[Level]

    @model_validator(mode="after")
    def _orders_contiguous_from_one(self) -> Self:
        orders = [level.order for level in self.levels]
        expected = list(range(1, len(self.levels) + 1))
        if orders != expected:
            raise ValueError(
                f"zone {self.id!r}: level orders must be {expected} in listed order, got {orders}"
            )
        return self


class Catalog(ContentModel):
    zones: list[Zone]

    @model_validator(mode="after")
    def _ids_unique(self) -> Self:
        _reject_duplicates("zone", [zone.id for zone in self.zones])
        _reject_duplicates("level", [level.id for zone in self.zones for level in zone.levels])
        return self

    def find_zone(self, zone_id: str) -> Zone | None:
        return next((zone for zone in self.zones if zone.id == zone_id), None)


def _reject_duplicates(kind: str, ids: list[str]) -> None:
    duplicates = sorted(item for item, count in Counter(ids).items() if count > 1)
    if duplicates:
        raise ValueError(f"duplicate {kind} ids: {duplicates}")
