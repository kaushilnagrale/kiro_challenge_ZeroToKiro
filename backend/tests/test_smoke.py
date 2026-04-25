"""
Smoke tests for end-to-end /risk and /route flows.

These tests verify the full integration without mocking internal services.
External APIs (Mapbox, Open-Meteo, NWS) are still mocked.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

# ── Mock Mapbox response ──────────────────────────────────────────────────────

MOCK_MAPBOX_HOT = {
    "routes": [
        {
            "geometry": {
                "coordinates": [
                    [-111.9400, 33.4255],  # Mill Ave hot zone
                    [-111.9402, 33.4256],
                    [-111.9404, 33.4257],
                    [-111.9406, 33.4258],
                ]
            },
            "distance": 300.0,
            "duration": 75.0,
        }
    ]
}

MOCK_MAPBOX_COOL = {
    "routes": [
        {
            "geometry": {
                "coordinates": [
                    [-111.9498, 33.4508],  # Papago Park cool zone
                    [-111.9496, 33.4510],
                    [-111.9494, 33.4512],
                    [-111.9492, 33.4514],
                ]
            },
            "distance": 300.0,
            "duration": 75.0,
        }
    ]
}

MOCK_OPEN_METEO = {
    "current_weather": {
        "temperature": 41.0,
        "windspeed": 12.0,
        "time": "2024-07-15T14:00",
    },
    "hourly": {
        "time": [f"2024-07-15T{h:02d}:00" for h in range(14, 24)],
        "temperature_2m": [41.0] * 10,
        "relativehumidity_2m": [15] * 10,
        "uv_index": [10.0] * 10,
    },
}

MOCK_NWS = {"features": []}


def _make_mock_response(data: dict, status_code: int = 200) -> MagicMock:
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = data
    mock_resp.raise_for_status = MagicMock()
    return mock_resp


def _make_mapbox_client():
    """Mock httpx.AsyncClient for Mapbox + weather calls."""
    call_count = 0

    async def mock_get(url, **kwargs):
        nonlocal call_count
        if "mapbox.com" in url:
            call_count += 1
            if call_count == 1:
                return _make_mock_response(MOCK_MAPBOX_HOT)
            return _make_mock_response(MOCK_MAPBOX_COOL)
        if "open-meteo" in url:
            return _make_mock_response(MOCK_OPEN_METEO)
        if "weather.gov" in url:
            return _make_mock_response(MOCK_NWS)
        return _make_mock_response({})

    mock_client = AsyncMock()
    mock_client.get = mock_get
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


# ── Smoke tests ───────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def set_mapbox_token(monkeypatch):
    """Ensure MAPBOX_ACCESS_TOKEN is set."""
    monkeypatch.setenv("MAPBOX_ACCESS_TOKEN", "test-token")


def test_smoke_risk_dehydrating_session():
    """
    POST /risk with a dehydrating session → returns red alert with provenance.

    Flow:
    1. Set bio mode to dehydrating
    2. POST /risk
    3. Verify red alert returned
    4. Verify provenance present
    """
    session_id = "smoke-dehydrating-001"

    # Set mode to dehydrating
    mode_resp = client.post(
        "/bio/mode",
        json={"session_id": session_id, "mode": "dehydrating"},
    )
    assert mode_resp.status_code == 200

    # Mock weather API
    mock_client = _make_mapbox_client()

    with patch("httpx.AsyncClient", return_value=mock_client):
        # POST /risk
        risk_resp = client.post(
            "/risk",
            json={
                "bio_session_id": session_id,
                "current_lat": 33.4255,
                "current_lng": -111.9400,
                "ride_minutes": 30.0,
                "baseline_hr": 65.0,
            },
        )

    assert risk_resp.status_code == 200, f"Expected 200, got {risk_resp.status_code}: {risk_resp.text}"
    data = risk_resp.json()

    # Should have an alert (not fallback)
    assert data["fallback"] is False, "Expected validated alert, got fallback"
    assert data["alert"] is not None

    # Alert should be red (dehydrating bio + hot weather)
    alert = data["alert"]
    assert alert["risk"]["level"] == "red", f"Expected red alert, got {alert['risk']['level']}"

    # Provenance must be present
    assert "provenance" in alert
    assert alert["provenance"]["bio_source"] is not None
    assert alert["provenance"]["env_source"] is not None
    assert alert["provenance"]["route_segment_id"] is not None


def test_smoke_route_pulseroute_cooler():
    """
    POST /route → pulseroute mean_mrt_c < fastest mean_mrt_c.

    Flow:
    1. POST /route with origin in hot zone, destination elsewhere
    2. Mock Mapbox to return hot-zone polyline for fastest, cool-zone polyline for pulseroute
    3. Verify pulseroute mean_mrt_c < fastest mean_mrt_c
    """
    mock_client = _make_mapbox_client()

    with patch("httpx.AsyncClient", return_value=mock_client):
        route_resp = client.post(
            "/route",
            json={
                "origin": [33.4255, -111.9400],  # Mill Ave (hot)
                "destination": [33.4508, -111.9498],  # Papago Park (cool)
                "depart_time": datetime(2024, 7, 15, 14, 0, 0, tzinfo=timezone.utc).isoformat(),
                "sensitive_mode": False,
            },
        )

    assert route_resp.status_code == 200, f"Expected 200, got {route_resp.status_code}: {route_resp.text}"
    data = route_resp.json()

    fastest = data["fastest"]
    pulseroute = data["pulseroute"]

    # Both routes should have MRT values
    assert "mean_mrt_c" in fastest
    assert "mean_mrt_c" in pulseroute

    # PulseRoute should be cooler (or equal if both go through same zones)
    assert pulseroute["mean_mrt_c"] <= fastest["mean_mrt_c"], (
        f"Expected pulseroute mean_mrt_c ({pulseroute['mean_mrt_c']:.2f}) "
        f"<= fastest mean_mrt_c ({fastest['mean_mrt_c']:.2f})"
    )

    # Both should have provenance
    assert "provenance" in fastest
    assert "provenance" in pulseroute
    assert fastest["provenance"]["route_segment_id"] is not None
    assert pulseroute["provenance"]["route_segment_id"] is not None
