from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from pydantic import JsonValue

from vgame.api.engine import EngineServices, get_engine
from vgame.content.models import SLUG_PATTERN
from vgame.content.repository import load_catalog
from vgame.engine.levels import LevelSpec, load_level
from vgame.engine.registry import registry_json

LEVEL_NOT_FOUND = "Không tìm thấy level."


def load_open_level(level_id: str) -> LevelSpec:
    """A level the API serves: its file exists, and its zone and its own entry in zones.json are
    open. A level can ship in the engine before it opens; until then it is not found, never a 500.
    Raises KeyError like ``load_level``."""
    level = load_level(level_id)
    zone = load_catalog().find_zone(level.zone)
    if zone is None or zone.status != "open":
        raise KeyError(level_id)
    # The zone can open before all its levels (Watchtower: W1 first).
    meta = next((lv for lv in zone.levels if lv.id == level_id), None)
    if meta is None or meta.status != "open":
        raise KeyError(level_id)
    return level


def _cache_publicly(response: Response) -> None:
    response.headers["Cache-Control"] = "public, max-age=60"


router = APIRouter(tags=["levels"], dependencies=[Depends(_cache_publicly)])


@router.get("/blocks")
async def list_blocks() -> dict[str, JsonValue]:
    return registry_json()


@router.get(
    "/levels/{level_id}",
    responses={status.HTTP_404_NOT_FOUND: {"description": LEVEL_NOT_FOUND}},
)
async def get_level(
    level_id: Annotated[str, Path(pattern=SLUG_PATTERN)],
    engine: Annotated[EngineServices, Depends(get_engine)],
) -> dict[str, JsonValue]:
    """PublicLevel (engine-v0.2.md §9.2): starter graph and visible questions only."""
    try:
        level = load_open_level(level_id)
    except KeyError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, LEVEL_NOT_FOUND) from None
    return level.public(engine.level_cases(level))
