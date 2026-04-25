"""
Route router — POST /route

Accepts a RouteRequest, fetches weather for the origin, computes fastest
and pulseroute cycling routes via RouteService, and returns a RouteResponse.
"""

from fastapi import APIRouter

from backend.services.route_service import route_service
from backend.services.weather_service import weather_service
from shared.schema import RouteRequest, RouteResponse

router = APIRouter(tags=["route"])


@router.post("/route", response_model=RouteResponse)
async def post_route(req: RouteRequest) -> RouteResponse:
    """
    Compute fastest and pulseroute cycling routes.

    - **origin**: [lat, lng] of the starting point
    - **destination**: [lat, lng] of the ending point
    - **depart_time**: ISO 8601 departure datetime
    - **sensitive_mode**: if True, apply extra heat-avoidance weighting
    - **bio_session_id**: optional biosignal session for risk annotation
    - **amenity_prefs**: list of preferred stop amenities (default: ["water"])
    """
    weather = await weather_service.get_weather(req.origin[0], req.origin[1])
    return await route_service.compute_route(req, weather)
