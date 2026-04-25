"""
Tests for WeatherService and GET /weather endpoint.

Uses unittest.mock to patch httpx.AsyncClient so no real network calls are made.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routers.weather import router
from backend.services.cache import cache
from backend.services.weather_service import WeatherService
from shared.schema import Provenance, SourceRef, WeatherHourly, WeatherResponse, WeatherSnapshot

# ── Minimal test app ──────────────────────────────────────────────────────────

test_app = FastAPI()
test_app.include_router(router)
client = TestClient(test_app)

# ── Mock payloads ─────────────────────────────────────────────────────────────

def _build_open_meteo_mock() -> dict:
    """Build Open-Meteo mock data anchored to the current UTC hour so that
    _find_current_hour_index lands at index 0 and 6 forecast entries follow."""
    now_utc = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = [(now_utc + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M") for h in range(24)]
    return {
        "current_weather": {
            "temperature": 41.0,
            "windspeed": 12.0,
            "time": times[0],
        },
        "hourly": {
            "time": times,
            "temperature_2m": [35.0] * 24,
            "relativehumidity_2m": [15] * 24,
            "uv_index": [8.0] * 24,
        },
    }

MOCK_OPEN_METEO = _build_open_meteo_mock()

MOCK_NWS = {"features": []}


def _make_mock_response(json_data: dict, status_code: int = 200) -> MagicMock:
    """Build a mock httpx.Response."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = json_data
    mock_resp.raise_for_status = MagicMock()  # no-op for 200
    return mock_resp


def _make_client_mock(open_meteo_data=None, nws_data=None, open_meteo_exc=None):
    """
    Return a mock async context manager for httpx.AsyncClient.

    open_meteo_exc: if set, the Open-Meteo GET raises this exception.
    """
    om_data = open_meteo_data if open_meteo_data is not None else MOCK_OPEN_METEO
    nws_d = nws_data if nws_data is not None else MOCK_NWS

    async def mock_get(url, **kwargs):
        if "open-meteo" in url:
            if open_meteo_exc is not None:
                raise open_meteo_exc
            return _make_mock_response(om_data)
        if "weather.gov" in url:
            return _make_mock_response(nws_d)
        if "airnowapi" in url:
            return _make_mock_response([])
        return _make_mock_response({})

    mock_client = AsyncMock()
    mock_client.get = mock_get
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_weather_response() -> WeatherResponse:
    """Pre-built WeatherResponse for endpoint tests."""
    now = datetime(2024, 7, 15, 14, 0, 0, tzinfo=timezone.utc)
    return WeatherResponse(
        current=WeatherSnapshot(
            temp_c=41.0,
            humidity_pct=15.0,
            heat_index_c=43.5,
            uv_index=8.0,
            apparent_temp_c=43.5,
            wind_kmh=12.0,
        ),
        forecast_hourly=[
            WeatherHourly(
                at=datetime(2024, 7, 15, h, 0, 0, tzinfo=timezone.utc),
                temp_c=35.0,
                humidity_pct=15.0,
                uv_index=8.0,
            )
            for h in range(15, 21)
        ],
        advisories=[],
        air_quality=None,
        provenance=Provenance(
            env_source=SourceRef(
                source_id="open-meteo",
                timestamp=now,
                age_seconds=0,
            )
        ),
    )


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def clear_cache():
    """Flush the cache before every test to prevent cross-test pollution."""
    cache.flush()
    yield
    cache.flush()


async def test_weather_returns_response():
    """Mock both APIs 200 → returns WeatherResponse with provenance.env_source not None."""
    svc = WeatherService()
    mock_client = _make_client_mock()

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await svc.get_weather(lat=33.4255, lng=-111.9400)

    assert isinstance(result, WeatherResponse)
    assert result.provenance.env_source is not None
    assert result.current.temp_c == 41.0


async def test_weather_cache_hit():
    """Call service twice with same coords — httpx should only be called once."""
    svc = WeatherService()
    call_count = 0

    async def counting_get(url, **kwargs):
        nonlocal call_count
        call_count += 1
        if "open-meteo" in url:
            return _make_mock_response(MOCK_OPEN_METEO)
        if "weather.gov" in url:
            return _make_mock_response(MOCK_NWS)
        return _make_mock_response({})

    mock_client = AsyncMock()
    mock_client.get = counting_get
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=mock_client):
        await svc.get_weather(lat=33.4255, lng=-111.9400)
        first_call_count = call_count
        await svc.get_weather(lat=33.4255, lng=-111.9400)

    # Second call should not have triggered any new HTTP requests
    assert call_count == first_call_count, (
        f"Expected no new HTTP calls on cache hit, but call_count went from "
        f"{first_call_count} to {call_count}"
    )


async def test_open_meteo_down_falls_back_to_nws():
    """Open-Meteo raises TimeoutException → falls back, env_source.source_id == 'nws'."""
    import httpx as _httpx

    svc = WeatherService()

    # NWS returns a minimal alert so we have something to fall back to
    nws_with_alert = {
        "features": [
            {
                "id": "urn:oid:2.49.0.1.840.0.test",
                "properties": {
                    "headline": "Heat Advisory",
                    "event": "Heat Advisory",
                    "severity": "Moderate",
                    "effective": "2024-07-15T12:00:00+00:00",
                    "expires": "2024-07-15T20:00:00+00:00",
                },
            }
        ]
    }

    mock_client = _make_client_mock(
        open_meteo_exc=_httpx.TimeoutException("timed out"),
        nws_data=nws_with_alert,
    )

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await svc.get_weather(lat=33.4255, lng=-111.9400)

    assert result.provenance.env_source is not None
    assert result.provenance.env_source.source_id == "nws"


async def test_provenance_env_source_not_none():
    """provenance.env_source must always be populated on a successful call."""
    svc = WeatherService()
    mock_client = _make_client_mock()

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await svc.get_weather(lat=33.4255, lng=-111.9400)

    assert result.provenance is not None
    assert result.provenance.env_source is not None


async def test_forecast_hourly_has_6_entries():
    """forecast_hourly must contain at least 6 entries (expanded to 12 for lookahead)."""
    svc = WeatherService()
    mock_client = _make_client_mock()

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await svc.get_weather(lat=33.4255, lng=-111.9400)

    assert len(result.forecast_hourly) >= 6, (
        f"Expected at least 6 forecast entries, got {len(result.forecast_hourly)}"
    )


def test_weather_endpoint_200():
    """GET /weather?lat=33.4255&lng=-111.9400 with mocked service returns 200."""
    pre_built = _make_weather_response()

    with patch(
        "backend.routers.weather.weather_service.get_weather",
        new=AsyncMock(return_value=pre_built),
    ):
        response = client.get("/weather?lat=33.4255&lng=-111.9400")

    assert response.status_code == 200
    data = response.json()
    assert "current" in data
    assert "forecast_hourly" in data
    assert "advisories" in data
    assert "provenance" in data
    assert data["provenance"]["env_source"] is not None


# ── _wind_chill_offset tests ──────────────────────────────────────────────────
# The function is private but has well-defined boundary behaviour worth
# pinning directly, in addition to the integration path through get_weather.

from backend.services.weather_service import _wind_chill_offset  # noqa: E402


class TestWindChillOffset:
    """Unit tests for the _wind_chill_offset helper added in the latest diff."""

    def test_zero_wind_returns_zero(self):
        """No wind → no cooling offset."""
        assert _wind_chill_offset(0.0) == 0.0

    def test_negative_wind_returns_zero(self):
        """Negative wind speed is nonsensical — treated as no wind."""
        assert _wind_chill_offset(-5.0) == 0.0

    def test_small_wind_proportional(self):
        """10 km/h → -1.5°C (one full step, no cap)."""
        result = _wind_chill_offset(10.0)
        assert result == pytest.approx(-1.5, abs=1e-9)

    def test_moderate_wind_proportional(self):
        """20 km/h → -3.0°C (two steps, still below cap)."""
        result = _wind_chill_offset(20.0)
        assert result == pytest.approx(-3.0, abs=1e-9)

    def test_cap_at_minus_six(self):
        """40 km/h would be -6.0°C without cap; cap must hold."""
        result = _wind_chill_offset(40.0)
        assert result == pytest.approx(-6.0, abs=1e-9)

    def test_very_high_wind_still_capped(self):
        """Extreme wind (200 km/h) must not exceed the -6°C cap."""
        result = _wind_chill_offset(200.0)
        assert result == pytest.approx(-6.0, abs=1e-9)

    def test_return_value_is_non_positive(self):
        """Offset must always be ≤ 0 (wind only cools, never warms)."""
        for speed in [0.0, 5.0, 15.0, 40.0, 100.0]:
            assert _wind_chill_offset(speed) <= 0.0


async def test_get_weather_wind_kmh_propagated():
    """wind_kmh from Open-Meteo current_weather flows through to current snapshot."""
    now_utc = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = [(now_utc + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M") for h in range(24)]

    open_meteo_with_wind = {
        "current_weather": {
            "temperature": 38.0,
            "windspeed": 25.0,   # <── the value we want to see in the response
            "time": times[0],
        },
        "hourly": {
            "time": times,
            "temperature_2m": [38.0] * 24,
            "relativehumidity_2m": [20] * 24,
            "uv_index": [9.0] * 24,
        },
    }

    svc = WeatherService()
    mock_client = _make_client_mock(open_meteo_data=open_meteo_with_wind)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await svc.get_weather(lat=33.4255, lng=-111.9400)

    assert result.current.wind_kmh == pytest.approx(25.0)
    # Provenance must still be populated
    assert result.provenance.env_source is not None
    assert result.provenance.env_source.source_id == "open-meteo"


async def test_get_weather_zero_wind_does_not_error():
    """windspeed=0 in Open-Meteo payload → _wind_chill_offset(0) path, no exception."""
    now_utc = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = [(now_utc + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M") for h in range(24)]

    calm_day = {
        "current_weather": {
            "temperature": 40.0,
            "windspeed": 0.0,
            "time": times[0],
        },
        "hourly": {
            "time": times,
            "temperature_2m": [40.0] * 24,
            "relativehumidity_2m": [10] * 24,
            "uv_index": [10.0] * 24,
        },
    }

    svc = WeatherService()
    mock_client = _make_client_mock(open_meteo_data=calm_day)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await svc.get_weather(lat=33.4255, lng=-111.9400)

    assert result.current.wind_kmh == pytest.approx(0.0)
    assert result.provenance.env_source is not None
