"""Smoke tests for /health endpoint."""

import pytest
from httpx import AsyncClient, ASGITransport

from backend.main import app


@pytest.mark.asyncio
async def test_health_returns_200() -> None:
    """GET /health must return HTTP 200."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_response_shape() -> None:
    """GET /health response must match HealthResponse schema."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == "0.1.0"
    assert isinstance(body["uptime_s"], int)
    assert body["uptime_s"] >= 0


@pytest.mark.asyncio
async def test_health_no_provenance_field() -> None:
    """HealthResponse is a liveness probe — it must NOT have a provenance field."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")
    body = response.json()
    assert "provenance" not in body


@pytest.mark.asyncio
async def test_schema_imports() -> None:
    """shared.schema must import cleanly and expose expected symbols."""
    from shared.schema import (  # noqa: F401
        HealthResponse,
        Provenance,
        SourceRef,
        WeatherResponse,
        StopsResponse,
        RouteResponse,
        RiskResponse,
        SafetyAlert,
        RiskScore,
        Biosignal,
    )
