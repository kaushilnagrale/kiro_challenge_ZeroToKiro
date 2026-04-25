# PulseRoute — Steering

## Mission
A mobile co-pilot for cyclists in hot cities. Plans cool + safe routes,
monitors biosignals from a smartwatch (real or simulated), and proactively
suggests stops to prevent dehydration and heat illness.

## Non-negotiables (the Accountability Logic Gate)
1. Every route or safety recommendation rendered to the user MUST carry a
   `provenance` object with source IDs and timestamps for biosignal,
   environmental, and route data.
2. The function `validate_safety_alert()` in `backend/safety.py` is the gate.
   No alert reaches the UI without passing it.
3. If any required data source returns null, the UI shows
   "Sensor data unavailable — using conservative defaults." Never fabricate.
4. Cite Buo, Khan, Middel et al. (2026) "Cool Routes" methodology for the
   MRT impedance approach. We are building on validated science.

## Stack
- Mobile: React Native + Expo SDK 51, react-native-maps, NativeWind,
  Zustand, expo-location, expo-notifications, expo-speech
- Backend: FastAPI, OSMnx, NetworkX, rasterio, httpx, pydantic v2
- Biosignal sim: Python module emitting realistic HR/HRV/skin-temp time series
- Data: ShadeMap API, Open-Meteo, NWS API, OSM Overpass, optional
  ASU Cool Routes precomputed MRT rasters

## Coding conventions
- Type hints everywhere. Ruff + Black for Python. Prettier for TS/TSX.
- All API responses include `provenance: ProvenanceObj`.
- Routing math lives in one pure function `compute_routes()`. No I/O.
- Tests for the safety classifier and Logic Gate run on every save.

## UI principles
- The biosignal panel is glanceable. Never more than 4 numbers visible.
- Stop notifications are non-modal cards, not full-screen interrupts.
- Color language: Green/Yellow/Red is reserved for hydration risk. Use
  blue for water stops, orange for heat zones, purple for advisories.
