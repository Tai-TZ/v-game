from typing import Annotated, Self

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from pydantic import BaseModel

from vgame.content.models import SLUG_PATTERN, Zone, ZoneLocation, ZoneStatus
from vgame.content.repository import load_catalog

ZONE_NOT_FOUND = "Không tìm thấy khu học."


def _cache_publicly(response: Response) -> None:
    # Static, non-personal content. CORSMiddleware adds "Vary: Origin" for shared caches.
    response.headers["Cache-Control"] = "public, max-age=60"


router = APIRouter(prefix="/zones", tags=["zones"], dependencies=[Depends(_cache_publicly)])


class ZoneSummary(BaseModel):
    id: str
    name: str
    summary: str
    concepts: list[str]
    location: ZoneLocation
    status: ZoneStatus
    level_count: int

    @classmethod
    def from_zone(cls, zone: Zone) -> Self:
        return cls(
            id=zone.id,
            name=zone.name,
            summary=zone.summary,
            concepts=zone.concepts,
            location=zone.location,
            status=zone.status,
            level_count=len(zone.levels),
        )


class ZoneListResponse(BaseModel):
    zones: list[ZoneSummary]


@router.get("", response_model=ZoneListResponse)
async def list_zones() -> ZoneListResponse:
    return ZoneListResponse(zones=[ZoneSummary.from_zone(zone) for zone in load_catalog().zones])


@router.get(
    "/{zone_id}",
    response_model=Zone,
    responses={status.HTTP_404_NOT_FOUND: {"description": ZONE_NOT_FOUND}},
)
async def get_zone(zone_id: Annotated[str, Path(pattern=SLUG_PATTERN)]) -> Zone:
    zone = load_catalog().find_zone(zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ZONE_NOT_FOUND)
    return zone
