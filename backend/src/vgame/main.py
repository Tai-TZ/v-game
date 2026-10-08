"""ASGI entrypoint: ``uvicorn --factory vgame.main:create_app``.

No module-level app: importing this module (tests do) must never read ``backend/.env``.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import cast

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from vgame.api import api_router
from vgame.api.engine import EngineServices, build_engine
from vgame.config import Settings
from vgame.content.repository import load_catalog
from vgame.security import CONTENT_SECURITY_POLICY, SECURITY_HEADERS, SecurityHeadersMiddleware

DOCS_URL = "/docs"
REDOC_URL = "/redoc"
OPENAPI_URL = "/openapi.json"

INTERNAL_ERROR = "Lỗi máy chủ, vui lòng thử lại sau."
INVALID_REQUEST = "Yêu cầu không hợp lệ."


async def _invalid_request(_request: Request, exc: Exception) -> JSONResponse:
    # Field paths only: the default body echoes the input and English messages.
    errors = cast(RequestValidationError, exc).errors()  # registered for this type only
    fields = [".".join(str(p) for p in err["loc"]) for err in errors]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": INVALID_REQUEST, "fields": fields},
    )


async def _internal_error(_request: Request, _exc: Exception) -> JSONResponse:
    # Generic body only. Starlette re-raises the exception afterwards, so the
    # server log still records the full traceback. This handler runs in
    # ServerErrorMiddleware, outside SecurityHeadersMiddleware, so it sets the headers itself.
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": INTERNAL_ERROR},
        headers={**SECURITY_HEADERS, "Content-Security-Policy": CONTENT_SECURITY_POLICY},
    )


def create_app(settings: Settings | None = None, engine: EngineServices | None = None) -> FastAPI:
    """``engine`` is for tests (fake models/LLM); by default it is built at startup."""
    settings = settings or Settings()
    load_catalog()  # Fail fast: invalid content must stop startup, not a request.

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Built here, not at import: loading the index/reranker must not slow `import vgame.main`.
        app.state.engine = engine or build_engine(settings)
        yield
        await app.state.engine.aclose()

    docs = settings.docs_enabled
    app = FastAPI(
        title="V-Game API",
        version="0.2.0",
        docs_url=DOCS_URL if docs else None,
        redoc_url=REDOC_URL if docs else None,
        openapi_url=OPENAPI_URL if docs else None,
        swagger_ui_oauth2_redirect_url=None,
        lifespan=lifespan,
    )
    app.add_exception_handler(Exception, _internal_error)
    app.add_exception_handler(RequestValidationError, _invalid_request)

    # Middleware added last runs outermost: security headers wrap CORS responses too.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        # POST only for /api/runs; JSON bodies and SSE reconnects need these request headers.
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Idempotency-Key", "Last-Event-ID"],
        allow_credentials=False,
    )
    app.add_middleware(
        SecurityHeadersMiddleware, csp_exempt_paths=(DOCS_URL, REDOC_URL) if docs else ()
    )

    app.include_router(api_router)
    return app
