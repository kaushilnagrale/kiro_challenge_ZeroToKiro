# PulseRoute — Steering

## Mission
Mobile co-pilot for cyclists in hot cities. Plans cool + safe routes,
monitors biosignals from a smartwatch (real or simulated), and proactively
suggests stops to prevent dehydration and heat illness.

## Non-negotiables (Accountability Logic Gate)
1. Every route or safety recommendation rendered to the user MUST carry a
   `provenance` object with source IDs and timestamps for biosignal,
   environmental, and route data.
2. `validate_safety_alert()` in `backend/safety.py` is the gate. No alert
   reaches the UI without passing it.
3. If any required data source returns null, the UI shows
   "Sensor data unavailable — using conservative defaults." Never fabricate.

## Stack
- Mobile: React Native + Expo SDK 51, react-native-maps, NativeWind,
  Zustand, expo-location, expo-notifications
- Backend: FastAPI (Python 3.11), OSMnx, NetworkX, rasterio, httpx, Pydantic v2
- Biosignal sim: Python module emitting realistic HR/HRV/skin-temp time series
- Data: ShadeMap API, Open-Meteo, NWS, OSM Overpass, Landsat LST

## Coding conventions
- Type hints everywhere. Ruff + Black for Python. Prettier for TS/TSX.
- All API responses include `provenance: Provenance`.
- Routing math lives in one pure function `compute_route()`. No I/O.
- Tests for the safety classifier and Logic Gate run on every save.

## UI principles
- The biosignal panel is glanceable. Never more than 4 numbers visible.
- Stop notifications are non-modal cards, not full-screen interrupts.
- Color language: Green/Yellow/Red reserved for hydration risk.
  Blue = water stops, Orange = heat zones, Purple = advisories.

## Branch / commit conventions
- Branch naming: `<type>/<initial>-<desc>` — e.g. `feat/S-backend-scaffold`
- Commit style: Conventional Commits — `feat(backend): add /route endpoint`
- Every PR reviewed by one other teammate before merge
- Main is always deployable — never push directly