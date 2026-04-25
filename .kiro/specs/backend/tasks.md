# Backend Tasks — PulseRoute (Hackathon Build)

Target: all 10 tasks done by 3 PM MVP checkpoint.

## Ownership rules for Wave 2 and Wave 3 subagents
- Each subagent creates ONLY its own router file in `backend/routers/<name>.py`
- Each subagent creates ONLY its own service file in `backend/services/<name>_service.py`
- Each subagent creates ONLY its own test file in `backend/tests/test_<name>.py`
- Each subagent creates ONLY its own data file in `data/<specific_file>.json` if needed
- **NO subagent may touch**: `main.py`, `conftest.py`, `shared/schema.py`, `backend/services/cache.py`, or any `__init__.py`
- If a subagent believes it needs to touch a shared file, it halts and reports back

## Wave barriers
- Wave 2 starts only after Task 1 completes AND `python -m pytest backend/tests/test_cache.py` passes
- Wave 3 starts only after all 4 Wave 2 subagents return DONE
- Task 9 runs only after Task 8 returns DONE
- Task 10 runs only after Task 9 returns DONE

---

## Wave 1 — Sequential (blocking)

- [x] 1. Coordination scaffold — all shared files Wave 2/3 subagents must never touch
  - [x] 1.1 Create all `__init__.py` files: `backend/__init__.py`, `backend/routers/__init__.py`, `backend/services/__init__.py`, `backend/tests/__init__.py`, `backend/tests/fixtures/__init__.py` — all empty
  - [x] 1.2 Create `backend/main.py` with lazy router registration via `importlib` + try/except — pre-wires health, bio, stops, weather, mrt, route, risk routers; logs warning and skips if module not yet present
  - [x] 1.3 Create `backend/tests/conftest.py` with shared fixtures: `mock_cache`, `sample_weather_snapshot`, `sample_biosignal`, `sample_provenance`, `frozen_time` (freezegun) — Wave 2/3 subagents import from here, never modify it
  - [x] 1.4 Verify `shared/schema.py` imports cleanly: run `python -c "from shared.schema import Provenance, Route, SafetyAlert"` — fix any missing `__init__.py` in `shared/` if needed
  - [x] 1.5 Create `backend/services/cache.py` — `InProcessCache` with `get(key)` / `setex(key, ttl_s, value)` interface; TTL eviction on read; backed by `dict[str, tuple[Any, float]]`; expose module-level `cache` singleton
  - [x] 1.6 Create `backend/tests/test_cache.py` — tests: set+get hit, TTL expiry returns None, key miss returns None
  - [x] 1.7 Create `backend/routers/health.py` — GET /health returning `HealthResponse(status="ok", version="0.1.0", uptime_s=...)`
  - [x] 1.8 Create `data/.gitkeep` so `data/` directory exists for Wave 2 writers
  - [x] 1.9 Create `backend/requirements.txt` with pinned deps: fastapi==0.111.0, uvicorn==0.29.0, httpx==0.27.0, pydantic==2.7.1, structlog==24.1.0, pytest==8.2.0, pytest-asyncio==0.23.6, freezegun==1.5.0
  - [x] 1.10 Run `python -m pytest backend/tests/test_cache.py -v` — must pass before Wave 2 starts

---

## Wave 2 — Parallel (4 subagents simultaneously, after Task 1 complete)

- [x] 3. Stub BioService + /bio/mode + /bio/current endpoints
  - [x] 3.1 Create `backend/services/bio_service.py` — `BioService` with `get_current(session_id: str) -> Biosignal` and `set_mode(session_id: str, mode: BioMode) -> None`
  - [x] 3.2 Stub internals: per-session state dict; HR/HRV/skin_temp drift based on mode — baseline: HR 65–85, HRV 55–75, skin_temp 36.2–36.8; moderate: HR 130–150, HRV 30–45, skin_temp 36.8–37.4; dehydrating: HR 155–175, HRV 18–28, skin_temp 37.8–38.5
  - [x] 3.3 Create `backend/routers/bio.py` — POST /bio/mode and GET /bio/current?session_id=...
  - [x] 3.4 Both endpoints return provenance with `bio_source` SourceRef (source_id = `"sim_{mode}"`)
  - [x] 3.5 Import fixtures from `backend/tests/conftest.py`; write `backend/tests/test_bio.py` — test mode transitions, value ranges, monotonic timestamps

- [x] 4. Stub StopsService + /stops endpoint
  - [x] 4.1 Create `data/stops_seed.json` with ~20 Tempe stops across 4 tiers: official (city fountains at Tempe Beach Park, Papago Park), fountain (ASU buildings), commercial (Mill Ave Starbucks/QT), public (shaded shelters/library)
  - [x] 4.2 Each stop matches `Stop` schema: id, name, lat, lng, amenities[], source, source_ref
  - [x] 4.3 Create `backend/services/stops_service.py` — `StopsService` loads seed at init, `get_stops(bbox, amenity) -> StopsResponse`
  - [x] 4.4 Create `backend/routers/stops.py` — GET /stops?bbox=lat_min,lng_min,lat_max,lng_max&amenity=...
  - [x] 4.5 Response includes provenance with env_source stamped at load time
  - [x] 4.6 Import fixtures from `backend/tests/conftest.py`; write `backend/tests/test_stops.py` — test bbox filter, amenity filter, at least 5 water stops in Tempe bbox

- [x] 5. WeatherService with real Open-Meteo + NWS + provenance + cache
  - [x] 5.1 Create `backend/services/weather_service.py` — `WeatherService` with `async get_weather(lat: float, lng: float) -> WeatherResponse`
  - [x] 5.2 Open-Meteo: fetch hourly temp/humidity/uv_index; map to `WeatherSnapshot` + `WeatherHourly[6]`
  - [x] 5.3 NWS: fetch `/alerts/active?point={lat},{lng}`; map to `Advisory[]`
  - [x] 5.4 AirNow: optional; skip gracefully on timeout or missing `AIRNOW_API_KEY` env var
  - [x] 5.5 Cache via imported `cache` singleton: key `weather:{round(lat,2)}:{round(lng,2)}`, TTL 900s; recalculate `age_seconds` on cache hit
  - [x] 5.6 Provenance: `env_source` SourceRef with source_id="open-meteo" (or "nws" if Open-Meteo fails)
  - [x] 5.7 Create `backend/routers/weather.py` — GET /weather?lat=..&lng=..
  - [x] 5.8 Import fixtures from `backend/tests/conftest.py`; write `backend/tests/test_weather.py` — mock httpx, test cache hit/miss, graceful degradation when Open-Meteo returns 500

- [x] 6. Stub MrtService with hand-curated Tempe hot/cool zones
  - [x] 6.1 Create `data/tempe_zones.json` with 5 hot zones and 4 cool zones (name, center_lat, center_lng, radius_m, delta_c) per design.md
  - [x] 6.2 Create `backend/services/mrt_service.py` — `MrtService` loads zones at init
  - [x] 6.3 `get_mrt(lat, lng, ambient_temp_c) -> float` — point-in-circle check; `mrt = ambient + 8.0 + zone_delta`; first matching zone wins; default delta=0
  - [x] 6.4 `annotate_route(polyline, ambient_temp_c) -> tuple[float, float]` — samples every ~100m, returns `(peak_mrt_c, mean_mrt_c)`
  - [x] 6.5 Write `backend/tests/test_mrt.py` — test point inside hot zone, inside cool zone, outside all zones, route annotation peak > mean

---

## Wave 3 — Parallel (2 subagents simultaneously, after all Wave 2 DONE)

- [x] 7. RouteService — Mapbox fastest + pulseroute with cool-zone detour + MRT annotation
  - [x] 7.1 Create `backend/services/route_service.py` — `RouteService` with `async compute_route(req: RouteRequest, weather: WeatherResponse) -> RouteResponse`
  - [x] 7.2 **fastest**: Mapbox Directions cycling profile origin→destination; decode polyline; annotate with MrtService
  - [x] 7.3 **pulseroute**: find nearest cool zone to route midpoint; inject as waypoint; call Mapbox again; annotate with MrtService
  - [x] 7.4 Both routes: populate `RouteSegment[]` (~500m splits, each with mrt_mean_c, forecasted_temp_c from weather)
  - [x] 7.5 `shade_pct` = fraction of polyline points inside cool zones × 100
  - [x] 7.6 `stops[]` = StopsService.get_stops(route_bbox, "water") top 3 nearest
  - [x] 7.7 Cache via imported `cache` singleton: key `route:{origin}:{dest}:{depart_hour}`, TTL 3600s
  - [x] 7.8 Provenance: route_segment_id = first segment id; env_source from weather provenance; bio_source from BioService if bio_session_id provided
  - [x] 7.9 Create `backend/routers/route.py` — POST /route accepting `RouteRequest`, returning `RouteResponse`
  - [x] 7.10 Write `backend/tests/test_route.py` — mock Mapbox, assert pulseroute mean_mrt_c < fastest mean_mrt_c for route through hot zones

- [ ] 8. HydrationService — rule-based classify()
  - [x] 8.1 Create `backend/services/hydration_service.py` — `HydrationService` with `classify(bio: Biosignal, context: RideContext, weather: WeatherSnapshot) -> RiskScore`
  - [x] 8.2 Point scoring: HR>170→+40, HR>155→+25, HR>140→+10; skin_temp>38.0→+30, >37.5→+15; HRV<20→+20, <35→+10; ride_minutes>45→+10; heat_index>40→+15, >35→+8
  - [x] 8.3 Map total points → RiskLevel: 0–19=green, 20–44=yellow, 45+=red
  - [x] 8.4 `all_reasons` = human-readable string per triggered condition; `top_reason` = highest-scoring single condition
  - [x] 8.5 Write `backend/tests/test_hydration.py` — test green/yellow/red boundaries, all_reasons populated, top_reason correct

---

## Wave 4 — Sequential (main agent)

- [x] 9. SafetyGate validate_safety_alert() + 6 branch-coverage tests
  - [x] 9.1 Create `backend/safety.py` — `validate_safety_alert(alert: SafetyAlert) -> SafetyAlert | None`
  - [x] 9.2 Rule 1: `bio_source is not None` → else structlog + return None
  - [x] 9.3 Rule 2: `bio_source.age_seconds < 60` → else structlog + return None
  - [x] 9.4 Rule 3: `env_source is not None` → else structlog + return None
  - [x] 9.5 Rule 4: `env_source.age_seconds < 1800` → else structlog + return None
  - [x] 9.6 Rule 5: `route_segment_id is not None` → else structlog + return None
  - [x] 9.7 All pass: structlog success + return alert; log fields: result, rule_failed, session context
  - [x] 9.8 Create `backend/tests/test_logic_gate.py` with exactly 6 tests: test_gate_pass, test_gate_no_bio, test_gate_old_bio, test_gate_no_env, test_gate_old_env, test_gate_no_segment
  - [x] 9.9 Run `python -m pytest backend/tests/test_logic_gate.py --cov=backend/safety --cov-report=term` — must show 100% branch coverage

- [x] 10. Wire /risk endpoint + README
  - [x] 10.1 Create `backend/routers/risk.py` — POST /risk accepting `RiskRequest`, returning `RiskResponse`
  - [x] 10.2 /risk flow: BioService.get_current() → WeatherService.get_weather() → HydrationService.classify() → build SafetyAlert candidate → SafetyGate.validate_safety_alert() → return RiskResponse
  - [x] 10.3 Gate returns None → `RiskResponse(fallback=True, fallback_message="Sensor data unavailable — using conservative defaults.")`
  - [x] 10.4 Verify /route router is fully wired (RouteService.compute_route called, RouteResponse returned with provenance)
  - [x] 10.5 Smoke test: POST /risk with dehydrating session → red alert with provenance
  - [x] 10.6 Smoke test: POST /route → pulseroute mean_mrt_c < fastest mean_mrt_c
  - [x] 10.7 Add "Implementation Notes" section to README.md (reference vs production services table)
  - [x] 10.8 Add API endpoint table to README.md (method, path, description, latency target)
  - [x] 10.9 Run full test suite `python -m pytest backend/tests/ -v` — all tests pass

---

## Post-MVP (after 3 PM checkpoint)

- [ ]* Coverage audit — fill gaps to reach >80% overall
- [ ]* Reviewer audit — read-only pass against steering rules
- [ ]* Deploy to Render — add render.yaml, verify /health on public URL
- [ ]* Swap CacheService to Upstash Redis if needed
