# Backend Design — PulseRoute (Hackathon Build)

## Overview

FastAPI backend serving the PulseRoute mobile app. All external API keys stay
server-side. Every response carries a `Provenance` object. The Accountability
Logic Gate (`safety.py`) is the only path to the UI for safety alerts.

Track C (biosignal simulator, OSMnx graph, MRT raster, stops GeoJSON) is not
yet available. All Track C dependencies are hidden behind service interfaces
with stub implementations that Track C can replace without touching any router
or caller.

---

## High-Level Architecture

```
Mobile App (Track A)
        │  REST
        ▼
┌─────────────────────────────────────────────────────┐
│                  FastAPI  (backend/main.py)          │
│                                                      │
│  /health   /weather   /stops   /bio/*                │
│  /route    /risk                                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              Service Layer                   │   │
│  │                                              │   │
│  │  BioService      StopsService                │   │
│  │  WeatherService  MrtService                  │   │
│  │  RouteService    HydrationService            │   │
│  │  SafetyGate      CacheService                │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  In-process dict cache (swap to Redis: 0 callers)   │
└─────────────────────────────────────────────────────┘
        │                    │
   External APIs         Static data
   Open-Meteo            data/stops_seed.json
   NWS Alerts            data/tempe_zones.json
   Mapbox Directions
   AirNow (optional)
```

---

## Module Map

```
backend/
  main.py                  # FastAPI app, lifespan, router mounts
  safety.py                # validate_safety_alert() — Logic Gate
  routers/
    health.py
    weather.py
    stops.py
    bio.py
    route.py
    risk.py
  services/
    cache.py               # InProcessCache — get/setex interface
    bio_service.py         # BioService (stub)
    stops_service.py       # StopsService (stub, hardcoded seed)
    weather_service.py     # WeatherService (real: Open-Meteo + NWS)
    mrt_service.py         # MrtService (stub, curated zones)
    route_service.py       # RouteService (Mapbox + MRT annotation)
    hydration_service.py   # HydrationService (rule-based classify)
shared/
  schema.py                # Pydantic models — source of truth
data/
  stops_seed.json          # ~20 hardcoded Tempe stops
  tempe_zones.json         # MRT hot/cool zone polygons
tests/
  test_logic_gate.py       # 6 branch-coverage tests (non-negotiable)
  test_weather.py
  test_bio.py
  test_stops.py
  test_route.py
  test_risk.py
```

---

## Service Interfaces

All services are instantiated once at startup and injected via FastAPI
dependency injection or module-level singletons.

### CacheService (`backend/services/cache.py`)

```python
class CacheService:
    def get(self, key: str) -> Any | None: ...
    def setex(self, key: str, ttl_seconds: int, value: Any) -> None: ...
```

Backed by `dict[str, (value, expires_at)]`. Redis-compatible interface —
swap implementation without touching callers.

### BioService (`backend/services/bio_service.py`)

```python
class BioService:
    def get_current(self, session_id: str) -> Biosignal: ...
    def set_mode(self, session_id: str, mode: BioMode) -> None: ...
```

Stub: maintains per-session state dict. HR drifts upward over time based on
mode. `dehydrating` → HR 155–175, HRV 18–28, skin_temp 37.8–38.5.
`moderate` → HR 130–150, HRV 30–45, skin_temp 36.8–37.4.
`baseline` → HR 65–85, HRV 55–75, skin_temp 36.2–36.8.

### StopsService (`backend/services/stops_service.py`)

```python
class StopsService:
    def get_stops(self, bbox: tuple[float,float,float,float],
                  amenity: str | None) -> StopsResponse: ...
```

Stub: loads `data/stops_seed.json` at startup. Seed contains ~20 Tempe stops
across four tiers:
- **official** — city water fountains (Tempe Beach Park, Papago Park)
- **fountain** — drinking fountains at ASU buildings
- **commercial** — Starbucks, QT, convenience stores on Mill Ave
- **public** — shaded bus shelters, library

### WeatherService (`backend/services/weather_service.py`)

```python
class WeatherService:
    async def get_weather(self, lat: float, lng: float) -> WeatherResponse: ...
```

Real implementation:
1. Check cache (key = `weather:{round(lat,2)}:{round(lng,2)}`, TTL 15 min)
2. Fetch Open-Meteo hourly (primary)
3. Fetch NWS `/alerts/active?point={lat},{lng}` (secondary)
4. Optionally fetch AirNow (tertiary, skip on timeout)
5. Compose `WeatherResponse` with `Provenance`
6. Cache and return

Graceful degradation: if Open-Meteo fails, return NWS-only with
`provenance.env_source` reflecting NWS timestamp.

### MrtService (`backend/services/mrt_service.py`)

```python
class MrtService:
    def get_mrt(self, lat: float, lng: float,
                ambient_temp_c: float) -> float: ...
    def annotate_route(self, polyline: list[tuple[float,float]],
                       ambient_temp_c: float) -> tuple[float, float]: ...
        # returns (peak_mrt_c, mean_mrt_c)
```

Stub: hand-curated Tempe zones loaded from `data/tempe_zones.json`.

**Hot zones** (zone_delta = +8 to +14 °C above ambient+8 base):
- Mill Ave corridor (33.4255, -111.9400) r=400m, delta=+6
- ASU Surface Parking Lot 59 (33.4195, -111.9340) r=300m, delta=+8
- Apache Blvd & Rural Rd intersection (33.4148, -111.9260) r=250m, delta=+5
- Tempe Marketplace parking (33.4050, -111.9090) r=350m, delta=+7
- University Dr & Rural Rd (33.4215, -111.9265) r=200m, delta=+4

**Cool zones** (zone_delta = −4 to −8 °C):
- Papago Park canopy (33.4508, -111.9498) r=600m, delta=−7
- Tempe Town Lake north shore (33.4285, -111.9498) r=500m, delta=−5
- ASU Palm Walk (33.4215, -111.9390) r=200m, delta=−4
- Tempe Beach Park (33.4285, -111.9498) r=300m, delta=−6

Formula: `mrt = ambient_temp_c + 8.0 + zone_delta_if_inside(lat, lng)`
Default (no zone): `mrt = ambient_temp_c + 8.0`

### RouteService (`backend/services/route_service.py`)

```python
class RouteService:
    async def compute_route(self, req: RouteRequest,
                            weather: WeatherResponse) -> RouteResponse: ...
```

Two routes returned:

**fastest** — Mapbox Directions cycling profile, direct.

**pulseroute** — Mapbox Directions cycling profile with waypoints injected
through nearest cool zone(s). Segments annotated with MRT via MrtService.
`shade_pct` estimated from cool-zone overlap ratio.

Both routes get `peak_mrt_c`, `mean_mrt_c` from MrtService.annotate_route().
Cache key: `route:{origin}:{destination}:{depart_hour}`, TTL 60 min.

### HydrationService (`backend/services/hydration_service.py`)

```python
class HydrationService:
    def classify(self, bio: Biosignal, context: RideContext,
                 weather: WeatherSnapshot) -> RiskScore: ...
```

Rule-based (inline, no ML):

| Condition | Points | Level |
|---|---|---|
| HR > 170 | +40 | — |
| HR > 155 | +25 | — |
| HR > 140 | +10 | — |
| skin_temp > 38.0 | +30 | — |
| skin_temp > 37.5 | +15 | — |
| HRV < 20 | +20 | — |
| HRV < 35 | +10 | — |
| ride_minutes > 45 | +10 | — |
| heat_index > 40 | +15 | — |
| heat_index > 35 | +8 | — |

Total points → level: 0–19 = green, 20–44 = yellow, 45+ = red.

### SafetyGate (`backend/safety.py`)

```python
def validate_safety_alert(alert: SafetyAlert) -> SafetyAlert | None: ...
```

Gate rules (all must pass):
1. `alert.provenance.bio_source` is not None
2. `alert.provenance.bio_source.age_seconds < 60`
3. `alert.provenance.env_source` is not None
4. `alert.provenance.env_source.age_seconds < 1800`
5. `alert.provenance.route_segment_id` is not None

Returns `SafetyAlert` if all pass, `None` if any fail. Logs every decision
with structlog including which rule failed.

---

## Caching Strategy

| Resource | Key pattern | TTL |
|---|---|---|
| Weather | `weather:{lat2}:{lng2}` | 900s (15 min) |
| Route | `route:{origin}:{dest}:{hour}` | 3600s (60 min) |
| Stops | `stops:all` | 86400s (24 hr, static) |
| Bio | not cached (always live) | — |

---

## Provenance Plumbing

Every service function that touches external data creates a `SourceRef`:

```python
SourceRef(
    source_id="open-meteo",
    timestamp=datetime.utcnow(),
    age_seconds=0
)
```

Cached responses recalculate `age_seconds` at read time:
`age_seconds = int((datetime.utcnow() - cached_timestamp).total_seconds())`

---

## Startup Sequence (`lifespan`)

1. Initialize `CacheService`
2. Load `StopsService` (reads stops_seed.json)
3. Load `MrtService` (reads tempe_zones.json)
4. Log startup complete with structlog

No OSMnx graph load — not needed with Mapbox stub routing.

---

## Error Handling

- External API timeout (5s default): log + return graceful degraded response
- Missing optional source (AirNow): omit field, note in provenance
- Logic Gate fail: return `RiskResponse(fallback=True, fallback_message="Sensor data unavailable — using conservative defaults.")`

---

## Implementation Notes

| Service | Status | Notes |
|---|---|---|
| WeatherService | **Production** | Real Open-Meteo + NWS calls |
| RouteService | **Reference impl** | Mapbox real; MRT annotation is zone-based stub |
| MrtService | **Reference impl** | Hand-curated zones; replace with rasterio when Track C delivers |
| StopsService | **Reference impl** | Hardcoded seed; replace with stops_tempe.geojson from Track C |
| BioService | **Reference impl** | In-process simulator; replace with Track C bio_sim |
| HydrationService | **Reference impl** | Rule-based; replace with scoring.hydration.classify() from Track C |
| SafetyGate | **Production** | Full Logic Gate — non-negotiable |
| CacheService | **Production** | In-process dict; swap to Redis by changing one class |
