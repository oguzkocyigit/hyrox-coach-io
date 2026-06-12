"""FastAPI application entrypoint.

Calistirma: uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI

from app.api.v1.endpoints import (
    analysis,
    exercises,
    metrics,
    plans,
    sync,
    users,
    webhooks,
    workouts,
)
from app.core.database import engine


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


app = FastAPI(
    title="HYROX Coach API",
    description="Hybrid Performance Management System - deterministik kural motoru + agentic AI katmani",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(workouts.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(exercises.router, prefix="/api/v1")
app.include_router(plans.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
