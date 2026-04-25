"""
Stops fetcher — Overpass API for water fountains, bike repair, cafes.
Falls back to a curated mock dataset when Overpass is unavailable.
"""
from __future__ import annotations

import uuid
from typing import List

import httpx

from .models import StopPoint

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
TEMPE_BBOX = (33.38, -111.97, 33.47, -111.90)  # south, west, north, east


async def fetch_stops(bbox: tuple = TEMPE_BBOX, timeout: int = 15) -> dict:
    south, west, north, east = bbox
    query = f"""
[out:json][timeout:{timeout}];
(
  node["amenity"="drinking_water"]({south},{west},{north},{east});
  node["amenity"="bicycle_repair_station"]({south},{west},{north},{east});
  node["amenity"="cafe"]({south},{west},{north},{east});
);
out body;
"""
    try:
        async with httpx.AsyncClient(timeout=timeout + 5) as client:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            elements = resp.json().get("elements", [])
            result = _parse_stops(elements)
            if result["fountains"] or result["cafes"] or result["repair"]:
                return result
    except Exception:
        pass
    return _mock_stops()


def _parse_stops(elements: list) -> dict:
    fountains: List[StopPoint] = []
    cafes: List[StopPoint] = []
    repair: List[StopPoint] = []

    for el in elements:
        tags = el.get("tags", {})
        lat = float(el.get("lat", 0))
        lon = float(el.get("lon", 0))
        amenity = tags.get("amenity", "")
        name = tags.get("name", amenity.replace("_", " ").title())
        stop_id = str(el.get("id", uuid.uuid4()))

        if amenity == "drinking_water":
            fountains.append(StopPoint(id=stop_id, type="fountain", name=name or "Water Fountain", lat=lat, lon=lon))
        elif amenity == "bicycle_repair_station":
            repair.append(StopPoint(id=stop_id, type="repair", name=name or "Bike Repair", lat=lat, lon=lon))
        elif amenity == "cafe":
            cafes.append(StopPoint(id=stop_id, type="cafe", name=name or "Cafe", lat=lat, lon=lon))

    return {"fountains": fountains, "cafes": cafes, "repair": repair}


def _mock_stops() -> dict:
    """Curated stops around ASU / Tempe for the demo."""
    fountains: List[StopPoint] = [
        StopPoint(id="f1", type="fountain", name="MU Courtyard Fountain",      lat=33.4175, lon=-111.9338),
        StopPoint(id="f2", type="fountain", name="Tyler Mall Fountain",         lat=33.4192, lon=-111.9315),
        StopPoint(id="f3", type="fountain", name="Hayden Library Fountain",     lat=33.4199, lon=-111.9295),
        StopPoint(id="f4", type="fountain", name="Tempe Beach Park Fountain",   lat=33.4260, lon=-111.9155),
        StopPoint(id="f5", type="fountain", name="Mill Avenue Fountain",        lat=33.4235, lon=-111.9170),
        StopPoint(id="f6", type="fountain", name="Apache Blvd Fountain",        lat=33.4160, lon=-111.9250),
        StopPoint(id="f7", type="fountain", name="Rural Rd Park Fountain",      lat=33.4185, lon=-111.9215),
        StopPoint(id="f8", type="fountain", name="Gammage Pkwy Fountain",       lat=33.4150, lon=-111.9290),
    ]
    cafes: List[StopPoint] = [
        StopPoint(id="c1", type="cafe", name="Dutch Bros Coffee — Mill Ave",  lat=33.4230, lon=-111.9175),
        StopPoint(id="c2", type="cafe", name="Cartel Coffee Lab",             lat=33.4220, lon=-111.9165),
        StopPoint(id="c3", type="cafe", name="Starbucks — ASU",               lat=33.4195, lon=-111.9330),
        StopPoint(id="c4", type="cafe", name="Bergies Coffee Roast House",    lat=33.4210, lon=-111.9200),
    ]
    repair_stations: List[StopPoint] = [
        StopPoint(id="r1", type="repair", name="ASU Bike Hub",      lat=33.4178, lon=-111.9310),
        StopPoint(id="r2", type="repair", name="Tempe Bike Station", lat=33.4250, lon=-111.9160),
    ]
    return {"fountains": fountains, "cafes": cafes, "repair": repair_stations}
