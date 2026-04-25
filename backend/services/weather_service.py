"""
WeatherService — fetches weather from Open-Meteo (primary) and NWS (secondary).

Optionally fetches AirNow if AIRNOW_API_KEY env var is set.
Caches full WeatherResponse for 900 seconds.
Every response carries a Provenance with env_source populated.
"""

import math
import os
import time
from datetime import datetime, timezone

import httpx
import structlog

from backend.services.cache import cache
from shared.schema import (
    Advisory,
    AirQuality,
    Provenance,
    SourceRef,
    WeatherHourly,
    WeatherResponse,
    WeatherSnapshot,
)

logger = structlog.get_logger()

_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
_NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"
_AIRNOW_URL = "https://www.airnowapi.org/aq/observation/latLong/current/"

_CACHE_TTL = 900  # 15 minutes


def _heat_index(temp_c: float, humidity_pct: float) -> float:
    """Steadman-style heat index approximation."""
    return temp_c + (
        0.33 * (humidity_pct / 100 * 6.105 * math.exp(17.27 * temp_c / (237.7 + temp_c)))
        - 4.0
    )


def _wind_chill_offset(wind_kmh: float) -> float:
    """
    Approximate wind cooling effect on MRT (negative = cooler).
    Based on ISO 7933 / UTCI: wind reduces perceived radiant load.
    Returns a negative offset in °C to subtract from MRT.
    """
    if wind_kmh <= 0:
        return 0.0
    # Empirical: each 10 km/h of wind reduces MRT by ~1.5°C (capped at -6°C)
    return -min(6.0, (wind_kmh / 10.0) * 1.5)


def _find_current_hour_index(hourly_times: list[str]) -> int:
    """Return the index in hourly_times closest to the current UTC hour."""
    now_utc = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    best_idx = 0
    best_diff = float("inf")
    for i, t_str in enumerate(hourly_times):
        # Parse ISO string — may or may not have timezone info
        try:
            t = datetime.fromisoformat(t_str)
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        diff = abs((t - now_utc).total_seconds())
        if diff < best_diff:
            best_diff = diff
            best_idx = i
    return best_idx


class WeatherService:
    async def get_weather(self, lat: float, lng: float) -> WeatherResponse:
        cache_key = f"weather:{round(lat, 2)}:{round(lng, 2)}"

        # ── Cache hit ──────────────────────────────────────────────────────────
        cached = cache.get(cache_key)
        if cached is not None:
            cached_dict: dict = cached
            # Recalculate age_seconds from stored timestamp
            env_src = cached_dict.get("provenance", {}).get("env_source")
            if env_src:
                stored_ts = datetime.fromisoformat(env_src["timestamp"])
                if stored_ts.tzinfo is None:
                    stored_ts = stored_ts.replace(tzinfo=timezone.utc)
                age = int((datetime.now(timezone.utc) - stored_ts).total_seconds())
                cached_dict["provenance"]["env_source"]["age_seconds"] = age
            return WeatherResponse(**cached_dict)

        # ── Fetch Open-Meteo ───────────────────────────────────────────────────
        open_meteo_data = None
        fetch_time = datetime.now(timezone.utc)

        async with httpx.AsyncClient(timeout=5.0) as client:
            # Open-Meteo
            t0 = time.monotonic()
            try:
                resp = await client.get(
                    _OPEN_METEO_URL,
                    params={
                        "latitude": lat,
                        "longitude": lng,
                        "hourly": (
                            "temperature_2m,relativehumidity_2m,uv_index,"
                            "apparent_temperature,windspeed_10m"
                        ),
                        "current_weather": "true",
                        "forecast_days": 1,
                        "timezone": "auto",
                    },
                )
                latency_ms = int((time.monotonic() - t0) * 1000)
                logger.info(
                    "weather_service.open_meteo",
                    latency_ms=latency_ms,
                    status_code=resp.status_code,
                )
                resp.raise_for_status()
                open_meteo_data = resp.json()
            except Exception as exc:
                latency_ms = int((time.monotonic() - t0) * 1000)
                logger.warning(
                    "weather_service.open_meteo_failed",
                    latency_ms=latency_ms,
                    error=str(exc),
                )

            # NWS alerts
            advisories: list[Advisory] = []
            nws_fetch_time = datetime.now(timezone.utc)
            t0 = time.monotonic()
            try:
                nws_resp = await client.get(
                    _NWS_ALERTS_URL,
                    params={"point": f"{lat},{lng}"},
                    headers={"User-Agent": "PulseRoute/0.1 (hackathon)"},
                )
                latency_ms = int((time.monotonic() - t0) * 1000)
                logger.info(
                    "weather_service.nws",
                    latency_ms=latency_ms,
                    status_code=nws_resp.status_code,
                )
                nws_resp.raise_for_status()
                nws_data = nws_resp.json()
                for feature in nws_data.get("features", []):
                    props = feature.get("properties", {})
                    try:
                        advisories.append(
                            Advisory(
                                id=feature["id"],
                                headline=props.get("headline") or props.get("event", ""),
                                severity=props.get("severity", "Unknown"),
                                effective=props["effective"],
                                expires=props["expires"],
                                source="NWS",
                            )
                        )
                    except Exception:
                        pass  # skip malformed features
            except Exception as exc:
                latency_ms = int((time.monotonic() - t0) * 1000)
                logger.warning(
                    "weather_service.nws_failed",
                    latency_ms=latency_ms,
                    error=str(exc),
                )

            # AirNow (optional)
            air_quality: AirQuality | None = None
            airnow_key = os.environ.get("AIRNOW_API_KEY")
            if airnow_key:
                t0 = time.monotonic()
                try:
                    aq_resp = await client.get(
                        _AIRNOW_URL,
                        params={
                            "format": "application/json",
                            "latitude": lat,
                            "longitude": lng,
                            "distance": 25,
                            "API_KEY": airnow_key,
                        },
                    )
                    latency_ms = int((time.monotonic() - t0) * 1000)
                    logger.info(
                        "weather_service.airnow",
                        latency_ms=latency_ms,
                        status_code=aq_resp.status_code,
                    )
                    aq_resp.raise_for_status()
                    aq_data = aq_resp.json()
                    if aq_data:
                        entry = aq_data[0]
                        air_quality = AirQuality(
                            aqi=int(entry.get("AQI", 0)),
                            dominant_pollutant=entry.get("ParameterName", "PM2.5"),
                        )
                except Exception as exc:
                    latency_ms = int((time.monotonic() - t0) * 1000)
                    logger.warning(
                        "weather_service.airnow_failed",
                        latency_ms=latency_ms,
                        error=str(exc),
                    )

        # ── Build response ─────────────────────────────────────────────────────
        if open_meteo_data is not None:
            hourly = open_meteo_data["hourly"]
            current_weather = open_meteo_data["current_weather"]

            hourly_times: list[str] = hourly["time"]
            idx = _find_current_hour_index(hourly_times)

            temp_c: float = current_weather["temperature"]
            humidity_pct: float = float(hourly["relativehumidity_2m"][idx])
            uv_index: float = float(hourly["uv_index"][idx])
            wind_kmh: float = float(current_weather.get("windspeed", 0.0))

            # Use Open-Meteo's apparent_temperature (feels-like) as heat index
            # It accounts for humidity, wind, and solar radiation — more accurate
            # than our hand-rolled Steadman approximation.
            apparent_c_hourly = hourly.get("apparent_temperature", [])
            if apparent_c_hourly and idx < len(apparent_c_hourly):
                apparent_temp_c = float(apparent_c_hourly[idx])
            else:
                apparent_temp_c = _heat_index(temp_c, humidity_pct)

            hi = apparent_temp_c  # use feels-like as heat index

            current_snapshot = WeatherSnapshot(
                temp_c=temp_c,
                humidity_pct=humidity_pct,
                heat_index_c=hi,
                uv_index=uv_index,
                apparent_temp_c=apparent_temp_c,
                wind_kmh=wind_kmh,
            )

            # Next 12 hours of forecast (enough to cover any realistic ride)
            forecast: list[WeatherHourly] = []
            for offset in range(1, 13):
                fi = idx + offset
                if fi >= len(hourly_times):
                    break
                try:
                    ts = datetime.fromisoformat(hourly_times[fi])
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    forecast.append(
                        WeatherHourly(
                            at=ts,
                            temp_c=float(hourly["temperature_2m"][fi]),
                            humidity_pct=float(hourly["relativehumidity_2m"][fi]),
                            uv_index=float(hourly["uv_index"][fi]),
                        )
                    )
                except (IndexError, ValueError):
                    break

            env_source = SourceRef(
                source_id="open-meteo",
                timestamp=fetch_time,
                age_seconds=0,
            )

        elif advisories or True:
            # Open-Meteo failed — build minimal response from NWS timestamp
            # We still need a current snapshot; use zeroed values and flag source
            if not advisories and open_meteo_data is None:
                # Both failed
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=503,
                    detail="Weather services unavailable",
                )

            current_snapshot = WeatherSnapshot(
                temp_c=0.0,
                humidity_pct=0.0,
                heat_index_c=None,
                uv_index=None,
            )
            forecast = []
            env_source = SourceRef(
                source_id="nws",
                timestamp=nws_fetch_time,
                age_seconds=0,
            )

        provenance = Provenance(env_source=env_source)

        weather_response = WeatherResponse(
            current=current_snapshot,
            forecast_hourly=forecast,
            advisories=advisories,
            air_quality=air_quality,
            provenance=provenance,
        )

        # ── Cache ──────────────────────────────────────────────────────────────
        cache.setex(cache_key, _CACHE_TTL, weather_response.model_dump(mode="json"))

        return weather_response


# Module-level singleton
weather_service = WeatherService()
