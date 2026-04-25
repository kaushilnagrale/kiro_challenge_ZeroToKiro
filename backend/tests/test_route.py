"""
Tests for RouteService and POST /route endpoint.

All Mapbox HTTP calls are mocked — no real network traffic.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routers.route import router
from backend.services.cache import cache
from backend.services.mrt_service import MrtService
from backend.services.route_service import RouteService, _shade_pct
from shared.schema import (
    Provenance,
    RouteRequest,
    RouteResponse,
    Route,
    RouteSegment,
    SourceRef,
    Stop,
    WeatherResponse,
    WeatherSnapshot,
)

# ── Minimal test app ──────────────────────────────────────────────────────────

test_app = FastAPI()
test_app.include_router(router)
client = TestClient(test_app)

# ── Mock Mapbox payloads ──────────────────────────────────────────────────────

MOCK_MAPBOX = {
    "routes": [
        {
            "geometry": {
                "coordinates": [
                    [-111.9400, 33.4255],  # lng, lat
                    [-111.9390, 33.4260],
                    [-111.9380, 33.4265],
                    [-111.9370, 33.4270],
                    [-111.9360, 33.4275],
                    [-111.9350, 33.4280],
                    [-111.9340, 33.4285],
                    [-111.9330, 33.4290],
                    [-111.9320, 33.4295],
                    [-111.9310, 33.4300],
                    [-111.9300, 33.4305],
                    [-111.9290, 33.4310],
                ]
            },
            "distance": 1200.0,
            "duration": 300.0,
        }
    ]
}

# Hot-zone polyline: all points near Mill Ave Corridor (33.4255, -111.9400, r=400m)
MOCK_MAPBOX_HOT = {
    "routes": [
        {
            "geometry": {
                "coordinates": [
                    [-111.9400, 33.4255],
                    [-111.9402, 33.4256],
                    [-111.9404, 33.4257],
                    [-111.9406, 33.4258],
                    [-111.9408, 33.4259],
                    [-111.9410, 33.4260],
                    [-111.9412, 33.4261],
                    [-111.9414, 33.4262],
                    [-111.9416, 33.4263],
                    [-111.9418, 33.4264],
                    [-111.9420, 33.4265],
                    [-111.9422, 33.4266],
                ]
            },
            "distance": 600.0,
            "duration": 150.0,
        }
    ]
}

# Cool-zone polyline: all points near Papago Park Canopy (33.4508, -111.9498, r=600m)
MOCK_MAPBOX_COOL = {
    "routes": [
        {
            "geometry": {
                "coordinates": [
                    [-111.9498, 33.4508],
                    [-111.9496, 33.4510],
                    [-111.9494, 33.4512],
                    [-111.9492, 33.4514],
                    [-111.9490, 33.4516],
                    [-111.9488, 33.4518],
                    [-111.9486, 33.4520],
                    [-111.9484, 33.4522],
                    [-111.9482, 33.4524],
                    [-111.9480, 33.4526],
                    [-111.9478, 33.4528],
                    [-111.9476, 33.4530],
                ]
            },
            "distance": 600.0,
            "duration": 150.0,
        }
    ]
}

# ── Helpers ───────────────────────────────────────────────────────────────────

FROZEN_NOW = datetime(2024, 7, 15, 14, 0, 0, tzinfo=timezone.utc)

SAMPLE_WEATHER = WeatherResponse(
    current=WeatherSnapshot(
        temp_c=41.0,
        humidity_pct=15.0,
        heat_index_c=43.5,
        uv_index=10.0,
        apparent_temp_c=43.0,
        wind_kmh=12.0,
    ),
    forecast_hourly=[],
    advisories=[],
    air_quality=None,
    provenance=Provenance(
        env_source=SourceRef(
            source_id="open-meteo",
            timestamp=FROZEN_NOW,
            age_seconds=0,
        )
    ),
)

SAMPLE_REQUEST = RouteRequest(
    origin=(33.4255, -111.9400),
    destination=(33.4290, -111.9310),
    depart_time=FROZEN_NOW,
)


def _make_mapbox_response(data: dict) -> MagicMock:
    """Build a mock httpx.Response for a Mapbox call."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = data
    mock_resp.raise_for_status = MagicMock()
    return mock_resp


def _make_mapbox_client(first_response: dict, second_response: dict | None = None):
    """
    Return a mock async httpx.AsyncClient context manager.

    first_response  → returned for the 1st Mapbox call (fastest route)
    second_response → returned for the 2nd Mapbox call (pulseroute); defaults to first_response
    """
    if second_response is None:
        second_response = first_response

    call_count = 0

    async def mock_get(url, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _make_mapbox_response(first_response)
        return _make_mapbox_response(second_response)

    mock_client = AsyncMock()
    mock_client.get = mock_get
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


def _make_full_route_response() -> RouteResponse:
    """Pre-built RouteResponse for endpoint-level tests."""
    seg = RouteSegment(
        id="seg-fastest-000",
        polyline=[(33.4255, -111.9400), (33.4260, -111.9390)],
        mrt_mean_c=49.0,
        length_m=100.0,
        eta_seconds_into_ride=0,
        forecasted_temp_c=41.0,
    )
    stop = Stop(
        id="official-001",
        name="Tempe Beach Park Fountain",
        lat=33.4285,
        lng=-111.9450,
        amenities=["water", "shade"],
        open_now=True,
        source="official",
        source_ref="osm:node/123456",
    )
    prov = Provenance(
        env_source=SourceRef(
            source_id="open-meteo",
            timestamp=FROZEN_NOW,
            age_seconds=0,
        ),
        route_segment_id="seg-fastest-000",
    )
    route = Route(
        polyline=[(33.4255, -111.9400), (33.4260, -111.9390)],
        distance_m=1200.0,
        eta_seconds=300,
        peak_mrt_c=55.0,
        mean_mrt_c=49.0,
        shade_pct=0.0,
        stops=[stop],
        segments=[seg],
        provenance=prov,
    )
    return RouteResponse(fastest=route, pulseroute=route, provenance=prov)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_cache():
    """Flush cache before and after every test."""
    cache.flush()
    yield
    cache.flush()


@pytest.fixture(autouse=True)
def set_mapbox_token(monkeypatch):
    """Ensure MAPBOX_ACCESS_TOKEN is always set for tests."""
    monkeypatch.setenv("MAPBOX_ACCESS_TOKEN", "test-token-abc123")


# ── Tests ─────────────────────────────────────────────────────────────────────


async def test_compute_route_returns_response():
    """Mock Mapbox + weather → returns RouteResponse with fastest and pulseroute."""
    svc = RouteService()
    mock_client = _make_mapbox_client(MOCK_MAPBOX)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await svc.compute_route(SAMPLE_REQUEST, SAMPLE_WEATHER)

    assert isinstance(result, RouteResponse)
    assert result.fastest is not None
    assert result.pulseroute is not None
    assert len(result.fastest.polyline) > 0
    assert len(result.pulseroute.polyline) > 0
    assert result.fastest.distance_m == 1200.0
    assert result.fastest.eta_seconds == 300


async def test_pulseroute_mean_mrt_lte_fastest():
    """
    PulseRoute mean_mrt_c <= fastest mean_mrt_c when fastest goes through a
    hot zone and pulseroute goes through a cool zone.
    """
    svc = RouteService()
    # First call (fastest) → hot zone polyline
    # Second call (pulseroute) → cool zone polyline
    mock_client = _make_mapbox_client(MOCK_MAPBOX_HOT, MOCK_MAPBOX_COOL)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await svc.compute_route(SAMPLE_REQUEST, SAMPLE_WEATHER)

    assert result.pulseroute.mean_mrt_c <= result.fastest.mean_mrt_c, (
        f"Expected pulseroute mean_mrt_c ({result.pulseroute.mean_mrt_c:.2f}) "
        f"<= fastest mean_mrt_c ({result.fastest.mean_mrt_c:.2f})"
    )


async def test_route_has_provenance():
    """Both routes must have provenance.route_segment_id not None."""
    svc = RouteService()
    mock_client = _make_mapbox_client(MOCK_MAPBOX)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await svc.compute_route(SAMPLE_REQUEST, SAMPLE_WEATHER)

    assert result.fastest.provenance.route_segment_id is not None, (
        "fastest.provenance.route_segment_id should not be None"
    )
    assert result.pulseroute.provenance.route_segment_id is not None, (
        "pulseroute.provenance.route_segment_id should not be None"
    )


async def test_route_has_segments():
    """Both routes must have at least 1 segment."""
    svc = RouteService()
    mock_client = _make_mapbox_client(MOCK_MAPBOX)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await svc.compute_route(SAMPLE_REQUEST, SAMPLE_WEATHER)

    assert len(result.fastest.segments) >= 1, (
        f"Expected >= 1 segment in fastest, got {len(result.fastest.segments)}"
    )
    assert len(result.pulseroute.segments) >= 1, (
        f"Expected >= 1 segment in pulseroute, got {len(result.pulseroute.segments)}"
    )


def test_route_endpoint_200():
    """POST /route with mocked services returns 200."""
    pre_built = _make_full_route_response()

    with (
        patch(
            "backend.routers.route.route_service.compute_route",
            new=AsyncMock(return_value=pre_built),
        ),
        patch(
            "backend.routers.route.weather_service.get_weather",
            new=AsyncMock(return_value=SAMPLE_WEATHER),
        ),
    ):
        response = client.post(
            "/route",
            json={
                "origin": [33.4255, -111.9400],
                "destination": [33.4290, -111.9310],
                "depart_time": FROZEN_NOW.isoformat(),
            },
        )

    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert "fastest" in data
    assert "pulseroute" in data
    assert "provenance" in data
