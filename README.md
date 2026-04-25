# PulseRoute

**A mobile co-pilot for cyclists in hot cities.** PulseRoute plans the coolest
and safest route between two points, monitors rider biosignals from a
smartwatch (real or simulated), and proactively suggests cool-down stops
before heat illness hits.

Built for the **Kiro Spark Challenge** at ASU, April 24, 2026.

---

## The problem

Phoenix recorded 645 heat-related deaths in 2023. Cyclists are uniquely
exposed — existing navigation apps optimize for distance, not thermal
exposure or rider physiology. A cyclist following the shortest path through
Tempe at 3 PM in July may unknowingly ride into a 60°C mean radiant
temperature corridor with no water access for two kilometers.

PulseRoute closes this gap.

## What makes it different

Three signals fused into one consumer app for the first time:

1. **Environmental** — Mean Radiant Temperature, shade coverage, heat advisories
2. **Infrastructural** — Water fountains, shaded rest stops, cafes, bike repair
3. **Physiological** — Heart rate, HRV, skin temperature → hydration risk score

When the model detects elevated risk, it suggests the right stop at the right
moment. Every recommendation carries a `provenance` object citing its sources.
If any source is unavailable, the app refuses to fabricate — it tells the user.

## The Accountability Logic Gate

Our environment-frame guardrail is a literal piece of code, not a slogan.
`backend/safety.py::validate_safety_alert()` refuses to render any safety
alert unless biosignal, environmental, and route data are all present and
fresh. This file has 100% branch coverage in its tests.

## Repo structure


---

## Backend API Endpoints

| Method | Path | Description | Latency Target |
|--------|------|-------------|----------------|
| GET | `/health` | Liveness probe — status, version, uptime | <500ms |
| POST | `/bio/mode` | Set biosignal simulation mode (baseline/moderate/dehydrating) | <100ms |
| GET | `/bio/current` | Get current biosignal reading for a session | <100ms |
| GET | `/stops` | Get water stops, cafes, repair shops filtered by bbox and amenity | <200ms |
| GET | `/weather` | Get current weather, 6-hour forecast, NWS advisories, optional AirNow AQI | <800ms cold, <100ms warm (cached) |
| POST | `/route` | Compute fastest and pulseroute cycling routes with MRT annotation | <2s p95 |
| POST | `/risk` | Assess hydration risk from biosignal + weather + ride context, return validated SafetyAlert | <500ms p95 |

All endpoints return responses with a `provenance` object citing data sources and timestamps.

---

## Implementation Notes

This is a **hackathon build** completed in one day. Some services are reference implementations that will be replaced with production-grade components when Track C (data pipeline) delivers.

| Service | Status | Notes |
|---------|--------|-------|
| **WeatherService** | ✅ Production | Real Open-Meteo + NWS API calls with graceful degradation |
| **SafetyGate** | ✅ Production | Full Accountability Logic Gate with 100% branch coverage — non-negotiable |
| **CacheService** | ✅ Production | In-process dict with Redis-compatible interface; swap to Upstash by changing one class |
| **RouteService** | ⚠️ Reference impl | Mapbox Directions API is real; MRT annotation uses hand-curated zone stubs |
| **MrtService** | ⚠️ Reference impl | Hand-curated Tempe hot/cool zones; replace with rasterio raster lookup when LST data ready |
| **StopsService** | ⚠️ Reference impl | Hardcoded 18-stop seed; replace with `stops_tempe.geojson` from Track C |
| **BioService** | ⚠️ Reference impl | In-process simulator with mode-based drift; replace with Track C `bio_sim` module |
| **HydrationService** | ⚠️ Reference impl | Rule-based point scoring; replace with `scoring.hydration.classify()` from Track C |

**Reference implementations** have the correct interface signatures and return the correct schema types. Track C can drop in production code without touching any router or caller.

---

## Running the backend

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Set environment variables
export MAPBOX_ACCESS_TOKEN=your_token_here
# Optional: export AIRNOW_API_KEY=your_key_here

# Run the server
uvicorn backend.main:app --reload

# Run tests
python -m pytest backend/tests/ -v

# Run tests with coverage
python -m pytest backend/tests/ --cov=backend --cov-report=term
```

Backend will be available at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

---

## External APIs

- **Mapbox Directions API** — cycling routes with turn-by-turn geometry
- **Open-Meteo** — hourly weather forecast (temp, humidity, UV index) — no API key required
- **NWS (National Weather Service)** — active weather alerts and advisories — no API key required
- **AirNow** — air quality index (optional) — requires API key from airnow.gov

---

## Testing

All backend services have unit tests with mocked external API calls (no real network traffic during tests).

**Test coverage**: 60 tests passing, 100% branch coverage on SafetyGate.

```bash
# Run all tests
python -m pytest backend/tests/ -v

# Run specific test file
python -m pytest backend/tests/test_logic_gate.py -v

# Run with coverage
python -m pytest backend/tests/ --cov=backend.safety --cov-report=term
```

---

## License

MIT
