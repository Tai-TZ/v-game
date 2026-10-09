from fastapi import APIRouter

from vgame.api.routes import health, levels, runs, zones

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(zones.router)
api_router.include_router(levels.router)
api_router.include_router(runs.router)
