from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.infrastructure.config.settings import settings
from src.infrastructure.database.session import engine
from src.presentation.api.v1.auth_router import router as auth_router
from src.presentation.api.v1.project_router import router as project_router
from src.presentation.api.v1.task_router import router as task_router
from src.presentation.api.v1.timelog_router import router as timelog_router
from src.presentation.api.v1.timesheet_router import router as timesheet_router
from src.presentation.exception_handlers import register_exception_handlers


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Startup: nothing extra needed — engine is lazy-initialized
    yield
    # Shutdown: dispose the connection pool
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # -- CORS ------------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -- Exception handlers ----------------------------------------------------
    register_exception_handlers(app)

    # -- Routers ---------------------------------------------------------------
    api_prefix = "/api/v1"
    app.include_router(auth_router, prefix=api_prefix)
    app.include_router(project_router, prefix=api_prefix)
    app.include_router(task_router, prefix=api_prefix)
    app.include_router(timelog_router, prefix=api_prefix)
    app.include_router(timesheet_router, prefix=api_prefix)

    # -- Health check ----------------------------------------------------------
    @app.get("/health", tags=["Health"])
    async def health_check() -> dict[str, str]:
        return {"status": "healthy"}

    return app


app = create_app()
