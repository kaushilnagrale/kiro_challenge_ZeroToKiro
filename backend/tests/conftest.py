"""
Shared pytest fixtures for the PulseRoute backend test suite.

OWNERSHIP: This file is owned by Wave 1 (main agent).
Wave 2 and Wave 3 subagents MUST import from here — never modify this file.
If a subagent needs a new fixture, it creates its own
backend/tests/fixtures/<name>_fixtures.py and imports it locally.
"""

from datetime import datetime, timezone

import pytest
from freezegun import freeze_time  # noqa: F401 — re-exported for subagents

from backend.services.cache import InProcessCache
from shared.schema import (
    AirQuality,
    Biosignal,
    Provenance,
    RideContext,
    SourceRef,
    WeatherSnapshot,
)


# ─────────── Cache ───────────

@pytest.fixture
def mock_cache() -> InProcessCache:
    """Fresh in-process cache instance for each test."""
    return InProcessCache()


# ─────────── Provenance ───────────

FROZEN_NOW = datetime(2024, 7, 15, 14, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def sample_provenance() -> Provenance:
    """A fully-populated, gate-passing Provenance object."""
    return Provenance(
        bio_source=SourceRef(
            source_id="sim_baseline",
            timestamp=FROZEN_NOW,
            age_seconds=5,
        ),
        env_source=SourceRef(
            source_id="open-meteo",
            timestamp=FROZEN_NOW,
            age_seconds=30,
        ),
        route_segment_id="seg-001",
    )


# ─────────── Biosignal ───────────

@pytest.fixture
def sample_biosignal() -> Biosignal:
    """Baseline biosignal — healthy rider, no heat stress."""
    return Biosignal(
        hr=72.0,
        hrv_ms=62.0,
        skin_temp_c=36.4,
        timestamp=FROZEN_NOW,
        source="sim_baseline",
    )


@pytest.fixture
def dehydrating_biosignal() -> Biosignal:
    """Dehydrating biosignal — should trigger red risk level."""
    return Biosignal(
        hr=168.0,
        hrv_ms=19.0,
        skin_temp_c=38.2,
        timestamp=FROZEN_NOW,
        source="sim_dehydrating",
    )


# ─────────── Weather ───────────

@pytest.fixture
def sample_weather_snapshot() -> WeatherSnapshot:
    """Typical hot Tempe summer afternoon."""
    return WeatherSnapshot(
        temp_c=41.0,
        humidity_pct=15.0,
        heat_index_c=43.5,
        uv_index=10.0,
        apparent_temp_c=43.0,
        wind_kmh=12.0,
    )


# ─────────── Ride context ───────────

@pytest.fixture
def sample_ride_context() -> RideContext:
    """30-minute ride near ASU campus."""
    return RideContext(
        minutes=30.0,
        baseline_hr=65.0,
        current_lat=33.4215,
        current_lng=-111.9390,
    )


# ─────────── Frozen time helper ───────────

@pytest.fixture
def frozen_now() -> datetime:
    """Returns the canonical frozen timestamp used across tests."""
    return FROZEN_NOW
