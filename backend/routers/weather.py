"""
Weather router — GET /weather?lat=<float>&lng=<float>

Returns a WeatherResponse with current conditions, 6-hour forecast,
NWS advisories, optional air quality, and provenance.
"""

from fastapi import APIRouter

from backend.services.weather_service import weather_service
from shared.schema import WeatherResponse

router = APIRouter(tags=["weather"])


@router.get("/weather", response_model=WeatherResponse)
async def get_weather(lat: float, lng: float) -> WeatherResponse:
    """
    Return current weather, 6-hour forecast, and NWS advisories for the
    given coordinates.

    - **lat**: latitude (e.g. 33.4255)
    - **lng**: longitude (e.g. -111.9400)
    """
    return await weather_service.get_weather(lat=lat, lng=lng)
