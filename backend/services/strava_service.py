"""
StravaService — simulates Strava API integration for hackathon demo.

PRODUCTION: Real Strava OAuth + API calls
HACKATHON: Fake data that looks real

Strava API docs: https://developers.strava.com/docs/reference/
"""

import random
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from pydantic import BaseModel

logger = structlog.get_logger()


class StravaAthlete(BaseModel):
    """Athlete profile from Strava."""
    id: int
    username: str
    firstname: str
    lastname: str
    profile_photo_url: str
    city: str
    state: str
    country: str


class StravaStats(BaseModel):
    """Athlete stats from Strava."""
    recent_ride_totals: dict  # Last 4 weeks
    ytd_ride_totals: dict  # Year to date
    all_ride_totals: dict  # All time


class StravaActivity(BaseModel):
    """Recent activity from Strava."""
    id: int
    name: str
    distance: float  # meters
    moving_time: int  # seconds
    elapsed_time: int  # seconds
    total_elevation_gain: float  # meters
    type: str  # "Ride"
    start_date: datetime
    average_heartrate: Optional[float] = None
    max_heartrate: Optional[float] = None
    average_speed: float  # m/s
    max_speed: float  # m/s
    average_watts: Optional[float] = None
    suffer_score: Optional[int] = None  # Strava's relative effort


class StravaService:
    """
    Simulates Strava API integration.
    
    HACKATHON: Returns fake but realistic data
    PRODUCTION: Replace with real Strava OAuth + API calls
    """
    
    def __init__(self):
        self._mock_athletes = self._create_mock_athletes()
        logger.info("strava_service.initialized", mode="MOCK")
    
    def _create_mock_athletes(self) -> dict[str, dict]:
        """Create fake Strava profiles for demo users."""
        return {
            "demo_beginner": {
                "athlete": StravaAthlete(
                    id=12345678,
                    username="sarah_rides",
                    firstname="Sarah",
                    lastname="Chen",
                    profile_photo_url="https://via.placeholder.com/150",
                    city="Tempe",
                    state="Arizona",
                    country="USA",
                ),
                "resting_hr": 78.0,
                "max_hr": 185.0,
                "ftp": 150.0,  # Functional Threshold Power (watts)
                "recent_rides": 8,  # Last 4 weeks
                "avg_distance": 15000.0,  # 15km average
            },
            "demo_intermediate": {
                "athlete": StravaAthlete(
                    id=23456789,
                    username="mike_cyclist",
                    firstname="Mike",
                    lastname="Rodriguez",
                    profile_photo_url="https://via.placeholder.com/150",
                    city="Tempe",
                    state="Arizona",
                    country="USA",
                ),
                "resting_hr": 65.0,
                "max_hr": 185.0,
                "ftp": 220.0,
                "recent_rides": 15,
                "avg_distance": 30000.0,  # 30km average
            },
            "demo_advanced": {
                "athlete": StravaAthlete(
                    id=34567890,
                    username="alex_pro",
                    firstname="Alex",
                    lastname="Kim",
                    profile_photo_url="https://via.placeholder.com/150",
                    city="Tempe",
                    state="Arizona",
                    country="USA",
                ),
                "resting_hr": 52.0,
                "max_hr": 185.0,
                "ftp": 310.0,
                "recent_rides": 25,
                "avg_distance": 50000.0,  # 50km average
            },
        }
    
    def get_athlete(self, user_id: str) -> Optional[StravaAthlete]:
        """
        Get athlete profile from Strava.
        
        PRODUCTION: GET https://www.strava.com/api/v3/athlete
        HACKATHON: Return mock data
        """
        mock_data = self._mock_athletes.get(user_id)
        if not mock_data:
            return None
        
        logger.info("strava_service.get_athlete", user_id=user_id, username=mock_data["athlete"].username)
        return mock_data["athlete"]
    
    def get_athlete_stats(self, user_id: str) -> Optional[StravaStats]:
        """
        Get athlete stats from Strava.
        
        PRODUCTION: GET https://www.strava.com/api/v3/athletes/{id}/stats
        HACKATHON: Return mock data
        """
        mock_data = self._mock_athletes.get(user_id)
        if not mock_data:
            return None
        
        recent_rides = mock_data["recent_rides"]
        avg_distance = mock_data["avg_distance"]
        
        stats = StravaStats(
            recent_ride_totals={
                "count": recent_rides,
                "distance": avg_distance * recent_rides,
                "moving_time": int(avg_distance * recent_rides / 6.0),  # ~6 m/s avg
                "elevation_gain": avg_distance * recent_rides * 0.01,  # 1% grade
            },
            ytd_ride_totals={
                "count": recent_rides * 12,  # Extrapolate to year
                "distance": avg_distance * recent_rides * 12,
                "moving_time": int(avg_distance * recent_rides * 12 / 6.0),
                "elevation_gain": avg_distance * recent_rides * 12 * 0.01,
            },
            all_ride_totals={
                "count": recent_rides * 50,  # Lifetime
                "distance": avg_distance * recent_rides * 50,
                "moving_time": int(avg_distance * recent_rides * 50 / 6.0),
                "elevation_gain": avg_distance * recent_rides * 50 * 0.01,
            },
        )
        
        logger.info("strava_service.get_stats", user_id=user_id, recent_rides=recent_rides)
        return stats
    
    def get_recent_activities(self, user_id: str, limit: int = 10) -> list[StravaActivity]:
        """
        Get recent activities from Strava.
        
        PRODUCTION: GET https://www.strava.com/api/v3/athlete/activities
        HACKATHON: Generate fake but realistic activities
        """
        mock_data = self._mock_athletes.get(user_id)
        if not mock_data:
            return []
        
        activities = []
        now = datetime.now(timezone.utc)
        
        for i in range(min(limit, mock_data["recent_rides"])):
            # Generate activity from past 4 weeks
            days_ago = random.randint(1, 28)
            start_date = now - timedelta(days=days_ago)
            
            # Distance varies by fitness level
            base_distance = mock_data["avg_distance"]
            distance = base_distance * random.uniform(0.7, 1.3)
            
            # Speed varies by fitness level
            avg_speed = distance / (distance / 6.0)  # ~6 m/s base
            
            # HR data
            resting_hr = mock_data["resting_hr"]
            max_hr = mock_data["max_hr"]
            avg_hr = resting_hr + (max_hr - resting_hr) * random.uniform(0.6, 0.8)
            max_hr_activity = resting_hr + (max_hr - resting_hr) * random.uniform(0.85, 0.95)
            
            # Power data (if available)
            ftp = mock_data.get("ftp")
            avg_watts = ftp * random.uniform(0.6, 0.8) if ftp else None
            
            # Suffer score (Strava's relative effort)
            suffer_score = int(distance / 1000 * random.uniform(5, 15))
            
            activity = StravaActivity(
                id=1000000 + i,
                name=self._generate_ride_name(i, days_ago),
                distance=distance,
                moving_time=int(distance / avg_speed),
                elapsed_time=int(distance / avg_speed * 1.1),  # 10% stopped time
                total_elevation_gain=distance * 0.01,  # 1% grade
                type="Ride",
                start_date=start_date,
                average_heartrate=avg_hr,
                max_heartrate=max_hr_activity,
                average_speed=avg_speed,
                max_speed=avg_speed * 1.5,
                average_watts=avg_watts,
                suffer_score=suffer_score,
            )
            activities.append(activity)
        
        logger.info("strava_service.get_activities", user_id=user_id, count=len(activities))
        return activities
    
    def _generate_ride_name(self, index: int, days_ago: int) -> str:
        """Generate realistic ride names."""
        names = [
            "Morning Ride",
            "Afternoon Ride",
            "Evening Ride",
            "Lunch Ride",
            "Tempe Town Lake Loop",
            "ASU Campus Cruise",
            "Mill Ave to Papago",
            "Rio Salado Trail",
            "Desert Ride",
            "Heat Training",
        ]
        return names[index % len(names)]
    
    def get_fitness_metrics(self, user_id: str) -> dict:
        """
        Extract fitness metrics from Strava data.
        
        Returns metrics useful for PulseRoute personalization:
        - resting_hr: Resting heart rate
        - max_hr: Max heart rate
        - ftp: Functional Threshold Power
        - recent_volume: Recent training volume
        - fitness_level: Estimated fitness level
        """
        mock_data = self._mock_athletes.get(user_id)
        if not mock_data:
            return {}
        
        # Calculate fitness level based on FTP and volume
        ftp = mock_data.get("ftp", 0)
        recent_rides = mock_data["recent_rides"]
        
        if ftp < 180 or recent_rides < 10:
            fitness_level = "beginner"
        elif ftp < 250 or recent_rides < 18:
            fitness_level = "intermediate"
        else:
            fitness_level = "advanced"
        
        metrics = {
            "resting_hr": mock_data["resting_hr"],
            "max_hr": mock_data["max_hr"],
            "ftp": ftp,
            "recent_rides": recent_rides,
            "avg_distance_km": mock_data["avg_distance"] / 1000,
            "fitness_level": fitness_level,
            "hrv_baseline": self._estimate_hrv(fitness_level),
        }
        
        logger.info("strava_service.get_fitness_metrics", user_id=user_id, fitness_level=fitness_level)
        return metrics
    
    def _estimate_hrv(self, fitness_level: str) -> float:
        """Estimate HRV baseline from fitness level."""
        if fitness_level == "beginner":
            return 35.0
        elif fitness_level == "advanced":
            return 75.0
        else:
            return 55.0
    
    def connect_strava(self, user_id: str, strava_code: str) -> dict:
        """
        Simulate Strava OAuth connection.
        
        PRODUCTION: Exchange code for access token
        POST https://www.strava.com/oauth/token
        
        HACKATHON: Return mock success
        """
        logger.info("strava_service.connect", user_id=user_id, code=strava_code[:10])
        
        # In production, this would:
        # 1. Exchange code for access token
        # 2. Store token in database
        # 3. Fetch athlete data
        # 4. Return success
        
        return {
            "success": True,
            "athlete_id": 12345678,
            "access_token": "mock_token_" + user_id,
            "refresh_token": "mock_refresh_" + user_id,
            "expires_at": int((datetime.now(timezone.utc) + timedelta(hours=6)).timestamp()),
        }


# Module-level singleton
strava_service = StravaService()
