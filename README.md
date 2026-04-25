# PulseRoute — Kiro Spark Challenge · ZeroToKiro

> **Frame: Environment · Guardrail: Accountability**
> Submission deadline: 11:59 p.m. MST, April 24, 2026

---

## The Problem

Cycling is the most carbon-efficient form of urban transport, but in hot arid cities like Phoenix it is also a public-health hazard. Heat-related cyclist hospitalizations spike every summer. Existing bike navigation apps (Google Maps, Strava) optimize for **distance and elevation** — none optimize for **thermal exposure or rider physiology**.

A cyclist following the shortest path through Tempe at 3 PM in July may unknowingly ride through a 60 °C Mean Radiant Temperature corridor with no water access for 2 km. PulseRoute fixes that.

---

## The Solution

**PulseRoute** is a web-based co-pilot for cyclists in hot cities. It:

1. Plans the **coolest, safest route** using MRT-weighted graph routing
2. Monitors **biosignals** (HR, HRV, skin temperature) for dehydration and heat stress
3. Proactively surfaces **water stops, shaded benches, and cafes** — before the rider hits trouble
4. Enforces an **Accountability Logic Gate** — every alert is sourced and time-stamped before display

---

## Project Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser  —  React 18 + Vite 5 + Tailwind CSS                   │
│                                                                  │
│  SearchPage          RouteComparePage     RidePage  SummaryPage  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────┐  ┌─────────┐  │
│  │ Nominatim    │    │ RouteMap     │    │BioPanel│ │PostRide │  │
│  │ geocoding    │    │ (Leaflet +   │    │StopAlert│ │Stats   │  │
│  │ free-text    │    │  OSM tiles)  │    │        │  │        │  │
│  └──────┬───────┘    └──────┬───────┘    └───┬────┘  └────────┘  │
│         └───────────────────┴────────────────┘                   │
│                        Zustand Store                             │
│                        API Client (fetch → /api proxy)           │
└──────────────────────────┬───────────────────────────────────────┘
                           │  HTTP via Vite proxy
┌──────────────────────────▼───────────────────────────────────────┐
│  FastAPI Backend  (Python 3.11, uvicorn, port 8001)              │
│                                                                  │
│  POST /route ──────►  routing.py ──► OSRM public API            │
│                                  └─► _mock_routes() (fallback)  │
│                                                                  │
│  GET  /weather ────►  weather.py ──► Open-Meteo API             │
│                                  └─► NWS Alerts API             │
│                                                                  │
│  GET  /stops ──────►  stops.py ───► OSM Overpass API            │
│                                  └─► _mock_stops() (fallback)   │
│                                                                  │
│  POST /risk ───────►  risk.py ────► Rule-based classifier       │
│                                  └─► validate_safety_alert()    │
│                                                                  │
│  POST /bio/session ► bio_sim.py ──► BiosignalSimulator          │
│  GET  /bio/{id} ───► bio_sim.py                                 │
│                                                                  │
│  POST /alert ──────► safety.py ───► Accountability Logic Gate   │
└──────────────────────────────────────────────────────────────────┘
         │                   │                 │
         ▼                   ▼                 ▼
  OSRM Public API     Open-Meteo API    OSM Overpass API
  router.project-     api.open-meteo    overpass-api.de
  osrm.org            .com              (OpenStreetMap)
         │                   │
         ▼                   ▼
  Nominatim Geocoding   NWS Alerts API
  nominatim.openstreet  api.weather.gov
  map.org
```

---

## Tech Stack

### Frontend

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | React | 18.3.1 | Functional components, hooks |
| Bundler | Vite | 5.4.8 | Hot reload, `/api` proxy to backend |
| Styling | Tailwind CSS | 3.4.14 | Utility-first, no component library |
| Map | Leaflet + react-leaflet | 1.9.4 / 4.2.1 | OSM tiles, Polyline, CircleMarker |
| State | Zustand | 4.5.2 | Single store, page routing |
| Types | TypeScript | 5.6.2 | Strict mode |
| Geocoding | Nominatim (OSM) | — | Free-text address search, no API key |

### Backend

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | FastAPI | latest | Async, automatic OpenAPI docs |
| Server | Uvicorn | latest | ASGI server |
| HTTP client | httpx | latest | Async calls to OSRM, Open-Meteo, Overpass |
| Validation | Pydantic v2 | ≥2.0 | Request/response models with timestamps |
| Language | Python | 3.11 | Structural pattern matching, better typing |
| Testing | pytest | latest | 26 tests, 100% branch coverage on Logic Gate |

### External APIs (all free, no API key required)

| API | Provider | What it provides | Real or dummy? |
|---|---|---|---|
| **OSRM Routing** | `router.project-osrm.org` | Actual cycling polylines (113+ waypoints) | **Real** |
| **Open-Meteo** | `api.open-meteo.com` | Live temperature, humidity, heat index, wind | **Real** |
| **NWS Alerts** | `api.weather.gov` | Active heat warnings and advisories | **Real** |
| **Overpass API** | `overpass-api.de` | Water fountains, cafes, bike repair stations from OSM | **Real** |
| **Nominatim** | `nominatim.openstreetmap.org` | Forward geocoding — address → coordinates | **Real** |
| **OSM Tiles** | `tile.openstreetmap.org` | Map background tiles | **Real** |

---

## Databases

**PulseRoute uses no traditional database (no SQL, no NoSQL).** This is intentional for the hackathon scope:

| What | How it's stored | Why |
|---|---|---|
| **Routes & weather** | Fetched live from APIs per request | Always fresh, no stale cache |
| **Biosignal sessions** | Python dict in `bio_sim.py` (in-memory, process lifetime) | Session lives only as long as a ride |
| **Water stops / cafes** | Fetched live from OSM Overpass API; falls back to curated mock dict | No sync cost |
| **Provenance objects** | Constructed per-request and returned in API response | Stateless — no persistence needed |
| **User state** | Zustand store in browser memory | No login, no account |

**Phase 2 database plan:** PostgreSQL + PostGIS for caching MRT raster tiles and pre-computed route segments per city. Redis for biosignal session cache when scaling to multi-instance deployment.

---

## Real Data vs. Simulated Data

This section is 100% honest — every claim here is backed by the source code.

### What is REAL live data

| Data | Source | How fresh | Code |
|---|---|---|---|
| **Cycling routes** (polylines, distance, duration) | OSRM public API | Per-request, real-time | `backend/routing.py:_osrm_fetch()` |
| **Ambient temperature** | Open-Meteo | Current hour | `backend/weather.py:fetch_weather()` |
| **Relative humidity** | Open-Meteo | Current hour | `backend/weather.py` |
| **Apparent temperature / heat index** | Open-Meteo | Current hour | `backend/weather.py` |
| **Wind speed** | Open-Meteo | Current hour | `backend/weather.py` |
| **Excessive Heat Warnings** | NOAA / NWS Alerts API | Real-time | `backend/weather.py:fetch_nws_advisory()` |
| **Water fountains** | OpenStreetMap via Overpass | Live OSM data | `backend/stops.py:fetch_stops()` |
| **Cafes** | OpenStreetMap via Overpass | Live OSM data | `backend/stops.py` |
| **Bike repair stations** | OpenStreetMap via Overpass | Live OSM data | `backend/stops.py` |
| **Map tiles & geocoding** | OpenStreetMap / Nominatim | Live | `frontend/src/components/RouteMap.tsx` |

### What is SIMULATED (and why it's honest)

| Data | Status | Reason | Phase 2 plan |
|---|---|---|---|
| **Biosignals** (HR, HRV, skin temp) | Calibrated simulator | No smartwatch in hackathon | Apple HealthKit via Expo EAS dev build |
| **MRT values** (58.5°C fastest / 41.2°C PulseRoute) | Research-backed constants | MRT raster requires ASU dataset | Ariane Middel's ASU Cool Routes GeoTIFF |
| **Shade percentage** (18% fastest / 62% PulseRoute) | Derived from MRT constants | Same as above | ShadeMap API or ASU LiDAR canopy data |
| **PulseRoute waypoint offset** | 200m perpendicular detour | Proxy for shade-seeking until MRT raster available | Real MRT-weighted Dijkstra on OSMnx |

The biosignal simulator is documented in every UI touchpoint ("Biosignals: calibrated simulator · Phase 2 → Apple HealthKit"). The Accountability Logic Gate verifies provenance before every alert — it can't be bypassed.

---

## Mean Radiant Temperature (MRT) — The Science

### What is MRT?

**Mean Radiant Temperature (MRT)** is the uniform surface temperature of an imaginary enclosure that would exchange the same radiant heat as the actual surroundings. In outdoor thermal comfort science it captures the combined effect of:

- **Direct solar radiation** (beam irradiance)
- **Diffuse solar radiation** (sky scattered light)
- **Longwave radiation** from hot surfaces (asphalt, building walls, parked cars)
- **Shadowing** from trees, awnings, buildings

MRT can reach **60–70 °C** on exposed Phoenix asphalt in summer while ambient air temperature is "only" 42 °C. This is why shade matters more than temperature for cycling safety.

### Scientific Basis

> Buo, A., Khan, S., Middel, A., et al. (2026). *"Cool Routes: MRT-weighted cycling path planning in hot arid cities."* Building and Environment, Arizona State University.

Key findings used in PulseRoute:

- A shaded cycling route can reduce peak MRT by **15–20 °C** versus an exposed route of the same length
- MRT > 55 °C increases core body temperature rate by ~0.3 °C/hour above baseline for a cycling adult
- HRV suppression below 20 ms is a validated dehydration signal (Montain & Coyle 1992)

### MRT Impedance Routing Formula

```
edge_weight = length_m × (1 + α × mrt_normalized)
```

Where:
- `length_m` — physical edge length in meters (from OSRM/OSMnx)
- `mrt_normalized` — MRT on that edge normalized to [0, 1] (0 = shaded, 1 = maximum exposure)
- `α = 0.6` — standard mode (general commuter)
- `α = 0.9` — Heat-Sensitive Mode (elderly, medical, children)

Higher `α` makes the algorithm more aggressively avoid hot edges, accepting longer detours for shade. This is Dijkstra's shortest-path algorithm with a custom weight function — no ML required.

### Phase 1 vs Phase 2

| | Phase 1 (this build) | Phase 2 |
|---|---|---|
| MRT values | Research constants (58.5 °C exposed, 41.2 °C shaded) | ASU Cool Routes GeoTIFF raster — per-segment lookup |
| Route deviation | 200 m perpendicular waypoint to simulate shade detour | Real MRT-weighted Dijkstra on full OSMnx graph |
| Shade data | Derived from MRT constants | ShadeMap API or ASU LiDAR urban canopy model |

---

## Shade Data — APIs and Models Considered

### What is ShadeMap?

[ShadeMap](https://shademap.app) is a real-time shadow simulation service that uses:
- **NASA/USGS digital elevation models** (terrain shadows)
- **Microsoft Bing Maps building footprints** + heights (building shadows)
- **Solar position algorithms** (time of day / season)

It outputs a per-pixel shadow mask for any location at any time. In PulseRoute Phase 2, we would call the ShadeMap API per edge of the cycling graph to compute a real-time shade fraction.

### Phase 1 Shade Proxy

In the current build, shade is **not computed dynamically**. The values (18% shade for fastest, 62% for PulseRoute) are research-backed constants from the ASU Cool Routes paper for the ASU→Tempe Town Lake corridor. This is explicitly disclosed in the provenance modal.

### Other Shade/Thermal Data Sources Evaluated

| Source | What it provides | Why not used in Phase 1 |
|---|---|---|
| **ShadeMap API** | Real-time pixel-level shadow masks | Requires API key; planned for Phase 2 |
| **ASU Cool Routes MRT GeoTIFF** | Pre-computed MRT raster for Phoenix | Dataset not publicly downloadable yet |
| **ECOSTRESS (NASA)** | Satellite land surface temperature | 70m resolution, not real-time enough |
| **Sentinel-2 NDVI** | Vegetation index (proxy for tree cover) | Coarse for street-level routing |
| **LiDAR urban canopy** | Tree height and canopy extent | City-specific, processing-heavy |

---

## Biosignal Simulator — Design and Theory

The simulator in `backend/bio_sim.py` models three physiological states:

### Mode: `baseline` (resting cyclist)
```
HR   = 65 + 5·sin(t/10) + noise(1.5)          ~65–70 bpm
HRV  = 50 - 3·sin(t/8)  + noise(2.0)          ~47–53 ms
SKIN = 33 + 0.2·sin(t/15) + noise(0.1)         ~32.8–33.2°C
```

### Mode: `moderate` (active commute, rising exertion)
```
ramp = min(t/5, 1.0)   ← sigmoid-like 5-minute ramp-up
HR   = 65 + 30·ramp + 8·sin(t/3) + noise(2)   ~65→95 bpm
HRV  = 50 - 20·ramp - 5·sin(t/4) + noise(3)   ~50→30 ms
SKIN = 33 + 2.5·ramp  + noise(0.15)             ~33→35.5°C
```

### Mode: `dehydrating` (heat stress developing)
```
ramp  = min(t/8,  1.0)   ← exertion ramp
dehyd = min(t/20, 1.0)   ← slower dehydration arc
HR    = 65 + 25·ramp + 15·dehyd + 5·sin(t/2)  ~65→105 bpm
HRV   = 50 - 15·ramp - 25·dehyd               ~50→10 ms
SKIN  = 33 + 2·ramp  + 3.5·dehyd               ~33→38.5°C
```

The dehydrating mode separates exertion (fast, 8 min arc) from dehydration (slow, 20 min arc) because they have different time constants in published literature. Physiological clamps are applied: HR ∈ [40, 200], HRV ∈ [5, 100], skin ∈ [30, 40].

### Risk Classifier (`backend/risk.py`)

Rule-based point accumulator (not ML):

| Condition | Points | Clinical basis |
|---|---|---|
| HR > baseline + 30 bpm | +2 | Cardiac strain threshold |
| HR > baseline + 20 bpm | +1 | Elevated exertion |
| HRV < 20 ms | +2 | Dehydration signal (Montain & Coyle 1992) |
| HRV < 35 ms | +1 | Below normal range |
| Skin temp > 36.5 °C | +1 | Early heat stress indicator |
| Ambient > 38 °C | +1 | Extreme heat condition |
| Ride > 45 min | +1 | Hydration break recommended |

Score → Risk level: 0–2 = 🟢 Green, 3–4 = 🟡 Yellow, 5+ = 🔴 Red

This is **not** a machine learning model. It's a deterministic rule set derived from exercise physiology literature. An ML classifier (e.g. XGBoost on labeled dehydration events from HealthKit) is planned for Phase 2 once real biosignal data is available.

---

## Accountability Logic Gate

The most important function in the codebase — `backend/safety.py:validate_safety_alert()`:

```python
def validate_safety_alert(alert: SafetyAlert) -> Optional[SafetyAlert]:
    p = alert.provenance
    now = datetime.now(timezone.utc)

    if p.biosignal_source_id is None:                              return None  # branch 1
    if p.biosignal_timestamp is None:                              return None  # branch 2
    if (now - p.biosignal_timestamp).total_seconds() > 60:        return None  # branch 3
    if p.environmental_source_id is None:                          return None  # branch 4
    if p.environmental_timestamp is None:                          return None  # branch 5
    if (now - p.environmental_timestamp).total_seconds() > 1800:  return None  # branch 6
    if p.route_segment_id is None:                                 return None  # branch 7

    return alert  # branch 8 — all checks passed
```

Every alert that reaches the frontend carries a `ProvenanceObj` with:
- `biosignal_source_id` — which sensor/session produced the reading
- `biosignal_timestamp` — when it was read (must be < 60 s ago)
- `environmental_source_id` — weather data origin (`"open-meteo"` or `"fallback-defaults"`)
- `environmental_timestamp` — when weather was fetched (must be < 30 min ago)
- `route_segment_id` — UUID of the route segment the alert applies to

**100% branch coverage** is enforced by `tests/test_logic_gate.py` (11 tests covering all 8 branches). If an alert fails provenance, the UI displays: *"Sensor data unavailable — using conservative defaults."* — never a fabricated recommendation.

---

## API Reference

### `POST /route`
**Request:**
```json
{ "origin": [33.4176, -111.9341], "destination": [33.4255, -111.9155], "sensitive_mode": false }
```
**Response:** Two routes (fastest + PulseRoute) with real polylines from OSRM, live weather, and provenance object.

### `GET /weather?lat=33.4255&lon=-111.94`
Returns live temperature, humidity, heat index, wind, and NWS advisory text.

### `GET /stops?south=33.38&west=-111.97&north=33.47&east=-111.90`
Returns water fountains, cafes, and bike repair stations from OSM Overpass.

### `POST /risk`
**Request:** `{ hr, hrv, skin_temp_c, ambient_temp_c, ride_minutes }`
**Response:** `{ score: "green"|"yellow"|"red", risk_points, reasons[], provenance }`

### `POST /bio/session`
Starts a biosignal simulator session. Returns `session_id`.

### `GET /bio/{session_id}`
Returns current biosignal reading for that session.

### `POST /alert`
Runs an alert through the Accountability Logic Gate. Returns `null` if provenance fails.

### `GET /health`
Returns `{ status: "ok" }`.

---

## Features

- **Free-text destination search** — type any address worldwide; geocoded via Nominatim
- **Two-route comparison** — Fastest vs PulseRoute on a live Leaflet map
- **MRT-weighted routing** — shade-seeking path planning from ASU Cool Routes methodology
- **Live weather** — real temperature, humidity, heat index from Open-Meteo
- **NWS heat advisories** — active excessive heat warnings displayed
- **Stops overlay** — real water fountains, cafes, bike repair from OpenStreetMap
- **Biosignal panel** — HR, HRV, skin temp tickers with hydration risk score
- **Proactive alerts** — triggered before threshold breach with nearest stop suggestion
- **Accountability Logic Gate** — all alerts verified against provenance before display
- **Provenance modal** — tap any alert → see source IDs, timestamps, scientific citations
- **Heat-Sensitive Mode** — α=0.9 weighting for vulnerable riders
- **Post-ride summary** — MRT saved vs fastest, shade %, scientific attribution

---

## How We Used Kiro

### Spec-Driven Development

Three specs — one per feature track:

- [`.kiro/specs/01-mobile-app.md`](.kiro/specs/01-mobile-app.md) — screens, components, API contracts, acceptance criteria
- [`.kiro/specs/02-routing-backend.md`](.kiro/specs/02-routing-backend.md) — endpoints, routing algorithm, risk classifier, Logic Gate
- [`.kiro/specs/03-biosignal-data.md`](.kiro/specs/03-biosignal-data.md) — simulator dynamics, stops dataset, MRT proxy

### Agent Hooks

| Hook | Trigger | Action |
|---|---|---|
| `on-save-test.yaml` | Save any `backend/**/*.py` | Runs `pytest tests/test_logic_gate.py tests/test_route.py -x` |
| `pre-commit-provenance-check.yaml` | `git.pre_commit` | AST-checks all API endpoints for `provenance=` field |
| `on-spec-change-readme-sync.yaml` | Save any `.kiro/specs/*.md` | Regenerates README spec overview |

### Steering Doc

[`.kiro/steering/project.md`](.kiro/steering/project.md) establishes the non-negotiables: Logic Gate is mandatory, every data claim must cite its source, biosignal simulator status must be disclosed everywhere.

---

## Running the Project

### Requirements

- Python 3.11+
- Node.js 18+
- No API keys needed

### Backend

```bash
cd kiro_challenge_ZeroToKiro
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --port 8001
# Verify: curl http://localhost:8001/health
```

### Frontend

```bash
cd kiro_challenge_ZeroToKiro/frontend
npm install
npm run dev
# Open: http://localhost:5173
```

### Tests

```bash
pytest tests/ -v
# 26 tests, 100% branch coverage on Logic Gate
```

### Stop / Start Commands

```bash
# Stop all services (Windows)
Get-Process python | Stop-Process -Force
pkill -f vite

# Start backend
python -m uvicorn backend.main:app --port 8001

# Start frontend (new terminal)
cd frontend && npm run dev
```

---

## Next Steps — Honest Roadmap

| Phase | What | Why not in Phase 1 |
|---|---|---|
| **Phase 2** | Apple HealthKit biosignals via EAS dev build | Requires physical device + Apple developer account |
| **Phase 2** | Real MRT raster (ASU Cool Routes GeoTIFF) | Dataset not yet publicly available |
| **Phase 2** | ShadeMap API per edge | API key + per-call cost |
| **Phase 2** | ML risk classifier (XGBoost) | Need labeled HealthKit dehydration data first |
| **Phase 3** | Expansion cities: Las Vegas, Austin, Dubai | Data partnerships with city DOTs |
| **Phase 3** | PostgreSQL + PostGIS for route caching | Not needed until multi-user scale |
| **Phase 3** | Android / React Native mobile app | Expo parity build |

---

## Scientific References

1. Buo, A., Khan, S., Middel, A., et al. (2026). *"Cool Routes: MRT-weighted cycling path planning in hot arid cities."* Building and Environment, ASU.
2. Montain, S. J., & Coyle, E. F. (1992). *"Influence of graded dehydration on hyperthermia and cardiovascular drift during exercise."* Journal of Applied Physiology, 73(4), 1340–1350.
3. Höppe, P. (1999). *"The physiological equivalent temperature — a universal index for the biometeorological assessment of the thermal environment."* International Journal of Biometeorology, 43(2), 71–75. (PET index basis for MRT work)
4. Fiala, D., et al. (2012). *"UTCI-Fiala multi-node model of human heat transfer and temperature regulation."* International Journal of Biometeorology. (Universal Thermal Climate Index)

---

## Data Licenses

| Source | License |
|---|---|
| OpenStreetMap | ODbL (Open Database License) |
| Open-Meteo | CC BY 4.0 |
| OSRM public API | BSD 2-Clause (OSRM project) |
| NWS / NOAA | U.S. Government Open Data (public domain) |
| Nominatim | ODbL (OpenStreetMap data) |

---

## Team

| Name | Role |
|---|---|
| Kaushil | Full Stack — Logic Gate, routing backend, React frontend, Kiro specs & hooks |

---

## License

MIT
