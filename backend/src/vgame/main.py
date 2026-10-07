"""ASGI entrypoint: ``uvicorn vgame.main:app``."""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from vgame.api import api_router
from vgame.config import Settings
from vgame.content.repository import load_catalog
from vgame.security import CONTENT_SECURITY_POLICY, SECURITY_HEADERS, SecurityHeadersMiddleware

DOCS_URL = "/docs"
REDOC_URL = "/redoc"
OPENAPI_URL = "/openapi.json"

INTERNAL_ERROR = "Lỗi máy chủ, vui lòng thử lại sau."


async def _internal_error(_request: Request, _exc: Exception) -> JSONResponse:
    # Generic body only. Starlette re-raises the exception afterwards, so the
    # server log still records the full traceback. This handler runs in
    # ServerErrorMiddleware, outside SecurityHeadersMiddleware, so it sets the headers itself.
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": INTERNAL_ERROR},
        headers={**SECURITY_HEADERS, "Content-Security-Policy": CONTENT_SECURITY_POLICY},
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    load_catalog()  # Fail fast: invalid content must stop startup, not a request.

    docs = settings.docs_enabled
    app = FastAPI(
        title="V-Game API",
        version="0.1.0",
        docs_url=DOCS_URL if docs else None,
        redoc_url=REDOC_URL if docs else None,
        openapi_url=OPENAPI_URL if docs else None,
        swagger_ui_oauth2_redirect_url=None,
    )
    app.add_exception_handler(Exception, _internal_error)

    # Middleware added last runs outermost: security headers wrap CORS responses too.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_credentials=False,
    )
    app.add_middleware(
        SecurityHeadersMiddleware, csp_exempt_paths=(DOCS_URL, REDOC_URL) if docs else ()
    )

    app.include_router(api_router)
    return app


app = create_app()
