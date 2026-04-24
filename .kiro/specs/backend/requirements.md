# Backend Requirements — PulseRoute

## Owner
Track B — Backend / Routing / Orchestration (Sai)

## Mission
Build the FastAPI backend that powers the mobile app. Own the routing math,
the weather composition, the risk classifier call, and the Accountability
Logic Gate. Keep every external API key off the client. Every response ships
with provenance.

## Stack
- Python 3.11, FastAPI + uvicorn
- Pydantic v2 for models
- httpx (async) for outbound API calls
- OSMnx + NetworkX for bike graph routing
- rasterio for MRT raster reads
- Redis (Upstash free) for caching
- Render for deploy
- pytest for tests

## Functional requirements

### FR-B1: /health endpoint
- Liveness probe: { status: "ok", version, uptime_s }
- Used by UptimeRobot for demo-time warmup pings
- Acceptance: 200 OK within 500ms

### FR-B2: POST /route
- Body: { origin, destination, depart_time, sensitive_mode, bio_session_id? }
- Returns fastest (Mapbox Directions cycling) + pulseroute (OSMnx Dijkstra, MRT-weighted)
- Fallback if Dijkstra runs out of time: Mapbox with MRT-hotspot waypoint exclusion
- Each route: polyline, distance_m, eta_seconds, peak_mrt_c, mean_mrt_c, shade_pct, stops[], segments[]
- Each segment includes forecasted conditions at ETA
- Response includes Provenance object
- Acceptance: p95 latency <2s for routes under 5km

### FR-B3: POST /risk
- Body: { bio_session_id, current_lat, current_lng, ride_minutes, baseline_hr? }
- Fetches current biosignal, ambient weather, calls HydrationService.classify()
- Constructs SafetyAlert candidate → runs SafetyGate.validate_safety_alert()
- Returns validated alert OR { fallback: true, message }
- Acceptance: returns in <500ms p95, Logic Gate 100% branch coverage

### FR-B4: GET /weather?lat=..&lng=..
- Composes: Open-Meteo hourly forecast (primary), NWS /alerts/active (secondary), AirNow (tertiary, optional)
- Each source cached in Redis with 15-min TTL
- Response: { current, forecast_hourly[6], advisories[], air_quality?, provenance }
- Graceful degradation: if Open-Meteo down, NWS still returns
- Acceptance: all sources stamped with timestamp and age_seconds

### FR-B5: GET /stops?bbox=...
- Reads cached stops.geojson from Track C
- Filters by bbox and optional amenity query param
- Acceptance: <200ms response, at least 200 fountains in Tempe bbox

### FR-B6: POST /bio/mode
- Body: { session_id, mode: "baseline"|"moderate"|"dehydrating" }
- Delegates to BioService (Track C simulator)
- Used only by debug mode in mobile app

### FR-B7: GET /bio/current?session_id=...
- Delegates to BioService
- Returns { hr, hrv_ms, skin_temp_c, timestamp, source }
- Acceptance: timestamps monotonically increasing, values in expected ranges

### FR-B8: Accountability Logic Gate
- Module: backend/safety.py
- Function: validate_safety_alert(alert: SafetyAlert) -> SafetyAlert | None
- Enforces: bio_source not None AND age_s < 60; env_source not None AND age_s < 1800; route_segment_id not None
- Logs every gate decision with reason
- Unit tests cover 6 cases: pass, no-bio, old-bio, no-env, old-env, no-segment
- Acceptance: 100% branch coverage in tests/test_logic_gate.py

### FR-B9: Provenance plumbing
- Pydantic base model: every response type has provenance: Provenance field
- Schema-level enforcement — missing provenance = validation error
- Every service function populates provenance as it goes
- Acceptance: no response in entire API can return without provenance

## Non-functional requirements
- /route p95 <2s, /risk p95 <500ms, /weather p95 <800ms cold <100ms warm
- Weather cached 15m by rounded-lat-lng, routes 60m by (origin, destination, depart_hour)
- Preload OSMnx graph + MRT raster + stops at startup
- UptimeRobot pings /health every 5 min during hackathon
- structlog JSON logs; every external call logged with latency + status; every gate decision logged

## Interfaces
- External APIs: Mapbox Directions, Open-Meteo, NWS, AirNow (optional), Overpass (startup only)
- From Track C: scoring.hydration.classify(), bio_sim.get_current(), bio_sim.set_mode(), data/stops_tempe.geojson, data/mrt_tempe.tif, data/bike_graph.pkl
- To Track A: all REST endpoints above, shared Pydantic models in shared/schemas.py

## Folder ownership
- backend/
- shared/ (schema source of truth)

## Deliverables
- Backend deployed to Render with public URL
- All 8 endpoints functional with real data by 5 PM
- Logic Gate with 6+ unit tests passing
- README section documenting every external API
- Shared schema file frozen by 11:30 AM

## Explicit non-goals
- Auth, rate limiting, multi-tenant
- Database (everything is file + Redis)
- Observability dashboards beyond logs