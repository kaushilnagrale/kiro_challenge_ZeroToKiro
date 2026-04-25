"""
MrtService — Mean Radiant Temperature stub with hand-curated Tempe zones.

Owner: Track B (Sai)
Status: Reference implementation (stub)

Loads hot/cool zones from data/tempe_zones.json at startup.
Formula: mrt = ambient_temp_c + 8.0 + zone_delta_if_inside(lat, lng)
Default (no zone): mrt = ambient_temp_c + 8.0

Track C will replace this with rasterio-based raster lookup when LST data is ready.
"""

import json
import math
from pathlib import Path
from typing import Optional


class Zone:
    """A circular zone with a temperature delta."""
    
    def __init__(self, name: str, center_lat: float, center_lng: float, 
                 radius_m: float, delta_c: float):
        self.name = name
        self.center_lat = center_lat
        self.center_lng = center_lng
        self.radius_m = radius_m
        self.delta_c = delta_c
    
    def contains(self, lat: float, lng: float) -> bool:
        """Check if a point is inside this zone using Haversine distance."""
        # Haversine formula for distance between two lat/lng points
        R = 6371000  # Earth radius in meters
        
        lat1_rad = math.radians(self.center_lat)
        lat2_rad = math.radians(lat)
        delta_lat = math.radians(lat - self.center_lat)
        delta_lng = math.radians(lng - self.center_lng)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(delta_lng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance_m = R * c
        
        return distance_m <= self.radius_m


class MrtService:
    """
    Mean Radiant Temperature service with hand-curated Tempe zones.
    
    Provides point-based MRT lookup and route annotation.
    """
    
    def __init__(self, zones_path: Optional[str] = None):
        """Load zones from JSON file."""
        if zones_path is None:
            zones_path = Path(__file__).parent.parent.parent / "data" / "tempe_zones.json"
        else:
            zones_path = Path(zones_path)
        
        with open(zones_path, "r") as f:
            data = json.load(f)
        
        self.zones: list[Zone] = []
        
        # Load hot zones
        for zone_data in data.get("hot_zones", []):
            self.zones.append(Zone(
                name=zone_data["name"],
                center_lat=zone_data["center_lat"],
                center_lng=zone_data["center_lng"],
                radius_m=zone_data["radius_m"],
                delta_c=zone_data["delta_c"]
            ))
        
        # Load cool zones
        for zone_data in data.get("cool_zones", []):
            self.zones.append(Zone(
                name=zone_data["name"],
                center_lat=zone_data["center_lat"],
                center_lng=zone_data["center_lng"],
                radius_m=zone_data["radius_m"],
                delta_c=zone_data["delta_c"]
            ))
    
    def get_mrt(self, lat: float, lng: float, ambient_temp_c: float) -> float:
        """
        Calculate MRT for a point.
        
        Formula: mrt = ambient_temp_c + 8.0 + zone_delta
        First matching zone wins. Default delta = 0 if no zone matches.
        
        Args:
            lat: Latitude
            lng: Longitude
            ambient_temp_c: Ambient air temperature in Celsius
        
        Returns:
            Mean radiant temperature in Celsius
        """
        zone_delta = 0.0
        
        # First matching zone wins
        for zone in self.zones:
            if zone.contains(lat, lng):
                zone_delta = zone.delta_c
                break
        
        return ambient_temp_c + 8.0 + zone_delta
    
    def annotate_route(self, polyline: list[tuple[float, float]], 
                       ambient_temp_c: float) -> tuple[float, float]:
        """
        Annotate a route polyline with MRT statistics.
        
        Samples the polyline every ~100m and computes peak and mean MRT.
        
        Args:
            polyline: List of (lat, lng) tuples defining the route
            ambient_temp_c: Ambient air temperature in Celsius
        
        Returns:
            Tuple of (peak_mrt_c, mean_mrt_c)
        """
        if not polyline:
            # Empty route: return base MRT
            base_mrt = ambient_temp_c + 8.0
            return (base_mrt, base_mrt)
        
        # Sample every ~100m
        sample_points = self._sample_polyline(polyline, interval_m=100)
        
        if not sample_points:
            # Fallback to first point if sampling fails
            sample_points = [polyline[0]]
        
        # Calculate MRT for each sample point
        mrt_values = [
            self.get_mrt(lat, lng, ambient_temp_c)
            for lat, lng in sample_points
        ]
        
        peak_mrt = max(mrt_values)
        mean_mrt = sum(mrt_values) / len(mrt_values)
        
        return (peak_mrt, mean_mrt)
    
    def _sample_polyline(self, polyline: list[tuple[float, float]], 
                         interval_m: float) -> list[tuple[float, float]]:
        """
        Sample a polyline at regular intervals.
        
        Args:
            polyline: List of (lat, lng) tuples
            interval_m: Sampling interval in meters
        
        Returns:
            List of sampled (lat, lng) points
        """
        if len(polyline) < 2:
            return polyline
        
        samples = [polyline[0]]  # Always include start
        accumulated_distance = 0.0
        
        for i in range(1, len(polyline)):
            prev_lat, prev_lng = polyline[i - 1]
            curr_lat, curr_lng = polyline[i]
            
            segment_distance = self._haversine_distance(
                prev_lat, prev_lng, curr_lat, curr_lng
            )
            accumulated_distance += segment_distance
            
            # Sample at interval boundaries
            while accumulated_distance >= interval_m:
                # Interpolate point at interval boundary
                fraction = (accumulated_distance - interval_m) / segment_distance
                interp_lat = curr_lat - fraction * (curr_lat - prev_lat)
                interp_lng = curr_lng - fraction * (curr_lng - prev_lng)
                samples.append((interp_lat, interp_lng))
                accumulated_distance -= interval_m
        
        # Always include end
        if polyline[-1] not in samples:
            samples.append(polyline[-1])
        
        return samples
    
    def _haversine_distance(self, lat1: float, lng1: float, 
                           lat2: float, lng2: float) -> float:
        """Calculate distance between two points using Haversine formula."""
        R = 6371000  # Earth radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(delta_lng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c


# Module-level singleton
mrt_service = MrtService()
