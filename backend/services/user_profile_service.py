"""
UserProfileService — simulates fitness app integration for hackathon.

In production, this would integrate with:
- Strava API (past rides, FTP, training load)
- Apple Health (resting HR, HRV baseline, VO2 max)
- Garmin Connect (fitness age, recovery metrics)

For hackathon, we simulate 3 user archetypes with realistic baselines.
"""

from datetime import datetime, timezone
from typing import Literal, Optional

import structlog
from pydantic import BaseModel

logger = structlog.get_logger()

FitnessLevel = Literal["beginner", "intermediate", "advanced"]


class UserProfile(BaseModel):
    """
    User fitness profile - simulates data from fitness apps.
    
    In production, this would be populated from:
    - Strava: avg_power, ftp, recent_rides
    - Apple Health: resting_hr, hrv_baseline, vo2_max
    - Garmin: fitness_age, recovery_score
    """
    user_id: str
    fitness_level: FitnessLevel
    
    # Baseline metrics (from fitness app history)
    resting_hr: float  # bpm - from Apple Health or Garmin
    max_hr: float  # bpm - calculated or from fitness test
    hrv_baseline: float  # ms - 7-day average from fitness app
    vo2_max: Optional[float] = None  # ml/kg/min - from fitness app
    
    # Thresholds (personalized based on fitness level)
    hr_alert_threshold: float  # When to alert for high HR
    hrv_alert_threshold: float  # When to alert for low HRV
    
    # Metadata
    created_at: datetime
    last_updated: datetime


class UserProfileService:
    """
    Manages user fitness profiles.
    
    Hackathon: Pre-defined archetypes (beginner/intermediate/advanced)
    Production: Fetch from Strava/Apple Health/Garmin APIs
    """
    
    def __init__(self):
        # In-memory storage: user_id -> UserProfile
        self._profiles: dict[str, UserProfile] = {}
        
        # Pre-populate with demo users
        self._create_demo_profiles()
        
        logger.info("user_profile_service.initialized", demo_users=len(self._profiles))
    
    def _create_demo_profiles(self):
        """Create 3 demo users representing different fitness levels."""
        now = datetime.now(timezone.utc)
        
        # Beginner: New to cycling, lower fitness
        self._profiles["demo_beginner"] = UserProfile(
            user_id="demo_beginner",
            fitness_level="beginner",
            resting_hr=78.0,  # Higher resting HR
            max_hr=185.0,  # Age-based (220 - 35)
            hrv_baseline=35.0,  # Lower HRV
            vo2_max=35.0,  # Lower VO2 max
            hr_alert_threshold=140.0,  # Alert earlier (more conservative)
            hrv_alert_threshold=25.0,  # Alert at higher HRV (more conservative)
            created_at=now,
            last_updated=now,
        )
        
        # Intermediate: Regular cyclist, good fitness
        self._profiles["demo_intermediate"] = UserProfile(
            user_id="demo_intermediate",
            fitness_level="intermediate",
            resting_hr=65.0,  # Average resting HR
            max_hr=185.0,
            hrv_baseline=55.0,  # Average HRV
            vo2_max=45.0,  # Average VO2 max
            hr_alert_threshold=155.0,  # Standard threshold
            hrv_alert_threshold=35.0,  # Standard threshold
            created_at=now,
            last_updated=now,
        )
        
        # Advanced: Athlete, high fitness
        self._profiles["demo_advanced"] = UserProfile(
            user_id="demo_advanced",
            fitness_level="advanced",
            resting_hr=52.0,  # Low resting HR (athlete)
            max_hr=185.0,
            hrv_baseline=75.0,  # High HRV (good recovery)
            vo2_max=58.0,  # High VO2 max
            hr_alert_threshold=170.0,  # Alert later (less conservative)
            hrv_alert_threshold=45.0,  # Alert at lower HRV (less conservative)
            created_at=now,
            last_updated=now,
        )
    
    def get_profile(self, user_id: str) -> Optional[UserProfile]:
        """
        Get user profile by ID.
        
        Hackathon: Returns pre-defined profile or creates default
        Production: Fetch from database + sync with fitness apps
        """
        if user_id in self._profiles:
            return self._profiles[user_id]
        
        # Default to intermediate if user not found
        logger.warning("user_profile_service.profile_not_found", user_id=user_id)
        return self._profiles.get("demo_intermediate")
    
    def create_profile(
        self,
        user_id: str,
        fitness_level: FitnessLevel,
        resting_hr: Optional[float] = None,
        hrv_baseline: Optional[float] = None,
    ) -> UserProfile:
        """
        Create a new user profile.
        
        Hackathon: Use fitness_level to set defaults
        Production: Fetch actual metrics from fitness app APIs
        """
        now = datetime.now(timezone.utc)
        
        # Set defaults based on fitness level
        if fitness_level == "beginner":
            resting_hr = resting_hr or 78.0
            hrv_baseline = hrv_baseline or 35.0
            hr_alert = 140.0
            hrv_alert = 25.0
            vo2_max = 35.0
        elif fitness_level == "advanced":
            resting_hr = resting_hr or 52.0
            hrv_baseline = hrv_baseline or 75.0
            hr_alert = 170.0
            hrv_alert = 45.0
            vo2_max = 58.0
        else:  # intermediate
            resting_hr = resting_hr or 65.0
            hrv_baseline = hrv_baseline or 55.0
            hr_alert = 155.0
            hrv_alert = 35.0
            vo2_max = 45.0
        
        profile = UserProfile(
            user_id=user_id,
            fitness_level=fitness_level,
            resting_hr=resting_hr,
            max_hr=220.0 - 35.0,  # Age-based estimate (assume 35 years old)
            hrv_baseline=hrv_baseline,
            vo2_max=vo2_max,
            hr_alert_threshold=hr_alert,
            hrv_alert_threshold=hrv_alert,
            created_at=now,
            last_updated=now,
        )
        
        self._profiles[user_id] = profile
        logger.info(
            "user_profile_service.profile_created",
            user_id=user_id,
            fitness_level=fitness_level,
        )
        
        return profile
    
    def update_profile(
        self,
        user_id: str,
        resting_hr: Optional[float] = None,
        hrv_baseline: Optional[float] = None,
    ) -> Optional[UserProfile]:
        """
        Update user profile with new metrics.
        
        Hackathon: Manual update
        Production: Auto-sync from fitness apps daily
        """
        profile = self.get_profile(user_id)
        if not profile:
            return None
        
        if resting_hr is not None:
            profile.resting_hr = resting_hr
        if hrv_baseline is not None:
            profile.hrv_baseline = hrv_baseline
        
        profile.last_updated = datetime.now(timezone.utc)
        
        logger.info(
            "user_profile_service.profile_updated",
            user_id=user_id,
            resting_hr=profile.resting_hr,
            hrv_baseline=profile.hrv_baseline,
        )
        
        return profile
    
    def get_personalized_thresholds(self, user_id: str) -> dict[str, float]:
        """
        Get personalized alert thresholds for a user.
        
        Returns dict with hr_threshold, hrv_threshold based on user's fitness.
        """
        profile = self.get_profile(user_id)
        if not profile:
            # Default thresholds (intermediate)
            return {
                "hr_threshold": 155.0,
                "hrv_threshold": 35.0,
                "resting_hr": 65.0,
                "hrv_baseline": 55.0,
            }
        
        return {
            "hr_threshold": profile.hr_alert_threshold,
            "hrv_threshold": profile.hrv_alert_threshold,
            "resting_hr": profile.resting_hr,
            "hrv_baseline": profile.hrv_baseline,
        }


# Module-level singleton
user_profile_service = UserProfileService()
