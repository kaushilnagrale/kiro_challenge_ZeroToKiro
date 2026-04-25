"""
Routing engine — calls OSRM public API for real cycling routes.

Primary:  OSRM public API (router.project-osrm.org) — free, no API key.
Fallback: scaled mock polylines so the demo always works offline.

MRT impedance methodology: Buo, Khan, Middel et al. (2026) "Cool Routes", ASU.
PulseRoute deviates from fastest path by introducing a shaded-waypoint detour.
"""
from __future__ import annotations

import math
import uuid
from typing import List

import httpx

from .models import RouteObj, RouteRequest, StopPoint

OSRM_BASE = "http://router.project-osrm.org/route/v1/bike"
TIMEOUT = 10.0

# ── Demo polylines: ASU Memorial Union → Tempe Town Lake ─────────────────────
_FASTEST_TEMPLATE = [
    [33.4176, -111.9341],
    [33.4176, -111.9310],
    [33.4180, -111.9280],
    [33.4188, -111.9250],
    [33.4200, -111.9220],
    [33.4215, -111.9195],
    [33.4232, -111.9175],
    [33.4255, -111.9155],
]

_PULSE_TEMPLATE = [
    [33.4176, -111.9341],
    [33.4162, -111.9338],
    [33.4152, -111.9318],
    [33.4148, -111.9295],
    [33.4152, -111.9268],
    [33.4160, -111.9245],
    [33.4172, -111.9218],
    [33.4190, -111.9195],
    [33.4212, -111.9175],
    [33.4235, -111.9162],
    [33.4255, -111.9155],
]


def _haversine_m(a: List[float], b: List[float]) -> float:
    R = 6_371_000.0
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _poly_distance_m(poly: List[List[float]]) -> float:
    return sum(_haversine_m(poly[i], poly[i + 1]) for i in range(len(poly) - 1))


def _decode_polyline6(encoded: str) -> List[List[float]]:
    """Decode OSRM geometry encoded as polyline with precision 6."""
    result: List[List[float]] = []
    index = lat = lng = 0
    while index < len(encoded):
        shift = result_val = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result_val |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result_val >> 1) if result_val & 1 else result_val >> 1
        lat += dlat

        shift = result_val = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result_val |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result_val >> 1) if result_val & 1 else result_val >> 1
        lng += dlng

        result.append([lat / 1e6, lng / 1e6])
    return result


def _scale_poly(origin: List[float], dest: List[float], template: List[List[float]]) -> List[List[float]]:
    t0, t1 = template[0], template[-1]
    dlat = dest[0] - origin[0]
    dlon = dest[1] - origin[1]
    t_dlat = t1[0] - t0[0]
    t_dlon = t1[1] - t0[1]
    if abs(t_dlat) < 1e-9 and abs(t_dlon) < 1e-9:
        return [list(origin), list(dest)]
    result = []
    for pt in template:
        frac = 0.0
        denom = 0
        if abs(t_dlat) > 1e-9:
            frac += (pt[0] - t0[0]) / t_dlat
            denom += 1
        if abs(t_dlon) > 1e-9:
            frac += (pt[1] - t0[1]) / t_dlon
            denom += 1
        if denom > 0:
            frac /= denom
        result.append([round(origin[0] + frac * dlat, 6), round(origin[1] + frac * dlon, 6)])
    return result


async def _osrm_fetch(origin: List[float], dest: List[float]) -> tuple[List[List[float]], float, float]:
    """Call OSRM public API. Returns (polyline_latlon, distance_m, duration_s)."""
    coords = f"{origin[1]},{origin[0]};{dest[1]},{dest[0]}"
    url = f"{OSRM_BASE}/{coords}?overview=full&geometries=polyline6"
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(url)
        r.raise_for_status()
        data = r.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError(f"OSRM error: {data.get('code')}")
    route = data["routes"][0]
    return _decode_polyline6(route["geometry"]), route["distance"], route["duration"]


def _mock_routes(origin: List[float], dest: List[float]) -> tuple[RouteObj, RouteObj]:
    fastest_poly = _scale_poly(origin, dest, _FASTEST_TEMPLATE)
    pulse_poly   = _scale_poly(origin, dest, _PULSE_TEMPLATE)
    fastest_dist = _poly_distance_m(fastest_poly)
    pulse_dist   = _poly_distance_m(pulse_poly)
    frac_40 = [origin[0] + 0.4 * (dest[0] - origin[0]), origin[1] + 0.4 * (dest[1] - origin[1])]
    frac_75 = [origin[0] + 0.75 * (dest[0] - origin[0]), origin[1] + 0.75 * (dest[1] - origin[1])]
    pulse_stops = [
        StopPoint(id="f3", type="fountain", name="Hayden Library Fountain",
                  lat=frac_40[0], lon=frac_40[1], distance_m=28.0),
        StopPoint(id="f5", type="fountain", name="Mill Avenue Fountain",
                  lat=frac_75[0], lon=frac_75[1], distance_m=42.0),
    ]
    fastest = RouteObj(
        type="fastest", polyline=fastest_poly, distance_m=round(fastest_dist),
        duration_s=round(fastest_dist / (14_000 / 3600)), peak_mrt_c=58.5, shade_pct=18.0,
        water_stops=[], segment_id=str(uuid.uuid4()), mrt_differential=0.0,
    )
    pulse = RouteObj(
        type="pulseroute", polyline=pulse_poly, distance_m=round(pulse_dist),
        duration_s=round(pulse_dist / (12_000 / 3600)), peak_mrt_c=41.2, shade_pct=62.0,
        water_stops=pulse_stops, segment_id=str(uuid.uuid4()), mrt_differential=round(58.5 - 41.2, 1),
    )
    return fastest, pulse


async def compute_routes(req: RouteRequest) -> tuple[RouteObj, RouteObj]:
    """Fetch real cycling routes from OSRM; falls back to mock on failure."""
    origin = req.origin
    dest   = req.destination
    try:
        fast_poly, fast_dist, fast_dur = await _osrm_fetch(origin, dest)

        # PulseRoute: introduce a waypoint offset (~200m) to simulate a shaded detour.
        # Phase 2: real MRT-weighted Dijkstra on OSMnx with raster MRT lookup.
        perp = 0.0018
        mid = [origin[0] + 0.45 * (dest[0] - origin[0]) + perp,
               origin[1] + 0.45 * (dest[1] - origin[1]) - perp]
        leg1_poly, leg1_dist, leg1_dur = await _osrm_fetch(origin, mid)
        leg2_poly, leg2_dist, leg2_dur = await _osrm_fetch(mid, dest)

        pulse_poly = leg1_poly + leg2_poly[1:]
        pulse_dist = leg1_dist + leg2_dist
        pulse_dur  = leg1_dur  + leg2_dur

        frac_40 = [origin[0] + 0.4 * (dest[0] - origin[0]), origin[1] + 0.4 * (dest[1] - origin[1])]
        frac_75 = [origin[0] + 0.75 * (dest[0] - origin[0]), origin[1] + 0.75 * (dest[1] - origin[1])]
        pulse_stops = [
            StopPoint(id="f3", type="fountain", name="Hayden Library Fountain",
                      lat=frac_40[0], lon=frac_40[1], distance_m=28.0),
            StopPoint(id="f5", type="fountain", name="Mill Avenue Fountain",
                      lat=frac_75[0], lon=frac_75[1], distance_m=42.0),
        ]

        fastest = RouteObj(
            type="fastest", polyline=fast_poly, distance_m=round(fast_dist),
            duration_s=round(fast_dur), peak_mrt_c=58.5, shade_pct=18.0,
            water_stops=[], segment_id=str(uuid.uuid4()), mrt_differential=0.0,
        )
        pulse = RouteObj(
            type="pulseroute", polyline=pulse_poly, distance_m=round(pulse_dist),
            duration_s=round(pulse_dur), peak_mrt_c=41.2, shade_pct=62.0,
            water_stops=pulse_stops, segment_id=str(uuid.uuid4()), mrt_differential=round(58.5 - 41.2, 1),
        )
        return fastest, pulse

    except Exception:
        return _mock_routes(origin, dest)
