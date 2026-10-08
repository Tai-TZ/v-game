from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from pydantic import JsonValue

from vgame.api.engine import EngineServices, get_engine
from vgame.content.models import SLUG_PATTERN
from vgame.engine.grading import public_cases
from vgame.engine.levels import load_level
from vgame.engine.registry import registry_json

LEVEL_NOT_FOUND = "Không tìm thấy level."


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
        level = load_level(level_id)
    except KeyError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, LEVEL_NOT_FOUND) from None
    return level.public(public_cases(engine.spec(level.id)))
