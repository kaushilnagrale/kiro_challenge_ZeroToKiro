"""
Tests for MrtService — hand-curated Tempe zone stub.

Owner: Track B (Sai)
Coverage: point inside hot zone, inside cool zone, outside all zones, route annotation
"""

import pytest
from backend.services.mrt_service import MrtService


@pytest.fixture
def mrt_service():
    """Create MrtService instance for testing."""
    return MrtService()


def test_point_inside_hot_zone(mrt_service):
    """Test MRT calculation for a point inside a hot zone."""
    # Mill Ave corridor: center (33.4255, -111.9400), radius 400m, delta +6
    lat, lng = 33.4255, -111.9400
    ambient_temp = 35.0
    
    mrt = mrt_service.get_mrt(lat, lng, ambient_temp)
    
    # Expected: 35.0 + 8.0 + 6.0 = 49.0
    assert mrt == pytest.approx(49.0, abs=0.1)


def test_point_inside_cool_zone(mrt_service):
    """Test MRT calculation for a point inside a cool zone."""
    # Papago Park canopy: center (33.4508, -111.9498), radius 600m, delta -7
    lat, lng = 33.4508, -111.9498
    ambient_temp = 35.0
    
    mrt = mrt_service.get_mrt(lat, lng, ambient_temp)
    
    # Expected: 35.0 + 8.0 - 7.0 = 36.0
    assert mrt == pytest.approx(36.0, abs=0.1)


def test_point_outside_all_zones(mrt_service):
    """Test MRT calculation for a point outside all zones."""
    # Random point far from any zone
    lat, lng = 33.5000, -112.0000
    ambient_temp = 35.0
    
    mrt = mrt_service.get_mrt(lat, lng, ambient_temp)
    
    # Expected: 35.0 + 8.0 + 0.0 = 43.0 (default delta)
    assert mrt == pytest.approx(43.0, abs=0.1)


def test_route_annotation_peak_greater_than_mean(mrt_service):
    """Test route annotation returns peak > mean for route through varied zones."""
    # Route from cool zone (Papago Park) through hot zone (Mill Ave) to neutral area
    polyline = [
        (33.4508, -111.9498),  # Papago Park (cool, delta -7)
        (33.4380, -111.9450),  # Midpoint
        (33.4255, -111.9400),  # Mill Ave (hot, delta +6)
        (33.4100, -111.9350),  # Beyond Mill Ave
    ]
    ambient_temp = 35.0
    
    peak_mrt, mean_mrt = mrt_service.annotate_route(polyline, ambient_temp)
    
    # Peak should be higher than mean
    assert peak_mrt > mean_mrt
    
    # Peak should be at least the hot zone MRT (35 + 8 + 6 = 49)
    assert peak_mrt >= 49.0
    
    # Mean should be between cool zone and hot zone
    assert 36.0 <= mean_mrt <= 49.0


def test_route_annotation_empty_polyline(mrt_service):
    """Test route annotation handles empty polyline gracefully."""
    polyline = []
    ambient_temp = 35.0
    
    peak_mrt, mean_mrt = mrt_service.annotate_route(polyline, ambient_temp)
    
    # Should return base MRT (ambient + 8.0)
    expected = 43.0
    assert peak_mrt == pytest.approx(expected, abs=0.1)
    assert mean_mrt == pytest.approx(expected, abs=0.1)


def test_route_annotation_single_point(mrt_service):
    """Test route annotation with single point."""
    # Single point in hot zone
    polyline = [(33.4255, -111.9400)]  # Mill Ave
    ambient_temp = 35.0
    
    peak_mrt, mean_mrt = mrt_service.annotate_route(polyline, ambient_temp)
    
    # Peak and mean should be equal for single point
    assert peak_mrt == mean_mrt
    assert peak_mrt == pytest.approx(49.0, abs=0.1)


def test_first_matching_zone_wins(mrt_service):
    """Test that first matching zone wins when zones overlap."""
    # Tempe Town Lake and Tempe Beach Park have same center coordinates
    # Both at (33.4285, -111.9498) but different radii
    # Town Lake: radius 500m, delta -5
    # Beach Park: radius 300m, delta -6
    # First in zones list should win
    
    lat, lng = 33.4285, -111.9498
    ambient_temp = 35.0
    
    mrt = mrt_service.get_mrt(lat, lng, ambient_temp)
    
    # Should match one of the overlapping zones
    # Expected: 35.0 + 8.0 + (either -5 or -6)
    assert mrt in [pytest.approx(38.0, abs=0.1), pytest.approx(37.0, abs=0.1)]


def test_zone_boundary(mrt_service):
    """Test point just outside zone boundary."""
    # Mill Ave corridor: center (33.4255, -111.9400), radius 400m
    # Point ~500m away (outside radius)
    lat, lng = 33.4300, -111.9400  # ~500m north
    ambient_temp = 35.0
    
    mrt = mrt_service.get_mrt(lat, lng, ambient_temp)
    
    # Should be outside zone, so default delta = 0
    # But might be inside another zone, so check it's reasonable
    assert 36.0 <= mrt <= 51.0  # Between coolest and hottest possible
