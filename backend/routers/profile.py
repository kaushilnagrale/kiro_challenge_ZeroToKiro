"""
Profile router — user profile and Strava integration endpoints.

Endpoints:
- GET /profile/{user_id} - Get user profile
- POST /profile/connect-strava - Connect Strava account
- GET /profile/{user_id}/strava - Get Strava data
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.strava_service import strava_service
from backend.services.user_profile_service import (
    FitnessLevel,
    UserProfile,
    user_profile_service,
)

router = APIRouter(prefix="/profile", tags=["profile"])


class ConnectStravaRequest(BaseModel):
    """Request to connect Strava account."""
    user_id: str
    strava_code: str  # OAuth code from Strava


class ConnectStravaResponse(BaseModel):
    """Response after connecting Strava."""
    success: bool
    athlete_id: int
    profile: UserProfile


class StravaDataResponse(BaseModel):
    """Strava data for a user."""
    athlete: dict
    stats: dict
    recent_activities: list[dict]
    fitness_metrics: dict


@router.get("/{user_id}")
def get_profile(user_id: str) -> UserProfile:
    """
    Get user profile.
    
    Returns personalized fitness profile with thresholds.
    """
    profile = user_profile_service.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/connect-strava")
def connect_strava(request: ConnectStravaRequest) -> ConnectStravaResponse:
    """
    Connect Strava account and import fitness data.
    
    HACKATHON: Simulates OAuth flow with mock data
    PRODUCTION: Real Strava OAuth + token exchange
    
    Flow:
    1. User clicks "Connect Strava" in app
    2. App redirects to Strava OAuth
    3. Strava redirects back with code
    4. App calls this endpoint with code
    5. Backend exchanges code for token
    6. Backend fetches athlete data
    7. Backend creates/updates user profile
    """
    # Step 1: Exchange code for token (mocked)
    strava_auth = strava_service.connect_strava(request.user_id, request.strava_code)
    
    if not strava_auth["success"]:
        raise HTTPException(status_code=400, detail="Strava connection failed")
    
    # Step 2: Fetch fitness metrics from Strava
    fitness_metrics = strava_service.get_fitness_metrics(request.user_id)
    
    if not fitness_metrics:
        raise HTTPException(status_code=404, detail="Could not fetch Strava data")
    
    # Step 3: Create/update user profile with Strava data
    profile = user_profile_service.create_profile(
        user_id=request.user_id,
        fitness_level=fitness_metrics["fitness_level"],
        resting_hr=fitness_metrics["resting_hr"],
        hrv_baseline=fitness_metrics["hrv_baseline"],
    )
    
    return ConnectStravaResponse(
        success=True,
        athlete_id=strava_auth["athlete_id"],
        profile=profile,
    )


@router.get("/{user_id}/strava")
def get_strava_data(user_id: str) -> StravaDataResponse:
    """
    Get Strava data for a user.
    
    Returns athlete profile, stats, and recent activities.
    Useful for showing "Your Strava Stats" screen in app.
    """
    athlete = strava_service.get_athlete(user_id)
    if not athlete:
        raise HTTPException(status_code=404, detail="Strava not connected")
    
    stats = strava_service.get_athlete_stats(user_id)
    activities = strava_service.get_recent_activities(user_id, limit=10)
    fitness_metrics = strava_service.get_fitness_metrics(user_id)
    
    return StravaDataResponse(
        athlete=athlete.model_dump(),
        stats=stats.model_dump() if stats else {},
        recent_activities=[a.model_dump() for a in activities],
        fitness_metrics=fitness_metrics,
    )
