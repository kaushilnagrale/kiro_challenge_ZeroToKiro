"""
Weather integration — Open-Meteo (primary) + NWS alerts.
Both are free and require no API key.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"

# Default: Tempe, AZ
DEFAULT_LAT = 33.4255
DEFAULT_LON = -111.9400


async def fetch_weather(lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> dict:
    """Returns current conditions from Open-Meteo; falls back to Tempe summer defaults."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": (
            "temperature_2m,relative_humidity_2m,"
            "apparent_temperature,wind_speed_10m"
        ),
        "temperature_unit": "celsius",
        "wind_speed_unit": "ms",
        "timezone": "America/Phoenix",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(OPEN_METEO_URL, params=params)
            resp.raise_for_status()
            current = resp.json().get("current", {})
            return {
                "ambient_temp_c":  current.get("temperature_2m", 41.0),
                "humidity_pct":    current.get("relative_humidity_2m", 15.0),
                "heat_index_c":    current.get("apparent_temperature", 44.0),
                "wind_speed_ms":   current.get("wind_speed_10m", 2.5),
                "source_id":       "open-meteo",
                "timestamp":       datetime.now(timezone.utc).isoformat(),
            }
    except Exception:
        return {
            "ambient_temp_c": 41.0,
            "humidity_pct":   15.0,
            "heat_index_c":   44.0,
            "wind_speed_ms":  2.5,
            "source_id":      "fallback-defaults",
            "timestamp":      datetime.now(timezone.utc).isoformat(),
        }


async def fetch_nws_advisory(
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON,
) -> Optional[str]:
    """Returns active NWS heat advisory headline, or None."""
    params = {
        "point": f"{lat},{lon}",
        "event": "Excessive Heat Warning,Heat Advisory,Excessive Heat Watch",
    }
    headers = {"User-Agent": "PulseRoute/1.0 (pulseroute-hackathon@example.com)"}
    try:
        async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
            resp = await client.get(NWS_ALERTS_URL, params=params)
            resp.raise_for_status()
            features = resp.json().get("features", [])
            if features:
                props = features[0].get("properties", {})
                return props.get("headline", "Heat advisory in effect")
    except Exception:
        pass
    return None
