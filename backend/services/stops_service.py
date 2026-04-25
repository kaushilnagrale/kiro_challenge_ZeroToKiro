"""
StopsService — fetches stops from Overpass API with 24h caching and fallback to seed file.

Live API integration: Fetches 200+ real stops from OpenStreetMap via Overpass API.
Falls back to stops_seed.json if API times out (>5s) or fails.
"""

import json
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import httpx
import structlog

from shared.schema import Amenity, Provenance, SourceRef, Stop, StopsResponse

logger = structlog.get_logger()

_FOUNTAIN_SOURCES = {"official", "fountain"}
_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_OVERPASS_TIMEOUT = 5.0  # seconds
_CACHE_TTL = timedelta(hours=24)


class StopsService:
    def __init__(self, seed_path: str = "data/stops_seed.json") -> None:
        self._seed_path = Path(seed_path)
        self._cache: dict[str, tuple[datetime, list[Stop]]] = {}
        self._seed_stops: Optional[list[Stop]] = None
        
        logger.info(
            "stops_service.initialized",
            seed_path=str(self._seed_path),
            cache_ttl_hours=_CACHE_TTL.total_seconds() / 3600,
        )

    def _load_seed_file(self) -> list[Stop]:
        """Load stops from seed file (lazy-loaded, cached)."""
        if self._seed_stops is None:
            raw = json.loads(self._seed_path.read_text(encoding="utf-8"))
            self._seed_stops = [Stop(**item) for item in raw]
            logger.info(
                "stops_service.seed_loaded",
                count=len(self._seed_stops),
                seed_path=str(self._seed_path),
            )
        return self._seed_stops

    def _build_overpass_query(self, bbox: tuple[float, float, float, float]) -> str:
        """
        Build Overpass QL query for Tempe bbox with all amenity tags.
        
        bbox = (lat_min, lng_min, lat_max, lng_max)
        
        Query tags:
        - Water: amenity=drinking_water, cafe, restaurant, convenience, fuel
        - Shade: amenity=shelter, covered=yes, highway=bus_stop, leisure=park, natural=tree_row
        - Services: amenity=bicycle_repair_station
        """
        lat_min, lng_min, lat_max, lng_max = bbox
        
        # Overpass uses (south, west, north, east) format
        bbox_str = f"{lat_min},{lng_min},{lat_max},{lng_max}"
        
        query = f"""
        [out:json][timeout:5];
        (
          // Water sources
          node["amenity"="drinking_water"]({bbox_str});
          node["amenity"="cafe"]({bbox_str});
          node["amenity"="restaurant"]({bbox_str});
          node["amenity"="convenience"]({bbox_str});
          node["amenity"="fuel"]({bbox_str});
          
          // Shade/rest zones
          node["amenity"="shelter"]({bbox_str});
          node["covered"="yes"]({bbox_str});
          node["highway"="bus_stop"]({bbox_str});
          way["leisure"="park"]({bbox_str});
          way["natural"="tree_row"]({bbox_str});
          
          // Services
          node["amenity"="bicycle_repair_station"]({bbox_str});
        );
        out center;
        """
        
        return query.strip()

    def _parse_overpass_response(self, data: dict, fetch_time: datetime) -> list[Stop]:
        """
        Parse Overpass JSON response to Stop objects.
        
        Overpass returns elements with:
        - type: "node" or "way"
        - id: OSM ID
        - lat/lon: coordinates (or center for ways)
        - tags: dict of OSM tags
        """
        stops: list[Stop] = []
        
        for element in data.get("elements", []):
            try:
                # Get coordinates
                if element["type"] == "node":
                    lat = element["lat"]
                    lng = element["lon"]
                elif element["type"] == "way" and "center" in element:
                    lat = element["center"]["lat"]
                    lng = element["center"]["lon"]
                else:
                    continue  # Skip elements without coordinates
                
                tags = element.get("tags", {})
                osm_id = element["id"]
                
                # Determine amenities based on OSM tags
                amenities: list[Amenity] = []
                source = "overpass"
                
                # Water sources
                amenity_tag = tags.get("amenity", "")
                if amenity_tag in {"drinking_water", "cafe", "restaurant", "convenience", "fuel"}:
                    amenities.append("water")
                    if amenity_tag == "drinking_water":
                        source = "official"
                    elif amenity_tag in {"cafe", "restaurant", "convenience", "fuel"}:
                        source = "commercial"
                        amenities.append("food")
                
                # Shade zones
                if (amenity_tag == "shelter" or 
                    tags.get("covered") == "yes" or 
                    tags.get("highway") == "bus_stop" or
                    tags.get("leisure") == "park" or
                    tags.get("natural") == "tree_row"):
                    amenities.append("shade")
                    if source == "overpass":
                        source = "public"
                
                # Services
                if amenity_tag == "bicycle_repair_station":
                    amenities.append("bike_repair")
                
                # Additional amenities
                if tags.get("toilets") == "yes":
                    amenities.append("restroom")
                if tags.get("air_conditioning") == "yes":
                    amenities.append("ac")
                
                # Skip if no relevant amenities
                if not amenities:
                    continue
                
                # Get name (fallback to amenity type)
                name = tags.get("name") or tags.get("amenity", "Unknown Stop")
                
                stop = Stop(
                    id=f"osm-{element['type']}-{osm_id}",
                    name=name,
                    lat=lat,
                    lng=lng,
                    amenities=amenities,
                    open_now=None,  # OSM doesn't reliably have opening hours
                    source=source,
                    source_ref=f"overpass_api_{fetch_time.isoformat()}",
                )
                
                stops.append(stop)
                
            except (KeyError, ValueError) as e:
                logger.warning(
                    "stops_service.parse_error",
                    element_id=element.get("id"),
                    error=str(e),
                )
                continue
        
        return stops

    def _fetch_from_overpass(self, bbox: tuple[float, float, float, float]) -> Optional[list[Stop]]:
        """
        Fetch stops from Overpass API with timeout.
        
        Returns None if API times out or fails.
        """
        query = self._build_overpass_query(bbox)
        fetch_time = datetime.now(timezone.utc)
        
        try:
            logger.info(
                "stops_service.overpass_request",
                bbox=bbox,
                timeout=_OVERPASS_TIMEOUT,
            )
            
            response = httpx.post(
                _OVERPASS_URL,
                content=query.encode('utf-8'),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=_OVERPASS_TIMEOUT,
            )
            response.raise_for_status()
            
            data = response.json()
            stops = self._parse_overpass_response(data, fetch_time)
            
            logger.info(
                "stops_service.overpass_success",
                bbox=bbox,
                count=len(stops),
            )
            
            return stops
            
        except httpx.TimeoutException:
            logger.warning(
                "stops_service.overpass_timeout",
                bbox=bbox,
                timeout=_OVERPASS_TIMEOUT,
            )
            return None
            
        except Exception as e:
            logger.error(
                "stops_service.overpass_error",
                bbox=bbox,
                error=str(e),
                error_type=type(e).__name__,
            )
            return None

    def get_stops(
        self,
        bbox: tuple[float, float, float, float],
        amenity: str | None = None,
    ) -> StopsResponse:
        """
        Filter stops by bounding box and optional amenity, then categorise.

        bbox = (lat_min, lng_min, lat_max, lng_max)
        amenity = one of the Amenity literals, or None for no filter
        
        Strategy:
        1. Check cache (24h TTL)
        2. If cache miss, fetch from Overpass API
        3. If API fails/times out, fall back to seed file
        """
        # Build cache key
        cache_key = f"stops_{bbox}_{amenity}"
        
        # Check cache
        if cache_key in self._cache:
            cached_time, cached_stops = self._cache[cache_key]
            age = datetime.now(timezone.utc) - cached_time
            
            if age < _CACHE_TTL:
                logger.info(
                    "stops_service.cache_hit",
                    cache_key=cache_key,
                    age_seconds=int(age.total_seconds()),
                )
                stops = cached_stops
                source_id = "overpass_api_cached"
                fetch_time = cached_time
            else:
                # Cache expired
                logger.info(
                    "stops_service.cache_expired",
                    cache_key=cache_key,
                    age_seconds=int(age.total_seconds()),
                )
                stops = None
                fetch_time = datetime.now(timezone.utc)
        else:
            stops = None
            fetch_time = datetime.now(timezone.utc)
        
        # Fetch from API if cache miss/expired
        if stops is None:
            stops = self._fetch_from_overpass(bbox)
            
            if stops is not None:
                # Cache successful fetch
                self._cache[cache_key] = (fetch_time, stops)
                source_id = "overpass_api"
            else:
                # Fall back to seed file and cache it too (to avoid repeated API failures)
                logger.warning(
                    "stops_service.fallback_to_seed",
                    bbox=bbox,
                )
                stops = self._load_seed_file()
                # Cache the seed file fallback for 5 minutes (shorter TTL to retry API sooner)
                self._cache[cache_key] = (fetch_time, stops)
                source_id = "stops_seed_v1"
                fetch_time = datetime.now(timezone.utc)
        else:
            source_id = "overpass_api_cached"
        
        # Filter by bbox and amenity
        lat_min, lng_min, lat_max, lng_max = bbox
        filtered: list[Stop] = []
        
        for stop in stops:
            # bbox filter
            if not (lat_min <= stop.lat <= lat_max and lng_min <= stop.lng <= lng_max):
                continue
            # amenity filter
            if amenity is not None and amenity not in stop.amenities:
                continue
            filtered.append(stop)
        
        # Categorize stops
        fountains = [s for s in filtered if s.source in _FOUNTAIN_SOURCES]
        cafes = [s for s in filtered if s.source == "commercial"]
        repair = [s for s in filtered if "bike_repair" in s.amenities]
        # Shade zones: any stop with shade amenity that's not already a fountain
        shade_zones = [
            s for s in filtered 
            if "shade" in s.amenities and s.source not in _FOUNTAIN_SOURCES
        ]
        
        # Build provenance
        age_seconds = int((datetime.now(timezone.utc) - fetch_time).total_seconds())
        provenance = Provenance(
            env_source=SourceRef(
                source_id=source_id,
                timestamp=fetch_time,
                age_seconds=age_seconds,
            )
        )
        
        logger.info(
            "stops_service.response",
            bbox=bbox,
            amenity=amenity,
            fountains=len(fountains),
            cafes=len(cafes),
            repair=len(repair),
            shade_zones=len(shade_zones),
            source_id=source_id,
        )
        
        return StopsResponse(
            fountains=fountains,
            cafes=cafes,
            repair=repair,
            shade_zones=shade_zones,
            provenance=provenance,
        )


# Module-level singleton — import this in routers:
#   from backend.services.stops_service import stops_service
stops_service = StopsService()
