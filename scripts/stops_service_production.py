"""
Production StopsService using Overpass API.

This is what Track C should replace backend/services/stops_service.py with.
"""

import json
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import structlog

from shared.schema import Provenance, SourceRef, Stop, StopsResponse

logger = structlog.get_logger()

_FOUNTAIN_SOURCES = {"official", "fountain"}


class StopsService:
    """
    Production stops service using Overpass API.
    
    Caches results for 24h to avoid hammering OSM servers.
    """
    
    def __init__(
        self,
        overpass_url: str = "https://overpass-api.de/api/interpreter",
        cache_ttl_seconds: int = 86400,  # 24 hours
    ):
        self.overpass_url = overpass_url
        self.cache_ttl_seconds = cache_ttl_seconds
        
        # Cache: bbox_key -> (stops, fetch_time)
        self._cache: dict[str, tuple[list[Stop], datetime]] = {}
        
        logger.info("stops_service.initialized", overpass_url=overpass_url)
    
    def _build_overpass_query(self, bbox: tuple[float, float, float, float]) -> str:
        """Build Overpass QL query for all heat-relief stops."""
        lat_min, lng_min, lat_max, lng_max = bbox
        
        query = f"""
        [out:json][timeout:25];
        (
          node["amenity"="drinking_water"]({lat_min},{lng_min},{lat_max},{lng_max});
          node["amenity"="cafe"]({lat_min},{lng_min},{lat_max},{lng_max});
          node["amenity"="restaurant"]({lat_min},{lng_min},{lat_max},{lng_max});
          node["amenity"="convenience"]({lat_min},{lng_min},{lat_max},{lng_max});
          node["amenity"="fuel"]({lat_min},{lng_min},{lat_max},{lng_max});
          node["amenity"="shelter"]({lat_min},{lng_min},{lat_max},{lng_max});
          node["covered"="yes"]({lat_min},{lng_min},{lat_max},{lng_max});
          node["highway"="bus_stop"]({lat_min},{lng_min},{lat_max},{lng_max});
          way["leisure"="park"]({lat_min},{lng_min},{lat_max},{lng_max});
          node["amenity"="bicycle_repair_station"]({lat_min},{lng_min},{lat_max},{lng_max});
        );
        out center;
        """
        return query
    
    async def _fetch_from_overpass(
        self, bbox: tuple[float, float, float, float]
    ) -> list[Stop]:
        """Fetch stops from Overpass API."""
        query = self._build_overpass_query(bbox)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.overpass_url,
                data={"data": query},
            )
            response.raise_for_status()
            data = response.json()
        
        stops = []
        for element in data.get("elements", []):
            # Extract coordinates
            if element["type"] == "node":
                lat = element["lat"]
                lng = element["lon"]
            elif element["type"] == "way" and "center" in element:
                lat = element["center"]["lat"]
                lng = element["center"]["lon"]
            else:
                continue
            
            tags = element.get("tags", {})
            name = tags.get("name", "Unnamed")
            
            # Determine amenities
            amenities = []
            if tags.get("amenity") == "drinking_water":
                amenities.append("water")
            if tags.get("amenity") in ["cafe", "restaurant", "convenience", "fuel"]:
                amenities.extend(["water", "food"])
            if tags.get("amenity") == "shelter" or tags.get("covered") == "yes":
                amenities.append("shade")
            if tags.get("highway") == "bus_stop":
                amenities.append("shade")
            if tags.get("leisure") == "park":
                amenities.append("shade")
            if tags.get("amenity") == "bicycle_repair_station":
                amenities.append("bike_repair")
            if tags.get("toilets") == "yes":
                amenities.append("restroom")
            
            # Determine source
            if tags.get("amenity") == "drinking_water":
                source = "official"
            elif tags.get("amenity") in ["cafe", "restaurant", "convenience", "fuel"]:
                source = "commercial"
            else:
                source = "public"
            
            stop = Stop(
                id=f"osm-{element['type']}-{element['id']}",
                name=name,
                lat=lat,
                lng=lng,
                amenities=amenities,
                open_now=None,
                source=source,
                source_ref="overpass_api",
            )
            stops.append(stop)
        
        logger.info("stops_service.fetched", count=len(stops), bbox=bbox)
        return stops
    
    def _get_cache_key(self, bbox: tuple[float, float, float, float]) -> str:
        """Generate cache key from bbox."""
        return f"{bbox[0]:.4f},{bbox[1]:.4f},{bbox[2]:.4f},{bbox[3]:.4f}"
    
    async def get_stops(
        self,
        bbox: tuple[float, float, float, float],
        amenity: Optional[str] = None,
    ) -> StopsResponse:
        """
        Get stops from Overpass API with 24h caching.
        
        Args:
            bbox: (lat_min, lng_min, lat_max, lng_max)
            amenity: Optional amenity filter
        
        Returns:
            StopsResponse with categorized stops
        """
        cache_key = self._get_cache_key(bbox)
        now = datetime.now(timezone.utc)
        
        # Check cache
        if cache_key in self._cache:
            cached_stops, fetch_time = self._cache[cache_key]
            age_seconds = int((now - fetch_time).total_seconds())
            
            if age_seconds < self.cache_ttl_seconds:
                logger.info("stops_service.cache_hit", age_seconds=age_seconds)
                stops = cached_stops
                fetch_time_used = fetch_time
            else:
                logger.info("stops_service.cache_expired", age_seconds=age_seconds)
                stops = await self._fetch_from_overpass(bbox)
                self._cache[cache_key] = (stops, now)
                fetch_time_used = now
        else:
            logger.info("stops_service.cache_miss")
            stops = await self._fetch_from_overpass(bbox)
            self._cache[cache_key] = (stops, now)
            fetch_time_used = now
        
        # Filter by bbox and amenity
        lat_min, lng_min, lat_max, lng_max = bbox
        filtered = []
        for stop in stops:
            if not (lat_min <= stop.lat <= lat_max and lng_min <= stop.lng <= lng_max):
                continue
            if amenity is not None and amenity not in stop.amenities:
                continue
            filtered.append(stop)
        
        # Categorize
        fountains = [s for s in filtered if s.source in _FOUNTAIN_SOURCES]
        cafes = [s for s in filtered if s.source == "commercial"]
        repair = [s for s in filtered if "bike_repair" in s.amenities]
        shade_zones = [
            s for s in filtered
            if "shade" in s.amenities and s.source not in _FOUNTAIN_SOURCES
        ]
        
        age_seconds = int((now - fetch_time_used).total_seconds())
        provenance = Provenance(
            env_source=SourceRef(
                source_id="overpass_api",
                timestamp=fetch_time_used,
                age_seconds=age_seconds,
            )
        )
        
        return StopsResponse(
            fountains=fountains,
            cafes=cafes,
            repair=repair,
            shade_zones=shade_zones,
            provenance=provenance,
        )


# Module-level singleton
stops_service = StopsService()
