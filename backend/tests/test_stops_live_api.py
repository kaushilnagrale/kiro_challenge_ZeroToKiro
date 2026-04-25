"""
Tests for StopsService live API integration with mocking.

Tests:
1. Successful Overpass API fetch
2. Cache behavior (24h TTL)
3. Timeout fallback to seed file
4. HTTP error fallback to seed file
5. Overpass response parsing
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, patch
import httpx

from backend.services.stops_service import StopsService

TEMPE_BBOX = (33.38, -111.95, 33.52, -111.85)


@pytest.fixture
def mock_overpass_response():
    """Mock successful Overpass API response with various stop types."""
    return {
        "elements": [
            # Drinking water fountain
            {
                "type": "node",
                "id": 123456,
                "lat": 33.42,
                "lon": -111.94,
                "tags": {
                    "amenity": "drinking_water",
                    "name": "Test Fountain",
                }
            },
            # Cafe
            {
                "type": "node",
                "id": 123457,
                "lat": 33.43,
                "lon": -111.93,
                "tags": {
                    "amenity": "cafe",
                    "name": "Test Cafe",
                }
            },
            # Shelter (shade zone)
            {
                "type": "node",
                "id": 123458,
                "lat": 33.44,
                "lon": -111.92,
                "tags": {
                    "amenity": "shelter",
                    "name": "Test Shelter",
                }
            },
            # Bus stop (shade zone)
            {
                "type": "node",
                "id": 123459,
                "lat": 33.45,
                "lon": -111.91,
                "tags": {
                    "highway": "bus_stop",
                    "name": "Test Bus Stop",
                }
            },
            # Park (shade zone, way with center)
            {
                "type": "way",
                "id": 123460,
                "center": {
                    "lat": 33.46,
                    "lon": -111.90,
                },
                "tags": {
                    "leisure": "park",
                    "name": "Test Park",
                }
            },
            # Bike repair station
            {
                "type": "node",
                "id": 123461,
                "lat": 33.41,
                "lon": -111.95,
                "tags": {
                    "amenity": "bicycle_repair_station",
                    "name": "Test Repair",
                }
            },
        ]
    }


def test_successful_overpass_fetch(mock_overpass_response):
    """Test successful fetch from Overpass API."""
    service = StopsService()
    
    with patch('httpx.post') as mock_post:
        # Mock successful API response
        mock_response = Mock()
        mock_response.json.return_value = mock_overpass_response
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        result = service.get_stops(bbox=TEMPE_BBOX)
        
        # Verify API was called
        assert mock_post.called
        
        # Verify stops were parsed correctly
        assert len(result.fountains) == 1  # drinking_water
        assert len(result.cafes) == 1  # cafe
        assert len(result.shade_zones) == 3  # shelter, bus_stop, park
        assert len(result.repair) == 1  # bicycle_repair_station
        
        # Verify provenance
        assert result.provenance.env_source.source_id == "overpass_api"
        
        # Verify stop details
        assert result.fountains[0].name == "Test Fountain"
        assert result.fountains[0].source == "official"
        assert "water" in result.fountains[0].amenities
        
        assert result.cafes[0].name == "Test Cafe"
        assert result.cafes[0].source == "commercial"
        assert "water" in result.cafes[0].amenities
        assert "food" in result.cafes[0].amenities
        
        assert result.shade_zones[0].name == "Test Shelter"
        assert "shade" in result.shade_zones[0].amenities


def test_cache_hit(mock_overpass_response):
    """Test cache hit on second request."""
    service = StopsService()
    
    with patch('httpx.post') as mock_post:
        # Mock successful API response
        mock_response = Mock()
        mock_response.json.return_value = mock_overpass_response
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response
        
        # First request - should hit API
        result1 = service.get_stops(bbox=TEMPE_BBOX)
        assert mock_post.call_count == 1
        assert result1.provenance.env_source.source_id == "overpass_api"
        
        # Second request - should hit cache
        result2 = service.get_stops(bbox=TEMPE_BBOX)
        assert mock_post.call_count == 1  # No additional API call
        assert result2.provenance.env_source.source_id == "overpass_api_cached"
        
        # Results should be the same
        assert len(result1.fountains) == len(result2.fountains)
        assert len(result1.cafes) == len(result2.cafes)
        assert len(result1.shade_zones) == len(result2.shade_zones)


def test_timeout_fallback():
    """Test fallback to seed file on timeout."""
    service = StopsService()
    
    with patch('httpx.post') as mock_post:
        # Mock timeout exception
        mock_post.side_effect = httpx.TimeoutException("Request timed out")
        
        result = service.get_stops(bbox=TEMPE_BBOX)
        
        # Verify API was called
        assert mock_post.called
        
        # Verify fallback to seed file
        assert result.provenance.env_source.source_id == "stops_seed_v1"
        
        # Verify seed file data is returned
        assert len(result.fountains) > 0 or len(result.cafes) > 0


def test_http_error_fallback():
    """Test fallback to seed file on HTTP error."""
    service = StopsService()
    
    with patch('httpx.post') as mock_post:
        # Mock HTTP error
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "406 Not Acceptable",
            request=Mock(),
            response=Mock(status_code=406)
        )
        mock_post.return_value = mock_response
        
        result = service.get_stops(bbox=TEMPE_BBOX)
        
        # Verify API was called
        assert mock_post.called
        
        # Verify fallback to seed file
        assert result.provenance.env_source.source_id == "stops_seed_v1"
        
        # Verify seed file data is returned
        assert len(result.fountains) > 0 or len(result.cafes) > 0


def test_cache_after_fallback():
    """Test that fallback results are cached to avoid repeated API failures."""
    service = StopsService()
    
    with patch('httpx.post') as mock_post:
        # Mock timeout exception
        mock_post.side_effect = httpx.TimeoutException("Request timed out")
        
        # First request - should try API and fall back
        result1 = service.get_stops(bbox=TEMPE_BBOX)
        assert mock_post.call_count == 1
        assert result1.provenance.env_source.source_id == "stops_seed_v1"
        
        # Second request - should hit cache (no additional API call)
        result2 = service.get_stops(bbox=TEMPE_BBOX)
        assert mock_post.call_count == 1  # No additional API call
        assert result2.provenance.env_source.source_id == "overpass_api_cached"


def test_parse_overpass_response_with_missing_fields():
    """Test parsing handles elements with missing fields gracefully."""
    service = StopsService()
    
    # Response with incomplete elements
    incomplete_response = {
        "elements": [
            # Valid element
            {
                "type": "node",
                "id": 123456,
                "lat": 33.42,
                "lon": -111.94,
                "tags": {
                    "amenity": "drinking_water",
                    "name": "Test Fountain",
                }
            },
            # Missing coordinates
            {
                "type": "node",
                "id": 123457,
                "tags": {
                    "amenity": "cafe",
                }
            },
            # Way without center
            {
                "type": "way",
                "id": 123458,
                "tags": {
                    "leisure": "park",
                }
            },
            # No relevant amenities
            {
                "type": "node",
                "id": 123459,
                "lat": 33.43,
                "lon": -111.93,
                "tags": {
                    "building": "yes",
                }
            },
        ]
    }
    
    # Should parse only the valid element
    fetch_time = datetime.now(timezone.utc)
    stops = service._parse_overpass_response(incomplete_response, fetch_time)
    
    assert len(stops) == 1
    assert stops[0].name == "Test Fountain"


def test_amenity_filter():
    """Test amenity filtering works with live API."""
    service = StopsService()
    
    mock_response = {
        "elements": [
            {
                "type": "node",
                "id": 123456,
                "lat": 33.42,
                "lon": -111.94,
                "tags": {
                    "amenity": "drinking_water",
                    "name": "Test Fountain",
                }
            },
            {
                "type": "node",
                "id": 123457,
                "lat": 33.43,
                "lon": -111.93,
                "tags": {
                    "amenity": "shelter",
                    "name": "Test Shelter",
                }
            },
        ]
    }
    
    with patch('httpx.post') as mock_post:
        mock_resp = Mock()
        mock_resp.json.return_value = mock_response
        mock_resp.raise_for_status = Mock()
        mock_post.return_value = mock_resp
        
        # Filter by water amenity
        result = service.get_stops(bbox=TEMPE_BBOX, amenity="water")
        
        # Should only return stops with water amenity
        all_stops = result.fountains + result.cafes + result.repair + result.shade_zones
        assert len(all_stops) == 1
        assert all_stops[0].name == "Test Fountain"
        assert "water" in all_stops[0].amenities


def test_bbox_filtering():
    """Test bbox filtering works correctly."""
    service = StopsService()
    
    # Response with stops inside and outside bbox
    mock_response = {
        "elements": [
            # Inside bbox
            {
                "type": "node",
                "id": 123456,
                "lat": 33.42,
                "lon": -111.94,
                "tags": {
                    "amenity": "drinking_water",
                    "name": "Inside Fountain",
                }
            },
            # Outside bbox (too far north)
            {
                "type": "node",
                "id": 123457,
                "lat": 33.60,
                "lon": -111.94,
                "tags": {
                    "amenity": "drinking_water",
                    "name": "Outside Fountain",
                }
            },
        ]
    }
    
    with patch('httpx.post') as mock_post:
        mock_resp = Mock()
        mock_resp.json.return_value = mock_response
        mock_resp.raise_for_status = Mock()
        mock_post.return_value = mock_resp
        
        result = service.get_stops(bbox=TEMPE_BBOX)
        
        # Should only return stop inside bbox
        assert len(result.fountains) == 1
        assert result.fountains[0].name == "Inside Fountain"


def test_shade_zones_exclude_fountains():
    """Test shade zones don't include fountain sources."""
    service = StopsService()
    
    mock_response = {
        "elements": [
            # Fountain with shade (should be in fountains, not shade_zones)
            {
                "type": "node",
                "id": 123456,
                "lat": 33.42,
                "lon": -111.94,
                "tags": {
                    "amenity": "drinking_water",
                    "name": "Shaded Fountain",
                    "covered": "yes",
                }
            },
            # Shelter (should be in shade_zones)
            {
                "type": "node",
                "id": 123457,
                "lat": 33.43,
                "lon": -111.93,
                "tags": {
                    "amenity": "shelter",
                    "name": "Test Shelter",
                }
            },
        ]
    }
    
    with patch('httpx.post') as mock_post:
        mock_resp = Mock()
        mock_resp.json.return_value = mock_response
        mock_resp.raise_for_status = Mock()
        mock_post.return_value = mock_resp
        
        result = service.get_stops(bbox=TEMPE_BBOX)
        
        # Fountain should be in fountains, not shade_zones
        assert len(result.fountains) == 1
        assert result.fountains[0].name == "Shaded Fountain"
        
        # Shelter should be in shade_zones
        assert len(result.shade_zones) == 1
        assert result.shade_zones[0].name == "Test Shelter"
