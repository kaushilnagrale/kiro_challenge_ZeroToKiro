"""
Stops router — GET /stops?bbox=lat_min,lng_min,lat_max,lng_max&amenity=water
"""

from fastapi import APIRouter, HTTPException

from backend.services.stops_service import stops_service
from shared.schema import StopsResponse

router = APIRouter(tags=["stops"])


@router.get("/stops", response_model=StopsResponse)
async def get_stops(
    bbox: str,
    amenity: str | None = None,
) -> StopsResponse:
    """
    Return stops filtered by bounding box and optional amenity.

    bbox format: lat_min,lng_min,lat_max,lng_max  (comma-separated floats)
    amenity: one of water | shade | food | restroom | ac | bike_repair
    """
    parts = bbox.split(",")
    if len(parts) != 4:
        raise HTTPException(
            status_code=422,
            detail="bbox must be four comma-separated floats: lat_min,lng_min,lat_max,lng_max",
        )
    try:
        lat_min, lng_min, lat_max, lng_max = (float(p.strip()) for p in parts)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="bbox values must be valid floats",
        )

    return stops_service.get_stops(
        bbox=(lat_min, lng_min, lat_max, lng_max),
        amenity=amenity,
    )
