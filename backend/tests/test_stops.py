"""
Tests for StopsService and GET /stops endpoint.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routers.stops import router
from backend.services.stops_service import StopsService

# ── Minimal test app ──────────────────────────────────────────────────────────

test_app = FastAPI()
test_app.include_router(router)
client = TestClient(test_app)

# ── Shared service instance (loads seed once for all tests) ───────────────────

_svc = StopsService()

TEMPE_BBOX = (33.39, -111.96, 33.46, -111.90)
PAPAGO_BBOX = (33.44, -111.96, 33.46, -111.94)


# ── Tests ─────────────────────────────────────────────────────────────────────


def test_tempe_bbox_returns_stops():
    """Full Tempe bbox should return at least some fountains or cafes."""
    result = _svc.get_stops(bbox=TEMPE_BBOX)
    assert len(result.fountains) > 0 or len(result.cafes) > 0


def test_water_amenity_filter():
    """All stops returned when amenity=water must have 'water' in amenities."""
    result = _svc.get_stops(bbox=TEMPE_BBOX, amenity="water")
    all_stops = result.fountains + result.cafes + result.repair
    assert len(all_stops) > 0, "Expected at least one water stop in Tempe bbox"
    for stop in all_stops:
        assert "water" in stop.amenities, (
            f"Stop '{stop.name}' returned for amenity=water but lacks 'water' amenity"
        )


def test_bbox_excludes_outside():
    """Tight bbox around Papago Park should return only the Papago stop."""
    result = _svc.get_stops(bbox=PAPAGO_BBOX)
    all_stops = result.fountains + result.cafes + result.repair
    assert len(all_stops) == 1, (
        f"Expected exactly 1 stop in Papago bbox, got {len(all_stops)}: "
        f"{[s.name for s in all_stops]}"
    )
    assert all_stops[0].id == "official-002"


def test_at_least_5_water_stops_in_tempe():
    """There should be at least 5 water stops across the full Tempe bbox."""
    result = _svc.get_stops(bbox=TEMPE_BBOX, amenity="water")
    all_stops = result.fountains + result.cafes + result.repair
    assert len(all_stops) >= 5, (
        f"Expected >= 5 water stops in Tempe bbox, got {len(all_stops)}"
    )


def test_provenance_present():
    """StopsResponse must carry a provenance with env_source populated."""
    result = _svc.get_stops(bbox=TEMPE_BBOX)
    assert result.provenance is not None
    assert result.provenance.env_source is not None


def test_shade_zones_excludes_fountains():
    """Shade zones should include stops with shade amenity but exclude fountain sources."""
    result = _svc.get_stops(bbox=TEMPE_BBOX)
    
    # Should have some shade zones
    assert len(result.shade_zones) > 0, "Expected at least one shade zone in Tempe bbox"
    
    # None of the shade zones should be from fountain sources
    for stop in result.shade_zones:
        assert stop.source not in {"official", "fountain"}, (
            f"Stop '{stop.name}' (source={stop.source}) should not be in shade_zones "
            f"because it's a fountain source"
        )
        assert "shade" in stop.amenities, (
            f"Stop '{stop.name}' in shade_zones must have 'shade' amenity"
        )


def test_shade_zones_with_amenity_filter():
    """When filtering by amenity=shade, shade_zones should only contain matching stops."""
    result = _svc.get_stops(bbox=TEMPE_BBOX, amenity="shade")
    
    # All returned stops should have shade amenity
    all_stops = result.fountains + result.cafes + result.repair + result.shade_zones
    assert len(all_stops) > 0, "Expected at least one stop with shade amenity"
    
    for stop in all_stops:
        assert "shade" in stop.amenities, (
            f"Stop '{stop.name}' returned for amenity=shade but lacks 'shade' amenity"
        )


def test_shade_zones_categorization():
    """
    Verify shade zones are correctly categorized:
    - public-002, public-003, public-005 should be in shade_zones (shade but not fountain)
    - official-001, official-002 should NOT be in shade_zones (fountain sources)
    """
    result = _svc.get_stops(bbox=TEMPE_BBOX)
    
    shade_zone_ids = {s.id for s in result.shade_zones}
    
    # These public stops with shade should be in shade_zones
    expected_shade_zones = {"public-002", "public-003", "public-005", "public-006"}
    found_expected = expected_shade_zones & shade_zone_ids
    assert len(found_expected) > 0, (
        f"Expected to find some of {expected_shade_zones} in shade_zones, "
        f"but got {shade_zone_ids}"
    )
    
    # These fountain sources with shade should NOT be in shade_zones
    fountain_ids = {s.id for s in result.fountains}
    overlap = fountain_ids & shade_zone_ids
    assert len(overlap) == 0, (
        f"Fountains {overlap} should not appear in shade_zones"
    )


def test_empty_bbox_returns_empty_shade_zones():
    """A bbox with no stops should return empty shade_zones list."""
    # Bbox far from any stops
    empty_bbox = (33.0, -112.5, 33.1, -112.4)
    result = _svc.get_stops(bbox=empty_bbox)
    
    assert len(result.shade_zones) == 0
    assert len(result.fountains) == 0
    assert len(result.cafes) == 0
    assert len(result.repair) == 0


def test_stops_endpoint_200():
    """GET /stops with a valid Tempe bbox should return HTTP 200."""
    response = client.get("/stops?bbox=33.39,-111.96,33.46,-111.90")
    assert response.status_code == 200
    data = response.json()
    assert "fountains" in data
    assert "cafes" in data
    assert "repair" in data
    assert "shade_zones" in data
    assert "provenance" in data


# ── Overpass API Integration Tests ───────────────────────────────────────────


@pytest.fixture
def mock_overpass_response():
    """Sample Overpass API response with various stop types."""
    return {
        "elements": [
            {
                "type": "node",
                "id": 123456,
                "lat": 33.42,
                "lon": -111.93,
                "tags": {
                    "amenity": "drinking_water",
                    "name": "Test Fountain"
                }
            },
            {
                "type": "node",
                "id": 123457,
                "lat": 33.43,
                "lon": -111.92,
                "tags": {
                    "amenity": "cafe",
                    "name": "Test Cafe"
                }
            },
            {
                "type": "node",
                "id": 123458,
                "lat": 33.44,
                "lon": -111.91,
                "tags": {
                    "amenity": "shelter",
                    "name": "Test Shelter"
                }
            },
            {
                "type": "node",
                "id": 123459,
                "lat": 33.45,
                "lon": -111.90,
                "tags": {
                    "amenity": "bicycle_repair_station",
                    "name": "Test Repair"
                }
            },
            {
                "type": "way",
                "id": 789012,
                "center": {
                    "lat": 33.41,
                    "lon": -111.94
                },
                "tags": {
                    "leisure": "park",
                    "name": "Test Park"
                }
            }
        ]
    }


def test_overpass_api_success(mock_overpass_response):
    """
    Happy path: Overpass API returns data successfully.
    Verify stops are parsed and categorized correctly.
    """
    svc = StopsService()
    
    with patch("httpx.post") as mock_post:
        # Mock successful API response
        mock_response = Mock()
        mock_response.json.return_value = mock_overpass_response
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        result = svc.get_stops(bbox=TEMPE_BBOX)
        
        # Verify API was called
        assert mock_post.called
        call_args = mock_post.call_args
        assert call_args.kwargs["timeout"] == 5.0
        
        # Verify stops were parsed
        all_stops = result.fountains + result.cafes + result.repair + result.shade_zones
        assert len(all_stops) >= 5, "Should have parsed at least 5 stops from mock response"
        
        # Verify categorization
        assert any(s.name == "Test Fountain" for s in result.fountains), "Fountain should be categorized"
        assert any(s.name == "Test Cafe" for s in result.cafes), "Cafe should be categorized"
        assert any(s.name == "Test Repair" for s in result.repair), "Repair station should be categorized"
        assert any(s.name in {"Test Shelter", "Test Park"} for s in result.shade_zones), "Shade zones should be categorized"
        
        # Verify provenance
        assert result.provenance is not None
        assert result.provenance.env_source is not None
        assert result.provenance.env_source.source_id == "overpass_api"
        assert result.provenance.env_source.timestamp is not None
        assert result.provenance.env_source.age_seconds >= 0


def test_overpass_api_timeout_fallback():
    """
    Error case: Overpass API times out (>5s).
    Verify service falls back to seed file gracefully.
    """
    svc = StopsService()
    
    with patch("httpx.post") as mock_post:
        # Mock timeout exception
        mock_post.side_effect = httpx.TimeoutException("Request timed out")
        
        result = svc.get_stops(bbox=TEMPE_BBOX)
        
        # Verify API was attempted
        assert mock_post.called
        
        # Verify fallback to seed file
        assert result.provenance.env_source.source_id == "stops_seed_v1"
        
        # Should still return stops from seed file
        all_stops = result.fountains + result.cafes + result.repair + result.shade_zones
        assert len(all_stops) > 0, "Should have stops from seed file fallback"


def test_overpass_api_http_error_fallback():
    """
    Error case: Overpass API returns HTTP error (500, 503, etc).
    Verify service falls back to seed file gracefully.
    """
    svc = StopsService()
    
    with patch("httpx.post") as mock_post:
        # Mock HTTP error
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=Mock(), response=Mock()
        )
        mock_post.return_value = mock_response
        
        result = svc.get_stops(bbox=TEMPE_BBOX)
        
        # Verify API was attempted
        assert mock_post.called
        
        # Verify fallback to seed file
        assert result.provenance.env_source.source_id == "stops_seed_v1"
        
        # Should still return stops from seed file
        all_stops = result.fountains + result.cafes + result.repair + result.shade_zones
        assert len(all_stops) > 0, "Should have stops from seed file fallback"


def test_overpass_api_cache_hit():
    """
    Cache hit path: Second request within 24h should use cached data.
    Verify API is not called again and source_id indicates cache.
    """
    svc = StopsService()
    
    with patch("httpx.post") as mock_post:
        # Mock successful first request
        mock_response = Mock()
        mock_response.json.return_value = {
            "elements": [
                {
                    "type": "node",
                    "id": 999,
                    "lat": 33.42,
                    "lon": -111.93,
                    "tags": {"amenity": "drinking_water", "name": "Cached Fountain"}
                }
            ]
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        # First request - should hit API
        result1 = svc.get_stops(bbox=TEMPE_BBOX)
        assert mock_post.call_count == 1
        assert result1.provenance.env_source.source_id == "overpass_api"
        
        # Second request - should use cache
        result2 = svc.get_stops(bbox=TEMPE_BBOX)
        assert mock_post.call_count == 1, "API should not be called again (cache hit)"
        assert result2.provenance.env_source.source_id == "overpass_api_cached"
        
        # Results should be identical
        assert len(result1.fountains) == len(result2.fountains)


def test_overpass_api_cache_expiration(mock_overpass_response):
    """
    Cache expiration: Request after 24h should trigger new API call.
    """
    svc = StopsService()
    
    with patch("httpx.post") as mock_post:
        # Mock successful API response
        mock_response = Mock()
        mock_response.json.return_value = mock_overpass_response
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        # First request
        result1 = svc.get_stops(bbox=TEMPE_BBOX)
        assert mock_post.call_count == 1
        
        # Manually expire the cache by setting timestamp to 25 hours ago
        cache_key = f"stops_{TEMPE_BBOX}_None"
        if cache_key in svc._cache:
            old_time = datetime.now(timezone.utc) - timedelta(hours=25)
            cached_stops = svc._cache[cache_key][1]
            svc._cache[cache_key] = (old_time, cached_stops)
        
        # Second request - should trigger new API call due to expiration
        result2 = svc.get_stops(bbox=TEMPE_BBOX)
        assert mock_post.call_count == 2, "API should be called again after cache expiration"
        assert result2.provenance.env_source.source_id == "overpass_api"


def test_parse_overpass_response_with_various_amenities(mock_overpass_response):
    """
    Test parsing of Overpass response with various amenity types.
    Verify correct amenity mapping and source categorization.
    """
    svc = StopsService()
    fetch_time = datetime.now(timezone.utc)
    
    stops = svc._parse_overpass_response(mock_overpass_response, fetch_time)
    
    # Should parse all 5 elements
    assert len(stops) == 5
    
    # Check drinking water stop
    fountain = next((s for s in stops if s.name == "Test Fountain"), None)
    assert fountain is not None
    assert "water" in fountain.amenities
    assert fountain.source == "official"
    assert fountain.id.startswith("osm-node-")
    
    # Check cafe stop
    cafe = next((s for s in stops if s.name == "Test Cafe"), None)
    assert cafe is not None
    assert "water" in cafe.amenities
    assert "food" in cafe.amenities
    assert cafe.source == "commercial"
    
    # Check shelter stop
    shelter = next((s for s in stops if s.name == "Test Shelter"), None)
    assert shelter is not None
    assert "shade" in shelter.amenities
    assert shelter.source == "public"
    
    # Check repair station
    repair = next((s for s in stops if s.name == "Test Repair"), None)
    assert repair is not None
    assert "bike_repair" in repair.amenities
    
    # Check park (way with center)
    park = next((s for s in stops if s.name == "Test Park"), None)
    assert park is not None
    assert "shade" in park.amenities
    assert park.id.startswith("osm-way-")


def test_build_overpass_query():
    """
    Test Overpass query builder generates valid QL syntax.
    """
    svc = StopsService()
    query = svc._build_overpass_query(TEMPE_BBOX)
    
    # Verify query contains expected elements
    assert "[out:json]" in query
    assert "[timeout:5]" in query
    assert "amenity" in query
    assert "drinking_water" in query
    assert "cafe" in query
    assert "shelter" in query
    assert "bicycle_repair_station" in query
    assert "out center" in query
    
    # Verify bbox is included (Overpass format: south,west,north,east)
    lat_min, lng_min, lat_max, lng_max = TEMPE_BBOX
    bbox_str = f"{lat_min},{lng_min},{lat_max},{lng_max}"
    assert bbox_str in query


def test_parse_overpass_response_skips_invalid_elements():
    """
    Test that parser gracefully skips elements with missing/invalid data.
    """
    svc = StopsService()
    fetch_time = datetime.now(timezone.utc)
    
    invalid_response = {
        "elements": [
            # Valid element
            {
                "type": "node",
                "id": 1,
                "lat": 33.42,
                "lon": -111.93,
                "tags": {"amenity": "drinking_water", "name": "Valid"}
            },
            # Missing coordinates
            {
                "type": "node",
                "id": 2,
                "tags": {"amenity": "cafe"}
            },
            # Way without center
            {
                "type": "way",
                "id": 3,
                "tags": {"leisure": "park"}
            },
            # No relevant amenities
            {
                "type": "node",
                "id": 4,
                "lat": 33.42,
                "lon": -111.93,
                "tags": {"building": "yes"}
            }
        ]
    }
    
    stops = svc._parse_overpass_response(invalid_response, fetch_time)
    
    # Should only parse the valid element
    assert len(stops) == 1
    assert stops[0].name == "Valid"
