## Strava Integration for Personalized Hydration Alerts

### Your Question

> "We usually give user to connect from fitness app and then suggest them based on their past strain and metrics... but that would be production level. Think of something that can be working for now almost similar."

---

## Solution: Fake Strava Integration for Hackathon

**HACKATHON**: Mock Strava data with 3 realistic user profiles  
**PRODUCTION**: Real Strava OAuth + API integration

---

## Demo Results (Just Ran!)

### User 1: Sarah Chen (@sarah_rides) - BEGINNER

```
Strava Profile:
  • 8 rides in last 4 weeks
  • 120 km total distance
  • Avg ride: 15 km
  • Resting HR: 78 bpm
  • FTP: 150 watts

Personalized Thresholds:
  • HR Alert: 140 bpm (conservative)
  • HRV Alert: 25 ms
```

### User 2: Mike Rodriguez (@mike_cyclist) - INTERMEDIATE

```
Strava Profile:
  • 15 rides in last 4 weeks
  • 450 km total distance
  • Avg ride: 30 km
  • Resting HR: 65 bpm
  • FTP: 220 watts

Personalized Thresholds:
  • HR Alert: 155 bpm (standard)
  • HRV Alert: 35 ms
```

### User 3: Alex Kim (@alex_pro) - ADVANCED

```
Strava Profile:
  • 25 rides in last 4 weeks
  • 1250 km total distance
  • Avg ride: 50 km
  • Resting HR: 52 bpm (athlete!)
  • FTP: 310 watts

Personalized Thresholds:
  • HR Alert: 170 bpm (less conservative)
  • HRV Alert: 45 ms
```

---

## Why This Matters

### Same HR, Different Alert

**Scenario**: Both users have HR of 145 bpm

- **Sarah (Beginner)**: 🟡 YELLOW - "Consider a water break"
- **Alex (Advanced)**: 🟢 GREEN - "Normal for your fitness level"

**Same data, personalized interpretation!**

---

## Hackathon Implementation

### What We Built

1. **`backend/services/strava_service.py`**
   - Mock Strava API client
   - 3 pre-defined user profiles
   - Realistic fake data (rides, stats, HR, FTP)

2. **`backend/services/user_profile_service.py`**
   - User profile management
   - Personalized threshold calculation
   - Fitness level detection

3. **`backend/routers/profile.py`**
   - `/profile/{user_id}` - Get user profile
   - `/profile/connect-strava` - Connect Strava (mocked)
   - `/profile/{user_id}/strava` - Get Strava data

4. **Demo Script**
   - `scripts/demo_strava_integration.py`
   - Shows all 3 user types
   - Compares thresholds

### How to Use (Hackathon)

```python
# In mobile app or backend
from backend.services.strava_service import strava_service
from backend.services.user_profile_service import user_profile_service

# User selects their fitness level
user_id = "demo_beginner"  # or demo_intermediate, demo_advanced

# Get personalized thresholds
profile = user_profile_service.get_profile(user_id)
print(f"HR Alert: {profile.hr_alert_threshold} bpm")
print(f"HRV Alert: {profile.hrv_alert_threshold} ms")

# Use these thresholds in hydration classifier
# (instead of hardcoded 155 bpm for everyone)
```

---

## Production Implementation

### Real Strava OAuth Flow

```
1. User clicks "Connect Strava" button
   ↓
2. App redirects to Strava OAuth:
   https://www.strava.com/oauth/authorize?
     client_id=YOUR_CLIENT_ID
     &redirect_uri=pulseroute://strava-callback
     &response_type=code
     &scope=activity:read_all,profile:read_all
   ↓
3. User authorizes PulseRoute
   ↓
4. Strava redirects back:
   pulseroute://strava-callback?code=AUTHORIZATION_CODE
   ↓
5. App sends code to backend:
   POST /profile/connect-strava
   { "user_id": "user123", "strava_code": "AUTHORIZATION_CODE" }
   ↓
6. Backend exchanges code for token:
   POST https://www.strava.com/oauth/token
   {
     "client_id": "YOUR_CLIENT_ID",
     "client_secret": "YOUR_CLIENT_SECRET",
     "code": "AUTHORIZATION_CODE",
     "grant_type": "authorization_code"
   }
   ↓
7. Backend receives access token:
   {
     "access_token": "abc123...",
     "refresh_token": "xyz789...",
     "expires_at": 1234567890,
     "athlete": { "id": 12345, "firstname": "Sarah", ... }
   }
   ↓
8. Backend fetches athlete stats:
   GET https://www.strava.com/api/v3/athletes/12345/stats
   Authorization: Bearer abc123...
   ↓
9. Backend fetches recent activities:
   GET https://www.strava.com/api/v3/athlete/activities?per_page=30
   Authorization: Bearer abc123...
   ↓
10. Backend calculates fitness level:
    - FTP from power data
    - Volume from recent rides
    - Resting HR from activity data
    ↓
11. Backend creates user profile with personalized thresholds
    ↓
12. User gets personalized hydration alerts!
```

### Production Code Changes

**Replace mock with real API calls**:

```python
# backend/services/strava_service.py

import httpx

class StravaService:
    def __init__(self):
        self.client_id = os.getenv("STRAVA_CLIENT_ID")
        self.client_secret = os.getenv("STRAVA_CLIENT_SECRET")
        self.base_url = "https://www.strava.com/api/v3"
    
    async def connect_strava(self, user_id: str, code: str) -> dict:
        """Exchange code for access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://www.strava.com/oauth/token",
                json={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                },
            )
            response.raise_for_status()
            return response.json()
    
    async def get_athlete(self, access_token: str) -> StravaAthlete:
        """Get athlete profile."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/athlete",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()
            return StravaAthlete(**data)
    
    async def get_athlete_stats(self, athlete_id: int, access_token: str) -> StravaStats:
        """Get athlete stats."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/athletes/{athlete_id}/stats",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()
            return StravaStats(**data)
```

---

## Why Strava is Simplest

### ✅ Advantages

1. **Great API**: Well-documented REST API
2. **OAuth 2.0**: Standard auth flow
3. **Rich data**: Activities, HR, power, stats
4. **Free tier**: No cost for basic integration
5. **Popular**: Most cyclists already use it
6. **No hardware**: Works with any device

### vs Other Options

| Service | Pros | Cons |
|---------|------|------|
| **Strava** | ✅ Best API, most cyclists use it | Need OAuth setup |
| Apple Health | iOS only, complex HealthKit API | iOS only |
| Garmin Connect | Good data, athletes use it | More complex API |
| Fitbit | Easy API | Less popular with cyclists |
| Whoop | Great recovery data | Expensive, niche |

---

## Files Created

| File | Purpose |
|------|---------|
| `backend/services/strava_service.py` | Mock Strava API client |
| `backend/services/user_profile_service.py` | User profile management |
| `backend/routers/profile.py` | Profile + Strava endpoints |
| `scripts/demo_strava_integration.py` | Live demo (just ran!) |
| `docs/STRAVA_INTEGRATION.md` | This document |

---

## Next Steps

### For Hackathon Demo

1. ✅ Use 3 pre-defined users (done!)
2. ✅ Show personalized thresholds (done!)
3. Add UI: "Select your fitness level" dropdown
4. Wire thresholds into hydration classifier

### For Production

1. Register app with Strava: https://www.strava.com/settings/api
2. Get client_id and client_secret
3. Replace mock functions with real API calls
4. Store access tokens in database
5. Implement token refresh (tokens expire after 6 hours)
6. Add webhook for real-time activity updates

---

## API Endpoints

### GET /profile/{user_id}

Get user profile with personalized thresholds.

**Response**:
```json
{
  "user_id": "demo_beginner",
  "fitness_level": "beginner",
  "resting_hr": 78.0,
  "max_hr": 185.0,
  "hrv_baseline": 35.0,
  "hr_alert_threshold": 140.0,
  "hrv_alert_threshold": 25.0
}
```

### POST /profile/connect-strava

Connect Strava account (mocked for hackathon).

**Request**:
```json
{
  "user_id": "user123",
  "strava_code": "AUTHORIZATION_CODE"
}
```

**Response**:
```json
{
  "success": true,
  "athlete_id": 12345678,
  "profile": { ... }
}
```

### GET /profile/{user_id}/strava

Get Strava data for user.

**Response**:
```json
{
  "athlete": {
    "id": 12345678,
    "username": "sarah_rides",
    "firstname": "Sarah",
    "lastname": "Chen"
  },
  "stats": {
    "recent_ride_totals": {
      "count": 8,
      "distance": 120000,
      "moving_time": 20000
    }
  },
  "recent_activities": [ ... ],
  "fitness_metrics": {
    "resting_hr": 78.0,
    "ftp": 150.0,
    "fitness_level": "beginner"
  }
}
```

---

## Bottom Line

✅ **Hackathon**: 3 fake users with realistic Strava data  
✅ **Personalized**: Different thresholds for different fitness levels  
✅ **Demo-ready**: Just ran the demo, works perfectly  
✅ **Production-ready**: Clear path to real Strava OAuth  
✅ **Simplest**: Strava has the best API for cyclists  

**Same HR, different alert - personalized to YOUR fitness!** 🚴‍♂️📊
