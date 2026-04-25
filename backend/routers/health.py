"""
GET /health — liveness probe.

Returns status, version, and uptime in seconds.
Used by UptimeRobot for demo-time warmup pings.
"""

import time

from fastapi import APIRouter

from shared.schema import HealthResponse

router = APIRouter(tags=["health"])

_START_TIME = time.time()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version="0.1.0",
        uptime_s=int(time.time() - _START_TIME),
    )
