from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from src.infrastructure.config.settings import settings
from src.infrastructure.database.models import Base  # noqa: F401 — registers all models
from src.infrastructure.database.models.time_log_model import TimeLogModel
from src.infrastructure.database.session import async_session_factory, engine
from src.presentation.api.v1.auth_router import router as auth_router
from src.presentation.api.v1.project_router import router as project_router
from src.presentation.api.v1.task_router import router as task_router
from src.presentation.api.v1.timelog_router import router as timelog_router
from src.presentation.api.v1.timesheet_router import router as timesheet_router
from src.presentation.exception_handlers import register_exception_handlers

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Background listener: AIInsightGenerated → update TimeLog in DB
# ---------------------------------------------------------------------------

async def _ai_insight_listener() -> None:
    """Subscribe to Redis and persist AI insights into the timelogs table."""
    import redis.asyncio as aioredis

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    while True:
        try:
            client = aioredis.from_url(redis_url, decode_responses=True)
            await client.ping()
            logger.info("AI-insight listener connected to Redis")

            pubsub = client.pubsub()
            await pubsub.subscribe("events")

            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                except json.JSONDecodeError:
                    continue

                if data.get("event_type") != "AIInsightGenerated":
                    continue

                time_log_id_raw = data.get("time_log_id")
                if not time_log_id_raw:
                    continue

                try:
                    tl_id = uuid.UUID(str(time_log_id_raw))
                except ValueError:
                    continue

                async with async_session_factory() as session:
                    stmt = (
                        update(TimeLogModel)
                        .where(TimeLogModel.id == tl_id)
                        .values(
                            ai_category=data.get("category"),
                            ai_quality_score=data.get("quality_score"),
                            ai_suggestion=data.get("suggestion"),
                        )
                    )
                    await session.execute(stmt)
                    await session.commit()
                    logger.info(
                        "Updated TimeLog %s with AI insight (category=%s, score=%s)",
                        tl_id,
                        data.get("category"),
                        data.get("quality_score"),
                    )

        except Exception:
            logger.warning("AI-insight listener: connection lost, reconnecting in 3s...")
            await asyncio.sleep(3)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Startup: create tables (dev convenience — use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Start background AI-insight listener
    task = asyncio.create_task(_ai_insight_listener())

    yield

    # Shutdown
    task.cancel()
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
