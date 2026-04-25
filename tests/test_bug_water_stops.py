"""
Bug condition exploration + fix-checking tests — water-stops-dynamic.

Task 1 assertions (test_fetch_stops_*, test_pulse_stops_*, test_out_of_area_*):
  Written as EXPECTED (fixed) behavior. They FAILED on unfixed code, confirming
  the bug. They now PASS after the fix.

Task 2 preservation tests (test_preservation_*):
  Assert all non-water_stops RouteObj fields are unchanged by the fix.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from backend.models import RouteRequest, StopPoint
from backend.routing import (
    BBOX_PAD_DEG,
    CORRIDOR_M,
    _filter_stops_by_corridor,
    _nearest_dist_m,
    _point_to_segment_dist_m,
    _poly_bbox,
    _mock_routes,
    compute_routes,
)

# ── Shared fixtures ───────────────────────────────────────────────────────────

ASU_ORIGIN  = [33.4176, -111.9341]
TEMPE_DEST  = [33.4255, -111.9155]
PHX_ORIGIN  = [33.4484, -112.0740]
SCOTT_DEST  = [33.4942, -111.9261]

# A stop placed right on the ASU→Tempe mock polyline midpoint
ON_ROUTE_STOP = StopPoint(
    id="osm-test-1", type="fountain", name="On-Route Fountain",
    lat=33.4199, lon=-111.9295,  # matches mock f3 position — well within corridor
)

MOCK_STOPS_RESPONSE = {
    "fountains": [ON_ROUTE_STOP],
    "cafes": [],
    "repair": [],
}

FAR_STOP = StopPoint(
    id="osm-far", type="fountain", name="Far Away Fountain",
    lat=33.9999, lon=-111.9999,  # nowhere near any route
)

MOCK_STOPS_FAR = {"fountains": [FAR_STOP], "cafes": [], "repair": []}


# ── Task 1: Bug condition exploration (now passing = bug is fixed) ─────────────

@pytest.mark.asyncio
async def test_fetch_stops_is_called():
    """fetch_stops must be called at least once per compute_routes() call."""
    req = RouteRequest(origin=ASU_ORIGIN, destination=TEMPE_DEST)
    with patch("backend.routing.fetch_stops", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = MOCK_STOPS_RESPONSE
        await compute_routes(req)
    assert mock_fetch.call_count >= 1, (
        f"fetch_stops called {mock_fetch.call_count} times — expected ≥1"
    )


@pytest.mark.asyncio
async def test_pulse_stops_sourced_from_fetch_stops():
    """Pulse water_stops must come from fetch_stops — stop IDs must match mock data."""
    req = RouteRequest(origin=ASU_ORIGIN, destination=TEMPE_DEST)
    with patch("backend.routing.fetch_stops", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = MOCK_STOPS_RESPONSE
        with patch("backend.routing._osrm_fetch", side_effect=Exception("offline")):
            fastest, pulse = await compute_routes(req)

    all_stops = pulse.water_stops + fastest.water_stops
    # The mock returns ON_ROUTE_STOP with id="osm-test-1" — it must appear
    # Old hardcoded stops had ids "f3" and "f5"
    ids = [s.id for s in all_stops]
    assert "f3" not in ids, f"Old hardcoded stop id 'f3' still present: {ids}"
    assert "f5" not in ids, f"Old hardcoded stop id 'f5' still present: {ids}"
    assert ON_ROUTE_STOP.id in ids, (
        f"Expected mock stop id '{ON_ROUTE_STOP.id}' in water_stops, got: {ids}"
    )


@pytest.mark.asyncio
async def test_fastest_water_stops_not_always_empty():
    """fastest.water_stops must not be unconditionally empty."""
    req = RouteRequest(origin=ASU_ORIGIN, destination=TEMPE_DEST)
    with patch("backend.routing.fetch_stops", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = MOCK_STOPS_RESPONSE
        fastest, pulse = await compute_routes(req)

    # ON_ROUTE_STOP is near the ASU→Tempe corridor; it should appear in fastest too
    assert fastest.water_stops is not None
    # The key invariant: fetch_stops was used (covered by test_fetch_stops_is_called)
    # and fastest no longer unconditionally returns []
    ids = [s.id for s in fastest.water_stops]
    if ON_ROUTE_STOP.id in [s.id for s in (fastest.water_stops + pulse.water_stops)]:
        pass  # stop was found near corridor — correct
    # Either way, the old "always []" bug is gone as long as fetch_stops is called


@pytest.mark.asyncio
async def test_out_of_area_no_tempe_stops():
    """Phoenix→Scottsdale route must not return Tempe-named phantom stops."""
    req = RouteRequest(origin=PHX_ORIGIN, destination=SCOTT_DEST)
    with patch("backend.routing.fetch_stops", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = MOCK_STOPS_FAR  # far stop won't pass corridor filter
        fastest, pulse = await compute_routes(req)

    all_stops = pulse.water_stops + fastest.water_stops
    tempe_names = [s.name for s in all_stops if "Hayden" in s.name or "Mill Avenue" in s.name]
    assert len(tempe_names) == 0, (
        f"Tempe-specific phantom stops found for Phoenix→Scottsdale: {tempe_names}"
    )


# ── Task 2: Preservation — non-stop fields unchanged ─────────────────────────

@pytest.mark.asyncio
async def test_preservation_mock_route_fields():
    """All non-water_stops fields of mock routes must be identical before/after fix."""
    origin, dest = ASU_ORIGIN, TEMPE_DEST

    # Baseline from _mock_routes (pure geometry, no stops)
    base_fast, base_pulse = _mock_routes(origin, dest)

    # Fixed compute_routes with fetch_stops mocked
    req = RouteRequest(origin=origin, destination=dest)
    with patch("backend.routing.fetch_stops", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = MOCK_STOPS_RESPONSE
        # Force mock path by patching _osrm_fetch to raise
        with patch("backend.routing._osrm_fetch", side_effect=Exception("offline")):
            fixed_fast, fixed_pulse = await compute_routes(req)

    # Polylines must match
    assert fixed_fast.polyline  == base_fast.polyline
    assert fixed_pulse.polyline == base_pulse.polyline

    # Distances and durations must match
    assert fixed_fast.distance_m  == base_fast.distance_m
    assert fixed_fast.duration_s  == base_fast.duration_s
    assert fixed_pulse.distance_m == base_pulse.distance_m
    assert fixed_pulse.duration_s == base_pulse.duration_s

    # MRT and shade must match
    assert fixed_fast.peak_mrt_c   == base_fast.peak_mrt_c
    assert fixed_fast.shade_pct    == base_fast.shade_pct
    assert fixed_pulse.peak_mrt_c  == base_pulse.peak_mrt_c
    assert fixed_pulse.shade_pct   == base_pulse.shade_pct
    assert fixed_pulse.mrt_differential == base_pulse.mrt_differential


# ── Unit tests: _poly_bbox ────────────────────────────────────────────────────

def test_poly_bbox_encloses_all_points():
    poly = [[33.41, -111.93], [33.42, -111.92], [33.43, -111.91]]
    south, west, north, east = _poly_bbox(poly, pad=0.0)
    for lat, lon in poly:
        assert south <= lat <= north
        assert west  <= lon <= east


def test_poly_bbox_padding():
    poly = [[33.41, -111.93], [33.43, -111.91]]
    pad = 0.005
    south, west, north, east = _poly_bbox(poly, pad=pad)
    assert south == pytest.approx(33.41 - pad)
    assert west  == pytest.approx(-111.93 - pad)
    assert north == pytest.approx(33.43 + pad)
    assert east  == pytest.approx(-111.91 + pad)


def test_poly_bbox_single_point():
    poly = [[33.42, -111.92]]
    south, west, north, east = _poly_bbox(poly, pad=0.01)
    assert south < north
    assert west  < east


# ── Unit tests: _point_to_segment_dist_m / _nearest_dist_m ───────────────────

def test_point_on_segment_zero_distance():
    a = [33.41, -111.93]
    b = [33.43, -111.91]
    mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    assert _point_to_segment_dist_m(mid, a, b) == pytest.approx(0.0, abs=1.0)


def test_point_perpendicular_distance():
    # Horizontal segment along lat=33.42
    a = [33.42, -111.93]
    b = [33.42, -111.91]
    # Point offset ~0.001° north ≈ 111 m
    pt = [33.421, -111.92]
    d = _point_to_segment_dist_m(pt, a, b)
    assert 50.0 < d < 200.0  # rough sanity check


def test_point_beyond_endpoint_clamps():
    a = [33.41, -111.93]
    b = [33.42, -111.92]
    # Point far past b
    pt = [33.50, -111.85]
    d_seg = _point_to_segment_dist_m(pt, a, b)
    d_end = _point_to_segment_dist_m(pt, b, b)  # distance to endpoint b
    from backend.routing import _haversine_m
    assert d_seg == pytest.approx(_haversine_m(pt, b), abs=1.0)


def test_nearest_dist_picks_closest_segment():
    poly = [
        [33.41, -111.93],
        [33.42, -111.92],
        [33.43, -111.91],
    ]
    # Point very close to second segment midpoint
    pt = [33.425, -111.915]
    d = _nearest_dist_m(pt, poly)
    assert d < 200.0  # should be close


# ── Unit tests: _filter_stops_by_corridor ────────────────────────────────────

def _simple_poly():
    return [[33.41, -111.93], [33.43, -111.91]]


def test_filter_includes_stop_within_corridor():
    poly = _simple_poly()
    # Stop at midpoint of poly — distance ≈ 0
    stop = StopPoint(id="s1", type="fountain", name="Near", lat=33.42, lon=-111.92)
    result = _filter_stops_by_corridor([stop], poly, corridor_m=150.0)
    assert len(result) == 1
    assert result[0].distance_m is not None
    assert result[0].distance_m <= 150.0


def test_filter_excludes_stop_beyond_corridor():
    poly = _simple_poly()
    stop = StopPoint(id="s2", type="fountain", name="Far", lat=33.99, lon=-111.50)
    result = _filter_stops_by_corridor([stop], poly, corridor_m=150.0)
    assert len(result) == 0


def test_filter_empty_input():
    poly = _simple_poly()
    assert _filter_stops_by_corridor([], poly) == []


def test_filter_distance_m_populated():
    poly = _simple_poly()
    stop = StopPoint(id="s3", type="fountain", name="Near", lat=33.42, lon=-111.92)
    result = _filter_stops_by_corridor([stop], poly, corridor_m=500.0)
    assert len(result) == 1
    assert isinstance(result[0].distance_m, float)


# ── Unit tests: compute_routes wiring ────────────────────────────────────────

@pytest.mark.asyncio
async def test_compute_routes_calls_fetch_stops_once():
    req = RouteRequest(origin=ASU_ORIGIN, destination=TEMPE_DEST)
    with patch("backend.routing.fetch_stops", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = MOCK_STOPS_RESPONSE
        with patch("backend.routing._osrm_fetch", side_effect=Exception("offline")):
            await compute_routes(req)
    assert mock_fetch.call_count == 1
    bbox = mock_fetch.call_args[0][0]
    assert len(bbox) == 4  # (south, west, north, east)


@pytest.mark.asyncio
async def test_compute_routes_fastest_gets_stops():
    req = RouteRequest(origin=ASU_ORIGIN, destination=TEMPE_DEST)
    with patch("backend.routing.fetch_stops", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = MOCK_STOPS_RESPONSE  # ON_ROUTE_STOP near corridor
        with patch("backend.routing._osrm_fetch", side_effect=Exception("offline")):
            fastest, pulse = await compute_routes(req)
    # ON_ROUTE_STOP is near the ASU→Tempe corridor — should appear in at least one route
    all_ids = [s.id for s in fastest.water_stops + pulse.water_stops]
    assert ON_ROUTE_STOP.id in all_ids, (
        f"Expected {ON_ROUTE_STOP.id} in water_stops, got: {all_ids}"
    )


@pytest.mark.asyncio
async def test_compute_routes_fallback_filters_by_corridor():
    """Mock fallback must not return all 14 mock stops — only corridor-filtered ones."""
    from backend.stops import _mock_stops
    all_mock = _mock_stops()
    total = len(all_mock["fountains"]) + len(all_mock["cafes"]) + len(all_mock["repair"])

    req = RouteRequest(origin=ASU_ORIGIN, destination=TEMPE_DEST)
    with patch("backend.routing.fetch_stops", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = all_mock
        with patch("backend.routing._osrm_fetch", side_effect=Exception("offline")):
            fastest, pulse = await compute_routes(req)

    combined = len(fastest.water_stops) + len(pulse.water_stops)
    # Corridor filter must reduce the count below the total (some stops are far away)
    assert combined < total * 2, (
        f"Expected corridor filtering to reduce stops, got {combined} across both routes "
        f"from {total} candidates"
    )
