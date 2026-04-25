"""
RouteService — computes fastest and pulseroute cycling routes via Mapbox Directions.

Fastest route: direct origin → destination.
PulseRoute: injects nearest cool-zone waypoint near the route midpoint.

Both routes are annotated with MRT via MrtService and enriched with:
  - shade_pct: fraction of polyline points inside a cool zone × 100
  - stops: top-3 water stops near the route midpoint
  - segments: polyline chunked into ~10-point segments with MRT means
  - provenance: env_source from weather, route_segment_id = first segment id

Caching: key = route:{origin}:{destination}:{depart_hour}, TTL 3600s.
"""

import math
import os
import time
from datetime import datetime, timezone
from typing import Any

import httpx
import structlog

from backend.services.cache import cache
from backend.services.mrt_service import mrt_service as _default_mrt_service
from backend.services.stops_service import stops_service
from shared.schema import (
    Provenance,
    Route,
    RouteRequest,
    RouteResponse,
    RouteSegment,
    SourceRef,
    Stop,
    WeatherResponse,
)

logger = structlog.get_logger()

_MAPBOX_BASE = "https://api.mapbox.com/directions/v5/mapbox/cycling"
_CACHE_TTL = 3600  # 60 minutes


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))


def _shade_pct(polyline: list[tuple[float, float]], mrt_svc: Any) -> float:
    """
    Fraction of polyline points inside any cool zone × 100.

    A point is in a cool zone if zone.delta_c < 0 and haversine distance
    to zone center <= zone.radius_m.
    """
    if not polyline:
        return 0.0

    cool_zones = [z for z in mrt_svc.zones if z.delta_c < 0]
    if not cool_zones:
        return 0.0

    shaded = 0
    for lat, lng in polyline:
        for zone in cool_zones:
            dist = _haversine_m(lat, lng, zone.center_lat, zone.center_lng)
            if dist <= zone.radius_m:
                shaded += 1
                break  # count each point at most once

    return (shaded / len(polyline)) * 100.0


def _build_segments(
    polyline: list[tuple[float, float]],
    route_type: str,
    ambient_temp_c: float,
    mrt_svc: Any,
    chunk_size: int = 10,
) -> list[RouteSegment]:
    """Split polyline into chunks of ~chunk_size points and build RouteSegment list."""
    segments: list[RouteSegment] = []
    for i, start in enumerate(range(0, len(polyline), chunk_size)):
        chunk = polyline[start : start + chunk_size]
        if not chunk:
            continue
        mrts = [mrt_svc.get_mrt(lat, lng, ambient_temp_c) for lat, lng in chunk]
        mrt_mean = sum(mrts) / len(mrts)
        segments.append(
            RouteSegment(
                id=f"seg-{route_type}-{i:03d}",
                polyline=list(chunk),
                mrt_mean_c=mrt_mean,
                length_m=float(len(chunk) * 50),
                eta_seconds_into_ride=i * 60,
                forecasted_temp_c=ambient_temp_c,
            )
        )
    return segments


def _route_bbox(
    polyline: list[tuple[float, float]],
) -> tuple[float, float, float, float]:
    """Return (min_lat, min_lng, max_lat, max_lng) for a polyline."""
    lats = [p[0] for p in polyline]
    lngs = [p[1] for p in polyline]
    return (min(lats), min(lngs), max(lats), max(lngs))


def _top3_stops_by_proximity(
    stops: list[Stop], midpoint: tuple[float, float]
) -> list[Stop]:
    """Return up to 3 stops sorted by distance to midpoint."""
    mid_lat, mid_lng = midpoint
    ranked = sorted(
        stops,
        key=lambda s: _haversine_m(mid_lat, mid_lng, s.lat, s.lng),
    )
    return ranked[:3]


class RouteService:
    async def _call_mapbox(
        self,
        client: httpx.AsyncClient,
        coords: str,
        token: str,
    ) -> dict:
        """Call Mapbox Directions API and return parsed JSON."""
        url = f"{_MAPBOX_BASE}/{coords}"
        params = {
            "access_token": token,
            "geometries": "geojson",
            "overview": "full",
            "steps": "false",
        }
        t0 = time.monotonic()
        resp = await client.get(url, params=params)
        latency_ms = int((time.monotonic() - t0) * 1000)
        logger.info(
            "route_service.mapbox",
            coords=coords,
            latency_ms=latency_ms,
            status_code=resp.status_code,
        )
        resp.raise_for_status()
        return resp.json()

    def _parse_mapbox(self, data: dict) -> tuple[list[tuple[float, float]], float, float]:
        """
        Parse Mapbox response.

        Returns (polyline_lat_lng, distance_m, duration_s).
        Mapbox returns [lng, lat] pairs — we convert to (lat, lng).
        """
        route = data["routes"][0]
        coords_lng_lat: list[list[float]] = route["geometry"]["coordinates"]
        polyline = [(c[1], c[0]) for c in coords_lng_lat]
        return polyline, float(route["distance"]), float(route["duration"])

    async def compute_route(
        self,
        req: RouteRequest,
        weather: WeatherResponse,
        mrt_svc: Any = None,
    ) -> RouteResponse:
        """
        Compute fastest and pulseroute cycling routes.

        mrt_svc is injectable for testing; defaults to the module singleton.
        """
        if mrt_svc is None:
            mrt_svc = _default_mrt_service

        token = os.environ.get("MAPBOX_ACCESS_TOKEN")
        if not token:
            from fastapi import HTTPException
            raise HTTPException(status_code=503, detail="MAPBOX_ACCESS_TOKEN not configured")

        # ── Cache check ────────────────────────────────────────────────────────
        cache_key = (
            f"route:{req.origin}:{req.destination}:{req.depart_time.hour}"
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return RouteResponse(**cached)

        ambient_temp_c = weather.current.temp_c
        origin_lat, origin_lng = req.origin
        dest_lat, dest_lng = req.destination

        async with httpx.AsyncClient(timeout=5.0) as client:
            # ── Fastest route ──────────────────────────────────────────────────
            fastest_coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
            fastest_data = await self._call_mapbox(client, fastest_coords, token)
            fastest_poly, fastest_dist, fastest_eta = self._parse_mapbox(fastest_data)

            # ── PulseRoute: inject nearest cool-zone waypoint ──────────────────
            midpoint_idx = len(fastest_poly) // 2
            midpoint = fastest_poly[midpoint_idx] if fastest_poly else (origin_lat, origin_lng)
            mid_lat, mid_lng = midpoint

            cool_zones = [z for z in mrt_svc.zones if z.delta_c < 0]
            nearest_cool = min(
                cool_zones,
                key=lambda z: _haversine_m(
                    mid_lat, mid_lng, z.center_lat, z.center_lng
                ),
            ) if cool_zones else None

            if nearest_cool:
                cool_lat = nearest_cool.center_lat
                cool_lng = nearest_cool.center_lng
                pulse_coords = (
                    f"{origin_lng},{origin_lat};"
                    f"{cool_lng},{cool_lat};"
                    f"{dest_lng},{dest_lat}"
                )
            else:
                pulse_coords = fastest_coords

            pulse_data = await self._call_mapbox(client, pulse_coords, token)
            pulse_poly, pulse_dist, pulse_eta = self._parse_mapbox(pulse_data)

        # ── MRT annotation ─────────────────────────────────────────────────────
        fastest_peak_mrt, fastest_mean_mrt = mrt_svc.annotate_route(
            fastest_poly, ambient_temp_c
        )
        pulse_peak_mrt, pulse_mean_mrt = mrt_svc.annotate_route(
            pulse_poly, ambient_temp_c
        )

        # ── Shade pct ──────────────────────────────────────────────────────────
        fastest_shade = _shade_pct(fastest_poly, mrt_svc)
        pulse_shade = _shade_pct(pulse_poly, mrt_svc)

        # ── Segments ───────────────────────────────────────────────────────────
        fastest_segments = _build_segments(
            fastest_poly, "fastest", ambient_temp_c, mrt_svc
        )
        pulse_segments = _build_segments(
            pulse_poly, "pulseroute", ambient_temp_c, mrt_svc
        )

        # ── Stops ──────────────────────────────────────────────────────────────
        fastest_midpoint = (
            fastest_poly[len(fastest_poly) // 2] if fastest_poly else (origin_lat, origin_lng)
        )
        pulse_midpoint = (
            pulse_poly[len(pulse_poly) // 2] if pulse_poly else (origin_lat, origin_lng)
        )

        fastest_bbox = _route_bbox(fastest_poly) if fastest_poly else (
            origin_lat, origin_lng, dest_lat, dest_lng
        )
        pulse_bbox = _route_bbox(pulse_poly) if pulse_poly else (
            origin_lat, origin_lng, dest_lat, dest_lng
        )

        fastest_stops_resp = stops_service.get_stops(fastest_bbox, "water")
        pulse_stops_resp = stops_service.get_stops(pulse_bbox, "water")

        fastest_all_stops = (
            fastest_stops_resp.fountains
            + fastest_stops_resp.cafes
            + fastest_stops_resp.repair
        )
        pulse_all_stops = (
            pulse_stops_resp.fountains
            + pulse_stops_resp.cafes
            + pulse_stops_resp.repair
        )

        fastest_top_stops = _top3_stops_by_proximity(fastest_all_stops, fastest_midpoint)
        pulse_top_stops = _top3_stops_by_proximity(pulse_all_stops, pulse_midpoint)

        # ── Provenance ─────────────────────────────────────────────────────────
        fetch_time = datetime.now(timezone.utc)
        env_source = weather.provenance.env_source or SourceRef(
            source_id="mapbox",
            timestamp=fetch_time,
            age_seconds=0,
        )

        # Fetch bio_source if bio_session_id is provided
        bio_source = None
        if req.bio_session_id:
            try:
                from backend.services.bio_service import bio_service
                biosignal = bio_service.get_current(req.bio_session_id)
                bio_source = SourceRef(
                    source_id=biosignal.source,
                    timestamp=biosignal.timestamp,
                    age_seconds=int((fetch_time - biosignal.timestamp).total_seconds()),
                )
            except Exception as e:
                logger.warning(
                    "route_service.bio_fetch_failed",
                    session_id=req.bio_session_id,
                    error=str(e),
                )

        fastest_seg_id = fastest_segments[0].id if fastest_segments else "seg-fastest-000"
        pulse_seg_id = pulse_segments[0].id if pulse_segments else "seg-pulseroute-000"

        fastest_provenance = Provenance(
            env_source=env_source,
            bio_source=bio_source,
            route_segment_id=fastest_seg_id,
        )
        pulse_provenance = Provenance(
            env_source=env_source,
            bio_source=bio_source,
            route_segment_id=pulse_seg_id,
        )
        response_provenance = Provenance(
            env_source=env_source,
            bio_source=bio_source,
            route_segment_id=fastest_seg_id,
        )

        # ── Assemble routes ────────────────────────────────────────────────────
        fastest_route = Route(
            polyline=fastest_poly,
            distance_m=fastest_dist,
            eta_seconds=int(fastest_eta),
            peak_mrt_c=fastest_peak_mrt,
            mean_mrt_c=fastest_mean_mrt,
            shade_pct=fastest_shade,
            stops=fastest_top_stops,
            segments=fastest_segments,
            provenance=fastest_provenance,
        )

        pulse_route = Route(
            polyline=pulse_poly,
            distance_m=pulse_dist,
            eta_seconds=int(pulse_eta),
            peak_mrt_c=pulse_peak_mrt,
            mean_mrt_c=pulse_mean_mrt,
            shade_pct=pulse_shade,
            stops=pulse_top_stops,
            segments=pulse_segments,
            provenance=pulse_provenance,
        )

        route_response = RouteResponse(
            fastest=fastest_route,
            pulseroute=pulse_route,
            provenance=response_provenance,
        )

        # ── Cache ──────────────────────────────────────────────────────────────
        cache.setex(cache_key, _CACHE_TTL, route_response.model_dump(mode="json"))

        return route_response


# Module-level singleton
route_service = RouteService()
